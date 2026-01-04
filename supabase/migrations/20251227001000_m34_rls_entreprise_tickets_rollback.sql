-- ============================================================
-- MIGRATION M34 ROLLBACK
-- ============================================================

DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

RAISE NOTICE '✅ M34 ROLLBACK: Policies RLS entreprise supprimées';
