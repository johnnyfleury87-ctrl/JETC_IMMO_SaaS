-- ============================================================
-- ROLLBACK M38: Supprimer RPC update_entreprise_mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Rollback migration M38
-- Objectif: Supprimer RPC update_entreprise_mode_diffusion
-- ============================================================

DROP FUNCTION IF EXISTS public.update_entreprise_mode_diffusion(uuid, text);

-- ============================================================
-- FIN ROLLBACK M38
-- ============================================================
