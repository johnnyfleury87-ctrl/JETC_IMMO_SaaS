-- ============================================================
-- MIGRATION M32: RPC valider_ticket_regie
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit workflow tickets régie-entreprise
-- Objectif: Permettre à la régie de valider un ticket avec plafond et mode de diffusion
-- ============================================================

CREATE OR REPLACE FUNCTION public.valider_ticket_regie(
  p_ticket_id uuid,
  p_plafond_chf numeric(10,2),
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_ticket_statut ticket_status;
  v_ticket_regie_id uuid;
BEGIN
  -- STEP 1: Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non autorisé - Régie introuvable'
    );
  END IF;
  
  -- STEP 2: Vérifier que le ticket appartient à cette régie
  SELECT statut, regie_id INTO v_ticket_statut, v_ticket_regie_id
  FROM tickets
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket introuvable'
    );
  END IF;
  
  IF v_ticket_regie_id != v_regie_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce ticket appartient à une autre régie'
    );
  END IF;
  
  -- STEP 3: Vérifier statut (doit être 'nouveau')
  IF v_ticket_statut != 'nouveau' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket déjà validé (statut actuel: ' || v_ticket_statut::text || ')'
    );
  END IF;
  
  -- STEP 4: Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'mode_diffusion invalide (attendu: general ou restreint, reçu: ' || p_mode_diffusion || ')'
    );
  END IF;
  
  -- STEP 5: Si restreint, vérifier entreprise_id fournie ET autorisée
  IF p_mode_diffusion = 'restreint' THEN
    IF p_entreprise_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'entreprise_id obligatoire en mode restreint'
      );
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_regie_id
        AND entreprise_id = p_entreprise_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Entreprise non autorisée pour cette régie'
      );
    END IF;
  END IF;
  
  -- STEP 6: Valider plafond (doit être positif)
  IF p_plafond_chf IS NULL OR p_plafond_chf <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plafond invalide (doit être > 0)'
    );
  END IF;
  
  -- STEP 7: UPDATE ticket
  UPDATE tickets
  SET 
    statut = 'en_attente',
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    plafond_intervention_chf = p_plafond_chf,
    plafond_valide_par = auth.uid(),
    plafond_valide_at = NOW(),
    diffuse_at = NOW(),
    diffuse_par = auth.uid(),
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  -- STEP 8: Retour succès
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'statut', 'en_attente',
    'mode_diffusion', p_mode_diffusion,
    'entreprise_id', CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    'plafond_chf', p_plafond_chf,
    'message', 'Ticket validé et diffusé avec succès'
  );
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.valider_ticket_regie IS 
'Valide un ticket (statut nouveau → en_attente) avec plafond et mode de diffusion.
Mode general : diffuse à toutes entreprises autorisées (entreprise_id = NULL).
Mode restreint : assigne à une entreprise spécifique (entreprise_id requis).
SECURITY DEFINER pour bypass RLS.
Trace QUI (auth.uid) et QUAND (NOW) pour plafond_valide_par/at et diffuse_par/at.';

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'valider_ticket_regie'
  ) THEN
    RAISE NOTICE '✅ M32: RPC valider_ticket_regie créée avec succès';
  ELSE
    RAISE EXCEPTION '❌ M32: Erreur lors de la création de la RPC';
  END IF;
END $$;
