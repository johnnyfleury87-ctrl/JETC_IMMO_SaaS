-- ============================================
-- AUDIT RLS MULTI-DEVISE - ÉTAPE 5
-- Date: 2026-01-09
-- Objectif: Vérifier que les RLS sont compatibles avec la colonne currency
-- ============================================

-- ============================================
-- PARTIE 1: VÉRIFIER LES TABLES AVEC CURRENCY
-- ============================================

-- Lister toutes les tables avec colonne currency
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'currency'
ORDER BY table_name;

-- Résultat attendu :
-- regies         | currency | text | YES
-- entreprises    | currency | text | YES
-- factures       | currency | text | NO

-- ============================================
-- PARTIE 2: VÉRIFIER RLS SUR TABLES CURRENCY
-- ============================================

-- Vérifier que RLS est activée
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('regies', 'entreprises', 'factures')
ORDER BY tablename;

-- Résultat attendu : rowsecurity = true pour les 3

-- ============================================
-- PARTIE 3: LISTER TOUTES LES POLICIES RLS
-- ============================================

-- Policies sur regies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'regies'
ORDER BY policyname;

-- Policies sur entreprises
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'entreprises'
ORDER BY policyname;

-- Policies sur factures
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'factures'
ORDER BY policyname;

-- ============================================
-- PARTIE 4: TESTER ACCÈS CURRENCY PAR RÔLE
-- ============================================

-- TEST 1: Régie peut voir sa propre currency
-- (Simuler en tant que régie_id = 'xxx')
SELECT id, nom, currency
FROM regies
WHERE profile_id = auth.uid()
LIMIT 5;

-- TEST 2: Entreprise peut voir sa propre currency
SELECT id, nom, currency
FROM entreprises
WHERE profile_id = auth.uid()
LIMIT 5;

-- TEST 3: Entreprise peut voir currency des factures
SELECT 
  f.numero,
  f.currency,
  f.montant_ht,
  f.montant_ttc,
  e.nom as entreprise_nom
FROM factures f
JOIN entreprises e ON e.id = f.entreprise_id
WHERE e.profile_id = auth.uid()
LIMIT 5;

-- TEST 4: Régie peut voir currency des factures sur ses biens
SELECT 
  f.numero,
  f.currency,
  f.montant_ht,
  f.montant_ttc,
  r.nom as regie_nom
FROM factures f
JOIN regies r ON r.id = f.regie_id
WHERE r.profile_id = auth.uid()
LIMIT 5;

-- ============================================
-- PARTIE 5: VÉRIFIER ISOLATION ENTRE DEVISES
-- ============================================

-- Compter factures par devise et vérifier isolation
SELECT 
  currency,
  COUNT(*) as nb_factures,
  COUNT(DISTINCT entreprise_id) as nb_entreprises,
  COUNT(DISTINCT regie_id) as nb_regies,
  SUM(montant_ht) as total_ht,
  SUM(montant_ttc) as total_ttc
FROM factures
GROUP BY currency
ORDER BY currency;

-- ============================================
-- PARTIE 6: AUDIT FONCTIONS SECURITY DEFINER
-- ============================================

-- Lister toutes les fonctions SECURITY DEFINER (contournent RLS)
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security,
  prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND prosecdef = true
  AND proname IN (
    'generate_facture_from_mission',
    'editer_facture',
    'calculer_montants_facture',
    'is_admin_jtec',
    'get_user_regie_id'
  )
ORDER BY p.proname;

-- ============================================
-- PARTIE 7: VÉRIFIER search_path SECURITY
-- ============================================

-- Vérifier que les fonctions SECURITY DEFINER ont search_path fixe
SELECT 
  p.proname,
  p.proconfig as search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname IN (
    'generate_facture_from_mission',
    'editer_facture',
    'calculer_montants_facture'
  )
ORDER BY p.proname;

-- Résultat attendu : proconfig = {search_path=public}

-- ============================================
-- RAPPORT FINAL
-- ============================================

DO $$
DECLARE
  v_regies_rls BOOLEAN;
  v_entreprises_rls BOOLEAN;
  v_factures_rls BOOLEAN;
  v_nb_policies_regies INT;
  v_nb_policies_entreprises INT;
  v_nb_policies_factures INT;
BEGIN
  -- Vérifier RLS activée
  SELECT rowsecurity INTO v_regies_rls
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'regies';
  
  SELECT rowsecurity INTO v_entreprises_rls
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'entreprises';
  
  SELECT rowsecurity INTO v_factures_rls
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'factures';
  
  -- Compter policies
  SELECT COUNT(*) INTO v_nb_policies_regies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'regies';
  
  SELECT COUNT(*) INTO v_nb_policies_entreprises
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'entreprises';
  
  SELECT COUNT(*) INTO v_nb_policies_factures
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'factures';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AUDIT RLS MULTI-DEVISE - RAPPORT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table regies:';
  RAISE NOTICE '  - RLS activée: %', v_regies_rls;
  RAISE NOTICE '  - Nombre de policies: %', v_nb_policies_regies;
  RAISE NOTICE '';
  RAISE NOTICE 'Table entreprises:';
  RAISE NOTICE '  - RLS activée: %', v_entreprises_rls;
  RAISE NOTICE '  - Nombre de policies: %', v_nb_policies_entreprises;
  RAISE NOTICE '';
  RAISE NOTICE 'Table factures:';
  RAISE NOTICE '  - RLS activée: %', v_factures_rls;
  RAISE NOTICE '  - Nombre de policies: %', v_nb_policies_factures;
  RAISE NOTICE '========================================';
  
  IF NOT v_regies_rls THEN
    RAISE WARNING 'RLS non activée sur table regies !';
  END IF;
  
  IF NOT v_entreprises_rls THEN
    RAISE WARNING 'RLS non activée sur table entreprises !';
  END IF;
  
  IF NOT v_factures_rls THEN
    RAISE WARNING 'RLS non activée sur table factures !';
  END IF;
END $$;
