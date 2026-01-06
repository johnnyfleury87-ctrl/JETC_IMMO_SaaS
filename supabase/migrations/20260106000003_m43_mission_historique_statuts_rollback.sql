-- ============================================================
-- MIGRATION M43 - ROLLBACK PARTIE 3 : Supprimer historique
-- ============================================================

-- Supprimer vues
DROP VIEW IF EXISTS mission_transitions_anormales CASCADE;
DROP VIEW IF EXISTS mission_transitions_stats CASCADE;
DROP VIEW IF EXISTS mission_historique_details CASCADE;

-- Supprimer policies
DROP POLICY IF EXISTS "Admin JTEC can view all historique" ON mission_historique_statuts;
DROP POLICY IF EXISTS "Regie can view historique for missions in own territory" ON mission_historique_statuts;
DROP POLICY IF EXISTS "Technicien can view historique for assigned missions" ON mission_historique_statuts;
DROP POLICY IF EXISTS "Entreprise can view historique for own missions" ON mission_historique_statuts;

-- Supprimer triggers
DROP TRIGGER IF EXISTS mission_creation_log ON missions;
DROP TRIGGER IF EXISTS mission_statut_change_log ON missions;
DROP FUNCTION IF EXISTS log_mission_creation() CASCADE;
DROP FUNCTION IF EXISTS log_mission_statut_change() CASCADE;

-- Supprimer table
DROP TABLE IF EXISTS mission_historique_statuts CASCADE;
