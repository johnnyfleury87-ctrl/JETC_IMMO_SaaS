# 🐛 ANALYSE - "Erreur technique lors de la récupération du profil régie"

**Date** : 24 décembre 2025  
**Statut** : 🔍 En diagnostic  
**Priorité** : 🔴 Bloquant

---

## 📋 Contexte

### Bug signalé
- **Message affiché** : "Erreur technique lors de la récupération du profil régie"
- **Situation** : Compte régie valide, session active, menu affiché
- **Cause** : `regieError !== null` (pas `!regie`)

---

## 🔍 Diagnostic technique

### 1. Structure BDD vérifiée ✅

```sql
-- Table profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'regie',
  ...
);

-- Table regies
CREATE TABLE regies (
  id uuid PRIMARY KEY,
  nom text NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  statut_validation text NOT NULL DEFAULT 'en_attente',
  ...
);
```

**✅ Clé confirmée** : `regies.profile_id = profiles.id = auth.users.id`

### 2. RLS Policy vérifiée ✅

```sql
CREATE POLICY "Regie can view own regie"
ON regies FOR SELECT
USING (profile_id = auth.uid());
```

**✅ Policy correcte** : Compare `profile_id` avec `auth.uid()` (= `profiles.id`)

### 3. Requête frontend

```javascript
const { data: regie, error: regieError } = await supabase
  .from('regies')
  .select('id, nom_agence')
  .eq('profile_id', session.user.id)
  .maybeSingle();
```

**✅ Requête correcte** : Filtre sur `profile_id = session.user.id`

---

## 🎯 Causes possibles

| Cause | Probabilité | Impact |
|-------|-------------|--------|
| **Profil régie existe SANS ligne dans `regies`** | 🔴 Très probable | Bloquant |
| Policy RLS bloque la lecture | 🟡 Possible | Bloquant |
| Colonne `nom_agence` n'existe pas | 🟡 Possible | Erreur SQL |
| Statut validation `en_attente` bloque | 🟢 Peu probable | Policy OK |

### Cause la plus probable

**Profil avec `role='regie'` MAIS aucune ligne dans table `regies`**

Scénario :
1. Utilisateur créé avec `role='regie'` dans `profiles`
2. Inscription interrompue / erreur avant création ligne `regies`
3. → Frontend cherche la régie associée
4. → Policy RLS autorise la requête
5. → Mais `.maybeSingle()` retourne `data: null, error: null`
6. → **SAUF SI** erreur SQL (colonne manquante, etc.)

---

## 🔧 Actions correctives appliquées

### 1. Logs détaillés ajoutés ✅

```javascript
if (regieError) {
  console.error('[REGIE FETCH ERROR] Erreur complète:', regieError);
  console.error('[ERROR CODE]', regieError.code);
  console.error('[ERROR MESSAGE]', regieError.message);
  console.error('[ERROR DETAILS]', regieError.details);
  console.error('[ERROR HINT]', regieError.hint);
  console.log('[SESSION USER]', session.user);
  console.log('[USER ID]', session.user.id);
}
```

### 2. Erreur non bloquante ✅

**Avant** :
```javascript
alert('Erreur technique');
window.location.href = '/login.html';  // ❌ Bloquant
```

**Après** :
```javascript
// Afficher banner d'erreur dans la page
// Rester sur la page, permettre debugging
// Session reste active
```

### 3. Messages contextuels ✅

- `regieError` → "Erreur technique" + détails en console
- `!regie` → "Configuration incomplète" + contact admin
- Session reste active, pas de redirection abusive

---

## 📊 Script de diagnostic SQL

Fichier : `supabase/diagnostic_regies_policies.sql`

```sql
-- 1. Compter les profils régie
SELECT COUNT(*) FROM profiles WHERE role = 'regie';

-- 2. Compter les lignes dans regies
SELECT COUNT(*) FROM regies;

-- 3. Identifier les profils régie SANS ligne dans regies
SELECT p.id, p.email, p.created_at
FROM profiles p
WHERE p.role = 'regie'
  AND NOT EXISTS (SELECT 1 FROM regies r WHERE r.profile_id = p.id);

-- 4. Vérifier les regies existantes
SELECT r.id, r.nom, r.profile_id, r.statut_validation, p.email
FROM regies r
LEFT JOIN profiles p ON p.id = r.profile_id;

-- 5. Tester la policy RLS
SELECT r.id, r.nom FROM regies r WHERE r.profile_id = auth.uid();
```

**À exécuter** : Dans Supabase SQL Editor avec le compte régie problématique

---

## ✅ Prochaines étapes

### 1. Exécuter le diagnostic SQL
- Se connecter à Supabase
- Ouvrir SQL Editor
- Exécuter `diagnostic_regies_policies.sql`
- **Observer les résultats**

### 2. Analyser l'erreur console
- Ouvrir `/regie/immeubles.html`
- Ouvrir Console (F12)
- **Copier les logs complets** :
  - `[REGIE FETCH ERROR]`
  - `[ERROR CODE]`
  - `[ERROR MESSAGE]`
  - `[ERROR DETAILS]`
  - `[ERROR HINT]`

### 3. Corriger selon diagnostic

#### Si profil SANS régie
**Solution A** : Créer la ligne `regies` manuellement
```sql
INSERT INTO regies (nom, profile_id, statut_validation)
VALUES ('Nom Agence', 'USER_UUID', 'valide');
```

**Solution B** : Refaire inscription complète

#### Si erreur SQL
**Vérifier** :
- Colonne `nom_agence` existe ? (Peut-être `nom` seulement)
- Permissions sur table `regies`
- Indexes corrompus

#### Si policy bloque
**Tester** :
```sql
-- Désactiver temporairement RLS pour tester
ALTER TABLE regies DISABLE ROW LEVEL SECURITY;
-- Puis réactiver
ALTER TABLE regies ENABLE ROW LEVEL SECURITY;
```

---

## 🛡️ Prévention future

### Checklist création compte régie

- [ ] Créer utilisateur dans `auth.users`
- [ ] Créer profil dans `profiles` avec `role='regie'`
- [ ] **Créer ligne dans `regies`** avec `profile_id`
- [ ] Vérifier `statut_validation`
- [ ] Tester connexion complète

### Transaction atomique recommandée

```javascript
// Dans api/auth/register.js
const { data: user } = await supabase.auth.signUp({...});

// Transaction : tout ou rien
await supabase.rpc('create_regie_complete', {
  user_id: user.id,
  email: user.email,
  nom_agence: formData.nom,
  ...
});
```

---

## 📝 Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| [immeubles.html](../public/regie/immeubles.html) | Logs détaillés + erreur non bloquante |
| [logements.html](../public/regie/logements.html) | Logs détaillés + erreur non bloquante |
| [diagnostic_regies_policies.sql](../supabase/diagnostic_regies_policies.sql) | Script diagnostic SQL |

---

**⚠️ ATTENTION** : Le bug n'est PAS corrigé tant que :
- Les logs console ne sont pas analysés
- Le diagnostic SQL n'est pas exécuté
- La cause racine n'est pas identifiée précisément

**👉 On debug le RÉEL, pas le markdown.**
