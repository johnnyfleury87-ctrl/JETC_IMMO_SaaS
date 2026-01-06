-- ============================================================
-- MIGRATION M43 - ROLLBACK PARTIE 1 : Supprimer signalements
-- ============================================================

-- Supprimer vue
DROP VIEW IF EXISTS mission_signalements_details CASCADE;

-- Supprimer policies
DROP POLICY IF EXISTS "Admin JTEC can view all signalements" ON mission_signalements;
DROP POLICY IF EXISTS "Regie can view signalements for missions in own territory" ON mission_signalements;
DROP POLICY IF EXISTS "Entreprise can update signalements for own missions" ON mission_signalements;
DROP POLICY IF EXISTS "Entreprise can view signalements for own missions" ON mission_signalements;
DROP POLICY IF EXISTS "Technicien can view own signalements" ON mission_signalements;
DROP POLICY IF EXISTS "Technicien can create signalements for assigned missions" ON mission_signalements;

-- Supprimer trigger
DROP TRIGGER IF EXISTS mission_signalements_updated_at ON mission_signalements;
DROP FUNCTION IF EXISTS update_mission_signalements_updated_at() CASCADE;

-- Supprimer table
DROP TABLE IF EXISTS mission_signalements CASCADE;
