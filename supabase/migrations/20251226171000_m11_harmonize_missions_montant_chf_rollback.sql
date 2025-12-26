-- ============================================================
-- ROLLBACK M11 - Annuler harmonisation montants missions
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M11 - Restaurer ancienne structure montant missions
-- Conséquence: Retour colonne 'montant' (ancien nom), perte colonne devise
-- ============================================================

-- Supprimer contraintes nouvelles
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_mission_devise_chf;
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_montant_reel_chf_positif;

-- Supprimer index
DROP INDEX IF EXISTS idx_missions_montant_reel_chf;

-- Supprimer colonne devise
ALTER TABLE missions DROP COLUMN IF EXISTS devise;

-- Renommer colonne montant_reel_chf → montant (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' AND column_name = 'montant_reel_chf'
  ) THEN
    ALTER TABLE missions RENAME COLUMN montant_reel_chf TO montant;
  END IF;
END $$;

-- Recréer ancienne contrainte montant positif (si nécessaire)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_montant_positif') THEN
    ALTER TABLE missions ADD CONSTRAINT check_montant_positif 
    CHECK (montant IS NULL OR montant >= 0);
  END IF;
END $$;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier colonne montant restaurée
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'montant';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier colonne montant_reel_chf supprimée
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'montant_reel_chf';
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier colonne devise supprimée
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'devise';
-- Attendu: 0 ligne

-- VALIDATION 4: Vérifier contraintes nouvelles supprimées
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('check_mission_devise_chf', 'check_montant_reel_chf_positif');
-- Attendu: 0 ligne

-- VALIDATION 5: Vérifier ancienne contrainte restaurée
-- SELECT conname FROM pg_constraint WHERE conname = 'check_montant_positif';
-- Attendu: 1 ligne

-- VALIDATION 6: Vérifier missions intactes (données conservées)
-- SELECT COUNT(*) FROM missions;
-- Attendu: Nombre inchangé

-- ============================================================
-- FIN ROLLBACK M11
-- ============================================================
