-- ============================================================
-- MIGRATION M38: RPC update_entreprise_mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Ajout contrôle régie sur autorisation marketplace entreprise
-- Objectif: Permettre à la régie de modifier mode_diffusion d'une entreprise
-- Dépendances: M37 (vue entreprise avec mode_diffusion)
-- Rollback: 20260104001400_m38_rpc_update_mode_diffusion_rollback.sql
-- ============================================================

-- CONTEXTE:
-- Le champ regies_entreprises.mode_diffusion existe et contrôle la visibilité:
-- - 'general' : entreprise voit tickets marketplace + assignés
-- - 'restreint' : entreprise voit uniquement tickets assignés
-- 
-- Problème: Aucune UI régie pour modifier ce paramètre.
-- Solution: RPC sécurisée pour UPDATE mode_diffusion.

CREATE OR REPLACE FUNCTION public.update_entreprise_mode_diffusion(
  p_entreprise_id uuid,
  p_mode_diffusion text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_exists boolean;
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
  
  -- STEP 2: Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'mode_diffusion invalide (attendu: general ou restreint, reçu: ' || p_mode_diffusion || ')'
    );
  END IF;
  
  -- STEP 3: Vérifier que l'entreprise est liée à cette régie
  SELECT EXISTS (
    SELECT 1 FROM regies_entreprises
    WHERE regie_id = v_regie_id
      AND entreprise_id = p_entreprise_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Entreprise non liée à cette régie'
    );
  END IF;
  
  -- STEP 4: UPDATE mode_diffusion
  UPDATE regies_entreprises
  SET 
    mode_diffusion = p_mode_diffusion,
    updated_at = NOW()
  WHERE regie_id = v_regie_id
    AND entreprise_id = p_entreprise_id;
  
  -- STEP 5: Retour succès
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', p_entreprise_id,
    'mode_diffusion', p_mode_diffusion,
    'message', CASE 
      WHEN p_mode_diffusion = 'general' THEN 'Entreprise autorisée pour diffusion générale (marketplace)'
      ELSE 'Entreprise limitée à diffusion restreinte (assignation uniquement)'
    END
  );
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.update_entreprise_mode_diffusion(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_entreprise_mode_diffusion(uuid, text) TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.update_entreprise_mode_diffusion IS 
'Permet à la régie de modifier le mode_diffusion d''une entreprise liée.
Mode general : entreprise voit tickets marketplace + assignés.
Mode restreint : entreprise voit uniquement tickets assignés.
SECURITY DEFINER pour bypass RLS.
Trace QUI (regie via auth.uid) et QUAND (NOW) via updated_at.';

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_entreprise_mode_diffusion'
  ) THEN
    RAISE NOTICE '✅ M38: RPC update_entreprise_mode_diffusion créée avec succès';
  ELSE
    RAISE EXCEPTION '❌ M38: Erreur lors de la création de la RPC';
  END IF;
END $$;

-- ============================================================
-- FIN MIGRATION M38
-- ============================================================
