-- ============================================================
-- MIGRATION M33 ROLLBACK
-- ============================================================

DROP FUNCTION IF EXISTS public.get_entreprises_autorisees();

RAISE NOTICE '✅ M33 ROLLBACK: RPC get_entreprises_autorisees supprimée';
