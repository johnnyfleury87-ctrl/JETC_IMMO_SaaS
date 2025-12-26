-- ============================================================
-- MIGRATION M01 - Ajouter colonnes budget sur tickets
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Ajouter plafond_intervention_chf et devise pour gestion budgétaire tickets
-- Dépendances: Aucune
-- Rollback: 20251226170000_m01_add_budget_columns_rollback.sql
-- ============================================================

-- Activer extension UUID si nécessaire (standardisation gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ajouter colonnes budget
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_intervention_chf numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'CHF';

-- Contraintes CHECK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_plafond_positif') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_plafond_positif 
    CHECK (plafond_intervention_chf >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_devise_chf') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_devise_chf 
    CHECK (devise = 'CHF');
  END IF;
END $$;

-- Index pour performances requêtes filtrées sur plafond
CREATE INDEX IF NOT EXISTS idx_tickets_plafond 
ON tickets(plafond_intervention_chf) 
WHERE plafond_intervention_chf > 0;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier colonnes créées
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tickets'
-- AND column_name IN ('plafond_intervention_chf', 'devise');
-- Attendu: 2 lignes (numeric NOT NULL DEFAULT 0, text NOT NULL DEFAULT 'CHF')

-- VALIDATION 2: Vérifier contraintes
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('check_plafond_positif', 'check_devise_chf');
-- Attendu: 2 lignes

-- VALIDATION 3: Vérifier index
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tickets_plafond';
-- Attendu: 1 ligne

-- VALIDATION 4: Test INSERT valide (environnement staging uniquement)
-- INSERT INTO tickets (titre, description, categorie, priorite, locataire_id, logement_id, plafond_intervention_chf)
-- VALUES ('Test M01', 'Test migration', 'plomberie', 'normale', 
--   '<locataire_id_test>', '<logement_id_test>', 100.00)
-- RETURNING id, plafond_intervention_chf, devise;
-- Attendu: 1 ligne avec (100.00, 'CHF')
-- CLEANUP: DELETE FROM tickets WHERE titre = 'Test M01';

-- VALIDATION 5: Test contrainte négative (doit échouer - staging uniquement)
-- INSERT INTO tickets (..., plafond_intervention_chf) VALUES (..., -10);
-- Attendu: ERROR - new row violates check constraint "check_plafond_positif"

-- ============================================================
-- FIN MIGRATION M01
-- ============================================================
