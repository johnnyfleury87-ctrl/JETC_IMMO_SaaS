-- ============================================================
-- ROLLBACK M42: Supprimer colonne disponibilite_id de missions
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Revenir à l'état avant M42
-- ============================================================

-- Supprimer index
DROP INDEX IF EXISTS idx_missions_disponibilite_id;

-- Supprimer colonne
ALTER TABLE missions
DROP COLUMN IF EXISTS disponibilite_id;

-- ============================================================
-- FIN ROLLBACK M42
-- ============================================================
