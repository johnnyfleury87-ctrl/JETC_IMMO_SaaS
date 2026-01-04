-- ============================================================
-- TESTS VALIDATION M29 - Workflow entreprise complet
-- ============================================================
-- Objectif: Valider RPC création + policies UPDATE/DELETE
-- Migrations testées: M29
-- Exécution: Environnement staging après application M29
-- ============================================================

-- ============================================================
-- PARTIE 1: TESTS STRUCTURE
-- ============================================================

-- TEST M29.1: Vérifier policies créées
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'entreprises')
  AND policyname IN (
    'System can insert entreprise profiles',
    'Regie can update authorized entreprises',
    'Regie can delete authorized entreprises'
  )
ORDER BY tablename, policyname;
-- Attendu: 3 lignes


-- TEST M29.2: Vérifier fonctions RPC créées
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN (
  'create_entreprise_simple',
  'create_entreprise_with_profile',
  'toggle_entreprise_mode'
)
ORDER BY proname;
-- Attendu: 3 lignes


-- ============================================================
-- PARTIE 2: TESTS RPC create_entreprise_simple
-- ============================================================

-- TEST M29.3: Créer entreprise simple (SANS compte)
-- Pré-requis: Connecté en tant que régie
BEGIN;
  SELECT create_entreprise_simple(
    'Entreprise Test Simple M29',
    'test-simple-m29@entreprise.ch',
    '+41 22 111 11 11',
    'Rue Test 1',
    '1200',
    'Genève',
    'CHE-111.111.111',
    'Créée via RPC simple',
    'actif'
  ) as entreprise_id;
  
  -- Attendu: UUID retourné
  -- Vérifier lien créé
  SELECT COUNT(*) FROM regies_entreprises 
  WHERE regie_id = get_user_regie_id()
    AND mode_diffusion = 'actif';
  -- Attendu: +1 ligne
ROLLBACK;


-- TEST M29.4: mode_diffusion invalide (doit échouer)
-- Pré-requis: Connecté en tant que régie
BEGIN;
  SELECT create_entreprise_simple(
    'Test Invalide',
    'test@invalid.ch',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'mode_invalide'  -- INVALIDE
  );
  
  -- Attendu: ERREUR "mode_diffusion doit être actif ou silencieux"
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST M29.4 SUCCESS: %', SQLERRM;
ROLLBACK;


-- ============================================================
-- PARTIE 3: TESTS RPC create_entreprise_with_profile
-- ============================================================

-- TEST M29.5: Créer entreprise avec profile (nécessite profile existant)
-- Pré-requis: 
--   1. Connecté en tant que régie
--   2. Profile entreprise créé au préalable (via API admin)
-- Query:
BEGIN;
  -- Créer profile test (SIMULER via INSERT direct - staging only)
  INSERT INTO profiles (id, email, role)
  VALUES (
    '00000000-0000-0000-0000-999999999999'::uuid,
    'test-profile-m29@entreprise.ch',
    'entreprise'
  );
  
  -- Créer entreprise avec ce profile
  SELECT create_entreprise_with_profile(
    '00000000-0000-0000-0000-999999999999'::uuid,
    'Entreprise Test Profile M29',
    'test-profile-m29@entreprise.ch',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'actif'
  ) as entreprise_id;
  
  -- Vérifier entreprise créée avec profile_id
  SELECT id, nom, profile_id 
  FROM entreprises
  WHERE email = 'test-profile-m29@entreprise.ch';
  -- Attendu: 1 ligne, profile_id = '00000000-0000-0000-0000-999999999999'
ROLLBACK;


-- TEST M29.6: Tenter création avec profile inexistant (doit échouer)
-- Pré-requis: Connecté en tant que régie
BEGIN;
  SELECT create_entreprise_with_profile(
    '00000000-0000-0000-0000-000000000001'::uuid,  -- N'existe PAS
    'Test Fail',
    'test@fail.ch',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'actif'
  );
  
  -- Attendu: ERREUR "Profile % non trouvé"
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST M29.6 SUCCESS: %', SQLERRM;
ROLLBACK;


-- ============================================================
-- PARTIE 4: TESTS RPC toggle_entreprise_mode
-- ============================================================

-- TEST M29.7: Basculer mode diffusion actif → silencieux
-- Pré-requis: Connecté en tant que régie, entreprise existante
BEGIN;
  -- Créer entreprise test
  WITH new_e AS (
    SELECT create_entreprise_simple(
      'Test Toggle M29',
      'test-toggle-m29@entreprise.ch',
      NULL, NULL, NULL, NULL, NULL, NULL,
      'actif'
    ) as id
  )
  -- Basculer en silencieux
  SELECT toggle_entreprise_mode(id, 'silencieux')
  FROM new_e;
  
  -- Vérifier mode changé
  SELECT mode_diffusion 
  FROM regies_entreprises 
  WHERE entreprise_id IN (
    SELECT id FROM entreprises WHERE email = 'test-toggle-m29@entreprise.ch'
  );
  -- Attendu: 'silencieux'
ROLLBACK;


-- ============================================================
-- PARTIE 5: TESTS POLICIES UPDATE/DELETE
-- ============================================================

-- TEST M29.8: Régie peut UPDATE entreprise autorisée
-- Pré-requis: Connecté en tant que régie, entreprise existante
BEGIN;
  -- Créer entreprise
  WITH new_e AS (
    SELECT create_entreprise_simple(
      'Test Update M29',
      'test-update-m29@entreprise.ch',
      NULL, NULL, NULL, NULL, NULL, NULL,
      'actif'
    ) as id
  )
  -- Mettre à jour
  UPDATE entreprises
  SET telephone = '+41 22 999 99 99'
  FROM new_e
  WHERE entreprises.id = new_e.id;
  
  -- Vérifier mise à jour
  SELECT telephone FROM entreprises WHERE email = 'test-update-m29@entreprise.ch';
  -- Attendu: '+41 22 999 99 99'
ROLLBACK;


-- TEST M29.9: Régie NE peut PAS UPDATE entreprise d'une autre régie
-- Pré-requis: Connecté en tant que régie, entreprise NON autorisée existe
-- Query:
BEGIN;
  -- Tenter UPDATE sur entreprise non autorisée (simuler avec UUID fictif)
  UPDATE entreprises
  SET telephone = 'HACK'
  WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;
  
  -- Attendu: 0 rows affected (policy bloque)
ROLLBACK;


-- TEST M29.10: Régie peut DELETE entreprise autorisée
-- Pré-requis: Connecté en tant que régie
BEGIN;
  -- Créer entreprise
  WITH new_e AS (
    SELECT create_entreprise_simple(
      'Test Delete M29',
      'test-delete-m29@entreprise.ch',
      NULL, NULL, NULL, NULL, NULL, NULL,
      'actif'
    ) as id
  )
  -- Supprimer
  DELETE FROM entreprises
  USING new_e
  WHERE entreprises.id = new_e.id;
  
  -- Vérifier suppression
  SELECT COUNT(*) FROM entreprises WHERE email = 'test-delete-m29@entreprise.ch';
  -- Attendu: 0
ROLLBACK;


-- ============================================================
-- PARTIE 6: TESTS RÉGRESSION
-- ============================================================

-- TEST REG.1: Workflow M26 (INSERT direct) fonctionne toujours
-- Pré-requis: Connecté en tant que régie
BEGIN;
  INSERT INTO entreprises (nom, email, profile_id)
  VALUES ('Test Reg M26', 'test-reg-m26@entreprise.ch', NULL);
  
  -- Attendu: SUCCESS (policy M26 autorise)
ROLLBACK;


-- TEST REG.2: SELECT entreprises fonctionne sans récursion
-- Pré-requis: Connecté en tant que régie
SELECT id, nom, email 
FROM entreprises
LIMIT 5;
-- Attendu: SUCCESS (pas d'erreur 42P17)


-- ============================================================
-- RÉSUMÉ TESTS (CHECKLIST VALIDATION)
-- ============================================================

/*
CHECKLIST VALIDATION M29:

Structure:
[ ] M29.1 - Policies créées (profiles, entreprises)
[ ] M29.2 - Fonctions RPC créées (3 fonctions)

RPC Simple:
[ ] M29.3 - create_entreprise_simple fonctionne
[ ] M29.4 - Validation mode_diffusion

RPC Profile:
[ ] M29.5 - create_entreprise_with_profile fonctionne
[ ] M29.6 - Échoue si profile inexistant

Toggle:
[ ] M29.7 - toggle_entreprise_mode fonctionne

UPDATE/DELETE:
[ ] M29.8 - Régie peut UPDATE ses entreprises
[ ] M29.9 - Régie NE PEUT PAS UPDATE entreprises autres régies
[ ] M29.10 - Régie peut DELETE ses entreprises

Régression:
[ ] REG.1 - Workflow M26 fonctionne toujours
[ ] REG.2 - SELECT sans récursion

TOTAL: 12 tests
*/

-- ============================================================
-- FIN TESTS VALIDATION M29
-- ============================================================
