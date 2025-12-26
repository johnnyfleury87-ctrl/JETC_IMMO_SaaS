# 🔍 AUDIT SQL COMMANDS - JETC_IMMO

**Date** : 26 décembre 2025  
**Objectif** : Commandes SQL pour extraire l'état complet de la base de données

---

## 📋 INSTRUCTIONS D'UTILISATION

Exécuter ces commandes dans **Supabase SQL Editor** pour générer un état des lieux complet.

---

## 1. TABLES - Structure complète

### 1.1. Liste toutes les tables du schéma public

```sql
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 1.2. Colonnes de chaque table (tickets, missions, entreprises, regies_entreprises)

```sql
-- Structure table tickets
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
ORDER BY ordinal_position;

-- Structure table missions
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
ORDER BY ordinal_position;

-- Structure table entreprises
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'entreprises'
ORDER BY ordinal_position;

-- Structure table regies_entreprises
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'regies_entreprises'
ORDER BY ordinal_position;

-- Structure table locataires
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'locataires'
ORDER BY ordinal_position;

-- Structure table profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

---

## 2. CONTRAINTES - PK / FK / UNIQUE / CHECK

### 2.1. Primary Keys

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('tickets', 'missions', 'entreprises', 'regies_entreprises', 'locataires', 'profiles')
ORDER BY tc.table_name;
```

### 2.2. Foreign Keys

```sql
SELECT
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  tc.constraint_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('tickets', 'missions', 'entreprises', 'regies_entreprises', 'locataires', 'profiles')
ORDER BY tc.table_name, kcu.column_name;
```

### 2.3. UNIQUE Constraints

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('tickets', 'missions', 'entreprises', 'regies_entreprises')
ORDER BY tc.table_name;
```

### 2.4. CHECK Constraints

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('tickets', 'missions', 'entreprises', 'regies_entreprises')
ORDER BY tc.table_name;
```

---

## 3. ENUMS - Types personnalisés

### 3.1. Liste des ENUMs

```sql
SELECT 
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN ('ticket_status', 'mission_status', 'user_role')
ORDER BY t.typname, e.enumsortorder;
```

### 3.2. Définition complète de ticket_status

```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'ticket_status'::regtype
ORDER BY enumsortorder;
```

### 3.3. Définition complète de mission_status

```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'mission_status'::regtype
ORDER BY enumsortorder;
```

---

## 4. VUES - Définitions

### 4.1. Liste des vues

```sql
SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%ticket%'
ORDER BY table_name;
```

### 4.2. Vue tickets_visibles_entreprise (définition complète)

```sql
SELECT 
  pg_get_viewdef('tickets_visibles_entreprise'::regclass, true) AS view_definition;
```

### 4.3. Vue tickets_complets (définition complète)

```sql
SELECT 
  pg_get_viewdef('tickets_complets'::regclass, true) AS view_definition;
```

### 4.4. Vue missions_details (définition complète)

```sql
SELECT 
  pg_get_viewdef('missions_details'::regclass, true) AS view_definition;
```

---

## 5. FONCTIONS / RPC - Définitions

### 5.1. Liste des fonctions liées aux tickets

```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%ticket%'
    OR p.proname LIKE '%mission%'
    OR p.proname = 'get_user_regie_id'
    OR p.proname = 'is_admin_jtec'
  )
ORDER BY p.proname;
```

### 5.2. Fonction accept_ticket_and_create_mission (détails)

```sql
SELECT pg_get_functiondef('accept_ticket_and_create_mission'::regproc);
```

### 5.3. Fonction update_ticket_statut (si existe)

```sql
SELECT 
  proname,
  pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_ticket_statut';
```

### 5.4. Fonction get_user_regie_id

```sql
SELECT pg_get_functiondef('get_user_regie_id'::regproc);
```

---

## 6. TRIGGERS - Définitions

### 6.1. Liste des triggers sur tickets et missions

```sql
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('tickets', 'missions')
  AND tgisinternal = false
ORDER BY tgrelid::regclass, tgname;
```

### 6.2. Trigger set_ticket_regie_id_trigger (détails)

```sql
SELECT 
  tgname,
  tgrelid::regclass,
  tgenabled,
  pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'set_ticket_regie_id_trigger';
```

---

## 7. ROW LEVEL SECURITY (RLS) - Policies

### 7.1. État RLS des tables

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tickets', 'missions', 'entreprises', 'regies_entreprises', 'locataires', 'profiles')
ORDER BY tablename;
```

### 7.2. Policies sur table tickets

```sql
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
  AND tablename = 'tickets'
ORDER BY policyname;
```

### 7.3. Policies sur table missions

```sql
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
  AND tablename = 'missions'
ORDER BY policyname;
```

### 7.4. Policies sur table regies_entreprises

```sql
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
  AND tablename = 'regies_entreprises'
ORDER BY policyname;
```

### 7.5. Policies détaillées avec définition complète

```sql
SELECT 
  pol.schemaname,
  pol.tablename,
  pol.policyname,
  pol.permissive,
  pol.roles,
  pol.cmd AS command,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy p
JOIN pg_policies pol ON p.polname = pol.policyname AND p.polrelid = (pol.schemaname || '.' || pol.tablename)::regclass
WHERE pol.schemaname = 'public'
  AND pol.tablename IN ('tickets', 'missions')
ORDER BY pol.tablename, pol.policyname;
```

---

## 8. INDEX - Performance

### 8.1. Index sur tickets

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'tickets'
ORDER BY indexname;
```

### 8.2. Index sur missions

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'missions'
ORDER BY indexname;
```

---

## 9. DONNÉES DE TEST - Comptages

### 9.1. Comptage tables principales

```sql
SELECT 
  'tickets' AS table_name, 
  COUNT(*) AS row_count,
  COUNT(DISTINCT statut) AS distinct_statuts,
  COUNT(DISTINCT regie_id) AS distinct_regies
FROM tickets
UNION ALL
SELECT 
  'missions', 
  COUNT(*),
  COUNT(DISTINCT statut),
  COUNT(DISTINCT entreprise_id)
FROM missions
UNION ALL
SELECT 
  'entreprises', 
  COUNT(*),
  NULL,
  NULL
FROM entreprises
UNION ALL
SELECT 
  'regies_entreprises', 
  COUNT(*),
  COUNT(DISTINCT mode_diffusion),
  NULL
FROM regies_entreprises;
```

### 9.2. Distribution des statuts tickets

```sql
SELECT 
  statut,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM tickets
GROUP BY statut
ORDER BY count DESC;
```

### 9.3. Distribution des statuts missions

```sql
SELECT 
  statut,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM missions
GROUP BY statut
ORDER BY count DESC;
```

---

## 10. VÉRIFICATIONS DE COHÉRENCE

### 10.1. Tickets sans regie_id (anomalie)

```sql
SELECT id, titre, created_at
FROM tickets
WHERE regie_id IS NULL
LIMIT 10;
```

### 10.2. Missions sans ticket valide (FK cassée théoriquement)

```sql
SELECT m.id, m.ticket_id, m.created_at
FROM missions m
LEFT JOIN tickets t ON m.ticket_id = t.id
WHERE t.id IS NULL
LIMIT 10;
```

### 10.3. Tickets verrouillés sans mission (incohérence)

```sql
SELECT t.id, t.titre, t.locked_at, t.statut
FROM tickets t
LEFT JOIN missions m ON m.ticket_id = t.id
WHERE t.locked_at IS NOT NULL
  AND m.id IS NULL
LIMIT 10;
```

### 10.4. Entreprises dans regies_entreprises sans profil actif

```sql
SELECT re.id, re.entreprise_id, re.regie_id, e.nom
FROM regies_entreprises re
LEFT JOIN entreprises e ON re.entreprise_id = e.id
WHERE e.id IS NULL
LIMIT 10;
```

### 10.5. Colonne autorise existe-t-elle dans regies_entreprises ?

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'regies_entreprises'
  AND column_name = 'autorise';
-- Si 0 row → colonne n'existe PAS (⚠️ utilisée dans RPC)
```

---

## 📊 RÉSULTAT ATTENDU

Après exécution de ces commandes, vous aurez :

- ✅ Structure exacte des 6 tables principales
- ✅ Toutes les contraintes (PK, FK, UNIQUE, CHECK)
- ✅ Valeurs des ENUMs (ticket_status, mission_status, user_role)
- ✅ Définitions complètes des 3 vues principales
- ✅ Code source des 4+ fonctions RPC
- ✅ Définitions des triggers (set_ticket_regie_id)
- ✅ Liste complète des 15+ policies RLS
- ✅ Index de performance
- ✅ Statistiques et vérifications de cohérence

**Durée estimée d'exécution** : 2-3 minutes

**Stockage résultats** : Copier/coller dans `docs/audit/AUDIT_SQL_RESULTS.txt`

---

**Fin des commandes SQL d'audit**
