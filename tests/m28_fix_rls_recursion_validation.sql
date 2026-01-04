-- ============================================================
-- TESTS VALIDATION M28 - Fix récursion RLS entreprises
-- ============================================================
-- Objectif: Valider correction récursion infinie
-- Erreur corrigée: 42P17
-- Exécution: Environnement staging après application M28
-- ============================================================

-- ============================================================
-- PARTIE 1: TESTS STRUCTURE
-- ============================================================

-- TEST M28.1: Vérifier fonction helper créée
SELECT 
  proname,
  pronargs,
  prorettype::regtype,
  prosecdef,
  provolatile
FROM pg_proc
WHERE proname = 'is_user_entreprise_owner';
-- Attendu: 1 ligne
-- prosecdef = true (SECURITY DEFINER)
-- provolatile = 's' (STABLE)


-- TEST M28.2: Vérifier policy modifiée
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'regies_entreprises'
  AND policyname = 'Entreprise can view own authorizations';
-- Attendu: 1 ligne
-- qual doit contenir 'is_user_entreprise_owner'
-- PAS de référence à EXISTS(...FROM entreprises...)


-- ============================================================
-- PARTIE 2: TESTS NON-RÉCURSION
-- ============================================================

-- TEST M28.3: Régie charge entreprises (NO RECURSION)
-- Pré-requis: Connecté en tant que régie
-- Query:
BEGIN;
  SELECT id, nom, email 
  FROM entreprises
  ORDER BY nom
  LIMIT 10;
  
  -- Attendu: SUCCESS
  -- PAS d'erreur 42P17 "infinite recursion detected"
ROLLBACK;


-- TEST M28.4: Régie charge regies_entreprises (NO RECURSION)
-- Pré-requis: Connecté en tant que régie
-- Query:
BEGIN;
  SELECT regie_id, entreprise_id, mode_diffusion
  FROM regies_entreprises
  WHERE regie_id = get_user_regie_id()
  LIMIT 10;
  
  -- Attendu: SUCCESS
ROLLBACK;


-- TEST M28.5: Entreprise charge regies_entreprises (NO RECURSION)
-- Pré-requis: Connecté en tant qu'entreprise (profile_id valide)
-- Query:
BEGIN;
  SELECT regie_id, entreprise_id, mode_diffusion
  FROM regies_entreprises
  WHERE entreprise_id IN (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  LIMIT 10;
  
  -- Attendu: SUCCESS
  -- Fonction SECURITY DEFINER évite récursion
ROLLBACK;


-- ============================================================
-- PARTIE 3: TESTS FONCTIONNELS
-- ============================================================

-- TEST M28.6: Fonction helper fonctionne correctement
-- Pré-requis: Connecté en tant qu'entreprise avec entreprise_id connu
-- Query:
BEGIN;
  -- Tester avec entreprise_id invalide (UUID qui n'existe pas)
  SELECT is_user_entreprise_owner('00000000-0000-0000-0000-000000000000'::uuid) as test_invalide;
  -- Attendu: FALSE
  
  -- Tester avec entreprise_id valide (remplacer par un UUID réel de votre base)
  -- Décommenter et remplacer UUID ci-dessous :
  -- SELECT is_user_entreprise_owner('REMPLACER_PAR_UUID_REEL'::uuid) as test_valide;
  -- Attendu: TRUE (si l'entreprise avec cet UUID a profile_id = auth.uid())
ROLLBACK;


-- TEST M28.7: Régie voit UNIQUEMENT entreprises autorisées
-- Pré-requis: Connecté en tant que régie
-- Query:
BEGIN;
  -- Créer entreprise test
  WITH new_entreprise AS (
    INSERT INTO entreprises (nom, email, profile_id)
    VALUES ('Test M28 Visibilité', 'test-m28-visi@entreprise.ch', NULL)
    RETURNING id
  )
  -- Créer autorisation
  INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
  SELECT get_user_regie_id(), id, 'restreint'
  FROM new_entreprise;
  
  -- Vérifier visibilité
  SELECT id, nom FROM entreprises WHERE nom = 'Test M28 Visibilité';
  -- Attendu: 1 ligne (entreprise visible)
ROLLBACK;


-- TEST M28.8: Entreprise voit UNIQUEMENT ses autorisations
-- Pré-requis: Connecté en tant qu'entreprise
-- Query:
BEGIN;
  SELECT 
    re.regie_id,
    re.entreprise_id,
    re.mode_diffusion
  FROM regies_entreprises re
  WHERE re.entreprise_id IN (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  );
  
  -- Attendu: Lignes correspondant au profile de l'entreprise
  -- PAS d'erreur récursion
ROLLBACK;


-- ============================================================
-- PARTIE 4: TESTS RÉGRESSION
-- ============================================================

-- TEST REG.1: Policy "Regie can view own authorizations" fonctionne
-- Pré-requis: Connecté en tant que régie
-- Query:
SELECT regie_id, COUNT(*) as nb_entreprises
FROM regies_entreprises
WHERE regie_id = get_user_regie_id()
GROUP BY regie_id;
-- Attendu: Résultats corrects


-- TEST REG.2: Policy "Admin JTEC" fonctionne toujours
-- Pré-requis: Connecté en tant qu'admin_jtec
-- Query:
SELECT COUNT(*) FROM regies_entreprises;
-- Attendu: Total complet


-- TEST REG.3: INSERT regies_entreprises fonctionne
-- Pré-requis: Connecté en tant que régie
-- Query:
BEGIN;
  WITH new_entreprise AS (
    INSERT INTO entreprises (nom, email, profile_id)
    VALUES ('Test M28 Insert', 'test-m28-insert@entreprise.ch', NULL)
    RETURNING id
  )
  INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
  SELECT get_user_regie_id(), id, 'restreint'
  FROM new_entreprise
  RETURNING id;
  
  -- Attendu: SUCCESS (UUID retourné)
ROLLBACK;


-- ============================================================
-- RÉSUMÉ TESTS (CHECKLIST VALIDATION)
-- ============================================================

/*
CHECKLIST VALIDATION M28:

Structure:
[ ] M28.1 - Fonction is_user_entreprise_owner créée
[ ] M28.2 - Policy modifiée (utilise fonction helper)

Non-récursion:
[ ] M28.3 - Régie charge entreprises (pas d'erreur 42P17)
[ ] M28.4 - Régie charge regies_entreprises (pas d'erreur)
[ ] M28.5 - Entreprise charge regies_entreprises (pas d'erreur)

Fonctionnel:
[ ] M28.6 - Fonction helper retourne TRUE/FALSE correctement
[ ] M28.7 - Régie voit entreprises autorisées
[ ] M28.8 - Entreprise voit ses autorisations

Régression:
[ ] REG.1 - Policy "Regie can view own authorizations" OK
[ ] REG.2 - Policy "Admin JTEC" OK
[ ] REG.3 - INSERT regies_entreprises OK

TOTAL: 11 tests
*/

-- ============================================================
-- FIN TESTS VALIDATION M28
-- ============================================================
