-- ============================================================
-- ROLLBACK M36: Restaurer règle "exactement 3 disponibilités"
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Rollback migration M36
-- Objectif: Rétablir validation trigger M10 originale (exactement 3)
-- ============================================================

-- Restaurer fonction trigger M10 originale
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
    
    -- Vérifier exactement 3 créneaux (règle originale M10)
    IF v_count_disponibilites != 3 THEN
      RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : %)', v_count_disponibilites;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Restaurer commentaire original
COMMENT ON FUNCTION check_disponibilites_before_diffusion IS 
'Valide qu''un ticket possède exactement 3 disponibilités avant diffusion (statut → en_attente).
Trigger: BEFORE UPDATE OF statut ON tickets.';

-- ============================================================
-- FIN ROLLBACK M36
-- ============================================================
