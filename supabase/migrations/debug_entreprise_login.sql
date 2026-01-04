-- ============================================================
-- VALIDATION USER ENTREPRISE - Requêtes SQL Debug
-- ============================================================
-- Date: 2025-12-27
-- Objectif: Vérifier qu'un user entreprise est correctement créé
-- Utilisation: Copier/coller dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Vérifier user dans auth.users
-- ============================================================

-- Remplacer 'entreprise@test.app' par l'email de test
SELECT 
  id,
  email,
  email_confirmed_at,
  phone_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_user_meta_data,
  raw_app_meta_data,
  is_super_admin,
  role as auth_role,
  encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'entreprise@test.app';

-- Résultat attendu:
-- - id: UUID du user
-- - email_confirmed_at: DOIT être NON NULL (sinon login échoue)
-- - has_password: true
-- - raw_user_meta_data: {"role": "entreprise", "created_by": "regie", "regie_id": "..."}

-- ⚠️ Si email_confirmed_at est NULL:
-- CAUSE: API a créé user avec email_confirm: false
-- SOLUTION: Recréer user OU confirmer manuellement:
-- UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = 'entreprise@test.app';


-- ============================================================
-- ÉTAPE 2: Vérifier profile dans public.profiles
-- ============================================================

SELECT 
  p.id,
  p.email,
  p.role,
  p.regie_id,
  p.created_at,
  r.nom as regie_nom
FROM profiles p
LEFT JOIN regies r ON p.regie_id = r.id
WHERE p.email = 'entreprise@test.app';

-- Résultat attendu:
-- - id: DOIT correspondre à auth.users.id
-- - role: 'entreprise'
-- - regie_id: UUID de la régie créatrice
-- - regie_nom: Nom de la régie (ex: 'Fleury_Teste')

-- ⚠️ Si profile absent:
-- CAUSE: Rollback dans API OU policy RLS bloque INSERT
-- SOLUTION: Vérifier logs API + vérifier policy M29 "System can insert entreprise profiles"


-- ============================================================
-- ÉTAPE 3: Vérifier entreprise créée
-- ============================================================

SELECT 
  e.id,
  e.nom,
  e.email,
  e.profile_id,
  e.siret,
  e.created_at,
  p.email as profile_email,
  p.role as profile_role
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE e.email = 'entreprise@test.app';

-- Résultat attendu:
-- - id: UUID de l'entreprise
-- - profile_id: DOIT correspondre à profiles.id et auth.users.id
-- - profile_email: 'entreprise@test.app'
-- - profile_role: 'entreprise'

-- ⚠️ Si entreprise absente:
-- CAUSE: RPC create_entreprise_with_profile a échoué
-- SOLUTION: Vérifier logs API Step 7 + vérifier M30 appliquée


-- ============================================================
-- ÉTAPE 4: Vérifier lien regies_entreprises
-- ============================================================

SELECT 
  re.id,
  re.regie_id,
  re.entreprise_id,
  re.mode_diffusion,
  re.date_autorisation,
  r.nom as regie_nom,
  e.nom as entreprise_nom
FROM regies_entreprises re
JOIN regies r ON re.regie_id = r.id
JOIN entreprises e ON re.entreprise_id = e.id
WHERE e.email = 'entreprise@test.app';

-- Résultat attendu:
-- - mode_diffusion: 'general' ou 'restreint' (default: 'restreint')
-- - regie_nom: Nom de la régie propriétaire
-- - entreprise_nom: Nom de l'entreprise créée

-- ⚠️ Si lien absent:
-- CAUSE: RPC create_entreprise_with_profile n'a pas créé le lien
-- SOLUTION: Vérifier M30 appliquée + vérifier mode_diffusion valide


-- ============================================================
-- ÉTAPE 5: Test login (simulation)
-- ============================================================

-- Vérifier que tous les éléments sont présents pour un login réussi:
SELECT 
  au.id as auth_user_id,
  au.email,
  au.email_confirmed_at,
  au.encrypted_password IS NOT NULL as has_password,
  p.id as profile_id,
  p.role,
  p.regie_id,
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  re.mode_diffusion
FROM auth.users au
JOIN profiles p ON p.id = au.id
LEFT JOIN entreprises e ON e.profile_id = p.id
LEFT JOIN regies_entreprises re ON re.entreprise_id = e.id
WHERE au.email = 'entreprise@test.app';

-- Résultat attendu pour login OK:
-- - email_confirmed_at: NON NULL ✅
-- - has_password: true ✅
-- - role: 'entreprise' ✅
-- - entreprise_id: NON NULL ✅
-- - mode_diffusion: 'general' ou 'restreint' ✅

-- ⚠️ Si email_confirmed_at est NULL → Login échouera avec "Invalid credentials"
-- FIX IMMÉDIAT (temporaire):
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW() 
-- WHERE email = 'entreprise@test.app' AND email_confirmed_at IS NULL;


-- ============================================================
-- ÉTAPE 6: Vérifier policies RLS pour entreprise
-- ============================================================

-- Lister les policies qui s'appliquent à role='entreprise'
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('tickets', 'entreprises', 'regies_entreprises', 'profiles')
  AND (roles::text[] @> ARRAY['authenticated'] OR roles::text[] @> ARRAY['entreprise'])
ORDER BY tablename, policyname;

-- Vérifier spécifiquement la policy tickets pour entreprise:
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tickets'
  AND policyname LIKE '%entreprise%';

-- Vérifier qu'il n'y a pas de récursion RLS (M28 fix):
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_user_entreprise_owner';

-- Résultat attendu:
-- - Fonction is_user_entreprise_owner doit être SECURITY DEFINER
-- - Policy "Entreprise can view own authorizations" doit utiliser cette fonction


-- ============================================================
-- ÉTAPE 7: Cleanup (si besoin de recommencer)
-- ============================================================

-- ⚠️ ATTENTION: Ceci SUPPRIME le user de test
-- À n'utiliser QUE pour recommencer à zéro

-- DELETE FROM regies_entreprises WHERE entreprise_id IN (
--   SELECT id FROM entreprises WHERE email = 'entreprise@test.app'
-- );
-- DELETE FROM entreprises WHERE email = 'entreprise@test.app';
-- DELETE FROM profiles WHERE email = 'entreprise@test.app';
-- DELETE FROM auth.users WHERE email = 'entreprise@test.app';

-- Puis recréer via UI régie

-- ============================================================
-- FIN VALIDATION
-- ============================================================
