-- ============================================================
-- MIGRATION M30 - Correction mode_diffusion entreprises
-- ============================================================
-- Date: 2025-12-27
-- Objectif: Corriger RPC M29 pour utiliser les bonnes valeurs de mode_diffusion
-- Problème: M29 utilise 'actif'/'silencieux' mais DB attend 'general'/'restreint'
-- Contrainte: check_mode_diffusion check (mode_diffusion in ('general', 'restreint'))
-- ============================================================

-- ============================================================
-- PARTIE 1: Corriger RPC create_entreprise_simple
-- ============================================================

CREATE OR REPLACE FUNCTION create_entreprise_simple(
  p_nom text,
  p_email text,
  p_telephone text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_mode_diffusion text DEFAULT 'restreint'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_entreprise_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est une régie
  SELECT get_user_regie_id() INTO v_regie_id;
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non autorisé (pas une régie)';
  END IF;

  -- Valider mode_diffusion (CORRECTION: general ou restreint)
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RAISE EXCEPTION 'mode_diffusion doit être general ou restreint (reçu: %)', p_mode_diffusion;
  END IF;

  -- Log pour debug
  RAISE NOTICE '[create_entreprise_simple] regie_id=%, mode_diffusion=%', v_regie_id, p_mode_diffusion;

  -- Créer entreprise (profile_id = NULL)
  INSERT INTO entreprises (
    nom, email, telephone, adresse, code_postal, ville, siret, description, profile_id
  ) VALUES (
    p_nom, p_email, p_telephone, p_adresse, p_code_postal, p_ville, p_siret, p_description, NULL
  ) RETURNING id INTO v_entreprise_id;

  -- Créer lien regies_entreprises
  INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
  VALUES (v_regie_id, v_entreprise_id, p_mode_diffusion);

  RETURN v_entreprise_id;
END;
$$;

COMMENT ON FUNCTION create_entreprise_simple IS
  'Crée entreprise simple (sans compte auth) par régie. Mode: general (tous tickets) ou restreint (sur assignation).';


-- ============================================================
-- PARTIE 2: Corriger RPC create_entreprise_with_profile
-- ============================================================

CREATE OR REPLACE FUNCTION create_entreprise_with_profile(
  p_profile_id uuid,
  p_nom text,
  p_email text,
  p_telephone text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_mode_diffusion text DEFAULT 'restreint'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_entreprise_id uuid;
  v_profile_role user_role;
BEGIN
  -- Vérifier que l'utilisateur est une régie
  SELECT get_user_regie_id() INTO v_regie_id;
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non autorisé (pas une régie)';
  END IF;

  -- Vérifier que le profile existe et a le bon role
  SELECT role INTO v_profile_role
  FROM profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % non trouvé', p_profile_id;
  END IF;

  IF v_profile_role != 'entreprise' THEN
    RAISE EXCEPTION 'Profile doit avoir role entreprise (actuellement: %)', v_profile_role;
  END IF;

  -- Valider mode_diffusion (CORRECTION: general ou restreint)
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RAISE EXCEPTION 'mode_diffusion doit être general ou restreint (reçu: %)', p_mode_diffusion;
  END IF;

  -- Log pour debug
  RAISE NOTICE '[create_entreprise_with_profile] regie_id=%, profile_id=%, mode_diffusion=%', 
    v_regie_id, p_profile_id, p_mode_diffusion;

  -- Créer entreprise avec profile_id
  INSERT INTO entreprises (
    nom, email, telephone, adresse, code_postal, ville, siret, description, profile_id
  ) VALUES (
    p_nom, p_email, p_telephone, p_adresse, p_code_postal, p_ville, p_siret, p_description, p_profile_id
  ) RETURNING id INTO v_entreprise_id;

  -- Créer lien regies_entreprises
  INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
  VALUES (v_regie_id, v_entreprise_id, p_mode_diffusion);

  RETURN v_entreprise_id;
END;
$$;

COMMENT ON FUNCTION create_entreprise_with_profile IS
  'Crée entreprise avec profile existant (compte auth) par régie. Mode: general (tous tickets) ou restreint (sur assignation).';


-- ============================================================
-- PARTIE 3: Corriger RPC toggle_entreprise_mode
-- ============================================================

CREATE OR REPLACE FUNCTION toggle_entreprise_mode(
  p_entreprise_id uuid,
  p_mode_diffusion text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est une régie
  SELECT get_user_regie_id() INTO v_regie_id;
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non autorisé (pas une régie)';
  END IF;

  -- Valider mode_diffusion (CORRECTION: general ou restreint)
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RAISE EXCEPTION 'mode_diffusion doit être general ou restreint (reçu: %)', p_mode_diffusion;
  END IF;

  -- Log pour debug
  RAISE NOTICE '[toggle_entreprise_mode] regie_id=%, entreprise_id=%, mode_diffusion=%', 
    v_regie_id, p_entreprise_id, p_mode_diffusion;

  -- Mettre à jour le mode_diffusion
  UPDATE regies_entreprises
  SET mode_diffusion = p_mode_diffusion
  WHERE regie_id = v_regie_id
    AND entreprise_id = p_entreprise_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lien régie-entreprise non trouvé';
  END IF;
END;
$$;

COMMENT ON FUNCTION toggle_entreprise_mode IS
  'Bascule mode diffusion entreprise: general (tous les tickets) ↔ restreint (sur assignation uniquement)';


-- ============================================================
-- VALIDATION
-- ============================================================

-- Vérifier fonctions mises à jour
SELECT 
  proname, 
  pg_get_functiondef(oid) LIKE '%general%' as uses_correct_values
FROM pg_proc
WHERE proname IN ('create_entreprise_simple', 'create_entreprise_with_profile', 'toggle_entreprise_mode')
ORDER BY proname;

-- Test validation (avec user régie connecté)
-- SELECT create_entreprise_simple('Test', 'test@test.ch', mode_diffusion := 'general');
-- SELECT create_entreprise_simple('Test2', 'test2@test.ch', mode_diffusion := 'restreint');

-- ============================================================
-- DOCUMENTATION
-- ============================================================

COMMENT ON CONSTRAINT check_mode_diffusion ON regies_entreprises IS 
  'Valeurs autorisées: general (entreprise voit tous les tickets en_attente) ou restreint (uniquement tickets assignés explicitement)';

-- ============================================================
-- FIN MIGRATION M30
-- ============================================================
