-- ============================================================
-- ROLLBACK M27 - Exposer get_user_regie_id comme RPC
-- ============================================================

-- Aucune action requise (fonction existait déjà)
-- La fonction get_user_regie_id() reste disponible pour les policies RLS

-- Vérification:
-- SELECT proname FROM pg_proc WHERE proname = 'get_user_regie_id';
-- Attendu: 1 ligne (fonction existe toujours)

-- ============================================================
-- FIN ROLLBACK M27
-- ============================================================
