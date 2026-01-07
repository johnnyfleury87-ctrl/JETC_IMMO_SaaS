-- =====================================================
-- VÉRIFICATION ET APPLICATION RLS - ÉTAPE 4
-- =====================================================
-- Ce script vérifie et applique les Row Level Security
-- sur toutes les tables critiques
--
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- 1. VÉRIFIER L'ÉTAT ACTUEL DES RLS
-- =====================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'missions', 'tickets', 'techniciens', 'entreprises',
    'regies', 'logements', 'locataires', 'immeubles',
    'factures', 'factures_commissions_jetc'
  )
ORDER BY tablename;

-- 2. LISTER LES POLICIES EXISTANTES
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using_clause,
  with_check IS NOT NULL as has_with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. COMPTER LES POLICIES PAR TABLE
-- =====================================================

SELECT 
  tablename,
  COUNT(*) as policy_count,
  array_agg(DISTINCT cmd) as commands_covered
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'missions', 'tickets', 'techniciens', 'entreprises',
    'regies', 'logements', 'locataires', 'immeubles',
    'factures'
  )
GROUP BY tablename
ORDER BY tablename;

-- 4. VÉRIFIER LES POLICIES SPÉCIFIQUES POUR MISSIONS
-- =====================================================

SELECT 
  policyname,
  cmd,
  roles,
  CASE 
    WHEN qual LIKE '%technicien_id%' THEN '✓ Filtre technicien'
    WHEN qual LIKE '%entreprise_id%' THEN '✓ Filtre entreprise'
    WHEN qual LIKE '%regie_id%' THEN '✓ Filtre régie'
    WHEN qual LIKE '%admin_jtec%' THEN '✓ Accès admin'
    ELSE '⚠ Autre filtre'
  END as filter_type,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'missions'
ORDER BY cmd, policyname;

-- 5. DIAGNOSTIC COMPLET
-- =====================================================

DO $$
DECLARE
  v_table text;
  v_rls_enabled boolean;
  v_policy_count integer;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC RLS COMPLET';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR v_table IN 
    SELECT unnest(ARRAY[
      'missions', 'tickets', 'techniciens', 'entreprises',
      'regies', 'logements', 'locataires', 'immeubles', 'factures'
    ])
  LOOP
    -- Vérifier RLS activé
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table AND relnamespace = 'public'::regnamespace;
    
    -- Compter policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = v_table AND schemaname = 'public';
    
    RAISE NOTICE 'Table: %', v_table;
    RAISE NOTICE '  RLS activé: %', COALESCE(v_rls_enabled::text, 'INCONNU');
    RAISE NOTICE '  Policies: %', v_policy_count;
    
    IF NOT v_rls_enabled THEN
      RAISE WARNING '  → RLS DÉSACTIVÉ ! Exécuter: ALTER TABLE % ENABLE ROW LEVEL SECURITY;', v_table;
    END IF;
    
    IF v_policy_count = 0 THEN
      RAISE WARNING '  → AUCUNE POLICY ! Vérifier le fichier SQL correspondant';
    END IF;
    
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIN DU DIAGNOSTIC';
  RAISE NOTICE '========================================';
END $$;

-- 6. SI RLS NON ACTIVÉ : COMMANDES DE CORRECTION
-- =====================================================
-- Décommenter et exécuter si nécessaire :

-- ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE techniciens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE regies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE logements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE locataires ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE immeubles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE factures_commissions_jetc ENABLE ROW LEVEL SECURITY;

-- 7. VÉRIFICATION POST-APPLICATION
-- =====================================================
-- Après application des policies, vérifier :

SELECT 
  'MISSIONS' as table_check,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies,
  COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'missions';
