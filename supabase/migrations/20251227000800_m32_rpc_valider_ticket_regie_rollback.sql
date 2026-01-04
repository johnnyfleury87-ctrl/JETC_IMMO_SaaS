-- ============================================================
-- MIGRATION M32 ROLLBACK: Suppression RPC valider_ticket_regie
-- ============================================================

DROP FUNCTION IF EXISTS public.valider_ticket_regie(uuid, numeric, text, uuid);

RAISE NOTICE '✅ M32 ROLLBACK: RPC valider_ticket_regie supprimée';
