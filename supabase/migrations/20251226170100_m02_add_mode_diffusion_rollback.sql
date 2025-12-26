-- ============================================================
-- ROLLBACK M02 - Supprimer colonne mode_diffusion
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M02 - Retirer mode_diffusion
-- Conséquence: Perte des modes diffusion enregistrés (acceptable si rollback)
-- ============================================================

-- Supprimer contrainte CHECK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_mode_diffusion;

-- Supprimer index
DROP INDEX IF EXISTS idx_tickets_mode_diffusion;

-- Supprimer colonne
ALTER TABLE tickets DROP COLUMN IF EXISTS mode_diffusion;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier colonne supprimée
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'tickets' AND column_name = 'mode_diffusion';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier contrainte supprimée
-- SELECT conname FROM pg_constraint WHERE conname = 'check_mode_diffusion';
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé

-- ============================================================
-- FIN ROLLBACK M02
-- ============================================================
