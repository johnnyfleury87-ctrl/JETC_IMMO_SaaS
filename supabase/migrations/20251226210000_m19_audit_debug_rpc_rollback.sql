/**
 * Rollback M19: Supprimer les fonctions de debug
 */

DROP FUNCTION IF EXISTS public.jtec_test_insert_ticket;
DROP FUNCTION IF EXISTS public.jtec_debug_schema;
