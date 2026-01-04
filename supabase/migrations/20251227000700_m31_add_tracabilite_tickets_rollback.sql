-- ============================================================
-- MIGRATION M31 ROLLBACK: Suppression colonnes traçabilité
-- ============================================================

-- Supprimer index
DROP INDEX IF EXISTS idx_tickets_plafond_valide_par;
DROP INDEX IF EXISTS idx_tickets_diffuse_par;

-- Supprimer colonnes
ALTER TABLE tickets
DROP COLUMN IF EXISTS plafond_valide_par,
DROP COLUMN IF EXISTS plafond_valide_at,
DROP COLUMN IF EXISTS diffuse_at,
DROP COLUMN IF EXISTS diffuse_par;

RAISE NOTICE '✅ M31 ROLLBACK: Colonnes traçabilité supprimées';
