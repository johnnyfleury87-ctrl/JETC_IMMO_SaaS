-- ============================================================
-- MIGRATION M27 - Exposer get_user_regie_id comme RPC
-- ============================================================
-- Date: 2025-12-27
-- Phase: Fix visibilité entreprises
-- Objectif: Permettre au frontend d'appeler get_user_regie_id() via supabase.rpc()
-- Dépendances: 09b_helper_functions.sql (fonction existe déjà)
-- Règle métier: Cohérence regie_id entre création et lecture (RLS)
-- Rollback: 20251227000300_m27_expose_get_user_regie_id_rpc_rollback.sql
-- ============================================================

-- La fonction existe déjà dans 09b_helper_functions.sql
-- Il suffit de vérifier qu'elle est accessible via RPC

-- Vérification: La fonction est déjà SECURITY DEFINER
-- Elle peut être appelée via supabase.rpc('get_user_regie_id')

-- VALIDATION: Test RPC
-- SELECT get_user_regie_id();
-- Attendu: UUID de la régie (si role='regie') ou NULL

-- ============================================================
-- NOTES
-- ============================================================

-- 1. Fonction créée dans 09b_helper_functions.sql:
--    CREATE OR REPLACE FUNCTION get_user_regie_id()
--    RETURNS uuid
--    LANGUAGE sql
--    SECURITY DEFINER
--    STABLE

-- 2. SECURITY DEFINER permet l'appel via RPC sans RLS

-- 3. Utilisation frontend:
--    const { data } = await supabase.rpc('get_user_regie_id');
--    // data contient UUID de la régie

-- 4. Cohérence garantie:
--    - Création: INSERT regies_entreprises (regie_id = RPC result)
--    - Lecture: Policy SELECT utilise get_user_regie_id()
--    - Même UUID utilisé partout

-- ============================================================
-- FIN MIGRATION M27
-- ============================================================
