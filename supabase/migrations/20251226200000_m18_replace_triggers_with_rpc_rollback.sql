/**
 * Rollback M18: Restaurer les triggers BEFORE INSERT
 */

-- Supprimer la fonction RPC
DROP FUNCTION IF EXISTS create_ticket_locataire;

-- Restaurer la fonction check_locataire_has_logement_for_ticket
CREATE OR REPLACE FUNCTION check_locataire_has_logement_for_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logement_id uuid;
BEGIN
  SELECT logement_id INTO v_logement_id
  FROM locataires
  WHERE id = NEW.locataire_id;

  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'RÈGLE MÉTIER VIOLÉE : Le locataire % doit avoir un logement assigné pour créer un ticket.', NEW.locataire_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Restaurer le trigger ensure_locataire_has_logement_before_ticket
CREATE TRIGGER ensure_locataire_has_logement_before_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_locataire_has_logement_for_ticket();

-- Restaurer la fonction set_ticket_regie_id
CREATE OR REPLACE FUNCTION set_ticket_regie_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  SELECT i.regie_id INTO v_regie_id
  FROM logements l
  JOIN immeubles i ON l.immeuble_id = i.id
  WHERE l.id = NEW.logement_id;
  
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Impossible de déterminer la régie pour le logement %', NEW.logement_id;
  END IF;
  
  NEW.regie_id := v_regie_id;
  RETURN NEW;
END;
$$;

-- Restaurer le trigger set_ticket_regie_id_trigger
CREATE TRIGGER set_ticket_regie_id_trigger
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_regie_id();
