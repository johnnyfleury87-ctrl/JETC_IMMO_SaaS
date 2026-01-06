-- =====================================================
-- DIAGNOSTIC STRUCTURE DB ENTREPRISES / PROFILES
-- =====================================================
-- Vérifie la structure et les liaisons entre tables

-- 1. Vérifier colonnes de la table entreprises
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'entreprises'
ORDER BY ordinal_position;

-- 2. Vérifier colonnes de la table profiles
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes FK
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('entreprises', 'profiles');

-- 4. Lister entreprises avec leurs profile_id
SELECT 
  id,
  nom,
  profile_id,
  created_at
FROM entreprises
ORDER BY created_at DESC;

-- 5. Lister profiles avec role='entreprise'
SELECT 
  id,
  email,
  role,
  entreprise_id,
  created_at
FROM profiles
WHERE role = 'entreprise'
ORDER BY created_at DESC;

-- 6. Vérifier liaisons bidirectionnelles
SELECT 
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  e.profile_id as entreprise_profile_id,
  p.id as profile_id,
  p.email as profile_email,
  p.entreprise_id as profile_entreprise_id,
  CASE 
    WHEN e.profile_id = p.id AND p.entreprise_id = e.id THEN '✅ LIAISON OK'
    WHEN e.profile_id = p.id AND p.entreprise_id IS NULL THEN '⚠️ profile.entreprise_id NULL'
    WHEN e.profile_id IS NULL THEN '❌ entreprise.profile_id NULL'
    ELSE '❌ INCOHÉRENCE'
  END as statut_liaison
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE p.role = 'entreprise' OR e.profile_id IS NOT NULL;
