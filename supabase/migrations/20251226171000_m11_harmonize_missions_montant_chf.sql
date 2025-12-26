-- ============================================================
-- MIGRATION M11 - Harmoniser montants missions (CHF)
-- ============================================================
-- Date: 2025-12-26
-- Phase: 2 (Enrichissement fonctionnel)
-- Objectif: Renommer montant → montant_reel_chf + ajouter devise pour cohérence
-- Dépendances: PHASE 1 complète (M01-M07)
-- Rollback: 20251226171000_m11_harmonize_missions_montant_chf_rollback.sql
-- ============================================================

-- Renommer colonne montant → montant_reel_chf (si colonne 'montant' existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' AND column_name = 'montant'
  ) THEN
    ALTER TABLE missions RENAME COLUMN montant TO montant_reel_chf;
  END IF;
END $$;

-- Ajouter colonne devise si inexistante
ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'CHF';

-- Contrainte CHECK devise CHF
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_mission_devise_chf') THEN
    ALTER TABLE missions ADD CONSTRAINT check_mission_devise_chf 
    CHECK (devise = 'CHF');
  END IF;
END $$;

-- Contrainte CHECK montant positif (modifier si existe déjà)
DO $$
BEGIN
  -- Supprimer ancienne contrainte si existe avec ancien nom
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_montant_positif') THEN
    ALTER TABLE missions DROP CONSTRAINT check_montant_positif;
  END IF;
  
  -- Créer nouvelle contrainte avec nom cohérent
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_montant_reel_chf_positif') THEN
    ALTER TABLE missions ADD CONSTRAINT check_montant_reel_chf_positif 
    CHECK (montant_reel_chf IS NULL OR montant_reel_chf >= 0);
  END IF;
END $$;

-- Index pour performances requêtes filtrées sur montant
CREATE INDEX IF NOT EXISTS idx_missions_montant_reel_chf 
ON missions(montant_reel_chf) 
WHERE montant_reel_chf IS NOT NULL;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier colonne renommée
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'montant_reel_chf';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier ancienne colonne n'existe plus
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'montant';
-- Attendu: 0 ligne

-- VALIDATION 3: Vérifier colonne devise
-- SELECT column_name, data_type, column_default FROM information_schema.columns 
-- WHERE table_name = 'missions' AND column_name = 'devise';
-- Attendu: 1 ligne (text, 'CHF')

-- VALIDATION 4: Vérifier contraintes
-- SELECT conname FROM pg_constraint 
-- WHERE conrelid = 'missions'::regclass 
-- AND conname IN ('check_mission_devise_chf', 'check_montant_reel_chf_positif');
-- Attendu: 2 lignes

-- VALIDATION 5: Vérifier ancienne contrainte supprimée
-- SELECT conname FROM pg_constraint 
-- WHERE conrelid = 'missions'::regclass 
-- AND conname = 'check_montant_positif';
-- Attendu: 0 ligne

-- VALIDATION 6: Vérifier index créé
-- SELECT indexname FROM pg_indexes 
-- WHERE indexname = 'idx_missions_montant_reel_chf';
-- Attendu: 1 ligne

-- VALIDATION 7: Test UPDATE montant valide (staging uniquement)
-- UPDATE missions SET montant_reel_chf = 250.00 WHERE id = '<mission_id_test>';
-- Attendu: 1 row updated
-- VALIDATION: SELECT montant_reel_chf, devise FROM missions WHERE id = '<mission_id_test>';
-- Attendu: (250.00, 'CHF')

-- VALIDATION 8: Test contrainte montant négatif (doit échouer - staging uniquement)
-- UPDATE missions SET montant_reel_chf = -50.00 WHERE id = '<mission_id_test>';
-- Attendu: ERROR - new row violates check constraint "check_montant_reel_chf_positif"

-- VALIDATION 9: Test contrainte devise invalide (doit échouer - staging uniquement)
-- UPDATE missions SET devise = 'EUR' WHERE id = '<mission_id_test>';
-- Attendu: ERROR - new row violates check constraint "check_mission_devise_chf"

-- VALIDATION 10: Vérifier compatibilité API existante (staging via API)
-- API call: GET /rest/v1/missions?id=eq.<mission_id>
-- Attendu: JSON contient champ "montant_reel_chf" (pas "montant")

-- ============================================================
-- FIN MIGRATION M11
-- ============================================================
