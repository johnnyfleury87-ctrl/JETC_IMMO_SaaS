-- M57 : FIX WORKFLOW REFUS + COLONNES REFUS
-- Date: 2026-01-09
-- Description: Ajout colonnes refus + correction RLS regies

-- ========================================
-- PARTIE 1: COLONNES POUR WORKFLOW REFUS
-- ========================================

-- Ajouter colonnes pour gérer le refus
ALTER TABLE factures ADD COLUMN IF NOT EXISTS refus_reason TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS refused_by UUID REFERENCES regies(id);

-- Commentaires
COMMENT ON COLUMN factures.refus_reason IS 'Raison du refus de la facture par la régie';
COMMENT ON COLUMN factures.refused_at IS 'Date et heure du refus';
COMMENT ON COLUMN factures.refused_by IS 'UUID de la régie qui a refusé';

-- ========================================
-- PARTIE 2: CORRECTION RLS SUR REGIES
-- ========================================

-- Assurer que les régies peuvent se lire elles-mêmes
ALTER TABLE regies ENABLE ROW LEVEL SECURITY;

-- Policy pour que la régie puisse lire ses propres infos
DROP POLICY IF EXISTS "Régie lit ses propres infos" ON regies;
CREATE POLICY "Régie lit ses propres infos"
  ON regies
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ========================================
-- PARTIE 3: RPC REFUSER FACTURE
-- ========================================

DROP FUNCTION IF EXISTS refuser_facture(UUID, TEXT);

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
  
  -- Vérifier que la régie peut refuser
  IF v_facture.regie_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Non autorisé'
    );
  END IF;
  
  -- Vérifier que la facture est en statut envoyee
  IF v_facture.statut != 'envoyee' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les factures envoyées peuvent être refusées'
    );
  END IF;
  
  -- Refuser la facture
  UPDATE factures
  SET 
    statut = 'refusee',
    refus_reason = p_raison,
    refused_at = NOW(),
    refused_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'refused_at', NOW()
  );
END;
$$;

-- ========================================
-- PARTIE 4: RPC CORRIGER ET RENVOYER
-- ========================================

DROP FUNCTION IF EXISTS corriger_et_renvoyer_facture(UUID);

CREATE OR REPLACE FUNCTION corriger_et_renvoyer_facture(
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
  
  -- Vérifier que l'entreprise peut renvoyer
  IF v_facture.entreprise_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Non autorisé'
    );
  END IF;
  
  -- Vérifier que la facture est refusée
  IF v_facture.statut != 'refusee' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les factures refusées peuvent être renvoyées'
    );
  END IF;
  
  -- Remettre en brouillon pour permettre correction
  UPDATE factures
  SET 
    statut = 'brouillon',
    refus_reason = NULL,
    refused_at = NULL,
    refused_by = NULL,
    updated_at = NOW()
  WHERE id = p_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'nouveau_statut', 'brouillon'
  );
END;
$$;

-- ========================================
-- PARTIE 5: CORRECTION UPDATE_FACTURE_STATUS
-- ========================================

-- Mettre à jour la fonction existante pour gérer refus
DROP FUNCTION IF EXISTS update_facture_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION update_facture_status(
  p_facture_id UUID,
  p_nouveau_statut TEXT
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
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture non trouvée');
  END IF;
  
  IF p_nouveau_statut NOT IN ('brouillon', 'envoyee', 'payee', 'refusee') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide');
  END IF;
  
  -- Si refus, utiliser la fonction dédiée
  IF p_nouveau_statut = 'refusee' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utiliser refuser_facture() pour refuser'
    );
  END IF;
  
  UPDATE factures
  SET 
    statut = p_nouveau_statut,
    date_envoi = CASE WHEN p_nouveau_statut = 'envoyee' AND date_envoi IS NULL THEN NOW() ELSE date_envoi END,
    date_paiement = CASE WHEN p_nouveau_statut = 'payee' AND date_paiement IS NULL THEN NOW() ELSE date_paiement END
  WHERE id = p_facture_id
  RETURNING mission_id INTO v_mission_id;
  
  IF p_nouveau_statut = 'payee' THEN
    SELECT ticket_id INTO v_ticket_id FROM missions WHERE id = v_mission_id;
    UPDATE missions SET statut = 'validee', validated_at = NOW() WHERE id = v_mission_id;
    UPDATE tickets SET statut = 'clos', date_cloture = NOW() WHERE id = v_ticket_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'facture_id', p_facture_id, 'cloture_auto', p_nouveau_statut = 'payee');
END;
$$;

-- ========================================
-- PARTIE 6: PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION refuser_facture TO authenticated;
GRANT EXECUTE ON FUNCTION corriger_et_renvoyer_facture TO authenticated;

-- FIN M57
