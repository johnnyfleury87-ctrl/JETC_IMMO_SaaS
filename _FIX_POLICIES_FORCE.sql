-- =====================================================
-- CORRECTION IMMÉDIATE - SUPPRIMER TOUTES POLICIES
-- =====================================================
-- Exécuter ce script dans Dashboard Supabase SQL Editor
-- =====================================================

DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '🔍 SUPPRESSION DE TOUTES LES POLICIES MISSIONS + TECHNICIENS';
  RAISE NOTICE '================================================================';
  
  -- Lister et supprimer toutes les policies de missions
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'missions'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON missions';
    RAISE NOTICE '✅ Supprimé: missions.%', r.policyname;
  END LOOP;
  
  -- Lister et supprimer toutes les policies de techniciens
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'techniciens'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON techniciens';
    RAISE NOTICE '✅ Supprimé: techniciens.%', r.policyname;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ TOUTES LES POLICIES ONT ÉTÉ SUPPRIMÉES';
  RAISE NOTICE '================================================================';
END $$;

-- =====================================================
-- RECRÉER POLICIES TECHNICIENS (7)
-- =====================================================

CREATE POLICY "Entreprise can view own techniciens"
ON techniciens FOR SELECT
USING (entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid()));

CREATE POLICY "Entreprise can insert own techniciens"
ON techniciens FOR INSERT
WITH CHECK (entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid()));

CREATE POLICY "Entreprise can update own techniciens"
ON techniciens FOR UPDATE
USING (entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid()));

CREATE POLICY "Technicien can view own profile"
ON techniciens FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Technicien can update own profile"
ON techniciens FOR UPDATE
USING (profile_id = auth.uid());

CREATE POLICY "Regie can view techniciens of authorized entreprises"
ON techniciens FOR SELECT
USING (EXISTS (SELECT 1 FROM regies r WHERE r.profile_id = auth.uid()));

CREATE POLICY "Admin JTEC can view all techniciens"
ON techniciens FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin_jtec'));

-- =====================================================
-- RECRÉER POLICIES MISSIONS (8)
-- =====================================================

CREATE POLICY "Regie can view missions for own tickets"
ON missions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN logements l ON t.logement_id = l.id
    JOIN immeubles i ON l.immeuble_id = i.id
    JOIN regies r ON i.regie_id = r.id
    WHERE t.id = ticket_id AND r.profile_id = auth.uid()
  )
);

CREATE POLICY "Entreprise can view own missions"
ON missions FOR SELECT
USING (entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid()));

CREATE POLICY "Locataire can view missions for own tickets"
ON missions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN locataires loc ON t.locataire_id = loc.id
    WHERE t.id = ticket_id AND loc.profile_id = auth.uid()
  )
);

CREATE POLICY "Entreprise can update own missions"
ON missions FOR UPDATE
USING (entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid()));

CREATE POLICY "Regie can update missions for own tickets"
ON missions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN logements l ON t.logement_id = l.id
    JOIN immeubles i ON l.immeuble_id = i.id
    JOIN regies r ON i.regie_id = r.id
    WHERE t.id = ticket_id AND r.profile_id = auth.uid()
  )
);

CREATE POLICY "Admin JTEC can view all missions"
ON missions FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin_jtec'));

CREATE POLICY "Technicien can view assigned missions"
ON missions FOR SELECT
USING (technicien_id = (SELECT id FROM techniciens WHERE profile_id = auth.uid()));

CREATE POLICY "Technicien can update assigned missions"
ON missions FOR UPDATE
USING (technicien_id = (SELECT id FROM techniciens WHERE profile_id = auth.uid()));

-- =====================================================
-- VALIDATION FINALE
-- =====================================================

DO $$
DECLARE
  v_count_tech integer;
  v_count_miss integer;
BEGIN
  SELECT COUNT(*) INTO v_count_tech FROM pg_policies WHERE tablename = 'techniciens';
  SELECT COUNT(*) INTO v_count_miss FROM pg_policies WHERE tablename = 'missions';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ VALIDATION';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Policies techniciens: %', v_count_tech;
  RAISE NOTICE 'Policies missions: %', v_count_miss;
  
  IF v_count_tech = 7 AND v_count_miss = 8 THEN
    RAISE NOTICE '✅ TOUTES LES POLICIES SONT CRÉÉES !';
  ELSE
    RAISE WARNING '⚠️  Nombre incorrect de policies !';
  END IF;
  
  -- Vérifier qu'aucune policy ne contient user_id
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename IN ('missions', 'techniciens')
    AND (qual::text LIKE '%user_id%' OR with_check::text LIKE '%user_id%')
  ) THEN
    RAISE EXCEPTION '❌ Des policies contiennent encore "user_id" !';
  ELSE
    RAISE NOTICE '✅ Aucune policy ne contient "user_id"';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
