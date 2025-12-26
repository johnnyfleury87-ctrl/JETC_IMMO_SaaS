# 🔬 DIAGNOSTIC DÉTERMINISTE - locataire_id does not exist

## 🎯 OBJECTIF

Comparer la requête SQL brute (qui fonctionne) avec la requête PostgREST générée par Supabase JS (qui échoue).

Identifier EXACTEMENT où `locataire_id` disparaît.

---

## 📋 ÉTAPE 1 : DIAGNOSTIC SCHÉMA POSTGRESQL

Exécutez dans **Supabase SQL Editor** :

```sql
-- 1. Vérifier la table tickets
SELECT 
  n.nspname AS schema,
  c.relname AS table_name,
  c.relkind AS type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'tickets'
  AND n.nspname = 'public';
-- Résultat attendu: 1 ligne (public, tickets, r=table)

-- 2. Vérifier TOUTES les colonnes de tickets
SELECT 
  attnum AS position,
  attname AS column_name,
  format_type(atttypid, atttypmod) AS data_type,
  NOT attnotnull AS is_nullable,
  atthasdef AS has_default
FROM pg_attribute
WHERE attrelid = 'public.tickets'::regclass
  AND attnum > 0
  AND NOT attisdropped
ORDER BY attnum;
-- Résultat attendu: locataire_id présent à une position donnée

-- 3. Vérifier les triggers BEFORE INSERT
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  tgtype AS when_type,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.tickets'::regclass
  AND tgname NOT LIKE 'RI_%'
ORDER BY tgname;
-- Résultat attendu: 2-3 triggers listés

-- 4. Vérifier les policies RLS INSERT
SELECT 
  polname AS policy_name,
  polcmd AS command,
  polpermissive AS is_permissive,
  pg_get_expr(polqual, polrelid) AS using_clause,
  pg_get_expr(polwithcheck, polrelid) AS with_check_clause
FROM pg_policy
WHERE polrelid = 'public.tickets'::regclass
ORDER BY polname;
-- Résultat attendu: 1+ policies listées

-- 5. TEST INSERT SQL BRUT (récupérer d'abord les UUIDs)
SELECT 
  l.id AS locataire_id,
  l.logement_id,
  lg.regie_id
FROM locataires l
JOIN logements lg ON lg.id = l.logement_id
LIMIT 1;

-- Puis (REMPLACER LES UUIDs)
INSERT INTO public.tickets (
  titre,
  description,
  categorie,
  sous_categorie,
  piece,
  locataire_id,
  logement_id,
  regie_id
) VALUES (
  'Test SQL Brut Diagnostic',
  'Test insertion directe depuis SQL Editor',
  'plomberie',
  'Fuite d''eau',
  'Cuisine',
  'UUID_LOCATAIRE_ICI',
  'UUID_LOGEMENT_ICI',
  'UUID_REGIE_ICI'
) RETURNING id, statut, locataire_id, created_at;

-- Si ça fonctionne → PostgreSQL OK, problème dans PostgREST/Supabase JS
-- Si ça échoue → problème migration/schéma
```

---

## 📋 ÉTAPE 2 : CAPTURER LA REQUÊTE POSTGREST RÉELLE

PostgREST génère des logs SQL. Pour les capturer :

### Option A : Logs Supabase (recommandé)

1. **Ouvrir Supabase Dashboard → Database → Logs**
2. **Activer les logs de requêtes** :
   ```sql
   -- Activer le logging temporaire (1 minute)
   ALTER DATABASE postgres SET log_statement = 'all';
   ALTER DATABASE postgres SET log_min_duration_statement = 0;
   
   -- ⚠️ Ceci va logger TOUTES les requêtes pendant 1 minute
   ```

3. **Créer un ticket via l'API locataire** (dans les 60 secondes)

4. **Récupérer les logs** :
   - Dashboard → Database → Logs
   - Chercher une ligne avec `INSERT INTO "tickets"`
   - Copier la requête SQL complète

5. **Désactiver le logging** :
   ```sql
   ALTER DATABASE postgres RESET log_statement;
   ALTER DATABASE postgres RESET log_min_duration_statement;
   ```

### Option B : Extension pgAudit (si disponible)

```sql
-- Installer pgAudit (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Logger uniquement les INSERT sur tickets
ALTER DATABASE postgres SET pgaudit.log = 'write';
ALTER DATABASE postgres SET pgaudit.log_relation = ON;

-- Créer un ticket via l'API

-- Voir les logs
SELECT * FROM pg_stat_statements WHERE query LIKE '%INSERT INTO%tickets%';

-- Désactiver
ALTER DATABASE postgres RESET pgaudit.log;
```

### Option C : Logs Vercel (moins précis)

Les logs Vercel montrent le payload JS, mais pas la requête SQL exacte.

**À chercher dans Vercel Logs** :
```
[TICKET INSERT PAYLOAD] {
  locataire_id: '...',
  logement_id: '...',
  regie_id: '...'
}
```

Puis l'erreur PostgREST :
```
42703: column "locataire_id" does not exist
```

---

## 📋 ÉTAPE 3 : COMPARER SQL BRUT VS POSTGREST

Une fois la requête PostgREST capturée, comparez-la avec l'INSERT brut.

**Exemple de différences possibles** :

### ✅ SQL Brut (fonctionne)
```sql
INSERT INTO public.tickets (
  titre, description, categorie, sous_categorie, piece,
  locataire_id, logement_id, regie_id
) VALUES (
  'Plomberie', 'Fuite', 'plomberie', NULL, NULL,
  'uuid-1', 'uuid-2', 'uuid-3'
);
```

### ❌ PostgREST (échoue) - Hypothèses à vérifier

**CAS 1 : Colonne manquante dans la requête**
```sql
INSERT INTO "tickets" (
  "titre", "description", "categorie", "sous_categorie", "piece",
  "logement_id", "regie_id"  -- ❌ locataire_id manquant
) VALUES (...);
```
→ Supabase JS n'envoie pas `locataire_id` dans le payload

**CAS 2 : Nom de colonne incorrect**
```sql
INSERT INTO "tickets" (
  "titre", "description", "categorie",
  "locataireId", "logementId", "regieId"  -- ❌ camelCase au lieu de snake_case
) VALUES (...);
```
→ Mapping incorrect dans Supabase client

**CAS 3 : Schéma ou table incorrects**
```sql
INSERT INTO "public"."tickets_v2" (...)  -- ❌ Mauvaise table
```
→ Cache PostgREST pointe vers une ancienne table

**CAS 4 : RLS/Trigger qui échoue**
```sql
-- INSERT réussit mais le trigger ensure_locataire_has_logement_before_ticket échoue
-- Message d'erreur trompeur "column does not exist"
```
→ Le trigger accède à NEW.locataire_id mais le payload ne le contient pas

---

## 📋 ÉTAPE 4 : ACTIONS SELON LE DIAGNOSTIC

### Si CAS 1 : Payload JS ne contient pas locataire_id

**Problème** : L'objet passé à `.insert()` n'a pas la clé `locataire_id`

**Correction** : Vérifier que l'objet littéral contient bien :
```javascript
.insert([{
  // ...
  locataire_id: locataire.id,  // ← VÉRIFIER QUE CETTE LIGNE EXISTE
  // ...
}])
```

### Si CAS 2 : Mapping camelCase/snake_case

**Problème** : Supabase client convertit mal les noms de colonnes

**Correction** : Forcer snake_case explicitement :
```javascript
const { data, error } = await supabaseAdmin
  .from('tickets')
  .insert([{
    titre: titre,
    description: description,
    categorie: categorie,
    sous_categorie: sous_categorie || null,
    piece: piece || null,
    locataire_id: locataire.id,    // ← snake_case explicite
    logement_id: locataire.logement_id,
    regie_id: logement.regie_id
  }]);
```

### Si CAS 3 : Cache PostgREST obsolète

**Problème** : PostgREST cache pointe vers une ancienne définition de schéma

**Correction** : Forcer le reload :
```sql
NOTIFY pgrst, 'reload schema';
```

Ou redémarrer Supabase :
- Dashboard → Settings → General → Pause → Unpause

### Si CAS 4 : Trigger échoue

**Problème** : Le trigger `ensure_locataire_has_logement_before_ticket` accède à `NEW.locataire_id` mais la colonne n'est pas dans le NEW record

**Correction** : Vérifier le trigger :
```sql
-- Récupérer la définition du trigger
SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'ensure_locataire_has_logement_before_ticket';

-- Vérifier qu'il accède bien à NEW.locataire_id et non NEW."locataire_id" ou NEW.locataireId
```

---

## 🎯 RÉSULTAT ATTENDU

Après ce diagnostic, vous aurez :

1. **Confirmation que PostgreSQL est OK** (INSERT SQL brut fonctionne)
2. **La requête PostgREST exacte** qui échoue
3. **La différence précise** entre les deux
4. **Une correction ciblée** basée sur des faits

---

## 📤 PARTAGER LES RÉSULTATS

Une fois le diagnostic terminé, partagez :

1. **Résultat ÉTAPE 1** (colonnes pg_attribute)
2. **Résultat ÉTAPE 2** (requête PostgREST capturée)
3. **Résultat INSERT SQL brut** (succès/échec)

Avec ces 3 éléments, je pourrai identifier la correction exacte à appliquer.

---

## ⚠️ RÈGLE ABSOLUE

**AUCUN changement de code tant que ce diagnostic n'est pas fait.**

Le problème est entre PostgreSQL (qui fonctionne) et Supabase JS (qui échoue).

Le diagnostic déterministe va révéler où exactement `locataire_id` disparaît.
