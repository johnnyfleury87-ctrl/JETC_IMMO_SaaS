-- ============================================================
-- MIGRATION M28 - Fix récursion RLS entreprises ↔ regies_entreprises
-- ============================================================
-- Date: 2025-12-27
-- Phase: Fix critique récursion RLS
-- Objectif: Empêcher récursion infinie entre policies SELECT entreprises et regies_entreprises
-- Erreur corrigée: 42P17 "infinite recursion detected in policy for relation \"entreprises\""
-- Rollback: 20251227000400_m28_fix_rls_recursion_entreprises_rollback.sql
-- ============================================================

-- PROBLÈME IDENTIFIÉ:
-- 1. Policy "Regie can view authorized entreprises" sur entreprises
--    → SELECT regies_entreprises
-- 2. Policy "Entreprise can view own authorizations" sur regies_entreprises
--    → SELECT entreprises
-- 3. RÉCURSION INFINIE

-- SOLUTION:
-- Créer une fonction SECURITY DEFINER qui vérifie si l'utilisateur
-- est propriétaire d'une entreprise SANS déclencher RLS

-- Fonction helper pour éviter récursion
CREATE OR REPLACE FUNCTION is_user_entreprise_owner(p_entreprise_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- SECURITY DEFINER bypass RLS sur entreprises
  SELECT EXISTS (
    SELECT 1
    FROM entreprises
    WHERE id = p_entreprise_id
      AND profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_user_entreprise_owner IS 
  'Vérifie si utilisateur possède entreprise (SECURITY DEFINER bypass RLS pour éviter récursion)';

-- Supprimer ancienne policy récursive
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;

-- Créer nouvelle policy NON-récursive utilisant la fonction helper
CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises
FOR SELECT
TO authenticated
USING (
  -- Utiliser fonction SECURITY DEFINER qui bypass RLS
  is_user_entreprise_owner(entreprise_id)
);

-- ============================================================
-- VALIDATION
-- ============================================================

-- TEST 1: Vérifier policy créée
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'regies_entreprises'
--   AND policyname = 'Entreprise can view own authorizations';
-- Attendu: 1 ligne

-- TEST 2: Régie charge entreprises sans erreur
-- Pré-requis: Connecté en tant que régie
-- Query: SELECT * FROM entreprises;
-- Attendu: SUCCESS (pas d'erreur 42P17)

-- TEST 3: Entreprise voit ses autorisations
-- Pré-requis: Connecté en tant qu'entreprise
-- Query: SELECT * FROM regies_entreprises;
-- Attendu: Lignes où entreprise_id correspond au profile

-- ============================================================
-- NOTES TECHNIQUES
-- ============================================================

-- 1. Pourquoi cette correction fonctionne:
--    - La fonction is_user_entreprise_owner() a SECURITY DEFINER
--    - SECURITY DEFINER bypass TOUS les RLS (exécuté avec droits owner)
--    - Plus de récursion car RLS sur entreprises n'est PAS déclenché

-- 2. Sécurité:
--    - La fonction vérifie profile_id = auth.uid() (sécurisé)
--    - Pas d'injection SQL possible (paramètre typé uuid)
--    - STABLE (pas d'effets de bord)

-- 3. Performance:
--    - Fonction inlinée par PostgreSQL (STABLE + simple SELECT)
--    - Index utilisé sur entreprises(id, profile_id)
--    - Impact négligeable

-- ============================================================
-- FIN MIGRATION M28
-- ============================================================
