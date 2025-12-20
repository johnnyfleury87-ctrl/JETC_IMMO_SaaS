/**
 * MIGRATION RLS - Policies Locataires Sécurisées
 * 
 * Date : 20 décembre 2025
 * Objectif : Refonte complète policies locataires + logements + immeubles
 * 
 * CHANGEMENTS :
 * 1. Suppression policy "Regie can manage own locataires" (FOR ALL)
 * 2. Création 4 policies distinctes régie (SELECT/INSERT/UPDATE/DELETE)
 * 3. Ajout policies restrictives locataire sur logements et immeubles
 * 
 * SÉCURITÉ :
 * - Locataire voit UNIQUEMENT son logement et son immeuble
 * - Régie voit/gère UNIQUEMENT ses locataires via hiérarchie logements
 * - Pas de récursion RLS (get_user_regie_id() en SECURITY DEFINER)
 */

-- =====================================================
-- 1. SUPPRESSION ANCIENNES POLICIES LOCATAIRES
-- =====================================================

-- Supprimer policy globale "FOR ALL" (remplacée par policies distinctes)
DROP POLICY IF EXISTS "Regie can manage own locataires" ON locataires;

-- Supprimer policy "Regie can view own locataires" (sera recréée identique)
DROP POLICY IF EXISTS "Regie can view own locataires" ON locataires;

-- =====================================================
-- 2. POLICIES LOCATAIRES - Rôle LOCATAIRE
-- =====================================================

-- Policy SELECT : Locataire voit ses propres données
-- ✅ Déjà existante, conserver telle quelle
-- CREATE POLICY "Locataire can view own data"
-- ON locataires FOR SELECT
-- USING (profile_id = auth.uid());

-- Policy UPDATE : Locataire modifie ses données personnelles
-- ✅ Déjà existante, conserver telle quelle
-- CREATE POLICY "Locataire can update own data"
-- ON locataires FOR UPDATE
-- USING (profile_id = auth.uid());

-- Note : Locataire NE PEUT PAS :
-- - Créer de locataire (INSERT interdit)
-- - Supprimer son compte (DELETE interdit, géré par régie)
-- - Modifier profile_id ou logement_id (colonnes critiques)

-- =====================================================
-- 3. POLICIES LOCATAIRES - Rôle RÉGIE
-- =====================================================

-- Policy SELECT : Régie voit ses locataires via hiérarchie
CREATE POLICY "Regie can view own locataires"
ON locataires FOR SELECT
USING (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

COMMENT ON POLICY "Regie can view own locataires" ON locataires IS
  'Régie peut voir les locataires de ses logements (via immeubles → logements → locataires)';

-- Policy INSERT : Régie crée locataire dans SES logements uniquement
CREATE POLICY "Regie can insert locataire in own logements"
ON locataires FOR INSERT
WITH CHECK (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

COMMENT ON POLICY "Regie can insert locataire in own logements" ON locataires IS
  'Régie peut créer un locataire uniquement pour ses propres logements';

-- Policy UPDATE : Régie modifie SES locataires
CREATE POLICY "Regie can update own locataires"
ON locataires FOR UPDATE
USING (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
)
WITH CHECK (
  -- Vérifier aussi le nouveau logement_id (si changement)
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

COMMENT ON POLICY "Regie can update own locataires" ON locataires IS
  'Régie peut modifier ses locataires. WITH CHECK empêche transfert vers logement hors périmètre.';

-- Policy DELETE : Régie peut supprimer SES locataires
CREATE POLICY "Regie can delete own locataires"
ON locataires FOR DELETE
USING (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

COMMENT ON POLICY "Regie can delete own locataires" ON locataires IS
  'Régie peut supprimer ses locataires (avec prudence : vérifier tickets liés avant suppression)';

-- =====================================================
-- 4. POLICIES LOCATAIRES - Rôle ADMIN JTEC
-- =====================================================

-- Policy SELECT : Admin voit tous les locataires
-- ✅ Déjà existante, conserver telle quelle
-- CREATE POLICY "Admin JTEC can view all locataires"
-- ON locataires FOR SELECT
-- USING (public.is_admin_jtec());

-- =====================================================
-- 5. POLICIES LOGEMENTS - Rôle LOCATAIRE (NOUVEAU)
-- =====================================================

-- Policy SELECT : Locataire voit UNIQUEMENT son logement
CREATE POLICY "Locataire can view only own logement"
ON logements FOR SELECT
USING (
  -- Vérifier que l'utilisateur est un locataire
  (select role from profiles where id = auth.uid()) = 'locataire'
  and id = (
    select logement_id 
    from locataires 
    where profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Locataire can view only own logement" ON logements IS
  'Locataire peut voir UNIQUEMENT son propre logement (pas les autres logements de l''immeuble)';

-- Locataire NE PEUT PAS :
-- - Modifier logement (UPDATE interdit)
-- - Créer logement (INSERT interdit)
-- - Supprimer logement (DELETE interdit)

-- =====================================================
-- 6. POLICIES IMMEUBLES - Rôle LOCATAIRE (NOUVEAU)
-- =====================================================

-- Policy SELECT : Locataire voit UNIQUEMENT son immeuble
CREATE POLICY "Locataire can view own immeuble"
ON immeubles FOR SELECT
USING (
  -- Vérifier que l'utilisateur est un locataire
  (select role from profiles where id = auth.uid()) = 'locataire'
  and id = (
    select l.immeuble_id
    from locataires loc
    join logements l on l.id = loc.logement_id
    where loc.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Locataire can view own immeuble" ON immeubles IS
  'Locataire peut voir l''immeuble contenant son logement (pour afficher adresse, nom régie, etc.)';

-- Locataire NE PEUT PAS :
-- - Modifier immeuble (UPDATE interdit)
-- - Créer immeuble (INSERT interdit)
-- - Supprimer immeuble (DELETE interdit)

-- =====================================================
-- 7. VÉRIFICATION POLICIES
-- =====================================================

DO $$
DECLARE
  v_count_policies_locataires INTEGER;
  v_count_policies_logements_locataire INTEGER;
  v_count_policies_immeubles_locataire INTEGER;
BEGIN
  -- Vérifier policies locataires (doit avoir 7 policies au total)
  SELECT COUNT(*) INTO v_count_policies_locataires
  FROM pg_policies
  WHERE tablename = 'locataires';
  
  IF v_count_policies_locataires < 7 THEN
    RAISE WARNING 'Attention : Seulement % policies sur locataires (7 attendues)', v_count_policies_locataires;
  END IF;
  
  -- Vérifier policies logements pour locataire (au moins 1 nouvelle)
  SELECT COUNT(*) INTO v_count_policies_logements_locataire
  FROM pg_policies
  WHERE tablename = 'logements'
    AND policyname LIKE '%Locataire%';
  
  IF v_count_policies_logements_locataire = 0 THEN
    RAISE WARNING 'Aucune policy locataire trouvée sur table logements';
  END IF;
  
  -- Vérifier policies immeubles pour locataire (au moins 1 nouvelle)
  SELECT COUNT(*) INTO v_count_policies_immeubles_locataire
  FROM pg_policies
  WHERE tablename = 'immeubles'
    AND policyname LIKE '%Locataire%';
  
  IF v_count_policies_immeubles_locataire = 0 THEN
    RAISE WARNING 'Aucune policy locataire trouvée sur table immeubles';
  END IF;
  
  RAISE NOTICE '✅ Migration RLS : % policies locataires, % policies logements locataire, % policies immeubles locataire',
    v_count_policies_locataires,
    v_count_policies_logements_locataire,
    v_count_policies_immeubles_locataire;
END $$;

-- =====================================================
-- 8. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '2025-12-20_rls_locataires_policies',
  'Refonte policies locataires : séparation SELECT/INSERT/UPDATE/DELETE + policies restrictives locataire sur logements/immeubles'
);

