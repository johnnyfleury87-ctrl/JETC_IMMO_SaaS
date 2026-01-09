-- VÉRIFICATION POLICIES RLS SUR FACTURES
-- Date: 2026-01-09

-- ========================================
-- 1. LISTER TOUTES LES POLICIES SUR FACTURES
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'factures'
ORDER BY policyname;

-- ========================================
-- 2. VÉRIFIER SI RLS EST ACTIVÉ
-- ========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'factures';

-- ========================================
-- 3. LISTER COLONNES FACTURES
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_generated
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'factures'
ORDER BY ordinal_position;

-- ========================================
-- 4. VUES LIÉES AUX FACTURES
-- ========================================
SELECT 
  table_name,
  LEFT(view_definition, 200) AS definition_preview
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name ILIKE '%facture%'
ORDER BY table_name;

-- ========================================
-- 5. FONCTIONS RPC FACTURES
-- ========================================
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type,
  routine_definition IS NOT NULL AS has_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name ILIKE '%facture%'
ORDER BY routine_name;

-- ========================================
-- 6. DONNÉES FACTURES (SAMPLE)
-- ========================================
SELECT 
  id,
  numero,
  statut,
  entreprise_id,
  regie_id,
  mission_id,
  montant_ht,
  montant_ttc,
  created_at
FROM factures
ORDER BY created_at DESC
LIMIT 5;
