
CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tech_user_id UUID;
  v_mission_ref TEXT;
  v_tech_nom TEXT;
  v_ticket_ref TEXT;
BEGIN
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    
    SELECT profile_id, nom INTO v_tech_user_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_user_id IS NOT NULL THEN
      
      SELECT t.reference INTO v_ticket_ref
      FROM tickets t
      WHERE t.id = NEW.ticket_id;
      
      v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
      
      PERFORM create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
  