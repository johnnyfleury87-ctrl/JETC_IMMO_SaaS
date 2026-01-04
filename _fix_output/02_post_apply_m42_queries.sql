-- ============================================================
-- ÉTAPE 2B - REQUÊTES VALIDATION M42
-- ============================================================
-- Date: 2026-01-04
-- Usage: Exécuter dans Supabase Studio SQL Editor pour validation manuelle
-- ============================================================

-- CHECK 1: Vérifier colonne disponibilite_id existe
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
  AND column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (missions, disponibilite_id, uuid, YES, NULL)


-- CHECK 1bis: Lister toutes colonnes missions (doit contenir disponibilite_id)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
ORDER BY ordinal_position;
-- Résultat attendu: 21 colonnes (20 existantes + disponibilite_id)


-- CHECK 2: Vérifier contrainte FK
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'missions'
  AND kcu.column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (missions_disponibilite_id_fkey, tickets_disponibilites, id, SET NULL)


-- CHECK 3: Vérifier index
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'missions'
  AND indexname = 'idx_missions_disponibilite_id';
-- Résultat attendu: 1 ligne avec indexdef contenant WHERE disponibilite_id IS NOT NULL


-- CHECK 4: Vérifier migration enregistrée
SELECT id, migration_name, description, applied_at
FROM migration_logs
WHERE migration_name LIKE '%m42%'
   OR migration_name LIKE '%disponibilite_id%'
ORDER BY applied_at DESC;
-- Résultat attendu: 1 ligne (20260104001800_m42_add_disponibilite_id_missions)


-- ============================================================
-- FIN REQUÊTES VALIDATION
-- ============================================================
