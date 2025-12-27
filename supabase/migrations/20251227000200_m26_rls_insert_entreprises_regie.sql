-- ============================================================
-- MIGRATION M26 - Autoriser régie à créer entreprises
-- ============================================================
-- Date: 2025-12-27
-- Phase: Gestion entreprises partenaires
-- Objectif: Permettre à une régie de créer des entreprises SANS compte auth
-- Dépendances: 10_entreprises.sql, 18_rls.sql
-- Règle métier: Régie crée entreprise avec profile_id = NULL (pas de login)
-- Rollback: 20251227000200_m26_rls_insert_entreprises_regie_rollback.sql
-- ============================================================

-- Ajouter policy INSERT pour régie sur table entreprises
CREATE POLICY "Regie can insert entreprise"
ON entreprises
FOR INSERT
TO authenticated
WITH CHECK (
  -- Vérifier utilisateur est bien une régie (pas entreprise, pas locataire)
  get_user_regie_id() IS NOT NULL
  -- Pas de contrainte sur NEW.profile_id (peut être NULL)
);

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier policy créée
-- Query:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'entreprises'
--   AND policyname = 'Regie can insert entreprise';
-- Attendu: 1 ligne (policy INSERT)

-- VALIDATION 2: Test INSERT par régie (staging)
-- Pré-requis: Utilisateur connecté role='regie'
-- Query:
-- INSERT INTO entreprises (
--   nom, email, telephone, adresse, ville, code_postal, siret, description
-- ) VALUES (
--   'Entreprise Test Régie',
--   'test@entreprise-regie.ch',
--   '+41 22 123 45 67',
--   'Rue Test 10',
--   'Genève',
--   '1200',
--   'CHE-123.456.789',
--   'Créée par régie pour tests'
-- ) RETURNING id;
-- Attendu: SUCCESS, retourne UUID entreprise créée

-- VALIDATION 3: Test INSERT par entreprise (doit échouer)
-- Pré-requis: Utilisateur connecté role='entreprise'
-- Query:
-- INSERT INTO entreprises (nom, email) 
-- VALUES ('Entreprise Test Entreprise', 'test@entreprise.ch')
-- RETURNING id;
-- Attendu: ERREUR RLS "new row violates row-level security policy" 
--          (policy existante "Entreprise can insert own profile" vérifie profile_id = auth.uid())

-- VALIDATION 4: Créer lien regies_entreprises après INSERT
-- Pré-requis: Entreprise créée par régie (VALIDATION 2)
-- Query:
-- INSERT INTO regies_entreprises (
--   regie_id, entreprise_id, mode_diffusion
-- ) VALUES (
--   '<regie_id_test>'::uuid,
--   '<entreprise_id_validation2>'::uuid,
--   'restreint'
-- ) RETURNING id;
-- Attendu: SUCCESS (policy INSERT regies_entreprises existante autorise régie)

-- VALIDATION 5: Vérifier entreprise visible par régie
-- Query:
-- SELECT id, nom, email, ville, profile_id
-- FROM entreprises
-- WHERE id = '<entreprise_id_validation2>';
-- Attendu: 1 ligne, profile_id = NULL (pas de compte auth)

-- ============================================================
-- NOTES TECHNIQUE
-- ============================================================

-- 1. Policy WITH CHECK:
--    - Ne vérifie QUE get_user_regie_id() IS NOT NULL
--    - Pas de contrainte NEW.profile_id (accepte NULL ou UUID)
--    - Régie peut créer entreprise SANS compte utilisateur

-- 2. Cohabitation policies:
--    - "Entreprise can insert own profile" : profile_id = auth.uid()
--    - "Regie can insert entreprise" : get_user_regie_id() IS NOT NULL
--    - PostgreSQL évalue policies avec OR logique (une seule doit réussir)

-- 3. Workflow création:
--    1. Régie INSERT entreprises → policy M26 autorise
--    2. Régie INSERT regies_entreprises → policy 18_rls.sql autorise
--    3. Entreprise visible via policy SELECT existante

-- 4. profile_id NULL acceptable:
--    - Entreprise existe en tant que référentiel
--    - Pas de login possible (pas de profile_id)
--    - Invitation/compte viendra plus tard (hors scope)

-- 5. Impact tickets/missions:
--    - FK entreprises.id inchangé
--    - Tickets/missions peuvent référencer entreprises.profile_id = NULL
--    - Aucune régression (colonnes NOT NULL inchangées)

-- 6. Sécurité:
--    - Entreprise ne peut PAS créer d'autres entreprises
--    - Locataire ne peut PAS créer entreprises (get_user_regie_id() = NULL)
--    - Admin JTEC utilise policy SELECT existante

-- ============================================================
-- FIN MIGRATION M26
-- ============================================================
