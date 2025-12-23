# 🚨 BUG CRITIQUE RLS - RÉCURSION INFINIE IMMEUBLES

**Date** : 23 décembre 2025  
**Erreur** : `infinite recursion detected in policy for relation "immeubles"`  
**Code erreur** : 42P17  
**Type** : Bug RLS (Row Level Security)

---

## 🎯 SYMPTÔME

```
Error: infinite recursion detected in policy for relation "immeubles"
Code: 42P17
```

**Contexte** :
- Frontend correct (chargement régie OK)
- Crash au chargement page `/regie/locataires`
- Impossible d'exécuter `SELECT * FROM immeubles`

---

## 🔬 ROOT CAUSE

### Chaîne de récursion identifiée

```
1. SELECT * FROM immeubles
   ↓
2. RLS déclenche policy "Regie can view own immeubles"
   ↓
3. Policy utilise : USING (regie_id = get_user_regie_id())
   ↓
4. Fonction get_user_regie_id() exécute :
   SELECT i.regie_id FROM immeubles i JOIN ...
   ↓
5. Lecture de immeubles déclenche ENCORE la policy
   ↓
6. ∞ RÉCURSION
```

### Code problématique

**Fichier** : [supabase/schema/18_rls.sql](../supabase/schema/18_rls.sql#L90)

```sql
create policy "Regie can view own immeubles"
on immeubles for select
using (regie_id = get_user_regie_id());  -- ❌ RÉCURSION
```

**Fichier** : [supabase/schema/09b_helper_functions.sql](../supabase/schema/09b_helper_functions.sql#L31)

```sql
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- ❌ LIT IMMEUBLES → DÉCLENCHE POLICY → RÉCURSION
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id  -- ❌ ICI
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;
```

---

## ✅ SOLUTION APPLIQUÉE

### Principe

**AVANT** : Policy immeubles utilise `get_user_regie_id()` qui lit immeubles → récursion

**APRÈS** : Policy immeubles lit directement `regies.profile_id` → pas de récursion

### Code corrigé

**Fichier** : [supabase/migrations/20251223000004_fix_rls_recursion_immeubles.sql](../supabase/migrations/20251223000004_fix_rls_recursion_immeubles.sql)

```sql
-- DROP anciennes policies
DROP POLICY IF EXISTS "Regie can view own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Regie can manage own immeubles" ON immeubles;
DROP POLICY IF EXISTS "Admin JTEC can view all immeubles" ON immeubles;

-- ✅ NOUVELLE POLICY SANS RÉCURSION
CREATE POLICY "Regie can view own immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()  -- ✅ Direct, pas get_user_regie_id()
  )
);

CREATE POLICY "Regie can manage own immeubles"
ON immeubles FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = immeubles.regie_id
      AND r.profile_id = auth.uid()
  )
);

CREATE POLICY "Admin JTEC can view all immeubles"
ON immeubles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin_jtec'
  )
);
```

---

## 📊 COMPARAISON AVANT/APRÈS

| Aspect | AVANT (récursif) | APRÈS (corrigé) |
|--------|------------------|-----------------|
| **Policy immeubles** | `USING (regie_id = get_user_regie_id())` | `USING (EXISTS (SELECT 1 FROM regies ...))` |
| **Dépendance** | Fonction helper | Direct sur regies |
| **Lecture immeubles** | Oui (via fonction) | Non |
| **Récursion** | ❌ Infinie | ✅ Aucune |
| **Performance** | N/A (crash) | ✅ Rapide (index FK) |

---

## 🎯 LOGIQUE VALIDATION

### Pour rôle `regie`

```sql
-- Vérification :
1. User auth.uid() = UUID-A
2. Table regies : profile_id = UUID-A, id = UUID-REGIE-X
3. Table immeubles : regie_id = UUID-REGIE-X
4. Policy immeubles : EXISTS (regies WHERE id = UUID-REGIE-X AND profile_id = UUID-A) → TRUE
5. ✅ SELECT réussit
```

### Pour rôle `admin_jtec`

```sql
-- Vérification :
1. User auth.uid() = UUID-ADMIN
2. Table profiles : id = UUID-ADMIN, role = 'admin_jtec'
3. Policy immeubles : EXISTS (profiles WHERE id = UUID-ADMIN AND role = 'admin_jtec') → TRUE
4. ✅ SELECT réussit (tous immeubles visibles)
```

---

## 📋 VALIDATION COMPLÈTE

### Script SQL de test

```sql
-- Test 1 : Vérifier policies immeubles
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'immeubles';

-- Attendu :
-- Regie can view own immeubles | SELECT | EXISTS (regies...)
-- Regie can manage own immeubles | ALL | EXISTS (regies...)
-- Admin JTEC can view all immeubles | SELECT | EXISTS (profiles...)
```

### Test 2 : SELECT immeubles (en tant que régie)

```sql
-- Se connecter avec compte régie
SELECT id, nom, regie_id FROM immeubles;

-- Doit retourner : Liste des immeubles de cette régie (pas d'erreur 42P17)
```

### Test 3 : Page locataires

1. Se connecter en tant que régie
2. Accéder à `/regie/locataires`
3. Vérifier console : aucune erreur `infinite recursion`
4. Page charge normalement

---

## 🚀 DÉPLOIEMENT

**Migration** : [20251223000004_fix_rls_recursion_immeubles.sql](../supabase/migrations/20251223000004_fix_rls_recursion_immeubles.sql)

**Action** :
1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier contenu migration
3. Exécuter
4. Vérifier message : `✅ Policies immeubles recréées sans récursion`

**Validation** :
```sql
-- Doit retourner 3 policies
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'immeubles';

-- Aucune ne doit contenir 'get_user_regie_id'
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'immeubles'
  AND definition LIKE '%get_user_regie_id%';
-- Doit retourner 0 lignes
```

---

## 🎯 RÈGLES RLS FINALES

| Table | Policy | Dépend de | Récursion possible ? |
|-------|--------|-----------|---------------------|
| **immeubles** | Regie can view | `regies.profile_id` | ❌ Non (lit regies, pas immeubles) |
| **logements** | Regie can view | `immeubles.regie_id` + `regies.profile_id` | ⚠️ Oui SI immeubles mal configuré |
| **locataires** | Locataire can view own | `profiles.id` | ❌ Non (lit profiles uniquement) |
| **tickets** | Locataire can view own | `locataires.profile_id` | ❌ Non (lit locataires, pas tickets) |

**Règle générale** : Une policy sur table X **NE DOIT JAMAIS** lire la table X dans son `USING` clause.

---

## 📋 CHECKLIST POST-FIX

- [ ] Migration 20251223000004 exécutée
- [ ] 3 policies immeubles créées
- [ ] Aucune policy ne contient `get_user_regie_id()`
- [ ] `SELECT * FROM immeubles` réussit (régie)
- [ ] Page `/regie/locataires` charge sans erreur
- [ ] Console logs : aucun 42P17
- [ ] Fonction `get_user_regie_id()` toujours utilisable pour autres tables (logements, tickets)

---

## 🎯 CONCLUSION

**Cause** : Policy immeubles utilisait fonction helper qui lisait immeubles → récursion

**Solution** : Policy immeubles lit directement regies.profile_id → pas de récursion

**Avantage** : Plus simple, plus rapide, pas de dépendance fonction

**État final** : ✅ RLS saine, compréhensible, sans récursion

**Note importante** : `get_user_regie_id()` reste disponible pour autres tables (logements, tickets) car ces tables NE lisent PAS immeubles directement dans leurs policies.
