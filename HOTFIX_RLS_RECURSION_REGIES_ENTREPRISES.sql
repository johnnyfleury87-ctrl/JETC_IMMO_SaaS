-- =====================================================
-- HOTFIX: Récursion RLS regies_entreprises
-- Date: 26 décembre 2025
-- Erreur: infinite recursion detected in policy for relation "regies_entreprises"
-- 
-- CONTEXTE:
-- - Migrations M20-M24 appliquées
-- - CREATE ticket fonctionne
-- - Erreur récursion sur SELECT tickets/entreprises
-- 
-- SOLUTION:
-- - Fonctions SECURITY DEFINER pour bypass RLS
-- - Corriger policies regies_entreprises
-- - Convertir vue en fonction
-- =====================================================

-- =====================================================
-- PARTIE 1: Fonctions helper SECURITY DEFINER
-- =====================================================

-- WHY: Évite récursion RLS entre regies_entreprises ↔ entreprises
CREATE OR REPLACE FUNCTION get_user_entreprise_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM entreprises
    WHERE profile_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION get_user_entreprise_id() IS 
'Retourne entreprise_id pour auth.uid() (SECURITY DEFINER bypass RLS)';

-- WHY: Évite récursion RLS sur tickets lors vérification autorisation entreprise
CREATE OR REPLACE FUNCTION is_ticket_authorized_for_entreprise(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tickets t
    JOIN regies_entreprises re ON t.regie_id = re.regie_id
    WHERE t.id = p_ticket_id
      AND re.entreprise_id = p_entreprise_id
      AND (
        (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
        OR
        (re.mode_diffusion = 'restreint' AND t.entreprise_id = p_entreprise_id)
      )
  );
END;
$$;

COMMENT ON FUNCTION is_ticket_authorized_for_entreprise IS 
'Vérifie si entreprise autorisée à voir ticket (SECURITY DEFINER bypass RLS)';

-- WHY: Évite récursion RLS sur regies_entreprises lors vérification storage
CREATE OR REPLACE FUNCTION is_entreprise_authorized_for_regie(
  p_entreprise_id uuid,
  p_regie_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM regies_entreprises
    WHERE entreprise_id = p_entreprise_id
      AND regie_id = p_regie_id
  );
END;
$$;

COMMENT ON FUNCTION is_entreprise_authorized_for_regie IS 
'Vérifie si entreprise autorisée pour régie (SECURITY DEFINER bypass RLS)';

-- =====================================================
-- PARTIE 2: Corriger policy regies_entreprises
-- =====================================================

-- WHY: Évite récursion entre regies_entreprises ↔ entreprises
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;

CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (entreprise_id = get_user_entreprise_id());

COMMENT ON POLICY "Entreprise can view own authorizations" ON regies_entreprises IS 
'Entreprise voit ses autorisations via fonction SECURITY DEFINER (pas de récursion RLS)';

-- =====================================================
-- PARTIE 3: Corriger policy tickets pour entreprises
-- =====================================================

-- WHY: Évite récursion tickets → regies_entreprises → entreprises → tickets
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
USING (
  is_ticket_authorized_for_entreprise(
    tickets.id,
    get_user_entreprise_id()
  )
);

COMMENT ON POLICY "Entreprise can view authorized tickets" ON tickets IS 
'Entreprise voit tickets autorisés via fonction SECURITY DEFINER (pas de récursion RLS)';

-- =====================================================
-- PARTIE 4: Convertir vue en fonction SECURITY DEFINER
-- =====================================================

-- WHY: Vue hérite RLS des tables → récursion garantie
-- Solution: Fonction SECURITY DEFINER bypass RLS
DROP VIEW IF EXISTS tickets_visibles_entreprise;

CREATE OR REPLACE FUNCTION get_tickets_visibles_entreprise(
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  titre text,
  description text,
  categorie text,
  priorite text,
  statut text,
  created_at timestamptz,
  updated_at timestamptz,
  locataire_id uuid,
  logement_id uuid,
  regie_id uuid,
  entreprise_id uuid,
  mode_diffusion text,
  locataire_nom text,
  locataire_prenom text,
  logement_numero text,
  immeuble_nom text,
  immeuble_adresse text,
  regie_nom text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.titre,
    t.description,
    t.categorie,
    t.priorite,
    t.statut,
    t.created_at,
    t.updated_at,
    t.locataire_id,
    t.logement_id,
    t.regie_id,
    t.entreprise_id,
    re.mode_diffusion,
    loc.nom,
    loc.prenom,
    log.numero,
    imm.nom,
    imm.adresse,
    reg.nom
  FROM tickets t
  JOIN regies_entreprises re ON t.regie_id = re.regie_id
  JOIN locataires loc ON t.locataire_id = loc.id
  JOIN logements log ON t.logement_id = log.id
  JOIN immeubles imm ON log.immeuble_id = imm.id
  JOIN regies reg ON t.regie_id = reg.id
  WHERE
    re.entreprise_id = COALESCE(
      p_entreprise_id,
      get_user_entreprise_id()
    )
    AND (
      (re.mode_diffusion = 'general' AND t.statut = 'ouvert')
      OR
      (re.mode_diffusion = 'restreint' AND t.entreprise_id = re.entreprise_id)
    );
END;
$$;

COMMENT ON FUNCTION get_tickets_visibles_entreprise IS 
'Remplace vue tickets_visibles_entreprise (SECURITY DEFINER évite récursion RLS)';

-- =====================================================
-- PARTIE 5: Corriger policy storage
-- =====================================================

-- WHY: Évite récursion storage → regies_entreprises → entreprises
DROP POLICY IF EXISTS "Regie can view signatures of authorized entreprises" ON storage.objects;

CREATE POLICY "Regie can view signatures of authorized entreprises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = 'entreprises' AND
  EXISTS (
    SELECT 1
    FROM entreprises e
    JOIN regies r ON r.profile_id = auth.uid()
    WHERE e.id::text = (storage.foldername(name))[2]
      AND is_entreprise_authorized_for_regie(e.id, r.id)
  )
);

COMMENT ON POLICY "Regie can view signatures of authorized entreprises" ON storage.objects IS 
'Régie voit signatures entreprises autorisées via fonction SECURITY DEFINER (pas récursion)';

-- =====================================================
-- PARTIE 6: Validation
-- =====================================================

-- Test 1: Vérifier policies regies_entreprises
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'regies_entreprises'
ORDER BY policyname;

-- Test 2: Vérifier fonction get_tickets_visibles_entreprise existe
SELECT
  proname,
  provolatile,  -- 's' = STABLE
  prosecdef      -- 't' = SECURITY DEFINER
FROM pg_proc
WHERE proname = 'get_tickets_visibles_entreprise';

-- Test 3: Vérifier fonctions helper existent
SELECT proname
FROM pg_proc
WHERE proname IN (
  'get_user_entreprise_id',
  'is_ticket_authorized_for_entreprise',
  'is_entreprise_authorized_for_regie'
);

-- =====================================================
-- RÉSULTAT ATTENDU
-- =====================================================

/*
✅ Locataire crée ticket → fonctionne
✅ Régie voit ses tickets → pas de déconnexion
✅ Entreprise voit tickets autorisés → pas de récursion
✅ Storage policies → pas de récursion
✅ Aucune erreur "infinite recursion"
*/
