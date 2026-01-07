-- ============================================================
-- TESTS DB MANUELS - VUE TECHNICIEN
-- ============================================================
-- À exécuter dans: Dashboard Supabase > SQL Editor
-- Date: 2026-01-07
-- ============================================================

-- ============================================================
-- TEST 1: Vérifier structure table missions
-- ============================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'missions'
  AND column_name IN (
    'id',
    'technicien_id',
    'statut',
    'started_at',
    'completed_at',
    'notes',
    'photos_urls',
    'locataire_absent',
    'absence_signalement_at',
    'absence_raison',
    'date_intervention_prevue'
  )
ORDER BY column_name;

-- Résultat attendu: 11 lignes (toutes les colonnes présentes)

-- ============================================================
-- TEST 2: Vérifier structure table mission_signalements
-- ============================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'mission_signalements'
ORDER BY ordinal_position;

-- Résultat attendu: Colonnes id, mission_id, type_signalement, description, etc.

-- ============================================================
-- TEST 3: Compter techniciens disponibles
-- ============================================================
SELECT 
  COUNT(*) as total_techniciens,
  COUNT(profile_id) as with_profile
FROM techniciens;

-- Résultat attendu: Au moins 1 technicien

-- ============================================================
-- TEST 4: Lister techniciens avec leurs profils
-- ============================================================
SELECT 
  t.id as technicien_id,
  t.profile_id,
  p.email,
  p.role,
  t.created_at
FROM techniciens t
LEFT JOIN profiles p ON t.profile_id = p.id
ORDER BY t.created_at DESC
LIMIT 10;

-- Vérifier: Chaque technicien a un profile_id et role='technicien'

-- ============================================================
-- TEST 5: Compter missions par statut
-- ============================================================
SELECT 
  statut,
  COUNT(*) as nb_missions,
  COUNT(technicien_id) as assignees
FROM missions
GROUP BY statut
ORDER BY statut;

-- Observer répartition: en_attente, en_cours, terminee, validee

-- ============================================================
-- TEST 6: Missions assignées à des techniciens
-- ============================================================
SELECT 
  m.id,
  m.statut,
  m.date_intervention_prevue,
  m.technicien_id,
  t.profile_id,
  p.email as technicien_email,
  m.started_at,
  m.completed_at,
  COALESCE(array_length(m.photos_urls, 1), 0) as nb_photos,
  m.locataire_absent
FROM missions m
LEFT JOIN techniciens t ON m.technicien_id = t.id
LEFT JOIN profiles p ON t.profile_id = p.id
WHERE m.technicien_id IS NOT NULL
ORDER BY m.date_intervention_prevue DESC
LIMIT 20;

-- Vérifier: Missions avec technicien_email renseigné

-- ============================================================
-- TEST 7: Missions SANS technicien assigné (disponibles)
-- ============================================================
SELECT 
  m.id,
  m.statut,
  m.date_intervention_prevue,
  t.categorie,
  t.sous_categorie
FROM missions m
JOIN tickets t ON m.ticket_id = t.id
WHERE m.technicien_id IS NULL
ORDER BY m.date_intervention_prevue DESC
LIMIT 10;

-- Ces missions peuvent être assignées par une entreprise

-- ============================================================
-- TEST 8: Vérifier RLS policies missions
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'missions'
  AND policyname ILIKE '%technicien%'
ORDER BY policyname;

-- Résultat attendu: Au moins 2 policies (SELECT et UPDATE pour techniciens)

-- ============================================================
-- TEST 9: Vérifier signalements existants
-- ============================================================
SELECT 
  ms.id,
  ms.mission_id,
  ms.type_signalement,
  ms.description,
  ms.resolu,
  ms.signale_at,
  p.email as signale_par_email
FROM mission_signalements ms
LEFT JOIN profiles p ON ms.signale_par = p.id
ORDER BY ms.signale_at DESC
LIMIT 10;

-- Si vide: Normal, signalements créés par techniciens lors interventions

-- ============================================================
-- TEST 10: Vérifier bucket Storage mission-photos
-- ============================================================
SELECT 
  id,
  name,
  public,
  file_size_limit / 1048576 as max_size_mb,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'mission-photos';

-- Résultat attendu:
-- - id: mission-photos
-- - public: true
-- - max_size_mb: 10
-- - allowed_mime_types: {image/jpeg, image/png, image/webp, image/heic}

-- ============================================================
-- TEST 11: Vérifier policies Storage
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%mission%photo%'
ORDER BY policyname;

-- Résultat attendu: 3 policies (INSERT, SELECT, DELETE)

-- ============================================================
-- TEST 12: Simuler requête technicien (IMPORTANT - SÉCURITÉ)
-- ============================================================
-- ⚠️ Remplacer 'TECHNICIEN_PROFILE_ID' par un vrai profile_id

-- Étape 1: Trouver un profile_id technicien
SELECT id as profile_id, email 
FROM profiles 
WHERE role = 'technicien' 
LIMIT 1;

-- Étape 2: Simuler query avec ce profile_id
-- (Remplacer 'UUID_ICI' par le résultat ci-dessus)
/*
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "UUID_ICI"}';

SELECT 
  m.id,
  m.statut,
  m.date_intervention_prevue
FROM missions m
WHERE m.technicien_id = (
  SELECT id FROM techniciens WHERE profile_id = 'UUID_ICI'
);

RESET role;
*/
-- ⚠️ Ne pas exécuter si RLS non testé - risque d'erreur permission

-- ============================================================
-- TEST 13: Créer mission de test pour un technicien
-- ============================================================
-- Si besoin de données de test, décommenter et adapter:
/*
-- Trouver un ticket et un technicien existants
SELECT t.id as ticket_id FROM tickets t LIMIT 1;
SELECT t.id as technicien_id FROM techniciens t LIMIT 1;

-- Créer mission test
INSERT INTO missions (
  ticket_id, 
  technicien_id, 
  statut, 
  date_intervention_prevue
) VALUES (
  'TICKET_ID_ICI',
  'TECHNICIEN_ID_ICI',
  'en_attente',
  NOW() + INTERVAL '1 day'
)
RETURNING id, statut;
*/

-- ============================================================
-- TEST 14: Vérifier migration M46 appliquée (technicien RLS)
-- ============================================================
SELECT version, name 
FROM supabase_migrations.schema_migrations
WHERE version >= '20260106000300'
ORDER BY version DESC
LIMIT 5;

-- Vérifier présence: 20260106000300_m46_rls_techniciens_missions.sql

-- ============================================================
-- TEST 15: Vérifier migration M47 appliquée (Storage)
-- ============================================================
SELECT version, name 
FROM supabase_migrations.schema_migrations
WHERE version = '20260106100000'
ORDER BY version DESC;

-- Vérifier présence: 20260106100000_m47_storage_mission_photos.sql

-- ============================================================
-- RÉSUMÉ - CHECKLIST RAPIDE
-- ============================================================
-- ✅ Tables missions, mission_signalements, techniciens existent
-- ✅ Colonnes critiques présentes (started_at, completed_at, notes, photos_urls, etc.)
-- ✅ Au moins 1 technicien existe avec profile_id
-- ✅ Au moins 1 mission assignée à un technicien
-- ✅ RLS policies technicien actives sur missions
-- ✅ Bucket Storage mission-photos créé (public, 10MB max)
-- ✅ Policies Storage fonctionnelles (INSERT, SELECT, DELETE)
-- ✅ Migrations M46 et M47 appliquées
-- ✅ Relations FK fonctionnelles (missions ↔ techniciens ↔ profiles)

-- ============================================================
-- FIN DES TESTS
-- ============================================================
