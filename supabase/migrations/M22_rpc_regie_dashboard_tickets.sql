-- ============================================================
-- MIGRATION M22: RPC Dashboard Régie (Bypass RLS Récursion)
-- ============================================================
-- Date: 2025-12-27
-- Auteur: Correction audit système tickets
-- Issue: Récursion RLS infinie tickets → regies_entreprises → entreprises
--        provoque déconnexion automatique utilisateur régie
-- Solution: Fonction SECURITY DEFINER qui lit tickets directement
--           sans déclencher évaluation policies RLS récursives
-- ============================================================

-- Créer fonction RPC pour dashboard régie
CREATE OR REPLACE FUNCTION public.get_tickets_dashboard_regie()
RETURNS TABLE(
  count_nouveau integer,
  count_en_attente integer,
  count_en_cours integer,
  count_termine integer
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

  -- Vérifier que l'utilisateur est bien une régie
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Compter tickets par statut (accès DIRECT, bypass RLS)
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE statut = 'nouveau')::integer AS count_nouveau,
    COUNT(*) FILTER (WHERE statut = 'en_attente')::integer AS count_en_attente,
    COUNT(*) FILTER (WHERE statut = 'en_cours')::integer AS count_en_cours,
    COUNT(*) FILTER (WHERE statut = 'termine')::integer AS count_termine
  FROM public.tickets
  WHERE regie_id = v_regie_id;
END;
$$;

-- Sécurité : restreindre accès à la fonction
REVOKE ALL ON FUNCTION public.get_tickets_dashboard_regie() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_dashboard_regie() TO authenticated;

-- Commentaire de documentation
COMMENT ON FUNCTION public.get_tickets_dashboard_regie() IS 
'Retourne compteurs de tickets par statut pour le dashboard régie. 
SECURITY DEFINER bypass les policies RLS pour éviter récursion infinie.
Vérifie que l''utilisateur est bien associé à une régie avant exécution.';

-- ============================================================
-- VALIDATION
-- ============================================================
-- Test avec utilisateur régie (exécuter après login régie) :
-- SELECT * FROM public.get_tickets_dashboard_regie();
--
-- Résultat attendu :
-- count_nouveau | count_en_attente | count_en_cours | count_termine
-- --------------|------------------|----------------|---------------
--      N        |        N         |       N        |       N
--
-- Où N = nombre de tickets dans chaque statut pour cette régie
-- ============================================================
