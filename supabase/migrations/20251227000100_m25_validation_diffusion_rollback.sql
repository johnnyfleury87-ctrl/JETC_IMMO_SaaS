-- ============================================================
-- ROLLBACK M25 - Restaurer RPC M04 sans validation priorité/plafond
-- ============================================================
-- Restaure fonction diffuser_ticket version M04 (SANS vérification priorite/plafond)
-- À utiliser SI bugs bloquants détectés après déploiement M25
-- ============================================================

CREATE OR REPLACE FUNCTION diffuser_ticket(
  p_ticket_id uuid,
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_statut_actuel ticket_status;
  v_regie_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est bien associé à une régie
  SELECT get_user_regie_id() INTO v_regie_id;
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Récupérer statut actuel du ticket
  SELECT statut INTO v_statut_actuel 
  FROM tickets 
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; 
  END IF;

  -- Vérifier que le ticket est au statut 'ouvert' (prêt à diffuser)
  IF v_statut_actuel != 'ouvert' THEN
    RAISE EXCEPTION 'Ticket doit être au statut ouvert pour diffusion (statut actuel: %)', v_statut_actuel;
  END IF;

  -- Validation mode diffusion
  IF p_mode_diffusion NOT IN ('public', 'assigné') THEN
    RAISE EXCEPTION 'Mode diffusion invalide: % (attendu: public ou assigné)', p_mode_diffusion;
  END IF;

  -- Si mode assigné, entreprise_id obligatoire
  IF p_mode_diffusion = 'assigné' AND p_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Mode assigné nécessite entreprise_id';
  END IF;

  -- Si mode public, entreprise_id doit être NULL
  IF p_mode_diffusion = 'public' AND p_entreprise_id IS NOT NULL THEN
    RAISE EXCEPTION 'Mode public ne peut pas avoir entreprise_id assignée';
  END IF;

  -- Si mode assigné, vérifier que l'entreprise est autorisée par cette régie
  IF p_mode_diffusion = 'assigné' THEN
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
      AND entreprise_id = p_entreprise_id
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée par régie %', p_entreprise_id, v_regie_id;
    END IF;
  END IF;

  -- Appliquer diffusion
  UPDATE tickets 
  SET mode_diffusion = p_mode_diffusion,
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut ouvert → en_attente via RPC update_ticket_statut
  PERFORM update_ticket_statut(p_ticket_id, 'en_attente');
END;
$$;

-- ⚠️ ATTENTION: Rollback retire validation métier
-- Régie pourra diffuser tickets SANS priorité/plafond
-- Frontend doit gérer validation si rollback appliqué

-- ============================================================
-- FIN ROLLBACK M25
-- ============================================================
