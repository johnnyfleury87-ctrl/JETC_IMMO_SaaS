-- ============================================================
-- ROLLBACK M08 - Supprimer colonnes classification tickets
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M08 - Retirer sous_categorie et piece
-- Conséquence: Perte des données classification métier (acceptable si rollback)
-- ============================================================

-- Supprimer contraintes CHECK
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_sous_categorie_valide;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_piece_valide;

-- Supprimer index
DROP INDEX IF EXISTS idx_tickets_sous_categorie;
DROP INDEX IF EXISTS idx_tickets_piece;

-- Supprimer colonnes
ALTER TABLE tickets DROP COLUMN IF EXISTS sous_categorie;
ALTER TABLE tickets DROP COLUMN IF EXISTS piece;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier colonnes supprimées
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'tickets' 
-- AND column_name IN ('sous_categorie', 'piece');
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier contraintes supprimées
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('check_sous_categorie_valide', 'check_piece_valide');
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier tickets intacts (autres colonnes)
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé

-- ============================================================
-- FIN ROLLBACK M08
-- ============================================================
