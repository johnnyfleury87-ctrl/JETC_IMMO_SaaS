-- ============================================================
-- ROLLBACK M09 - Supprimer table tickets_disponibilites
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M09 - Supprimer table créneaux disponibilité
-- Conséquence: Perte TOTALE des disponibilités locataires (acceptable si rollback)
-- ============================================================

-- Supprimer table (CASCADE supprime automatiquement policies, index, constraints)
DROP TABLE IF EXISTS tickets_disponibilites CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier table supprimée
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'tickets_disponibilites';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier policies supprimées
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'tickets_disponibilites';
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier tickets intacts
-- SELECT COUNT(*) FROM tickets;
-- Attendu: Nombre inchangé (FK CASCADE ne supprime pas tickets)

-- ============================================================
-- FIN ROLLBACK M09
-- ============================================================
