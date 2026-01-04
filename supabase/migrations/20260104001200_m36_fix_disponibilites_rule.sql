-- ============================================================
-- MIGRATION M36: Correction règle métier disponibilités
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Correction règle métier workflow tickets
-- Objectif: Changer validation de "exactement 3" à "au moins 1" disponibilité
-- Dépendances: M10 (trigger check_disponibilites_before_diffusion)
-- Rollback: 20260104001200_m36_fix_disponibilites_rule_rollback.sql
-- ============================================================

-- CONTEXTE:
-- Bug détecté: Trigger M10 exige exactement 3 disponibilités
-- Règle métier correcte: Au moins 1 disponibilité obligatoire, 2 autres optionnelles
-- Raison: L'entreprise choisit le créneau parmi ceux proposés (1 à 3)

-- Recréer fonction avec règle métier corrigée
CREATE OR REPLACE FUNCTION check_disponibilites_before_diffusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_disponibilites integer;
BEGIN
  -- Vérifier uniquement si transition vers statut 'en_attente' (diffusion)
  IF NEW.statut = 'en_attente' AND (OLD.statut IS NULL OR OLD.statut != 'en_attente') THEN
    
    -- Compter créneaux disponibilité existants
    SELECT COUNT(*) INTO v_count_disponibilites
    FROM tickets_disponibilites
    WHERE ticket_id = NEW.id;
    
    -- Vérifier AU MOINS 1 créneau (règle métier: 1 obligatoire, 2 optionnels)
    IF v_count_disponibilites < 1 THEN
      RAISE EXCEPTION 'Un ticket doit avoir au moins 1 disponibilité avant diffusion (actuellement : %)', v_count_disponibilites;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Commentaire mis à jour
COMMENT ON FUNCTION check_disponibilites_before_diffusion IS 
'Valide qu''un ticket possède au moins 1 disponibilité avant diffusion (statut → en_attente).
Règle métier: 1 disponibilité obligatoire, 2 autres optionnelles (max 3 au total).
L''entreprise choisit le créneau parmi ceux proposés.
Trigger: BEFORE UPDATE OF statut ON tickets.';

-- ============================================================
-- VALIDATION QUERIES
-- ============================================================

-- VALIDATION 1: Vérifier fonction mise à jour
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'check_disponibilites_before_diffusion';
-- Attendu: Définition contient "< 1" et "au moins 1 disponibilité"

-- VALIDATION 2: Test avec 0 disponibilités (doit ÉCHOUER)
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_sans_dispo>';
-- Attendu: ERROR - au moins 1 disponibilité (actuellement : 0)

-- VALIDATION 3: Test avec 1 disponibilité (doit RÉUSSIR)
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_1_dispo>';
-- Attendu: 1 row updated (succès)

-- VALIDATION 4: Test avec 2 disponibilités (doit RÉUSSIR)
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_2_dispos>';
-- Attendu: 1 row updated (succès)

-- VALIDATION 5: Test avec 3 disponibilités (doit RÉUSSIR)
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_3_dispos>';
-- Attendu: 1 row updated (succès)

-- ============================================================
-- FIN MIGRATION M36
-- ============================================================
