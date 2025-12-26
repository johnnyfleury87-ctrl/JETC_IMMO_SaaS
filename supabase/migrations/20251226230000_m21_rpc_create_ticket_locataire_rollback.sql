/**
 * Rollback M21 : Supprimer fonction RPC create_ticket_locataire
 */

DROP FUNCTION IF EXISTS public.create_ticket_locataire(text, text, text, text, text, uuid, uuid);
