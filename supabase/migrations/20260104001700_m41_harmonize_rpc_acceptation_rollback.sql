-- ============================================================
-- ROLLBACK M41: Restaurer RPC acceptation version M05
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Revenir à la version M05 avec 'public'/'assigné'
-- ============================================================

-- Restaurer version M05
CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
) RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_mission_id uuid;
  v_ticket_statut ticket_status;
  v_mode_diffusion text;
  v_entreprise_assignee uuid;
  v_locked_at timestamptz;
  v_regie_id uuid;
BEGIN
  -- Récupérer infos ticket
  SELECT statut, mode_diffusion, entreprise_id, locked_at, regie_id 
  INTO v_ticket_statut, v_mode_diffusion, v_entreprise_assignee, v_locked_at, v_regie_id
  FROM tickets 
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; 
  END IF;

  IF v_ticket_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être au statut en_attente (statut actuel: %)', v_ticket_statut;
  END IF;

  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)';
  END IF;

  -- VERSION M05: 'public'/'assigné'
  IF v_mode_diffusion = 'public' THEN
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
      AND entreprise_id = p_entreprise_id 
      AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée pour tickets publics de régie %', p_entreprise_id, v_regie_id;
    END IF;
    
  ELSIF v_mode_diffusion = 'assigné' THEN
    IF v_entreprise_assignee IS NULL THEN
      RAISE EXCEPTION 'Ticket en mode assigné mais aucune entreprise assignée (données incohérentes)';
    END IF;
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
    END IF;
    
  ELSE
    RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %', COALESCE(v_mode_diffusion, 'NULL');
  END IF;

  UPDATE tickets 
  SET locked_at = now(),
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  PERFORM update_ticket_statut(p_ticket_id, 'en_cours');

  INSERT INTO missions (
    id,
    ticket_id, 
    entreprise_id, 
    statut,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_ticket_id,
    p_entreprise_id,
    'en_attente',
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

-- ============================================================
-- FIN ROLLBACK M41
-- ============================================================
