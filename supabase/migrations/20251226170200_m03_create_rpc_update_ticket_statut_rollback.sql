-- ============================================================
-- ROLLBACK M03 - Supprimer RPC update_ticket_statut
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M03 - Retirer fonction update_ticket_statut
-- Conséquence: API calls vers cette fonction échoueront (retour état avant migration)
-- ============================================================

-- Supprimer fonction (CASCADE pour supprimer dépendances si existantes)
DROP FUNCTION IF EXISTS update_ticket_statut(uuid, ticket_status) CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier fonction supprimée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'update_ticket_statut';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé

-- VALIDATION 3: Test API échouera (comportement attendu après rollback)
-- API call: POST /rpc/update_ticket_statut {...}
-- Attendu: ERROR 404 - function not found

-- ============================================================
-- FIN ROLLBACK M03
-- ============================================================
