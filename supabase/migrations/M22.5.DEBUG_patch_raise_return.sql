-- ============================================================
-- MIGRATION M22.5.DEBUG: Patch temporaire RAISE→RETURN
-- ============================================================
-- Date: 2025-12-27
-- Auteur: ÉTAPE 1.6 - Debug déconnexion immédiate
-- Objectif: CONFIRMER que RAISE EXCEPTION invalide le token auth
-- ⚠️ TEMPORAIRE - NE PAS DÉPLOYER EN PRODUCTION
-- ============================================================

-- 1️⃣ Patch get_tickets_list_regie: RETURN au lieu de RAISE
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

  -- ✅ PATCH DEBUG: RETURN au lieu de RAISE EXCEPTION
  IF v_regie_id IS NULL THEN
    -- AVANT: RAISE EXCEPTION 'Utilisateur non associé à une régie';
    -- APRÈS (TEMPORAIRE):
    RETURN; -- Retourne ensemble vide
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

-- ============================================================

-- 2️⃣ Patch get_ticket_detail_regie: RETURN au lieu de RAISE
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
  plafond_intervention_chf numeric,
  locataire_id uuid,
  locataire_nom text,
  locataire_prenom text,
  locataire_email text,
  logement_id uuid,
  logement_numero text,
  immeuble_id uuid,
  immeuble_adresse text,
  regie_id uuid,
  regie_nom text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  -- ✅ PATCH DEBUG: RETURN au lieu de RAISE EXCEPTION
  IF v_regie_id IS NULL THEN
    -- AVANT: RAISE EXCEPTION 'Utilisateur non associé à une régie';
    RETURN;
  END IF;

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
    t.plafond_intervention_chf,
    t.locataire_id,
    l.nom AS locataire_nom,
    l.prenom AS locataire_prenom,
    l.email AS locataire_email,
    t.logement_id,
    lg.numero AS logement_numero,
    lg.immeuble_id,
    i.adresse AS immeuble_adresse,
    t.regie_id,
    r.nom_agence AS regie_nom
  FROM public.tickets t
  INNER JOIN public.locataires l ON l.id = t.locataire_id
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  INNER JOIN public.immeubles i ON i.id = lg.immeuble_id
  INNER JOIN public.regies r ON r.id = t.regie_id
  WHERE t.id = p_ticket_id
    AND t.regie_id = v_regie_id;
END;
$$;

-- ============================================================

-- 3️⃣ Patch update_ticket_regie: RETURN JSON au lieu de RAISE
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
  v_result json;
BEGIN
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  -- ✅ PATCH DEBUG: RETURN JSON au lieu de RAISE EXCEPTION
  IF v_regie_id IS NULL THEN
    -- AVANT: RAISE EXCEPTION 'Utilisateur non associé à une régie';
    RETURN json_build_object(
      'success', false,
      'error', 'Utilisateur non associé à une régie'
    );
  END IF;

  UPDATE public.tickets
  SET
    priorite = p_priorite,
    plafond_intervention_chf = p_plafond_intervention_chf,
    updated_at = NOW()
  WHERE id = p_ticket_id
    AND regie_id = v_regie_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ticket non trouvé ou accès refusé'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'ticket_id', p_ticket_id
  );
END;
$$;

-- ============================================================
-- NOTES DE DEBUG
-- ============================================================
-- 🧪 TEST: Après application de ce patch
-- 
-- Si la déconnexion DISPARAÎT:
--   → CONFIRMÉ: RAISE EXCEPTION invalide token auth
--   → Cause racine: auth.uid() retourne NULL ou regies.profile_id incorrect
--
-- Si la déconnexion PERSISTE:
--   → Bug ailleurs (probablement RLS sur regies/profiles)
--   → Vérifier policies regies SELECT
-- ============================================================
