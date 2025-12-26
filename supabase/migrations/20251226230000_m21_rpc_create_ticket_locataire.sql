/**
 * Migration M21 : Fonction RPC create_ticket_locataire
 * 
 * OBJECTIF: Bypass PostgREST INSERT qui est incompatible avec la structure métier
 * (RLS + triggers + contraintes)
 * 
 * SOLUTION: RPC SQL SECURITY DEFINER qui exécute INSERT direct
 * Tous les triggers BEFORE INSERT restent actifs et injectent regie_id
 */

CREATE OR REPLACE FUNCTION public.create_ticket_locataire(
  p_titre text,
  p_description text,
  p_categorie text,
  p_sous_categorie text,
  p_piece text,
  p_locataire_id uuid,
  p_logement_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  INSERT INTO public.tickets (
    titre,
    description,
    categorie,
    sous_categorie,
    piece,
    locataire_id,
    logement_id
  )
  VALUES (
    p_titre,
    p_description,
    p_categorie,
    p_sous_categorie,
    p_piece,
    p_locataire_id,
    p_logement_id
  )
  RETURNING id INTO v_ticket_id;

  RETURN v_ticket_id;
END;
$$;

COMMENT ON FUNCTION public.create_ticket_locataire IS 
'Création ticket locataire via RPC (bypass PostgREST INSERT incompatible). Triggers BEFORE INSERT actifs (regie_id auto).';
