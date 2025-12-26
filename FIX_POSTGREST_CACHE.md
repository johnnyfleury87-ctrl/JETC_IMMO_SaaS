# 🔥 FIX POSTGREST CACHE OBSOLÈTE - locataire_id

## 🎯 CAUSE RACINE IDENTIFIÉE

**Le schéma `public.tickets` est CORRECT** (colonne `locataire_id` existe).

**Le problème** : PostgREST (utilisé par Supabase JS) a un **cache de schéma obsolète**.

Quand vous avez appliqué les migrations, PostgREST n'a pas automatiquement rechargé le nouveau schéma.

---

## ✅ PROCÉDURE DE FIX (À EXÉCUTER DANS SUPABASE SQL EDITOR)

### 1️⃣ Forcer le reload du schéma PostgREST

```sql
NOTIFY pgrst, 'reload schema';
```

**Ce que ça fait** :
- Force PostgREST à recharger son cache de schéma
- Prend effet immédiatement
- Aucun risque, aucune modification de données

**Résultat attendu** :
- `NOTIFY` (succès silencieux)

---

### 2️⃣ Vérifier que la colonne locataire_id existe

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name = 'locataire_id';
```

**Résultat attendu** :
- 1 ligne : `locataire_id | uuid | NO`
- Si 0 lignes → migration non appliquée (impossible vu votre diagnostic)

---

### 3️⃣ Test INSERT SQL direct avec vrais UUIDs

**Récupérer des UUIDs réels :**

```sql
-- Récupérer un locataire existant
SELECT 
  l.id AS locataire_id,
  l.logement_id,
  lg.regie_id
FROM locataires l
JOIN logements lg ON lg.id = l.logement_id
LIMIT 1;
```

**Puis tester l'INSERT :**

```sql
-- ⚠️ REMPLACER LES UUIDs PAR LES VALEURS RÉCUPÉRÉES CI-DESSUS
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
  'Test insertion depuis SQL Editor après NOTIFY pgrst',
  'plomberie',
  'Fuite d''eau',
  'Cuisine',
  'UUID_LOCATAIRE_RÉEL',   -- ⚠️ À REMPLACER
  'UUID_LOGEMENT_RÉEL',     -- ⚠️ À REMPLACER
  'UUID_REGIE_RÉELLE'       -- ⚠️ À REMPLACER
) RETURNING id, statut, locataire_id, created_at;
```

**Résultat attendu** :
- ✅ INSERT réussi → ticket créé avec `statut = 'nouveau'`
- ❌ Erreur "locataire_id does not exist" → problème plus profond (cache Supabase global ?)

---

## 🎯 VALIDATION POST-FIX

Une fois les 3 requêtes exécutées avec succès :

1. **Tester la création de ticket via l'API locataire** (dashboard frontend)
2. **Vérifier les logs Vercel** : plus d'erreur "column does not exist"
3. **Confirmer le ticket visible** dans la vue régie

---

## ⚠️ INTERDICTIONS ABSOLUES JUSQU'À VALIDATION

❌ Ne pas toucher au code API  
❌ Ne pas ajouter de logs  
❌ Ne pas modifier les triggers  
❌ Ne pas modifier les migrations  
❌ Ne pas modifier le frontend  

---

## 📚 CONTEXTE TECHNIQUE

**PostgREST** est la couche REST de Supabase qui traduit les requêtes JS en SQL.

Il maintient un **cache du schéma PostgreSQL** pour optimiser les performances.

Quand vous modifiez le schéma (ALTER TABLE, ADD COLUMN, etc.), PostgREST ne le détecte pas automatiquement.

La commande `NOTIFY pgrst, 'reload schema'` est la méthode officielle pour forcer le reload.

**Sources** :
- [PostgREST Schema Cache](https://postgrest.org/en/stable/schema_cache.html)
- [Supabase Docs - Schema Changes](https://supabase.com/docs/guides/database/extensions/postgrest)

---

## 🔄 SI LE PROBLÈME PERSISTE

Si après `NOTIFY pgrst, 'reload schema'` l'erreur persiste :

1. **Redémarrer le projet Supabase** (Settings → General → Pause → Unpause)
2. **Vérifier les variables d'environnement Vercel** :
   - `SUPABASE_URL` pointe vers le bon projet
   - `SUPABASE_SERVICE_ROLE_KEY` est la bonne clé
3. **Inspecter les logs PostgREST** dans Supabase Dashboard → Logs

---

## ✅ RÉSULTAT ATTENDU FINAL

Après exécution de `NOTIFY pgrst, 'reload schema'` :

- API `/api/tickets/create` retourne **200 OK**
- Ticket créé avec **statut = 'nouveau'**
- Visible immédiatement côté régie
- Plus d'erreur "locataire_id does not exist"

**FIN DU BUG BLOQUANT.**
