-- ============================================================
-- ROLLBACK M35: Restaurer anciennes valeurs mode_diffusion
-- ============================================================

-- Supprimer nouvelles policies
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- Restaurer anciennes policies (si nécessaire - version avant M35)
-- Note: À adapter selon l'état avant M35

-- Restaurer anciennes valeurs données
UPDATE tickets SET mode_diffusion = 'public' WHERE mode_diffusion = 'general';
UPDATE tickets SET mode_diffusion = 'assigné' WHERE mode_diffusion = 'restreint';

RAISE NOTICE '⚠️ M35 ROLLBACK: Anciennes valeurs restaurées (déconseillé - incohérence avec M32!)';
