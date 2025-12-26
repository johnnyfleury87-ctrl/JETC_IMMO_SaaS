# 🔍 DIAGNOSTIC SQL À EXÉCUTER DANS SUPABASE

## ⚠️ INSTRUCTIONS

Exécutez ces requêtes **dans l'ordre** dans le **Supabase SQL Editor** et partagez-moi les résultats complets.

---

## 📋 REQUÊTE 1 : Lister toutes les relations nommées "tickets"

**Objectif** : Vérifier s'il existe plusieurs objets nommés "tickets" (table, vue, etc.)

```sql
SELECT
  n.nspname AS schema,
  c.relname AS name,
  CASE c.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    WHEN 'i' THEN 'INDEX'
    WHEN 'S' THEN 'SEQUENCE'
    WHEN 'f' THEN 'FOREIGN TABLE'
    ELSE c.relkind::text
  END AS type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'tickets'
ORDER BY n.nspname, c.relkind;
```

**Résultat attendu** :
- 1 seule ligne : `public | tickets | TABLE`
- Si plusieurs lignes → problème identifié

---

## 📋 REQUÊTE 2 : Vérifier les colonnes de public.tickets

**Objectif** : Confirmer que `locataire_id` existe dans la table

```sql
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
ORDER BY ordinal_position;
```

**Résultat attendu** :
- Une ligne avec `column_name = 'locataire_id'`
- Si absent → migration M01-M15 non appliquée

---

## 📋 REQUÊTE 3 : Vérifier les vues qui pourraient masquer la table

**Objectif** : S'assurer qu'aucune vue nommée "tickets" n'existe

```sql
SELECT 
  table_schema, 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'tickets';
```

**Résultat attendu** :
- 0 lignes (aucune vue nommée "tickets")
- Si 1+ lignes → vue trouvée, c'est elle qui est ciblée par l'API

---

## 📋 REQUÊTE 4 : Vérifier les triggers BEFORE INSERT

**Objectif** : Identifier quel trigger pourrait échouer

```sql
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.tickets'::regclass
  AND tgname NOT LIKE 'RI_%'  -- Exclure triggers internes
ORDER BY tgname;
```

**Résultat attendu** :
- 2-3 triggers listés
- Vérifier que leur définition accède bien à `NEW.locataire_id`

---

## 📋 REQUÊTE 5 : Vérifier les policies RLS INSERT

**Objectif** : Confirmer que les policies n'utilisent pas une colonne inexistante

```sql
SELECT 
  polname AS policy_name,
  polcmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policy
WHERE polrelid = 'public.tickets'::regclass
  AND polcmd = 'a'  -- INSERT
ORDER BY polname;
```

**Résultat attendu** :
- 1+ policies listées
- Vérifier qu'elles référencent bien `locataire_id`

---

## 📋 REQUÊTE 6 : Test INSERT direct (bypass API)

**Objectif** : Tester si l'INSERT fonctionne directement en SQL

```sql
-- ⚠️ REMPLACER LES UUIDs PAR DES VALEURS RÉELLES DE VOTRE BDD
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
  'Test SQL Direct',
  'Test insertion depuis SQL Editor',
  'plomberie',
  'Fuite d''eau',
  'Cuisine',
  'UUID_LOCATAIRE_EXISTANT',  -- ⚠️ À REMPLACER
  'UUID_LOGEMENT_EXISTANT',    -- ⚠️ À REMPLACER
  'UUID_REGIE_EXISTANTE'       -- ⚠️ À REMPLACER
) RETURNING id, statut, locataire_id;
```

**Résultat attendu** :
- ✅ INSERT réussi → le problème vient de l'API
- ❌ Erreur "column locataire_id does not exist" → problème de migration

---

## 📋 REQUÊTE 7 : Vérifier le search_path PostgreSQL

**Objectif** : Confirmer que `public` est dans le search_path

```sql
SHOW search_path;
```

**Résultat attendu** :
- `"$user", public` ou similaire
- `public` doit être présent

---

## 🎯 APRÈS EXÉCUTION

Une fois toutes les requêtes exécutées, partagez-moi :

1. **Résultat REQUÊTE 1** : Combien de relations "tickets" ?
2. **Résultat REQUÊTE 2** : `locataire_id` présent ? Type ?
3. **Résultat REQUÊTE 3** : Existe-t-il une VIEW "tickets" ?
4. **Résultat REQUÊTE 6** : INSERT direct fonctionne ?

Avec ces informations, je pourrai identifier la cause exacte et corriger le code.

---

## 🚨 SI VOUS NE POUVEZ PAS EXÉCUTER CES REQUÊTES

Si vous n'avez pas accès au SQL Editor Supabase, testez au moins :

1. **Créer un ticket via l'interface locataire**
2. **Copier les logs Vercel complets** (section Functions)
3. **Partager le message d'erreur exact** avec :
   - `code`
   - `message`
   - `details`
   - `hint`

Je pourrai alors déduire la cause du problème.
