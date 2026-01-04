-- ============================================================
-- MIGRATION M29 FINALE - Workflow entreprise régie (idempotente)
-- ============================================================
-- Date: 2025-12-27
-- Objectif: Création + gestion entreprises par régie (avec/sans compte)
-- Dépendances: M26 (INSERT), M28 (fix récursion RLS)
-- ============================================================

-- ============================================================
-- PARTIE 1: POLICY INSERT profiles pour workflow entreprise
-- ============================================================

DROP POLICY IF EXISTS "System can insert entreprise profiles" ON profiles;

CREATE POLICY "System can insert entreprise profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (role = 'entreprise');

COMMENT ON POLICY "System can insert entreprise profiles" ON profiles IS
  'Permet création profiles entreprise via RPC SECURITY DEFINER (workflow régie)';


-- ============================================================
-- PARTIE 2: POLICIES UPDATE/DELETE entreprises pour régie
-- ============================================================

DROP POLICY IF EXISTS "Regie can update authorized entreprises" ON entreprises;

CREATE POLICY "Regie can update authorized entreprises"
ON entreprises
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM regies_entreprises
    WHERE regies_entreprises.entreprise_id = entreprises.id
      AND regies_entreprises.regie_id = get_user_regie_id()
  )
);

DROP POLICY IF EXISTS "Regie can delete authorized entreprises" ON entreprises;

CREATE POLICY "Regie can delete authorized entreprises"
ON entreprises
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM regies_entreprises
    WHERE regies_entreprises.entreprise_id = entreprises.id
      AND regies_entreprises.regie_id = get_user_regie_id()
  )
);


-- ============================================================
-- PARTIE 3: RPC créer entreprise SANS compte auth
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
  p_mode_diffusion text DEFAULT 'actif'
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

  -- Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('actif', 'silencieux') THEN
    RAISE EXCEPTION 'mode_diffusion doit être actif ou silencieux';
  END IF;

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
  'Crée entreprise simple (sans compte auth) par régie. Workflow M26 sécurisé.';


-- ============================================================
-- PARTIE 4: RPC créer entreprise AVEC compte (profile existant)
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
  p_mode_diffusion text DEFAULT 'actif'
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

  -- Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('actif', 'silencieux') THEN
    RAISE EXCEPTION 'mode_diffusion doit être actif ou silencieux';
  END IF;

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
  'Crée entreprise avec profile existant (compte auth) par régie. Profile doit exister avant.';


-- ============================================================
-- PARTIE 5: RPC toggle mode entreprise
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

  -- Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('actif', 'silencieux') THEN
    RAISE EXCEPTION 'mode_diffusion doit être actif ou silencieux';
  END IF;

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
  'Bascule mode diffusion entreprise : actif ↔ silencieux';


-- ============================================================
-- VALIDATION
-- ============================================================

-- Vérifier fonctions créées
SELECT proname, proargtypes::regtype[]
FROM pg_proc
WHERE proname IN ('create_entreprise_simple', 'create_entreprise_with_profile', 'toggle_entreprise_mode')
ORDER BY proname;

-- Vérifier policies créées
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'entreprises')
  AND policyname IN (
    'System can insert entreprise profiles',
    'Regie can update authorized entreprises',
    'Regie can delete authorized entreprises'
  )
ORDER BY tablename, policyname;

-- ============================================================
-- EXEMPLE D'APPEL FRONTEND
-- ============================================================

-- Création entreprise simple (sans compte):
-- const { data, error } = await supabaseClient.rpc('create_entreprise_simple', {
--   p_nom: 'Entreprise Test',
--   p_email: 'test@exemple.ch',
--   p_telephone: '+41 21 000 00 00',
--   p_adresse: 'Rue Test 1',
--   p_code_postal: '1000',
--   p_ville: 'Lausanne',
--   p_siret: '12345678901234',
--   p_description: 'Entreprise de test',
--   p_mode_diffusion: 'actif'
-- });

-- Création entreprise avec compte (profile_id existant):
-- const { data, error } = await supabaseClient.rpc('create_entreprise_with_profile', {
--   p_profile_id: '00000000-0000-0000-0000-000000000000',
--   p_nom: 'Entreprise Compte',
--   p_email: 'compte@exemple.ch',
--   ...
-- });

-- Toggle mode:
-- const { error } = await supabaseClient.rpc('toggle_entreprise_mode', {
--   p_entreprise_id: '00000000-0000-0000-0000-000000000000',
--   p_mode_diffusion: 'silencieux'
-- });
