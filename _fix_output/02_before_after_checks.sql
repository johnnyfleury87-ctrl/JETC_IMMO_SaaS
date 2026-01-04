-- ============================================================
-- ÉTAPE 2: VÉRIFICATIONS AVANT APPLICATION M42
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Prouver état DB avant application migration

-- TEST 1: Vérifier absence colonne missions.disponibilite_id
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
  AND column_name = 'disponibilite_id';
-- Résultat attendu: 0 lignes (colonne absente)

-- TEST 2: Lister toutes colonnes missions (avant)
SELECT 
  column_name,
  ordinal_position,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
ORDER BY ordinal_position;
-- Résultat attendu: 20 colonnes (sans disponibilite_id)

-- TEST 3: Vérifier existence table tickets_disponibilites (FK target)
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'tickets_disponibilites';
-- Résultat attendu: 1 ligne (table existe)

-- TEST 4: Vérifier structure tickets_disponibilites.id
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets_disponibilites'
  AND column_name = 'id';
-- Résultat attendu: 1 ligne (id uuid NOT NULL)

-- ============================================================
-- VÉRIFICATIONS APRÈS APPLICATION M42
-- ============================================================

-- TEST 5: Confirmer présence colonne missions.disponibilite_id
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
  AND column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (disponibilite_id uuid YES null)

-- TEST 6: Vérifier contrainte FK disponibilite_id → tickets_disponibilites
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'missions'
  AND kcu.column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (FK vers tickets_disponibilites.id)

-- TEST 7: Vérifier index idx_missions_disponibilite_id
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'missions'
  AND indexname = 'idx_missions_disponibilite_id';
-- Résultat attendu: 1 ligne (index partial WHERE disponibilite_id IS NOT NULL)

-- TEST 8: Compter colonnes missions (après)
SELECT COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions';
-- Résultat attendu: 21 colonnes (20 + disponibilite_id)

-- ============================================================
-- FIN VÉRIFICATIONS
-- ============================================================
