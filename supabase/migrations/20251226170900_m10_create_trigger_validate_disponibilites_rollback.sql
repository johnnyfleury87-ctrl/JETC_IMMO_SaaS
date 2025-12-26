-- ============================================================
-- ROLLBACK M10 - Supprimer trigger validation 3 disponibilités
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M10 - Retirer trigger validation créneaux
-- Conséquence: Tickets peuvent être diffusés SANS 3 disponibilités (régression métier)
-- ============================================================

-- Supprimer trigger
DROP TRIGGER IF EXISTS trigger_check_disponibilites_before_diffusion ON tickets;

-- Supprimer fonction
DROP FUNCTION IF EXISTS check_disponibilites_before_diffusion() CASCADE;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier trigger supprimé
-- SELECT tgname FROM pg_trigger 
-- WHERE tgname = 'trigger_check_disponibilites_before_diffusion';
-- Attendu: 0 ligne

-- VALIDATION 2: Vérifier fonction supprimée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'check_disponibilites_before_diffusion';
-- Attendu: 0 ligne

-- VALIDATION 3: Test diffusion sans validation (staging uniquement)
-- Pré-requis: Ticket statut='ouvert' SANS créneaux
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_id_test>';
-- Attendu: 1 row updated (trigger absent, validation supprimée)

-- ============================================================
-- FIN ROLLBACK M10
-- ============================================================
