-- M55 : FIX FACTURATION SUISSE + LIGNES DE FACTURES
-- Date: 2026-01-08
-- Description: Correction colonnes générées + système de lignes + logique Suisse (TVA 8.1%, Commission 2%)

-- ========================================
-- PARTIE 1: VÉRIFICATION ET CORRECTION COLONNES
-- ========================================

-- Les colonnes montant_tva, montant_ttc, montant_commission existent déjà comme GENERATED
-- On ne les supprime PAS pour éviter de casser les vues/triggers existants
-- Si elles ne sont pas GENERATED, on les migrera manuellement plus tard

-- Vérifier si les colonnes sont bien GENERATED (pas d'action nécessaire si déjà OK)

-- ========================================
-- PARTIE 2: TABLE LIGNES DE FACTURES
-- ========================================

CREATE TABLE IF NOT EXISTS facture_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  
  -- Type de ligne
  type TEXT NOT NULL CHECK (type IN ('main_oeuvre', 'materiel', 'deplacement', 'forfait', 'frais_divers', 'remise', 'autre')),
  
  -- Description
  description TEXT NOT NULL,
  
  -- Quantité et unité
  quantite NUMERIC NOT NULL DEFAULT 1,
  unite TEXT NOT NULL DEFAULT 'pcs', -- h, pcs, km, jour, forfait
  
  -- Prix
  prix_unitaire_ht NUMERIC NOT NULL,
  
  -- TVA spécifique (si différente de la facture)
  tva_taux NUMERIC DEFAULT NULL, -- NULL = utilise taux_tva de la facture
  
  -- Calculs automatiques
  total_ht NUMERIC GENERATED ALWAYS AS (quantite * prix_unitaire_ht) STORED,
  
  -- Ordre d'affichage
  ordre INT DEFAULT 0,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id ON facture_lignes(facture_id);
CREATE INDEX IF NOT EXISTS idx_facture_lignes_ordre ON facture_lignes(facture_id, ordre);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_facture_lignes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_facture_lignes_timestamp ON facture_lignes;
CREATE TRIGGER trigger_update_facture_lignes_timestamp
  BEFORE UPDATE ON facture_lignes
  FOR EACH ROW
  EXECUTE FUNCTION update_facture_lignes_timestamp();

-- ========================================
-- PARTIE 3: CALCUL AUTO MONTANT_HT DEPUIS LIGNES
-- ========================================

-- Fonction pour recalculer montant_ht depuis les lignes
CREATE OR REPLACE FUNCTION recalculer_montant_facture()
RETURNS TRIGGER AS $$
DECLARE
  v_montant_ht NUMERIC;
BEGIN
  -- Calculer la somme des lignes
  SELECT COALESCE(SUM(total_ht), 0) INTO v_montant_ht
  FROM facture_lignes
  WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id);
  
  -- Mettre à jour la facture (uniquement montant_ht, le reste est calculé auto)
  UPDATE factures
  SET montant_ht = v_montant_ht,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.facture_id, OLD.facture_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers sur facture_lignes
DROP TRIGGER IF EXISTS trigger_recalcul_montant_after_insert ON facture_lignes;
CREATE TRIGGER trigger_recalcul_montant_after_insert
  AFTER INSERT ON facture_lignes
  FOR EACH ROW
  EXECUTE FUNCTION recalculer_montant_facture();

DROP TRIGGER IF EXISTS trigger_recalcul_montant_after_update ON facture_lignes;
CREATE TRIGGER trigger_recalcul_montant_after_update
  AFTER UPDATE ON facture_lignes
  FOR EACH ROW
  EXECUTE FUNCTION recalculer_montant_facture();

DROP TRIGGER IF EXISTS trigger_recalcul_montant_after_delete ON facture_lignes;
CREATE TRIGGER trigger_recalcul_montant_after_delete
  AFTER DELETE ON facture_lignes
  FOR EACH ROW
  EXECUTE FUNCTION recalculer_montant_facture();

-- ========================================
-- PARTIE 4: VALEURS PAR DÉFAUT SUISSE
-- ========================================

-- TVA Suisse standard: 8.1% (modifiable)
-- Commission JETC: 2.0%
ALTER TABLE factures ALTER COLUMN taux_tva SET DEFAULT 8.1;
ALTER TABLE factures ALTER COLUMN taux_commission SET DEFAULT 2.0;

-- Mettre à jour les factures existantes sans taux
UPDATE factures SET taux_tva = 8.1 WHERE taux_tva IS NULL OR taux_tva = 20.0;
UPDATE factures SET taux_commission = 2.0 WHERE taux_commission IS NULL OR taux_commission = 10.0;

-- ========================================
-- PARTIE 5: RPC CORRIGÉES (SANS COLONNES GÉNÉRÉES)
-- ========================================

-- RPC: editer_facture (VERSION CORRIGÉE)
DROP FUNCTION IF EXISTS editer_facture(UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS editer_facture;

CREATE OR REPLACE FUNCTION editer_facture(
  p_facture_id UUID,
  p_montant_ht DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL,
  p_taux_tva NUMERIC DEFAULT NULL,
  p_taux_commission NUMERIC DEFAULT NULL
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
      'error', 'Seules les factures en brouillon peuvent être éditées'
    );
  END IF;
  
  -- Mettre à jour UNIQUEMENT les colonnes sources (pas les calculées)
  UPDATE factures
  SET 
    montant_ht = p_montant_ht,
    taux_tva = COALESCE(p_taux_tva, taux_tva),
    taux_commission = COALESCE(p_taux_commission, taux_commission),
    notes = COALESCE(p_notes, notes),
    iban = COALESCE(p_iban, iban),
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  -- Relire pour avoir les calculs auto
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'montant_ht', v_facture.montant_ht,
    'montant_tva', v_facture.montant_tva,
    'montant_ttc', v_facture.montant_ttc,
    'montant_commission', v_facture.montant_commission,
    'updated_at', v_facture.updated_at
  );
END;
$$;

-- RPC: ajouter_ligne_facture
CREATE OR REPLACE FUNCTION ajouter_ligne_facture(
  p_facture_id UUID,
  p_type TEXT,
  p_description TEXT,
  p_quantite NUMERIC,
  p_unite TEXT,
  p_prix_unitaire_ht NUMERIC,
  p_tva_taux NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ligne_id UUID;
  v_facture RECORD;
BEGIN
  -- Vérifier que la facture existe et est brouillon
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture non trouvée');
  END IF;
  
  IF v_facture.statut != 'brouillon' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seules les factures en brouillon peuvent être modifiées');
  END IF;
  
  -- Insérer la ligne
  INSERT INTO facture_lignes (facture_id, type, description, quantite, unite, prix_unitaire_ht, tva_taux)
  VALUES (p_facture_id, p_type, p_description, p_quantite, p_unite, p_prix_unitaire_ht, p_tva_taux)
  RETURNING id INTO v_ligne_id;
  
  -- Le trigger recalculer_montant_facture() s'exécute automatiquement
  
  RETURN jsonb_build_object('success', true, 'ligne_id', v_ligne_id);
END;
$$;

-- RPC: modifier_ligne_facture
CREATE OR REPLACE FUNCTION modifier_ligne_facture(
  p_ligne_id UUID,
  p_description TEXT DEFAULT NULL,
  p_quantite NUMERIC DEFAULT NULL,
  p_prix_unitaire_ht NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ligne RECORD;
  v_facture RECORD;
BEGIN
  -- Vérifier que la ligne existe
  SELECT * INTO v_ligne FROM facture_lignes WHERE id = p_ligne_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ligne non trouvée');
  END IF;
  
  -- Vérifier que la facture est brouillon
  SELECT * INTO v_facture FROM factures WHERE id = v_ligne.facture_id;
  
  IF v_facture.statut != 'brouillon' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture non modifiable');
  END IF;
  
  -- Mettre à jour
  UPDATE facture_lignes
  SET 
    description = COALESCE(p_description, description),
    quantite = COALESCE(p_quantite, quantite),
    prix_unitaire_ht = COALESCE(p_prix_unitaire_ht, prix_unitaire_ht),
    updated_at = NOW()
  WHERE id = p_ligne_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: supprimer_ligne_facture
CREATE OR REPLACE FUNCTION supprimer_ligne_facture(
  p_ligne_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ligne RECORD;
  v_facture RECORD;
BEGIN
  SELECT * INTO v_ligne FROM facture_lignes WHERE id = p_ligne_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ligne non trouvée');
  END IF;
  
  SELECT * INTO v_facture FROM factures WHERE id = v_ligne.facture_id;
  
  IF v_facture.statut != 'brouillon' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture non modifiable');
  END IF;
  
  DELETE FROM facture_lignes WHERE id = p_ligne_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ========================================
-- PARTIE 6: RLS POLICIES
-- ========================================

-- RLS sur facture_lignes
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

-- Entreprise: voir ses lignes
DROP POLICY IF EXISTS "Entreprise voit ses lignes facture" ON facture_lignes;
CREATE POLICY "Entreprise voit ses lignes facture" ON facture_lignes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM factures f
      JOIN missions m ON f.mission_id = m.id
      WHERE f.id = facture_lignes.facture_id
      AND m.entreprise_id = auth.uid()
    )
  );

-- Entreprise: modifier ses lignes si brouillon
DROP POLICY IF EXISTS "Entreprise modifie lignes brouillon" ON facture_lignes;
CREATE POLICY "Entreprise modifie lignes brouillon" ON facture_lignes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM factures f
      JOIN missions m ON f.mission_id = m.id
      WHERE f.id = facture_lignes.facture_id
      AND m.entreprise_id = auth.uid()
      AND f.statut = 'brouillon'
    )
  );

-- Régie: voir les lignes des factures envoyées
DROP POLICY IF EXISTS "Régie voit lignes factures envoyées" ON facture_lignes;
CREATE POLICY "Régie voit lignes factures envoyées" ON facture_lignes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM factures f
      WHERE f.id = facture_lignes.facture_id
      AND f.regie_id = auth.uid()
      AND f.statut IN ('envoyee', 'payee', 'refusee')
    )
  );

-- ========================================
-- PARTIE 7: PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION ajouter_ligne_facture TO authenticated;
GRANT EXECUTE ON FUNCTION modifier_ligne_facture TO authenticated;
GRANT EXECUTE ON FUNCTION supprimer_ligne_facture TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON facture_lignes TO authenticated;

-- ========================================
-- PARTIE 8: VUE COMPLÈTE FACTURES + LIGNES
-- ========================================

CREATE OR REPLACE VIEW factures_avec_lignes AS
SELECT 
  f.*,
  COALESCE(json_agg(
    json_build_object(
      'id', fl.id,
      'type', fl.type,
      'description', fl.description,
      'quantite', fl.quantite,
      'unite', fl.unite,
      'prix_unitaire_ht', fl.prix_unitaire_ht,
      'total_ht', fl.total_ht,
      'ordre', fl.ordre
    ) ORDER BY fl.ordre, fl.created_at
  ) FILTER (WHERE fl.id IS NOT NULL), '[]'::json) AS lignes
FROM factures f
LEFT JOIN facture_lignes fl ON f.id = fl.facture_id
GROUP BY f.id;

GRANT SELECT ON factures_avec_lignes TO authenticated;

-- FIN M55
