-- ============================================================
-- ÉTAPE 3 — Export historique migration_logs
-- ============================================================
-- À exécuter dans Supabase Studio > SQL Editor
-- ============================================================

SELECT 
    migration_name,
    executed_at,
    COALESCE(description, '') as description
FROM public.migration_logs
ORDER BY executed_at DESC;

-- ============================================================
-- INSTRUCTIONS EXPORT CSV
-- ============================================================
-- 1. Copier cette requête dans Supabase Studio > SQL Editor
-- 2. Exécuter (bouton Run)
-- 3. Cliquer sur bouton "Download CSV" dans les résultats
-- 4. Sauvegarder le fichier sous:
--    _audit_output/03_migrations_applied_from_db.csv
-- ============================================================
