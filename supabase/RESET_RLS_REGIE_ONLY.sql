-- =====================================================
-- RESET COMPLET RLS - REGIE UNIQUEMENT
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Supprimer TOUTES policies conflictuelles, ne garder QUE celles pour RÉGIE
-- Périmètre : Création locataire par régie (pas de fonctionnalité locataire à ce stade)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DROP TOUTES LES POLICIES EXISTANTES
-- =====================================================

-- IMMEUBLES
DROP POLICY IF EXISTS "Regie can view own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can manage own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Admin JTEC can view all immeubles" ON immeubles;
DROP POLICY IF EXISTS "Locataire can view own immeuble" ON immeubles;

-- LOGEMENTS
DROP POLICY IF EXISTS "Regie can view own logements" ON logements;
DROP POLICY IF EXISTS "Regie can manage own logements" ON logements;
DROP POLICY IF EXISTS "Locataire can view own logement" ON logements;
DROP POLICY IF EXISTS "Admin JTEC can view all logements" ON logements;

-- LOCATAIRES
DROP POLICY IF EXISTS "Locataire can view own data" ON locataires;
DROP POLICY IF EXISTS "Locataire can update own data" ON locataires;
DROP POLICY IF EXISTS "Regie can view own locataires" ON locataires;
DROP POLICY IF EXISTS "Regie can manage own locataires" ON locataires;
DROP POLICY IF EXISTS "Admin JTEC can view all locataires" ON locataires;
DROP POLICY IF EXISTS locataires_select_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_insert_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_update_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_delete_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_select_self_policy ON locataires;
DROP POLICY IF EXISTS locataires_select_policy ON locataires;

-- =====================================================
-- 2. RECRÉER POLICIES IMMEUBLES (RÉGIE + ADMIN UNIQUEMENT)
-- =====================================================

-- Régie peut voir ses immeubles
CREATE POLICY "Regie can view own immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie peut gérer ses immeubles (INSERT, UPDATE, DELETE)
CREATE POLICY "Regie can manage own immeubles"
ON immeubles FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC peut voir tous les immeubles
CREATE POLICY "Admin JTEC can view all immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);

-- =====================================================
-- 3. RECRÉER POLICIES LOGEMENTS (RÉGIE + ADMIN UNIQUEMENT)
-- =====================================================

-- Régie peut voir ses logements (via immeubles.regie_id)
CREATE POLICY "Regie can view own logements"
ON logements FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM immeubles i
    JOIN regies r ON r.id = i.regie_id
    WHERE i.id = logements.immeuble_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie peut gérer ses logements (INSERT, UPDATE, DELETE)
CREATE POLICY "Regie can manage own logements"
ON logements FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM immeubles i
    JOIN regies r ON r.id = i.regie_id
    WHERE i.id = logements.immeuble_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC peut voir tous les logements
CREATE POLICY "Admin JTEC can view all logements"
ON logements FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);

-- =====================================================
-- 4. RECRÉER POLICIES LOCATAIRES (RÉGIE + ADMIN UNIQUEMENT)
-- =====================================================

-- Régie peut voir ses locataires (via locataires.regie_id)
CREATE POLICY "Regie can view own locataires"
ON locataires FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie peut créer ses locataires
CREATE POLICY "Regie can insert own locataires"
ON locataires FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie peut modifier ses locataires
CREATE POLICY "Regie can update own locataires"
ON locataires FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Régie peut supprimer ses locataires
CREATE POLICY "Regie can delete own locataires"
ON locataires FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = locataires.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Admin JTEC peut voir tous les locataires
CREATE POLICY "Admin JTEC can view all locataires"
ON locataires FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
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
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'RESET RLS COMPLET - VALIDATION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Compter policies immeubles
  RAISE NOTICE '📊 IMMEUBLES : % policies actives', 
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'immeubles');
  
  -- Compter policies logements
  RAISE NOTICE '📊 LOGEMENTS : % policies actives', 
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'logements');
  
  -- Compter policies locataires
  RAISE NOTICE '📊 LOCATAIRES : % policies actives', 
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'locataires');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ POLICIES ACTIVES (RÉGIE UNIQUEMENT) :';
  RAISE NOTICE '   → immeubles : Regie view/manage + Admin view';
  RAISE NOTICE '   → logements : Regie view/manage + Admin view';
  RAISE NOTICE '   → locataires : Regie view/insert/update/delete + Admin view';
  RAISE NOTICE '';
  RAISE NOTICE '❌ POLICIES SUPPRIMÉES (LOCATAIRE) :';
  RAISE NOTICE '   → Aucune policy "Locataire can..." active';
  RAISE NOTICE '   → Aucune récursion possible';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TESTS À EFFECTUER :';
  RAISE NOTICE '   1. SELECT * FROM immeubles (régie)';
  RAISE NOTICE '   2. SELECT * FROM logements (régie)';
  RAISE NOTICE '   3. SELECT * FROM locataires (régie)';
  RAISE NOTICE '   4. Page /regie/locataires → OK';
  RAISE NOTICE '   5. Création locataire SANS logement → OK';
  RAISE NOTICE '   6. Création locataire AVEC logement → OK';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
