-- M54 : AJOUT RPC POUR ÉDITION ET ENVOI FACTURES
-- Date: 2026-01-08
-- Description: Compléter le workflow facturation avec les fonctions manquantes

-- ========================================
-- 1. RPC : editer_facture
-- ========================================
DROP FUNCTION IF EXISTS editer_facture(UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS editer_facture;

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
  v_tva DECIMAL;
  v_commission DECIMAL;
  v_ttc DECIMAL;
BEGIN
  -- Vérifier que la facture existe
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Facture non trouvée'
    );
  END IF;
  
  -- Vérifier que c'est un brouillon
  IF v_facture.statut != 'brouillon' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Seules les factures en brouillon peuvent être éditées'
    );
  END IF;
  
  -- Calculer montants
  v_tva := p_montant_ht * (v_facture.taux_tva / 100);
  v_ttc := p_montant_ht + v_tva;
  v_commission := p_montant_ht * (v_facture.taux_commission / 100);
  
  -- Mettre à jour la facture
  UPDATE factures
  SET 
    montant_ht = p_montant_ht,
    montant_tva = v_tva,
    montant_ttc = v_ttc,
    montant_commission = v_commission,
    notes = COALESCE(p_notes, notes),
    iban = COALESCE(p_iban, iban),
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'montant_ht', p_montant_ht,
    'montant_ttc', v_ttc,
    'updated_at', NOW()
  );
END;
$$;

-- ========================================
-- 2. RPC : envoyer_facture
-- ========================================
DROP FUNCTION IF EXISTS envoyer_facture(UUID);
DROP FUNCTION IF EXISTS envoyer_facture;

CREATE OR REPLACE FUNCTION envoyer_facture(
  p_facture_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture RECORD;
BEGIN
  -- Vérifier que la facture existe
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Facture non trouvée'
    );
  END IF;
  
  -- Vérifier que c'est un brouillon
  IF v_facture.statut != 'brouillon' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les factures en brouillon peuvent être envoyées'
    );
  END IF;
  
  -- Vérifier que les champs obligatoires sont remplis
  IF v_facture.montant_ttc IS NULL OR v_facture.montant_ttc = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le montant de la facture doit être renseigné'
    );
  END IF;
  
  IF v_facture.iban IS NULL OR LENGTH(TRIM(v_facture.iban)) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'L''IBAN doit être renseigné'
    );
  END IF;
  
  -- Mettre à jour le statut
  UPDATE factures
  SET 
    statut = 'envoyee',
    date_envoi = NOW(),
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'numero', v_facture.numero,
    'statut', 'envoyee',
    'date_envoi', NOW()
  );
END;
$$;

-- ========================================
-- 3. RPC : valider_paiement_facture
-- ========================================
DROP FUNCTION IF EXISTS valider_paiement_facture(UUID);
DROP FUNCTION IF EXISTS valider_paiement_facture;

CREATE OR REPLACE FUNCTION valider_paiement_facture(
  p_facture_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture RECORD;
  v_mission_id UUID;
  v_ticket_id UUID;
BEGIN
  -- Vérifier que la facture existe
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Facture non trouvée'
    );
  END IF;
  
  -- Vérifier que la facture est envoyée
  IF v_facture.statut NOT IN ('envoyee', 'brouillon') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les factures envoyées peuvent être validées'
    );
  END IF;
  
  -- Mettre à jour la facture
  UPDATE factures
  SET 
    statut = 'payee',
    date_paiement = NOW(),
    updated_at = NOW()
  WHERE id = p_facture_id
  RETURNING mission_id INTO v_mission_id;
  
  -- Clôturer la mission et le ticket
  SELECT ticket_id INTO v_ticket_id FROM missions WHERE id = v_mission_id;
  
  UPDATE missions 
  SET 
    statut = 'clos',
    validated_at = NOW()
  WHERE id = v_mission_id;
  
  UPDATE tickets 
  SET 
    statut = 'clos',
    date_cloture = NOW()
  WHERE id = v_ticket_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'mission_id', v_mission_id,
    'ticket_id', v_ticket_id,
    'statut', 'payee',
    'mission_clos', true,
    'ticket_clos', true
  );
END;
$$;

-- ========================================
-- 4. RPC : refuser_facture
-- ========================================
DROP FUNCTION IF EXISTS refuser_facture(UUID, TEXT);
DROP FUNCTION IF EXISTS refuser_facture;

CREATE OR REPLACE FUNCTION refuser_facture(
  p_facture_id UUID,
  p_raison TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture RECORD;
BEGIN
  -- Vérifier que la facture existe
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Facture non trouvée'
    );
  END IF;
  
  -- Vérifier que la facture peut être refusée
  IF v_facture.statut NOT IN ('envoyee', 'brouillon') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les factures envoyées peuvent être refusées'
    );
  END IF;
  
  -- Mettre à jour la facture
  UPDATE factures
  SET 
    statut = 'refusee',
    notes = CASE 
      WHEN p_raison IS NOT NULL 
      THEN COALESCE(notes, '') || '\n\nRefusée: ' || p_raison
      ELSE notes
    END,
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'statut', 'refusee'
  );
END;
$$;

-- ========================================
-- 5. PERMISSIONS
-- ========================================
GRANT EXECUTE ON FUNCTION editer_facture TO authenticated;
GRANT EXECUTE ON FUNCTION envoyer_facture TO authenticated;
GRANT EXECUTE ON FUNCTION valider_paiement_facture TO authenticated;
GRANT EXECUTE ON FUNCTION refuser_facture TO authenticated;

-- FIN M54
