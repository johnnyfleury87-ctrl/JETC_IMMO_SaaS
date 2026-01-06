-- =====================================================
-- VÉRIFICATION DES RÔLES EXISTANTS
-- =====================================================
-- Exécuter ce script D'ABORD pour voir les vraies valeurs

-- 1. Voir tous les rôles utilisés actuellement
SELECT DISTINCT role FROM profiles ORDER BY role;

-- 2. Si 'role' est un ENUM, voir les valeurs autorisées
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%role%'
ORDER BY t.typname, e.enumsortorder;

-- 3. Voir la structure de la colonne role
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
