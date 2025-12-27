-- ============================================================
-- TESTS VALIDATION M26 - RLS INSERT entreprises régie
-- ============================================================
-- Objectif: Valider policy RLS + workflow création entreprise
-- Migrations testées: M26 (RLS INSERT régie)
-- Exécution: Environnement staging UNIQUEMENT
-- ============================================================

-- ============================================================
-- PARTIE 1: TESTS STRUCTURE & RLS
-- ============================================================

-- TEST M26.1: Vérifier policy RLS créée
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
WHERE tablename = 'entreprises'
ORDER BY policyname;
-- Attendu: 5 policies dont "Regie can insert entreprise" (cmd='INSERT')


-- TEST M26.2: Vérifier structure table entreprises inchangée
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'entreprises'
  AND table_schema = 'public'
ORDER BY ordinal_position;
-- Attendu: 15 colonnes (id, nom, siret, adresse, code_postal, ville, telephone, 
--          email, specialites, profile_id, description, site_web, created_at, 
--          updated_at, signature_url)
-- ✅ AUCUNE colonne ajoutée/supprimée


-- ============================================================
-- PARTIE 2: TESTS RLS INSERT
-- ============================================================

-- TEST M26.3: Régie peut INSERT entreprise (SUCCESS)
-- Pré-requis: Utilisateur connecté role='regie', get_user_regie_id() != NULL
-- Setup:
/*
-- Se connecter en tant que régie via frontend
-- OU configurer SET SESSION AUTHORIZATION (staging)
*/

-- Query test:
BEGIN;
  -- Insérer entreprise test
  INSERT INTO entreprises (
    nom, 
    email, 
    telephone, 
    adresse, 
    ville, 
    code_postal, 
    siret, 
    description,
    profile_id  -- NULL explicitement (pas de compte auth)
  ) VALUES (
    'Entreprise Test M26',
    'test-m26@entreprise-regie.ch',
    '+41 22 999 88 77',
    'Avenue Test 99',
    'Lausanne',
    '1000',
    'CHE-999.888.777',
    'Créée par régie pour tests M26',
    NULL
  ) RETURNING id, nom, email, profile_id;
  
  -- Vérifier insertion
  -- Attendu: 1 ligne retournée, profile_id = NULL
ROLLBACK; -- Ne pas polluer staging


-- TEST M26.4: Entreprise NE PEUT PAS INSERT entreprise (FAIL)
-- Pré-requis: Utilisateur connecté role='entreprise'
-- Query test:
BEGIN;
  -- Tenter insertion
  INSERT INTO entreprises (nom, email, profile_id) 
  VALUES (
    'Entreprise Test Entreprise',
    'test-entreprise@fail.ch',
    NULL  -- Même NULL, policy "Entreprise can insert own profile" vérifie profile_id = auth.uid()
  );
  
  -- NE DEVRAIT PAS arriver ici
  RAISE EXCEPTION 'TEST ÉCHOUÉ: Entreprise a pu créer une entreprise';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST M26.4 SUCCESS: Entreprise bloquée (%))', SQLERRM;
ROLLBACK;


-- TEST M26.5: Locataire NE PEUT PAS INSERT entreprise (FAIL)
-- Pré-requis: Utilisateur connecté role='locataire'
-- Query test:
BEGIN;
  INSERT INTO entreprises (nom, email) 
  VALUES ('Test Locataire', 'test-locataire@fail.ch');
  
  RAISE EXCEPTION 'TEST ÉCHOUÉ: Locataire a pu créer entreprise';
EXCEPTION
  WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'TEST M26.5 SUCCESS: Locataire bloqué (%))', SQLERRM;
ROLLBACK;


-- ============================================================
-- PARTIE 3: TESTS WORKFLOW COMPLET
-- ============================================================

-- TEST M26.6: Workflow création entreprise + autorisation
-- Pré-requis: Utilisateur connecté role='regie'
-- Query test:
BEGIN;
  -- ÉTAPE 1: Créer entreprise
  WITH new_entreprise AS (
    INSERT INTO entreprises (
      nom, email, ville, telephone, description, profile_id
    ) VALUES (
      'Plomberie Workflow Test',
      'workflow@plomberie-test.ch',
      'Genève',
      '+41 22 111 22 33',
      'Contact: Jean Dupont, responsable interventions',
      NULL  -- Workflow régie = pas de compte auth
    ) RETURNING id, nom
  )
  -- ÉTAPE 2: Créer autorisation regies_entreprises
  INSERT INTO regies_entreprises (
    regie_id,
    entreprise_id,
    mode_diffusion
  )
  SELECT 
    get_user_regie_id(),
    id,
    'restreint'
  FROM new_entreprise
  RETURNING 
    id AS autorisation_id,
    entreprise_id,
    mode_diffusion,
    date_autorisation;
  
  -- Attendu: 1 ligne retournée, mode_diffusion = 'restreint'
ROLLBACK;


-- TEST M26.7: Vérifier entreprise visible par régie après création
-- Pré-requis: Entreprise créée + autorisation créée (TEST M26.6 sans ROLLBACK)
-- Query test:
/*
-- Créer entreprise test persistante (sans ROLLBACK)
WITH new_entreprise AS (
  INSERT INTO entreprises (nom, email, profile_id)
  VALUES ('Entreprise Visible Test', 'visible@test.ch', NULL)
  RETURNING id, nom
)
INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
SELECT get_user_regie_id(), id, 'restreint'
FROM new_entreprise;

-- Vérifier visibilité via policy SELECT existante
SELECT id, nom, email, ville, profile_id
FROM entreprises
WHERE nom = 'Entreprise Visible Test';
-- Attendu: 1 ligne (policy "Regie can view authorized entreprises" autorise)
*/


-- ============================================================
-- PARTIE 4: TESTS RÉGRESSION (NON-RÉGRESSION)
-- ============================================================

-- TEST REG.1: Policy INSERT existante "Entreprise can insert own profile" toujours active
-- Pré-requis: Utilisateur connecté role='entreprise' avec profile_id valide
-- Query test:
BEGIN;
  -- Entreprise DOIT pouvoir créer SON propre profil
  INSERT INTO entreprises (
    nom, email, profile_id
  ) VALUES (
    'Mon Entreprise',
    'mon@entreprise.ch',
    auth.uid()  -- Profile_id = utilisateur connecté
  ) RETURNING id, nom, profile_id;
  
  -- Attendu: SUCCESS (policy existante fonctionne toujours)
ROLLBACK;


-- TEST REG.2: Aucun impact sur tickets FK entreprises.id
-- Query test:
SELECT 
  t.id AS ticket_id,
  t.titre,
  t.entreprise_id,
  e.nom AS entreprise_nom,
  e.profile_id AS entreprise_profile_id
FROM tickets t
INNER JOIN entreprises e ON e.id = t.entreprise_id
WHERE t.entreprise_id IS NOT NULL
LIMIT 5;
-- Attendu: Résultats corrects (JOIN fonctionne même si profile_id = NULL)
-- ✅ FK entreprises.id inchangé, pas de régression


-- TEST REG.3: Aucun impact sur missions FK entreprises.id
-- Query test:
SELECT 
  m.id AS mission_id,
  m.entreprise_id,
  e.nom AS entreprise_nom,
  e.profile_id
FROM missions m
INNER JOIN entreprises e ON e.id = m.entreprise_id
LIMIT 5;
-- Attendu: Résultats corrects
-- ✅ FK missions.entreprise_id fonctionne


-- TEST REG.4: Aucun impact sur techniciens FK entreprises.id
-- Query test:
SELECT 
  te.id AS technicien_id,
  te.nom AS technicien_nom,
  te.entreprise_id,
  e.nom AS entreprise_nom
FROM techniciens te
INNER JOIN entreprises e ON e.id = te.entreprise_id
LIMIT 5;
-- Attendu: Résultats corrects
-- ✅ FK techniciens.entreprise_id fonctionne


-- ============================================================
-- PARTIE 5: TESTS FRONTEND (MANUEL)
-- ============================================================

-- TEST FRONT.1: Onglet entreprises visible pour régie
-- 1. Se connecter en tant que régie
-- 2. Naviguer vers /regie/entreprises.html
-- 3. Vérifier page charge sans erreur
-- Attendu: ✅ Page affichée, menu "Entreprises" actif

-- TEST FRONT.2: Liste entreprises vide au démarrage
-- Pré-requis: Aucune entreprise autorisée pour cette régie
-- Attendu: ✅ Message "Aucune entreprise partenaire" + bouton "Créer une entreprise"

-- TEST FRONT.3: Création entreprise via formulaire
-- 1. Cliquer "Nouvelle entreprise"
-- 2. Remplir formulaire:
--    - Nom: "Entreprise Frontend Test"
--    - Email: "frontend-test@entreprise.ch"
--    - Téléphone: "+41 22 123 45 67"
--    - Ville: "Genève"
-- 3. Cliquer "Créer l'entreprise"
-- Attendu: ✅ Alert "Entreprise créée avec succès", modal fermée, entreprise visible dans liste

-- TEST FRONT.4: Entreprise visible dans liste après création
-- Attendu: ✅ Card entreprise affichée avec:
--   - Icône 🏭
--   - Nom "Entreprise Frontend Test"
--   - Ville "📍 Genève"
--   - Email "📧 frontend-test@entreprise.ch"
--   - Téléphone "📞 +41 22 123 45 67"
--   - Badge "🔐 Diffusion restreinte"

-- TEST FRONT.5: Vérification console navigateur
-- Attendu: 
--   ✅ "[CREATE] Entreprise créée: <uuid>"
--   ✅ "[CREATE] Autorisation créée avec succès"
--   ❌ Aucune erreur RLS
--   ❌ Aucune erreur 400/500

-- TEST FRONT.6: Vérification DB après création frontend
-- Query:
SELECT 
  e.id,
  e.nom,
  e.email,
  e.profile_id,
  re.regie_id,
  re.mode_diffusion
FROM entreprises e
INNER JOIN regies_entreprises re ON re.entreprise_id = e.id
WHERE e.email = 'frontend-test@entreprise.ch';
-- Attendu:
--   ✅ 1 ligne
--   ✅ profile_id = NULL
--   ✅ mode_diffusion = 'restreint'


-- ============================================================
-- RÉSUMÉ TESTS (CHECKLIST VALIDATION)
-- ============================================================

/*
CHECKLIST VALIDATION M26:

Structure & RLS:
[ ] M26.1 - Policy "Regie can insert entreprise" créée
[ ] M26.2 - Aucune colonne ajoutée/supprimée table entreprises

RLS INSERT:
[ ] M26.3 - Régie PEUT créer entreprise (profile_id = NULL)
[ ] M26.4 - Entreprise NE PEUT PAS créer autre entreprise
[ ] M26.5 - Locataire NE PEUT PAS créer entreprise

Workflow:
[ ] M26.6 - Création entreprise + autorisation réussit
[ ] M26.7 - Entreprise visible après création

Régression:
[ ] REG.1 - Policy "Entreprise can insert own profile" fonctionne
[ ] REG.2 - FK tickets.entreprise_id aucun impact
[ ] REG.3 - FK missions.entreprise_id aucun impact
[ ] REG.4 - FK techniciens.entreprise_id aucun impact

Frontend:
[ ] FRONT.1 - Onglet entreprises accessible
[ ] FRONT.2 - État vide initial correct
[ ] FRONT.3 - Formulaire création fonctionnel
[ ] FRONT.4 - Liste affiche entreprises créées
[ ] FRONT.5 - Console sans erreur
[ ] FRONT.6 - DB contient entreprise avec profile_id = NULL

TOTAL: 15 tests
*/

-- ============================================================
-- FIN TESTS VALIDATION M26
-- ============================================================
