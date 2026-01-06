-- =====================================================
-- COPIER-COLLER CE FICHIER DANS DASHBOARD SUPABASE
-- SQL Editor → New Query → Coller → Run
-- =====================================================

-- ⏱️ Temps d'exécution: ~2-3 secondes
-- 🎯 Objectif: Corriger policies RLS avec user_id
-- 📋 Actions: DROP + CREATE 15 policies (7 techniciens + 8 missions)

-- =====================================================
-- 1. DIAGNOSTIC
-- =====================================================

DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '🔍 DIAGNOSTIC POLICIES RLS';
  RAISE NOTICE '===========================================';
  
  FOR r IN 
    SELECT 
      schemaname,
      tablename,
      policyname,
      cmd,
      qual::text as using_clause,
      with_check::text as with_check_clause
    FROM pg_policies
    WHERE tablename IN ('missions', 'techniciens')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Table: %.%', r.schemaname, r.tablename;
    RAISE NOTICE 'Policy: %', r.policyname;
    RAISE NOTICE 'Command: %', r.cmd;
    RAISE NOTICE 'USING: %', r.using_clause;
    
    IF r.using_clause LIKE '%user_id%' OR r.with_check_clause LIKE '%user_id%' THEN
      RAISE WARNING '⚠️  PROBLÈME DÉTECTÉ: Policy % utilise "user_id"', r.policyname;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- 2. CORRIGER POLICIES TECHNICIENS
-- =====================================================

DROP POLICY IF EXISTS "Entreprise can view own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Entreprise can insert own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Entreprise can update own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Technicien can view own profile" ON techniciens;
DROP POLICY IF EXISTS "Technicien can update own profile" ON techniciens;
DROP POLICY IF EXISTS "Regie can view techniciens of authorized entreprises" ON techniciens;
DROP POLICY IF EXISTS "Admin JTEC can view all techniciens" ON techniciens;

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
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- =====================================================
-- 3. CORRIGER POLICIES MISSIONS
-- =====================================================

DROP POLICY IF EXISTS "Regie can view missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Entreprise can view own missions" ON missions;
DROP POLICY IF EXISTS "Locataire can view missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Entreprise can update own missions" ON missions;
DROP POLICY IF EXISTS "Regie can update missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Admin JTEC can view all missions" ON missions;
DROP POLICY IF EXISTS "Technicien can view assigned missions" ON missions;
DROP POLICY IF EXISTS "Technicien can update assigned missions" ON missions;

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
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Technicien can view assigned missions"
ON missions FOR SELECT
USING (technicien_id = (SELECT id FROM techniciens WHERE profile_id = auth.uid()));

CREATE POLICY "Technicien can update assigned missions"
ON missions FOR UPDATE
USING (technicien_id = (SELECT id FROM techniciens WHERE profile_id = auth.uid()));

-- =====================================================
-- 4. VALIDATION
-- =====================================================

DO $$
DECLARE
  v_count_techniciens integer;
  v_count_missions integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ VALIDATION M46';
  RAISE NOTICE '===========================================';
  
  SELECT COUNT(*) INTO v_count_techniciens FROM pg_policies WHERE tablename = 'techniciens';
  RAISE NOTICE 'Policies techniciens: %', v_count_techniciens;
  
  IF v_count_techniciens != 7 THEN
    RAISE WARNING '⚠️  Attendu: 7 policies techniciens, trouvé: %', v_count_techniciens;
  END IF;
  
  SELECT COUNT(*) INTO v_count_missions FROM pg_policies WHERE tablename = 'missions';
  RAISE NOTICE 'Policies missions: %', v_count_missions;
  
  IF v_count_missions != 8 THEN
    RAISE WARNING '⚠️  Attendu: 8 policies missions, trouvé: %', v_count_missions;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename IN ('techniciens', 'missions')
    AND (qual::text LIKE '%user_id%' OR with_check::text LIKE '%user_id%')
  ) THEN
    RAISE EXCEPTION '❌ ERREUR: Des policies utilisent encore "user_id"';
  ELSE
    RAISE NOTICE '✅ Aucune policy n''utilise "user_id"';
  END IF;
  
  RAISE NOTICE '✅ M46: Migration réussie';
  RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- ✅ TERMINÉ - Vérifier logs ci-dessus
-- =====================================================
