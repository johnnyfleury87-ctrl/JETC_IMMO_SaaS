-- ============================================================
-- ROLLBACK M04 - Supprimer RPC diffuser_ticket
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M04 - Retirer fonction diffuser_ticket
-- Conséquence: API calls vers cette fonction échoueront (retour état avant migration)
-- ============================================================

-- Supprimer fonction (CASCADE pour supprimer dépendances si existantes)
DROP FUNCTION IF EXISTS diffuser_ticket(uuid, text, uuid) CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier fonction supprimée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'diffuser_ticket';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé

-- VALIDATION 3: Test API échouera (comportement attendu après rollback)
-- API call: POST /rpc/diffuser_ticket {...}
-- Attendu: ERROR 404 - function not found

-- ============================================================
-- FIN ROLLBACK M04
-- ============================================================
