
CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor RECORD;
  v_mission_ref TEXT;
  v_ticket_ref TEXT;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    
    SELECT t.reference INTO v_ticket_ref
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
    
    v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
    
    PERFORM create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    FOR v_actor IN SELECT * FROM get_mission_actors(NEW.id)
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
  