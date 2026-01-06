-- ============================================================
-- MIGRATION M43 - ROLLBACK PARTIE 2 : Supprimer colonnes
-- ============================================================

-- Supprimer vues
DROP VIEW IF EXISTS missions_avec_absence_locataire CASCADE;

-- Supprimer fonctions
DROP FUNCTION IF EXISTS ajouter_photos_mission(uuid, text[]) CASCADE;
DROP FUNCTION IF EXISTS signaler_absence_locataire(uuid, text) CASCADE;

-- Supprimer index
DROP INDEX IF EXISTS idx_missions_with_photos;
DROP INDEX IF EXISTS idx_missions_locataire_absent;

-- Supprimer colonnes
ALTER TABLE missions
DROP COLUMN IF EXISTS photos_urls,
DROP COLUMN IF EXISTS absence_raison,
DROP COLUMN IF EXISTS absence_signalement_at,
DROP COLUMN IF EXISTS locataire_absent;
