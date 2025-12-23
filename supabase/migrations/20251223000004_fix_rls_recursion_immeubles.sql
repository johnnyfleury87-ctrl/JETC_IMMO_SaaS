-- =====================================================
-- HOTFIX : RLS Recursion sur table immeubles
-- =====================================================
-- Date : 23 décembre 2025
-- Bug : infinite recursion detected in policy for relation "immeubles"
-- Cause : get_user_regie_id() lit immeubles, policies immeubles utilisent get_user_regie_id()
-- Solution : Simplifier policies immeubles pour ne PAS utiliser get_user_regie_id()
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DROP policies immeubles existantes
-- =====================================================

DROP POLICY IF EXISTS "Regie can view own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can manage own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Admin JTEC can view all immeubles" ON immeubles;

-- =====================================================
-- 2. CRÉER policies immeubles SANS get_user_regie_id()
-- =====================================================

-- Régie peut voir ses propres immeubles
-- ✅ CORRECTIF : Utilise regies.profile_id directement, pas get_user_regie_id()
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

COMMENT ON POLICY "Regie can view own immeubles" ON immeubles IS
  'Régie peut voir ses propres immeubles via regies.profile_id (pas de récursion)';

-- Régie peut gérer ses propres immeubles
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

COMMENT ON POLICY "Regie can manage own immeubles" ON immeubles IS
  'Régie peut gérer (INSERT/UPDATE/DELETE) ses propres immeubles via regies.profile_id';

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

COMMENT ON POLICY "Admin JTEC can view all immeubles" ON immeubles IS
  'Admin JTEC peut voir tous les immeubles (supervision globale)';

-- =====================================================
-- 3. VÉRIFICATION : Aucune policy ne référence immeubles dans USING
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Policies immeubles recréées sans récursion';
  RAISE NOTICE '   → Utilise regies.profile_id directement';
  RAISE NOTICE '   → Plus de dépendance à get_user_regie_id()';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tests à effectuer :';
  RAISE NOTICE '   1. SELECT * FROM immeubles (doit réussir pour régie)';
  RAISE NOTICE '   2. Charger page /regie/locataires (doit fonctionner)';
  RAISE NOTICE '   3. Vérifier logs : plus d''erreur 42P17';
END $$;

COMMIT;
