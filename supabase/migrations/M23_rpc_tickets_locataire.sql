-- ============================================================
-- MIGRATION M23: RPC Tickets Locataire (Fix Récursion RLS)
-- ============================================================
-- Date: 2025-12-27
-- Auteur: Correction récursion RLS locataire
-- Issue: Frontend locataire utilise .from('tickets') direct
--        → Trigger récursion: tickets → regies_entreprises → entreprises → regies_entreprises (∞)
-- Solution: RPC SECURITY DEFINER bypass RLS (comme régie)
-- ============================================================

-- ============================================================
-- 1️⃣ RPC: Liste tickets du locataire connecté
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_tickets_locataire()
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
  locataire_id uuid,
  logement_id uuid,
  logement_numero text,
  immeuble_id uuid,
  immeuble_adresse text,
  regie_id uuid,
  entreprise_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locataire_id uuid;
BEGIN
  -- Récupérer locataire_id de l'utilisateur connecté
  SELECT l.id INTO v_locataire_id
  FROM public.locataires l
  WHERE l.profile_id = auth.uid();

  -- Si pas locataire, retourner vide (pas d'erreur, juste aucun ticket)
  IF v_locataire_id IS NULL THEN
    RETURN;
  END IF;

  -- Retourner tickets du locataire avec jointures SÛRES (logements, immeubles)
  -- ⚠️ PAS de jointure regies_entreprises / entreprises (récursion)
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
    t.locataire_id,
    t.logement_id,
    lg.numero AS logement_numero,
    lg.immeuble_id,
    i.adresse AS immeuble_adresse,
    t.regie_id,
    t.entreprise_id
  FROM public.tickets t
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  INNER JOIN public.immeubles i ON i.id = lg.immeuble_id
  WHERE t.locataire_id = v_locataire_id
  ORDER BY t.created_at DESC;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_tickets_locataire() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tickets_locataire() TO authenticated;

COMMENT ON FUNCTION public.get_tickets_locataire() IS 
'Retourne tous les tickets du locataire connecté avec jointures logements/immeubles.
SECURITY DEFINER bypass RLS pour éviter récursion regies_entreprises.
PAS de jointure entreprises/regies pour éviter boucle infinie.';

-- ============================================================
-- 2️⃣ RPC: Détail d''un ticket pour locataire
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ticket_detail_locataire(p_ticket_id uuid)
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
  logement_numero text,
  logement_adresse text,
  immeuble_id uuid,
  immeuble_adresse text,
  regie_id uuid,
  entreprise_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locataire_id uuid;
BEGIN
  -- Récupérer locataire_id de l'utilisateur connecté
  SELECT l.id INTO v_locataire_id
  FROM public.locataires l
  WHERE l.profile_id = auth.uid();

  -- Vérifier que le locataire existe
  IF v_locataire_id IS NULL THEN
    RETURN; -- Pas d'erreur, juste vide
  END IF;

  -- Retourner détail ticket UNIQUEMENT si appartient au locataire
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
    lg.numero AS logement_numero,
    lg.adresse AS logement_adresse,
    lg.immeuble_id,
    i.adresse AS immeuble_adresse,
    t.regie_id,
    t.entreprise_id
  FROM public.tickets t
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  INNER JOIN public.immeubles i ON i.id = lg.immeuble_id
  WHERE t.id = p_ticket_id
    AND t.locataire_id = v_locataire_id; -- ✅ SÉCURITÉ: vérif appartenance
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_ticket_detail_locataire(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_detail_locataire(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_ticket_detail_locataire(uuid) IS 
'Retourne détail complet d''un ticket pour le locataire connecté.
SECURITY DEFINER bypass RLS. Vérifie que ticket appartient bien au locataire.
PAS de jointure entreprises/regies pour éviter récursion.';

-- ============================================================
-- TESTS MANUELS (Optionnels - à exécuter après migration)
-- ============================================================

-- Test 1: Liste tickets locataire (doit retourner uniquement tickets du user connecté)
-- SELECT * FROM public.get_tickets_locataire();

-- Test 2: Détail ticket (remplacer UUID)
-- SELECT * FROM public.get_ticket_detail_locataire('<UUID_TICKET>');

-- Test 3: Vérifier qu'un autre locataire NE VOIT PAS ce ticket
-- (Se connecter avec un autre user locataire, essayer même UUID)
-- → Doit retourner 0 lignes

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '✅ MIGRATION M23 TERMINÉE - RPC Tickets Locataire';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctions créées:';
  RAISE NOTICE '  1. get_tickets_locataire() → Liste tickets du locataire';
  RAISE NOTICE '  2. get_ticket_detail_locataire(uuid) → Détail ticket';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT:';
  RAISE NOTICE '  - Ces RPC BYPASSENT RLS (SECURITY DEFINER)';
  RAISE NOTICE '  - PAS de jointure regies_entreprises/entreprises';
  RAISE NOTICE '  - Évite récursion: tickets → regies_entreprises → ∞';
  RAISE NOTICE '';
  RAISE NOTICE 'Colonnes retournées:';
  RAISE NOTICE '  - Toutes colonnes tickets';
  RAISE NOTICE '  - logement_numero, logement_adresse';
  RAISE NOTICE '  - immeuble_adresse';
  RAISE NOTICE '  - regie_id, entreprise_id (UUID seulement, pas de détails)';
  RAISE NOTICE '';
  RAISE NOTICE 'Sécurité:';
  RAISE NOTICE '  ✅ Filtre WHERE t.locataire_id = v_locataire_id';
  RAISE NOTICE '  ✅ Un locataire ne voit QUE ses tickets';
  RAISE NOTICE '  ✅ GRANT EXECUTE TO authenticated only';
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaine étape:';
  RAISE NOTICE '  1. Modifier public/locataire/dashboard.html';
  RAISE NOTICE '  2. Remplacer .from("tickets") par .rpc("get_tickets_locataire")';
  RAISE NOTICE '  3. Tester en console: aucune erreur 42P17 (récursion)';
  RAISE NOTICE '========================================================';
END $$;
