-- ============================================
-- ROLLBACK M15 : Rétablir NOT NULL sur priorite et plafond_intervention_chf
-- ============================================
-- Date: 2025-12-26
-- Attention: Ce rollback peut échouer si des tickets existent avec NULL
-- ============================================

BEGIN;

-- Rétablir NOT NULL sur priorite (avec valeur par défaut pour les NULL existants)
UPDATE public.tickets SET priorite = 'normale' WHERE priorite IS NULL;
ALTER TABLE public.tickets 
  ALTER COLUMN priorite SET NOT NULL;

-- Rétablir NOT NULL sur plafond_intervention_chf (avec valeur par défaut pour les NULL existants)
UPDATE public.tickets SET plafond_intervention_chf = 0 WHERE plafond_intervention_chf IS NULL;
ALTER TABLE public.tickets 
  ALTER COLUMN plafond_intervention_chf SET NOT NULL;

COMMIT;
