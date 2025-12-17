-- =====================================================
-- DIAGNOSTIC - État actuel de la base Supabase
-- =====================================================
-- Date: 2025-12-17
-- Objectif: Lister tous les objets existants avant reset
-- Usage: Exécuter dans Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABLES EXISTANTES (schéma public)
-- =====================================================
SELECT 
    'TABLE' as type,
    schemaname,
    tablename as name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- 2. VUES EXISTANTES
-- =====================================================
SELECT 
    'VIEW' as type,
    schemaname,
    viewname as name
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- =====================================================
-- 3. FONCTIONS EXISTANTES
-- =====================================================
SELECT 
    'FUNCTION' as type,
    n.nspname as schema,
    p.proname as name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- =====================================================
-- 4. INDEX EXISTANTS
-- =====================================================
SELECT 
    'INDEX' as type,
    schemaname,
    indexname as name,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

-- =====================================================
-- 5. CONTRAINTES EXISTANTES
-- =====================================================
SELECT 
    'CONSTRAINT' as type,
    conname as name,
    contype as constraint_type,
    conrelid::regclass as table_name
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conname;

-- =====================================================
-- 6. TYPES ENUM EXISTANTS
-- =====================================================
SELECT 
    'ENUM' as type,
    n.nspname as schema,
    t.typname as name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- =====================================================
-- 7. TRIGGERS EXISTANTS
-- =====================================================
SELECT 
    'TRIGGER' as type,
    trigger_schema,
    trigger_name as name,
    event_object_table as table_name,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- =====================================================
-- 8. POLICIES RLS EXISTANTES
-- =====================================================
SELECT 
    'POLICY' as type,
    schemaname,
    tablename,
    policyname as name,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 9. STORAGE BUCKETS
-- =====================================================
SELECT 
    'BUCKET' as type,
    id,
    name,
    public
FROM storage.buckets
ORDER BY name;

-- =====================================================
-- 10. RÉSUMÉ GLOBAL
-- =====================================================
SELECT 'SUMMARY' as info, 
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as tables,
    (SELECT count(*) FROM pg_views WHERE schemaname = 'public') as views,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') as functions,
    (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as indexes,
    (SELECT count(DISTINCT t.typname) FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public') as enums,
    (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public') as triggers,
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as policies,
    (SELECT count(*) FROM storage.buckets) as buckets;
