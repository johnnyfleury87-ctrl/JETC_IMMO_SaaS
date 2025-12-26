-- ============================================================
-- ROLLBACK M13 - Annuler sécurisation DELETE tickets
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M13 - Retirer policy DELETE sécurisée
-- Conséquence: Tickets peuvent être supprimés même avec missions (régression sécurité)
-- ============================================================

-- Supprimer policy DELETE sécurisée
DROP POLICY IF EXISTS "Regie can delete tickets without mission" ON tickets;

-- Supprimer fonction helper
DROP FUNCTION IF EXISTS ticket_has_mission(uuid) CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier policy supprimée
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'tickets' 
-- AND policyname = 'Regie can delete tickets without mission';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier fonction supprimée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'ticket_has_mission';
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé (rollback n'affecte pas données)

-- VALIDATION 4: Vérifier missions intactes
-- SELECT COUNT(*) FROM missions;
-- Attendu: Nombre inchangé

-- ============================================================
-- ATTENTION : RÉGRESSION SÉCURITÉ POST-ROLLBACK
-- ============================================================
-- Après rollback M13, la suppression de tickets n'est plus contrôlée.
-- Si une ancienne policy DELETE existait, elle doit être recréée manuellement.
-- Sinon, aucune règle DELETE n'existe (suppression impossible pour tous rôles).

-- ============================================================
-- FIN ROLLBACK M13
-- ============================================================
