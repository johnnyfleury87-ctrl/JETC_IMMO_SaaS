-- ============================================================
-- MIGRATION M02 - Ajouter colonne mode_diffusion
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Ajouter mode_diffusion ('public' / 'assigné') pour contrôler visibilité tickets
-- Dépendances: M01 (colonnes budget)
-- Rollback: 20251226170100_m02_add_mode_diffusion_rollback.sql
-- ============================================================

-- Ajouter colonne mode_diffusion (NULL par défaut = pas encore diffusé)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS mode_diffusion text;

-- Contrainte CHECK : valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_mode_diffusion') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_mode_diffusion 
    CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('public', 'assigné'));
  END IF;
END $$;

-- Index pour performances requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_tickets_mode_diffusion 
ON tickets(mode_diffusion) 
WHERE mode_diffusion IS NOT NULL;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier colonne créée
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tickets' AND column_name = 'mode_diffusion';
-- Attendu: 1 ligne (text, YES)

-- VALIDATION 2: Vérifier contrainte CHECK
-- SELECT conname FROM pg_constraint WHERE conname = 'check_mode_diffusion';
-- Attendu: 1 ligne

-- VALIDATION 3: Vérifier index
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tickets_mode_diffusion';
-- Attendu: 1 ligne

-- VALIDATION 4: Test valeurs autorisées (staging uniquement)
-- UPDATE tickets SET mode_diffusion = 'public' 
-- WHERE id = '<ticket_id_test>' RETURNING mode_diffusion;
-- Attendu: 'public'
-- UPDATE tickets SET mode_diffusion = 'assigné' 
-- WHERE id = '<ticket_id_test>' RETURNING mode_diffusion;
-- Attendu: 'assigné'
-- UPDATE tickets SET mode_diffusion = NULL 
-- WHERE id = '<ticket_id_test>' RETURNING mode_diffusion;
-- Attendu: NULL

-- VALIDATION 5: Test valeur invalide (doit échouer - staging uniquement)
-- UPDATE tickets SET mode_diffusion = 'invalide' WHERE id = '<ticket_id_test>';
-- Attendu: ERROR - new row violates check constraint "check_mode_diffusion"

-- ============================================================
-- FIN MIGRATION M02
-- ============================================================
