-- ============================================================
-- MIGRATION M22.5: RPC Liste et Détail Tickets Régie
-- ============================================================
-- Date: 2025-12-27
-- Auteur: Correction audit système tickets (ÉTAPE 1.5)
-- Issue: .from('tickets').select() côté régie déclenche récursion RLS
--        → Déconnexion au clic sur ticket
-- Solution: RPC SECURITY DEFINER pour liste ET détail tickets
-- ============================================================

-- 1️⃣ RPC: Liste tickets par statut pour régie
CREATE OR REPLACE FUNCTION public.get_tickets_list_regie(p_statut ticket_status)
RETURNS TABLE(
  id uuid,
  titre text,
  description text,
  statut ticket_status,
  priorite text,
  categorie text,
  sous_categorie text,
  piece text,
  created_at timestamptz,
  plafond_intervention_chf numeric,
  locataire_nom text,
  locataire_prenom text,
  logement_numero text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur courant
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Retourner tickets avec jointures (DIRECT, bypass RLS)
  RETURN QUERY
  SELECT
    t.id,
    t.titre,
    t.description,
    t.statut,
    t.priorite,
    t.categorie,
    t.sous_categorie,
    t.piece,
    t.created_at,
    t.plafond_intervention_chf,
    l.nom AS locataire_nom,
    l.prenom AS locataire_prenom,
    lg.numero AS logement_numero
  FROM public.tickets t
  INNER JOIN public.locataires l ON l.id = t.locataire_id
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  WHERE t.regie_id = v_regie_id
    AND t.statut = p_statut
  ORDER BY t.created_at DESC;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_tickets_list_regie(ticket_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_list_regie(ticket_status) TO authenticated;

COMMENT ON FUNCTION public.get_tickets_list_regie(ticket_status) IS 
'Retourne liste tickets par statut pour régie avec jointures locataires/logements. 
SECURITY DEFINER bypass RLS pour éviter récursion.';

-- ============================================================

-- 2️⃣ RPC: Détail ticket pour régie
CREATE OR REPLACE FUNCTION public.get_ticket_detail_regie(p_ticket_id uuid)
RETURNS TABLE(
  id uuid,
  titre text,
  description text,
  statut ticket_status,
  priorite text,
  categorie text,
  sous_categorie text,
  piece text,
  created_at timestamptz,
  updated_at timestamptz,
  date_limite timestamptz,
  plafond_intervention_chf numeric,
  devise text,
  urgence boolean,
  mode_diffusion text,
  locked_at timestamptz,
  locataire_id uuid,
  logement_id uuid,
  entreprise_id uuid,
  regie_id uuid,
  locataire_nom text,
  locataire_prenom text,
  locataire_email text,
  logement_numero text,
  logement_adresse text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur courant
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Retourner détail ticket si appartient à cette régie
  RETURN QUERY
  SELECT
    t.id,
    t.titre,
    t.description,
    t.statut,
    t.priorite,
    t.categorie,
    t.sous_categorie,
    t.piece,
    t.created_at,
    t.updated_at,
    t.date_limite,
    t.plafond_intervention_chf,
    t.devise,
    t.urgence,
    t.mode_diffusion,
    t.locked_at,
    t.locataire_id,
    t.logement_id,
    t.entreprise_id,
    t.regie_id,
    l.nom AS locataire_nom,
    l.prenom AS locataire_prenom,
    p.email AS locataire_email,
    lg.numero AS logement_numero,
    lg.adresse AS logement_adresse
  FROM public.tickets t
  INNER JOIN public.locataires l ON l.id = t.locataire_id
  INNER JOIN public.profiles p ON p.id = l.profile_id
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  WHERE t.id = p_ticket_id
    AND t.regie_id = v_regie_id;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_ticket_detail_regie(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_detail_regie(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_ticket_detail_regie(uuid) IS 
'Retourne détail complet d''un ticket pour régie avec toutes jointures. 
SECURITY DEFINER bypass RLS. Vérifie que ticket appartient bien à la régie.';

-- ============================================================

-- 3️⃣ RPC: Update ticket (priorité + plafond) pour régie
CREATE OR REPLACE FUNCTION public.update_ticket_regie(
  p_ticket_id uuid,
  p_priorite text,
  p_plafond_intervention_chf numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_ticket_exists boolean;
BEGIN
  -- Récupérer regie_id de l'utilisateur courant
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Vérifier que ticket appartient à cette régie
  SELECT EXISTS(
    SELECT 1 FROM public.tickets
    WHERE id = p_ticket_id AND regie_id = v_regie_id
  ) INTO v_ticket_exists;

  IF NOT v_ticket_exists THEN
    RAISE EXCEPTION 'Ticket non trouvé ou non autorisé';
  END IF;

  -- Mettre à jour (DIRECT, bypass RLS)
  UPDATE public.tickets
  SET
    priorite = p_priorite,
    plafond_intervention_chf = p_plafond_intervention_chf,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN json_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'message', 'Ticket mis à jour avec succès'
  );
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.update_ticket_regie(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_ticket_regie(uuid, text, numeric) TO authenticated;

COMMENT ON FUNCTION public.update_ticket_regie(uuid, text, numeric) IS 
'Met à jour priorité et plafond d''un ticket régie. 
SECURITY DEFINER bypass RLS. Vérifie appartenance régie.';

-- ============================================================
-- VALIDATION
-- ============================================================
-- Tests à exécuter après application migration :
--
-- 1. Liste tickets par statut :
-- SELECT * FROM public.get_tickets_list_regie('nouveau');
--
-- 2. Détail ticket :
-- SELECT * FROM public.get_ticket_detail_regie('<UUID_TICKET>');
--
-- 3. Update ticket :
-- SELECT * FROM public.update_ticket_regie(
--   '<UUID_TICKET>', 
--   'haute', 
--   500.00
-- );
--
-- ⚠️ Exécuter avec utilisateur régie authentifié
-- ============================================================
