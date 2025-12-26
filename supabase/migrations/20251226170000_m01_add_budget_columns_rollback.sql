-- ============================================================
-- ROLLBACK M01 - Supprimer colonnes budget sur tickets
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M01 - Retirer colonnes plafond_intervention_chf et devise
-- Conséquence: Perte des données plafond budgétaires (acceptable si rollback)
-- ============================================================

-- Supprimer contraintes CHECK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_plafond_positif;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;

-- Supprimer index
DROP INDEX IF EXISTS idx_tickets_plafond;

-- Supprimer colonnes (CASCADE si nécessaire)
ALTER TABLE tickets DROP COLUMN IF EXISTS plafond_intervention_chf;
ALTER TABLE tickets DROP COLUMN IF EXISTS devise;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier colonnes supprimées
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'tickets' 
-- AND column_name IN ('plafond_intervention_chf', 'devise');
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier contraintes supprimées
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('check_plafond_positif', 'check_devise_chf');
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier tickets intacts (autres colonnes)
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé par rapport à avant migration

-- ============================================================
-- FIN ROLLBACK M01
-- ============================================================
