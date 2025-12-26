-- ============================================================
-- ROLLBACK M14 - Annuler synchronisation mission → ticket
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M14 - Retirer trigger synchronisation statut
-- Conséquence: Statuts mission et ticket peuvent diverger (régression cohérence)
-- ============================================================

-- Supprimer trigger
DROP TRIGGER IF EXISTS trigger_sync_ticket_statut_from_mission ON missions;

-- Supprimer fonction
DROP FUNCTION IF EXISTS sync_ticket_statut_from_mission() CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier trigger supprimé
-- SELECT tgname FROM pg_trigger 
-- WHERE tgname = 'trigger_sync_ticket_statut_from_mission';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier fonction supprimée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'sync_ticket_statut_from_mission';
-- Attendu: 0 ligne

-- VALIDATION 3: Test divergence statuts (staging uniquement)
-- Pré-requis: Mission statut='en_cours', ticket statut='en_cours'
-- UPDATE missions SET statut = 'terminee' WHERE id = '<mission_id>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut = 'en_cours' (pas de synchronisation, trigger supprimé)

-- VALIDATION 4: Vérifier missions intactes
-- SELECT COUNT(*) FROM missions;
-- Attendu: Nombre inchangé

-- VALIDATION 5: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé

-- ============================================================
-- ATTENTION : RÉGRESSION COHÉRENCE POST-ROLLBACK
-- ============================================================
-- Après rollback M14, les statuts mission et ticket NE SONT PLUS synchronisés.
-- Nécessite synchronisation manuelle ou re-application M14 pour cohérence.

-- ============================================================
-- FIN ROLLBACK M14
-- ============================================================
