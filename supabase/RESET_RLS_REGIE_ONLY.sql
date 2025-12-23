-- =====================================================
-- RESET COMPLET RLS - PHASE 1 RÉGIE UNIQUEMENT
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Reset total policies RLS pour PHASE 1 (création locataire par régie)
-- Périmètre : Régie CRUD locataires, pas de fonctionnalité locataire frontend
-- Idempotent : Exécutable plusieurs fois sans erreur
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DROP TOUTES LES POLICIES (SANS EXCEPTION)
-- =====================================================

-- IMMEUBLES - Toutes variantes possibles
DROP POLICY IF EXISTS "Regie can view own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can manage own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can insert own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can update own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can delete own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Admin JTEC can view all immeubles" ON immeubles;
DROP POLICY IF EXISTS "Admin JTEC can manage all immeubles" ON immeubles;
DROP POLICY IF EXISTS "Locataire can view own immeuble" ON immeubles;
DROP POLICY IF EXISTS immeubles_select_policy ON immeubles;
DROP POLICY IF EXISTS immeubles_all_policy ON immeubles;

-- LOGEMENTS - Toutes variantes possibles
DROP POLICY IF EXISTS "Regie can view own logements" ON logements;
DROP POLICY IF EXISTS "Regie can manage own logements" ON logements;
DROP POLICY IF EXISTS "Regie can insert own logements" ON logements;
DROP POLICY IF EXISTS "Regie can update own logements" ON logements;
DROP POLICY IF EXISTS "Regie can delete own logements" ON logements;
DROP POLICY IF EXISTS "Locataire can view own logement" ON logements;
DROP POLICY IF EXISTS "Admin JTEC can view all logements" ON logements;
DROP POLICY IF EXISTS "Admin JTEC can manage all logements" ON logements;
DROP POLICY IF EXISTS logements_select_policy ON logements;
DROP POLICY IF EXISTS logements_all_policy ON logements;

-- LOCATAIRES - Toutes variantes possibles
DROP POLICY IF EXISTS "Locataire can view own data" ON locataires;
DROP POLICY IF EXISTS "Locataire can update own data" ON locataires;
DROP POLICY IF EXISTS "Locataire can view own profile" ON locataires;
DROP POLICY IF EXISTS "Regie can view own locataires" ON locataires;
DROP POLICY IF EXISTS "Regie can manage own locataires" ON locataires;
DROP POLICY IF EXISTS "Regie can insert own locataires" ON locataires;
DROP POLICY IF EXISTS "Regie can update own locataires" ON locataires;
DROP POLICY IF EXISTS "Regie can delete own locataires" ON locataires;
DROP POLICY IF EXISTS "Admin JTEC can view all locataires" ON locataires;
DROP POLICY IF EXISTS "Admin JTEC can manage all locataires" ON locataires;
DROP POLICY IF EXISTS locataires_select_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_insert_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_update_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_delete_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_select_self_policy ON locataires;
DROP POLICY IF EXISTS locataires_select_policy ON locataires;
DROP POLICY IF EXISTS locataires_all_policy ON locataires;

-- =====================================================
-- 2. IMMEUBLES - POLICIES MINIMALES (RÉGIE + ADMIN)
-- =====================================================

-- Régie SELECT ses immeubles
DROP POLICY IF EXISTS "Regie can view own immeubles" ON immeubles;
CREATE POLICY "Regie can view own immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie ALL (INSERT/UPDATE/DELETE) ses immeubles
DROP POLICY IF EXISTS "Regie can manage own immeubles" ON immeubles;
CREATE POLICY "Regie can manage own immeubles"
ON immeubles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC SELECT tous immeubles
DROP POLICY IF EXISTS "Admin JTEC can view all immeubles" ON immeubles;
CREATE POLICY "Admin JTEC can view all immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);

-- =====================================================
-- 3. LOGEMENTS - POLICIES MINIMALES (RÉGIE + ADMIN)
-- =====================================================

-- Régie SELECT ses logements (via immeubles → regies)
DROP POLICY IF EXISTS "Regie can view own logements" ON logements;
CREATE POLICY "Regie can view own logements"
ON logements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM immeubles i
    JOIN regies r ON r.id = i.regie_id
    WHERE i.id = logements.immeuble_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie ALL (INSERT/UPDATE/DELETE) ses logements
DROP POLICY IF EXISTS "Regie can manage own logements" ON logements;
CREATE POLICY "Regie can manage own logements"
ON logements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM immeubles i
    JOIN regies r ON r.id = i.regie_id
    WHERE i.id = logements.immeuble_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC SELECT tous logements
DROP POLICY IF EXISTS "Admin JTEC can view all logements" ON logements;
CREATE POLICY "Admin JTEC can view all logements"
ON logements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);

-- =====================================================
-- 4. LOCATAIRES - POLICIES MINIMALES (RÉGIE + ADMIN)
-- =====================================================

-- Régie SELECT ses locataires (via locataires.regie_id)
DROP POLICY IF EXISTS "Regie can view own locataires" ON locataires;
CREATE POLICY "Regie can view own locataires"
ON locataires FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie INSERT ses locataires
DROP POLICY IF EXISTS "Regie can insert own locataires" ON locataires;
CREATE POLICY "Regie can insert own locataires"
ON locataires FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie UPDATE ses locataires
DROP POLICY IF EXISTS "Regie can update own locataires" ON locataires;
CREATE POLICY "Regie can update own locataires"
ON locataires FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie DELETE ses locataires
DROP POLICY IF EXISTS "Regie can delete own locataires" ON locataires;
CREATE POLICY "Regie can delete own locataires"
ON locataires FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC SELECT tous locataires
DROP POLICY IF EXISTS "Admin JTEC can view all locataires" ON locataires;
CREATE POLICY "Admin JTEC can view all locataires"
ON locataires FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);

COMMIT;

-- =====================================================
-- 5. VALIDATION
-- =====================================================

DO $$
BEGIN
DECLARE
  v_immeubles_count int;
  v_logements_count int;
  v_locataires_count int;
BEGIN
  SELECT COUNT(*) INTO v_immeubles_count FROM pg_policies WHERE tablename = 'immeubles';
  SELECT COUNT(*) INTO v_logements_count FROM pg_policies WHERE tablename = 'logements';
  SELECT COUNT(*) INTO v_locataires_count FROM pg_policies WHERE tablename = 'locataires';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'RESET RLS PHASE 1 - VALIDATION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 COMPTAGE POLICIES :';
  RAISE NOTICE '   immeubles : % policies', v_immeubles_count;
  RAISE NOTICE '   logements : % policies', v_logements_count;
  RAISE NOTICE '   locataires : % policies', v_locataires_count;
  RAISE NOTICE '';
  
  IF v_immeubles_count = 3 AND v_logements_count = 3 AND v_locataires_count = 5 THEN
    RAISE NOTICE '✅ NOMBRE DE POLICIES CORRECT';
  ELSE
    RAISE WARNING '⚠️  NOMBRE DE POLICIES INCORRECT (attendu: 3, 3, 5)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ POLICIES ACTIVES (PHASE 1) :';
  RAISE NOTICE '   immeubles → Regie: SELECT + ALL, Admin: SELECT';
  RAISE NOTICE '   logements → Regie: SELECT + ALL, Admin: SELECT';
  RAISE NOTICE '   locataires → Regie: SELECT + INSERT + UPDATE + DELETE, Admin: SELECT';
  RAISE NOTICE '';
  RAISE NOTICE '❌ POLICIES SUPPRIMÉES :';
  RAISE NOTICE '   → Toutes policies "Locataire can..."';
  RAISE NOTICE '   → Toutes policies avec récursion';
  RAISE NOTICE '   → Toutes policies legacy';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 TESTS MINIMAUX :';
  RAISE NOTICE '   1. SELECT * FROM immeubles → OK (régie)';
  RAISE NOTICE '   2. SELECT * FROM logements → OK (régie)';
  RAISE NOTICE '   3. SELECT * FROM locataires → OK (régie)';
  RAISE NOTICE '   4. Page /regie/locataires charge';
  RAISE NOTICE '   5. Création locataire SANS logement
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
