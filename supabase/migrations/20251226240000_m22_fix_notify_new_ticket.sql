/**
 * Migration M22 : Correction fonction notify_new_ticket()
 * 
 * ERREUR IDENTIFIÉE: 42703 column "locataire_id" does not exist
 * CAUSE: notify_new_ticket() ligne 428 référence profiles.locataire_id qui n'existe pas
 * 
 * CONTEXTE POSTGRESQL:
 * PL/pgSQL function notify_new_ticket() line 6 FOR SELECT rows
 * 
 * CORRECTION:
 * - Utiliser JOIN avec locataires pour obtenir profile_id du locataire
 * - Éviter toute référence à profiles.locataire_id
 */

CREATE OR REPLACE FUNCTION public.notify_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Notifier la régie (via regie_id dans profiles)
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_ticket_id
  )
  SELECT 
    p.id,
    'new_ticket',
    'Nouveau ticket créé',
    'Ticket ' || COALESCE(NEW.numero, NEW.id::text) || ' : ' || left(NEW.description, 100),
    NEW.id
  FROM profiles p
  WHERE p.regie_id = NEW.regie_id;

  -- Notifier le locataire (via locataires.profile_id)
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_ticket_id
  )
  SELECT 
    l.profile_id,
    'new_ticket',
    'Nouveau ticket créé',
    'Ticket ' || COALESCE(NEW.numero, NEW.id::text) || ' : ' || left(NEW.description, 100),
    NEW.id
  FROM locataires l
  WHERE l.id = NEW.locataire_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_new_ticket IS 
'Trigger AFTER INSERT tickets: envoie notifications à la régie et au locataire. Corrigé M22: pas de profiles.locataire_id.';
