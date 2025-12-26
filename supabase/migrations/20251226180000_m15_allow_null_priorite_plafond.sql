-- ============================================
-- MIGRATION M15 : Autoriser NULL pour priorite et plafond_intervention_chf
-- ============================================
-- Date: 2025-12-26
-- Contexte: Le locataire ne choisit PAS la priorité ni le plafond
--           Ces champs sont définis par la RÉGIE lors de la validation
-- 
-- Problème actuel: 
--   "null value in column priorite violates not-null constraint"
--
-- Solution:
--   - DROP NOT NULL sur tickets.priorite
--   - DROP NOT NULL sur tickets.plafond_intervention_chf
-- ============================================

BEGIN;

-- DROP NOT NULL sur priorite
ALTER TABLE public.tickets 
  ALTER COLUMN priorite DROP NOT NULL;

-- DROP NOT NULL sur plafond_intervention_chf
ALTER TABLE public.tickets 
  ALTER COLUMN plafond_intervention_chf DROP NOT NULL;

-- Commentaire explicatif
COMMENT ON COLUMN public.tickets.priorite IS 
  'Priorité du ticket (basse, normale, haute, urgente). NULL si non défini par la régie. Défini par la régie lors de la validation du ticket.';

COMMENT ON COLUMN public.tickets.plafond_intervention_chf IS 
  'Plafond d''intervention en CHF autorisé sans validation. NULL si non défini. Défini par la régie.';

COMMIT;
