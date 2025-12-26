/**
 * Rollback M22 : Restaurer ancienne fonction notify_new_ticket (bugguée)
 */

CREATE OR REPLACE FUNCTION public.notify_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor record;
BEGIN
  -- Notifier la régie et le locataire
  FOR v_actor IN 
    SELECT id FROM profiles 
    WHERE regie_id = NEW.regie_id OR locataire_id = NEW.locataire_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_ticket_id
    )
    VALUES (
      v_actor.user_id,
      'new_ticket',
      'Nouveau ticket créé',
      'Ticket ' || NEW.numero || ' : ' || left(NEW.description, 100),
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;
