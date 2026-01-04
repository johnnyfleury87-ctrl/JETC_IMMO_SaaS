-- ============================================================
-- MIGRATION M33: RPC get_entreprises_autorisees
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit workflow tickets régie-entreprise
-- Objectif: Retourner la liste des entreprises autorisées pour une régie
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_entreprises_autorisees()
RETURNS TABLE(
  id uuid,
  nom text,
  email text,
  siret text,
  mode_diffusion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN;  -- Pas d'erreur, juste vide si pas régie
  END IF;
  
  -- Retourner entreprises autorisées
  RETURN QUERY
  SELECT
    e.id,
    e.nom,
    e.email,
    e.siret,
    re.mode_diffusion
  FROM entreprises e
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  WHERE re.regie_id = v_regie_id
  ORDER BY e.nom ASC;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_entreprises_autorisees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entreprises_autorisees() TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.get_entreprises_autorisees IS 
'Retourne liste des entreprises autorisées pour la régie connectée avec mode_diffusion par défaut.
Utilisé pour peupler dropdown assignation entreprise dans UI.
SECURITY DEFINER pour bypass RLS.';

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_entreprises_autorisees'
  ) THEN
    RAISE NOTICE '✅ M33: RPC get_entreprises_autorisees créée avec succès';
  ELSE
    RAISE EXCEPTION '❌ M33: Erreur lors de la création de la RPC';
  END IF;
END $$;
