-- ============================================
-- MIGRATION M61: LOGIQUE FACTURATION MULTI-DEVISE
-- Date: 2026-01-09
-- Version: Adaptation TVA selon devise EUR/CHF
-- Objectif: Adapter les RPC functions pour calculer la TVA selon la devise
-- ============================================

-- ============================================
-- PARTIE 1: MISE À JOUR generate_facture_from_mission
-- ============================================

-- Supprimer l'ancienne version
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID, DECIMAL, DATE, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_facture_from_mission;

/**
 * Génère une facture pour une mission validée
 * ADAPTÉ MULTI-DEVISE : TVA automatique selon devise (20% EUR, 8.1% CHF)
 * 
 * @param p_mission_id UUID de la mission
 * @param p_montant_ht Montant HT de la facture
 * @param p_description Description optionnelle
 * @param p_iban IBAN pour paiement
 * @return JSON avec facture_id et détails
 */
CREATE OR REPLACE FUNCTION generate_facture_from_mission(
  p_mission_id UUID,
  p_montant_ht DECIMAL DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
  v_facture_id UUID;
  v_numero TEXT;
  v_year TEXT;
  v_seq INT;
  v_regie_id UUID;
  v_regie_currency TEXT;
  v_taux_tva DECIMAL;
  v_taux_commission DECIMAL := 10.00; -- Commission JETC 10%
BEGIN
  -- ========================================
  -- ÉTAPE 1: Vérifier la mission
  -- ========================================
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission non trouvée';
  END IF;
  
  -- Vérifier statut mission
  IF v_mission.statut NOT IN ('terminee', 'validee') THEN
    RAISE EXCEPTION 'La mission doit être terminée ou validée (statut actuel: %)', v_mission.statut;
  END IF;
  
  -- Vérifier qu'aucune facture n'existe déjà
  IF EXISTS (SELECT 1 FROM factures WHERE mission_id = p_mission_id) THEN
    RAISE EXCEPTION 'Une facture existe déjà pour cette mission';
  END IF;
  
  -- ========================================
  -- ÉTAPE 2: Récupérer la régie et sa devise
  -- ========================================
  SELECT t.regie_id INTO v_regie_id
  FROM tickets t
  WHERE t.id = v_mission.ticket_id;
  
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de déterminer la régie de la mission';
  END IF;
  
  -- Récupérer la devise de la régie (source de vérité)
  SELECT currency INTO v_regie_currency
  FROM regies
  WHERE id = v_regie_id;
  
  IF v_regie_currency IS NULL THEN
    -- Fallback sur CHF si pas de devise définie
    v_regie_currency := 'CHF';
    RAISE WARNING 'Régie sans devise définie, utilisation par défaut de CHF';
  END IF;
  
  -- ========================================
  -- ÉTAPE 3: Déterminer le taux de TVA selon la devise
  -- ========================================
  IF v_regie_currency = 'EUR' THEN
    v_taux_tva := 20.00;  -- TVA France/UE
  ELSIF v_regie_currency = 'CHF' THEN
    v_taux_tva := 8.1;    -- TVA Suisse
  ELSE
    -- Devise inconnue : utiliser CHF par défaut
    v_taux_tva := 8.1;
    RAISE WARNING 'Devise inconnue (%), utilisation taux TVA CHF par défaut', v_regie_currency;
  END IF;
  
  -- ========================================
  -- ÉTAPE 4: Déterminer le montant HT
  -- ========================================
  -- Si pas fourni, utiliser montant_reel de la mission
  IF p_montant_ht IS NULL THEN
    p_montant_ht := COALESCE(v_mission.montant_reel, v_mission.montant_reel_chf, 0);
  END IF;
  
  IF p_montant_ht <= 0 THEN
    RAISE EXCEPTION 'Le montant HT doit être supérieur à 0';
  END IF;
  
  -- ========================================
  -- ÉTAPE 5: Générer le numéro de facture
  -- ========================================
  v_year := to_char(current_date, 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero ~ '^FAC-[0-9]{4}-[0-9]+$' 
      THEN CAST(substring(numero FROM 'FAC-[0-9]{4}-([0-9]+)') AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM factures
  WHERE numero LIKE 'FAC-' || v_year || '-%';
  
  v_numero := 'FAC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  
  -- ========================================
  -- ÉTAPE 6: Créer la facture
  -- ========================================
  INSERT INTO factures (
    mission_id,
    entreprise_id,
    regie_id,
    numero,
    montant_ht,
    taux_tva,
    taux_commission,
    currency,
    date_echeance,
    statut,
    iban,
    notes
  )
  VALUES (
    p_mission_id,
    v_mission.entreprise_id,
    v_regie_id,
    v_numero,
    p_montant_ht,
    v_taux_tva,
    v_taux_commission,
    v_regie_currency,
    current_date + INTERVAL '30 days',
    'brouillon',
    p_iban,
    p_description
  )
  RETURNING id INTO v_facture_id;
  
  -- ========================================
  -- ÉTAPE 7: Retourner le résultat
  -- ========================================
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero,
    'currency', v_regie_currency,
    'montant_ht', p_montant_ht,
    'taux_tva', v_taux_tva,
    'taux_commission', v_taux_commission,
    'message', 'Facture générée avec TVA ' || v_taux_tva || '% (' || v_regie_currency || ')'
  );
END;
$$;

COMMENT ON FUNCTION generate_facture_from_mission IS 'Génère une facture pour une mission terminée avec TVA automatique selon devise (EUR=20%, CHF=8.1%)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_facture_from_mission TO authenticated;

-- ============================================
-- PARTIE 2: MISE À JOUR editer_facture (si existe)
-- ============================================

DROP FUNCTION IF EXISTS editer_facture(UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS editer_facture;

/**
 * Édite une facture existante
 * ADAPTÉ MULTI-DEVISE : Conserve la devise, recalcule TVA si nécessaire
 * 
 * @param p_facture_id UUID de la facture
 * @param p_montant_ht Nouveau montant HT
 * @param p_notes Notes/description
 * @param p_iban IBAN
 * @return JSON avec détails mise à jour
 */
CREATE OR REPLACE FUNCTION editer_facture(
  p_facture_id UUID,
  p_montant_ht DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture RECORD;
  v_taux_tva DECIMAL;
BEGIN
  -- Vérifier que la facture existe
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée';
  END IF;
  
  -- Vérifier que la facture n'est pas payée ou annulée
  IF v_facture.statut IN ('payee', 'annulee') THEN
    RAISE EXCEPTION 'Impossible de modifier une facture avec statut %', v_facture.statut;
  END IF;
  
  -- Déterminer le taux TVA selon la devise existante
  IF v_facture.currency = 'EUR' THEN
    v_taux_tva := 20.00;
  ELSIF v_facture.currency = 'CHF' THEN
    v_taux_tva := 8.1;
  ELSE
    v_taux_tva := 8.1; -- Défaut CHF
  END IF;
  
  -- Mettre à jour la facture (montant_tva et montant_ttc sont calculés auto)
  UPDATE factures
  SET 
    montant_ht = p_montant_ht,
    taux_tva = v_taux_tva,
    notes = COALESCE(p_notes, notes),
    iban = COALESCE(p_iban, iban),
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  -- Récupérer les valeurs calculées
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'montant_ht', v_facture.montant_ht,
    'taux_tva', v_facture.taux_tva,
    'montant_tva', v_facture.montant_tva,
    'montant_ttc', v_facture.montant_ttc,
    'currency', v_facture.currency,
    'updated_at', v_facture.updated_at
  );
END;
$$;

COMMENT ON FUNCTION editer_facture IS 'Édite une facture avec recalcul automatique TVA selon devise';

GRANT EXECUTE ON FUNCTION editer_facture TO authenticated;

-- ============================================
-- PARTIE 3: FONCTION HELPER - Calculer montants facture
-- ============================================

/**
 * Fonction helper pour calculer les montants d'une facture
 * selon la devise (utilisable en JavaScript via RPC)
 * 
 * @param p_montant_ht Montant HT
 * @param p_currency Devise (EUR ou CHF)
 * @return JSON avec tous les montants calculés
 */
CREATE OR REPLACE FUNCTION calculer_montants_facture(
  p_montant_ht DECIMAL,
  p_currency TEXT DEFAULT 'CHF'
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_taux_tva DECIMAL;
  v_taux_commission DECIMAL := 10.00;
  v_montant_tva DECIMAL;
  v_montant_commission DECIMAL;
  v_montant_ttc DECIMAL;
BEGIN
  -- Déterminer taux TVA
  IF p_currency = 'EUR' THEN
    v_taux_tva := 20.00;
  ELSIF p_currency = 'CHF' THEN
    v_taux_tva := 8.1;
  ELSE
    v_taux_tva := 8.1; -- Défaut CHF
  END IF;
  
  -- Calculs
  v_montant_tva := p_montant_ht * (v_taux_tva / 100);
  v_montant_commission := p_montant_ht * (v_taux_commission / 100);
  v_montant_ttc := p_montant_ht + v_montant_tva;
  
  RETURN jsonb_build_object(
    'currency', p_currency,
    'montant_ht', p_montant_ht,
    'taux_tva', v_taux_tva,
    'montant_tva', ROUND(v_montant_tva, 2),
    'taux_commission', v_taux_commission,
    'montant_commission', ROUND(v_montant_commission, 2),
    'montant_ttc', ROUND(v_montant_ttc, 2)
  );
END;
$$;

COMMENT ON FUNCTION calculer_montants_facture IS 'Calcule tous les montants d''une facture selon la devise (EUR=20% TVA, CHF=8.1% TVA)';

GRANT EXECUTE ON FUNCTION calculer_montants_facture TO authenticated;

-- ============================================
-- PARTIE 4: RAPPORT FINAL
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION M61 - RAPPORT FINAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ generate_facture_from_mission : Mise à jour avec TVA automatique';
  RAISE NOTICE '   - EUR : 20%% TVA';
  RAISE NOTICE '   - CHF : 8.1%% TVA';
  RAISE NOTICE '✅ editer_facture : Mise à jour avec conservation devise';
  RAISE NOTICE '✅ calculer_montants_facture : Fonction helper ajoutée';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 Prochaines étapes:';
  RAISE NOTICE '   - Tester génération facture EUR';
  RAISE NOTICE '   - Tester génération facture CHF';
  RAISE NOTICE '   - Mettre à jour frontend pour afficher devise';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- MIGRATION M61 RÉUSSIE ✅
-- ============================================
