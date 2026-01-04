-- ============================================================
-- MIGRATION M41: Harmonisation terminologie RPC acceptation ticket
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Harmonisation mode_diffusion dans accept_ticket_and_create_mission
-- Objectif: Corriger RPC pour accepter 'general'/'restreint' au lieu de 'public'/'assigné'
-- Dépendances: M05 (RPC originale), M35 (harmonisation terminologie)
-- Rollback: 20260104001700_m41_harmonize_rpc_acceptation_rollback.sql
-- ============================================================

-- CONTEXTE:
-- M05 créé la RPC accept_ticket_and_create_mission qui valide mode_diffusion.
-- Problème: Attend 'public'/'assigné' mais données sont 'general'/'restreint' (M35).
-- Erreur: "Mode diffusion invalide ou NULL: general"
-- Solution: Remplacer les checks par nouvelle terminologie.

CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid,
  p_disponibilite_id uuid DEFAULT NULL
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

  -- Vérifier que ticket est au statut 'en_attente'
  IF v_ticket_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être au statut en_attente (statut actuel: %)', v_ticket_statut;
  END IF;

  -- Vérifier que ticket n'est pas déjà verrouillé (accepté par autre entreprise)
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)';
  END IF;

  -- Validation selon mode diffusion (NOUVELLE TERMINOLOGIE)
  IF v_mode_diffusion = 'general' THEN
    -- Mode general (marketplace): Vérifier que entreprise est autorisée
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
      AND entreprise_id = p_entreprise_id 
      AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée pour tickets marketplace de régie %', p_entreprise_id, v_regie_id;
    END IF;
    
  ELSIF v_mode_diffusion = 'restreint' THEN
    -- Mode restreint (assignation): Vérifier que entreprise correspond
    IF v_entreprise_assignee IS NULL THEN
      RAISE EXCEPTION 'Ticket en mode restreint mais aucune entreprise assignée (données incohérentes)';
    END IF;
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
    END IF;
    
  ELSE
    RAISE EXCEPTION 'Mode diffusion invalide ou NULL: % (attendu: general ou restreint)', COALESCE(v_mode_diffusion, 'NULL');
  END IF;

  -- Verrouiller ticket (locked_at + entreprise_id si pas déjà rempli)
  UPDATE tickets 
  SET locked_at = now(),
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut en_attente → en_cours via RPC
  PERFORM update_ticket_statut(p_ticket_id, 'en_cours');

  -- Créer mission (contrainte UNIQUE sur ticket_id empêche doublons)
  INSERT INTO missions (
    id,
    ticket_id, 
    entreprise_id,
    disponibilite_id,
    statut,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_ticket_id,
    p_entreprise_id,
    p_disponibilite_id,  -- Créneau sélectionné (M42)
    'en_attente',
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

-- Commentaire mis à jour
COMMENT ON FUNCTION accept_ticket_and_create_mission(uuid, uuid, uuid) IS
'Acceptation ticket par entreprise et création mission.
Validation: mode_diffusion general (entreprise autorisée) ou restreint (assignée).
Terminologie harmonisée M35: general/restreint.
Paramètre disponibilite_id (M41+M42): créneau sélectionné par entreprise.';

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'accept_ticket_and_create_mission'
  ) THEN
    RAISE NOTICE '✅ M41: RPC accept_ticket_and_create_mission harmonisée';
  ELSE
    RAISE EXCEPTION '❌ M41: Erreur lors de la mise à jour de la RPC';
  END IF;
END $$;

-- ============================================================
-- FIN MIGRATION M41
-- ============================================================
