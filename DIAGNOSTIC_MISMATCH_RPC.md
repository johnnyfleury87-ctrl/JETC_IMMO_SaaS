# 🚨 DIAGNOSTIC CRITIQUE - MISMATCH SIGNATURE RPC

**Date** : 24 décembre 2025  
**Erreur** : `Could not find the function public.creer_locataire_complet(...) in the schema cache`

---

## 🔍 DIAGNOSTIC PRÉCIS

### Problème identifié

**La base de données Supabase PRODUCTION contient une ANCIENNE VERSION de la fonction `creer_locataire_complet`.**

**Preuve** : L'audit CSV (`AUDIT_DB_FUNCTIONS.csv` ligne 94-220) montre que la fonction en production :

```sql
INSERT INTO locataires (
  nom,
  prenom,
  email,
  profile_id,
  logement_id,        -- ❌ PAS de regie_id
  date_entree,
  telephone,
  date_naissance,
  contact_urgence_nom,
  contact_urgence_telephone
)
```

**Signature en production** (10 paramètres) :
```sql
creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_logement_id uuid,     -- Position 5
  p_date_entree date,
  p_telephone text,
  p_date_naissance date,
  p_contact_urgence_nom text,
  p_contact_urgence_telephone text
)
```

**Appel backend** (11 paramètres) :
```javascript
.rpc('creer_locataire_complet', {
  p_nom: nom,
  p_prenom: prenom,
  p_email: email,
  p_profile_id: profileId,
  p_regie_id: regieId,          // ❌ Paramètre inconnu
  p_logement_id: cleanLogementId,
  p_date_entree: date_entree,
  p_telephone: cleanTelephone,
  p_date_naissance: cleanDateNaissance,
  p_contact_urgence_nom: cleanContactNom,
  p_contact_urgence_telephone: cleanContactTel
})
```

### Cause racine

**La migration `2025-12-21_fix_locataire_sans_logement.sql` N'A PAS ÉTÉ EXÉCUTÉE en production.**

---

## 📊 AVANT / APRÈS

### ❌ AVANT (Version production actuelle)

**Signature SQL** :
```sql
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_logement_id uuid,     -- Position 5, pas de DEFAULT NULL
  p_date_entree date,
  p_telephone text,
  p_date_naissance date,
  p_contact_urgence_nom text,
  p_contact_urgence_telephone text
)
```

**INSERT SQL** :
```sql
INSERT INTO locataires (
  nom, prenom, email, profile_id,
  logement_id,  -- ❌ PAS de regie_id
  date_entree, telephone, date_naissance,
  contact_urgence_nom, contact_urgence_telephone
)
```

**Problèmes** :
- ❌ Pas de paramètre `p_regie_id`
- ❌ `p_logement_id` obligatoire (pas de DEFAULT NULL)
- ❌ Pas d'insertion de `regie_id` dans la table
- ❌ Isolation multi-tenant impossible

---

### ✅ APRÈS (Version migration 2025-12-21)

**Signature SQL** :
```sql
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_regie_id uuid,                -- ✅ Position 5, OBLIGATOIRE
  p_logement_id uuid DEFAULT NULL, -- ✅ Position 6, OPTIONNEL
  p_date_entree date DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_date_naissance date DEFAULT NULL,
  p_contact_urgence_nom text DEFAULT NULL,
  p_contact_urgence_telephone text DEFAULT NULL
)
```

**INSERT SQL** :
```sql
INSERT INTO locataires (
  nom, prenom, email, profile_id,
  regie_id,     -- ✅ AJOUTÉ
  logement_id,  -- ✅ Nullable
  date_entree, telephone, date_naissance,
  contact_urgence_nom, contact_urgence_telephone
)
VALUES (
  p_nom, p_prenom, p_email, p_profile_id,
  p_regie_id,     -- ✅ PASSÉ
  p_logement_id,
  ...
)
```

**Bénéfices** :
- ✅ Paramètre `p_regie_id` en position 5
- ✅ `p_logement_id` devient OPTIONNEL (DEFAULT NULL)
- ✅ Insertion de `regie_id` dans la table
- ✅ Isolation multi-tenant garantie
- ✅ Compatibilité avec appel backend actuel

---

## 🔧 CORRECTION DÉFINITIVE

### Action requise

**Exécuter la migration `2025-12-21_fix_locataire_sans_logement.sql` en production.**

### Étapes précises

1. **Ouvrir Supabase Dashboard** → SQL Editor

2. **Copier le contenu complet de** :
   ```
   supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql
   ```

3. **Exécuter le script** (Run)

4. **Vérifier le message de confirmation** :
   ```
   Fonction creer_locataire_complet créée avec succès
   ```

5. **Vérifier la signature** avec cette requête SQL :
   ```sql
   SELECT 
     proname AS function_name,
     pg_get_function_arguments(oid) AS arguments
   FROM pg_proc
   WHERE proname = 'creer_locataire_complet'
     AND pronamespace = 'public'::regnamespace;
   ```

   **Résultat attendu** :
   ```
   function_name: creer_locataire_complet
   arguments: p_nom text, p_prenom text, p_email text, p_profile_id uuid, 
              p_regie_id uuid, p_logement_id uuid DEFAULT NULL, 
              p_date_entree date DEFAULT NULL, p_telephone text DEFAULT NULL, 
              p_date_naissance date DEFAULT NULL, 
              p_contact_urgence_nom text DEFAULT NULL, 
              p_contact_urgence_telephone text DEFAULT NULL
   ```

---

## ✅ CHECK-LIST VALIDATION

### 1️⃣ Vérification signature SQL

```sql
-- Dans Supabase SQL Editor
SELECT pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'creer_locataire_complet';
```

**Attendu** : Doit contenir `p_regie_id uuid` en position 5

### 2️⃣ Test RPC direct

```sql
-- Test avec données fictives
SELECT creer_locataire_complet(
  p_nom := 'Test',
  p_prenom := 'RPC',
  p_email := 'test.rpc@example.com',
  p_profile_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_regie_id := (SELECT id FROM regies LIMIT 1),  -- Régie existante
  p_logement_id := NULL,  -- ✅ Test création sans logement
  p_date_entree := CURRENT_DATE
);
```

**Attendu** : Retourne JSON avec `"success": true`

### 3️⃣ Test backend POST

```bash
# Depuis le frontend ou Postman
POST https://votre-app.vercel.app/api/locataires/create
Authorization: Bearer <token_regie>
Content-Type: application/json

{
  "nom": "Dupont",
  "prenom": "Marie",
  "email": "marie.dupont@test.com",
  "date_entree": "2025-01-01",
  "logement_id": "",  // ✅ Test sans logement
  "telephone": "",
  "date_naissance": "",
  "contact_urgence_nom": "",
  "contact_urgence_telephone": ""
}
```

**Attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "...",
    "nom": "Dupont",
    "prenom": "Marie",
    ...
  },
  "temporary_password": {
    "password": "Test1234!",
    ...
  }
}
```

### 4️⃣ Vérification isolation multi-tenant

```sql
-- Vérifier que le locataire créé a bien un regie_id
SELECT id, nom, prenom, regie_id 
FROM locataires 
WHERE email = 'marie.dupont@test.com';
```

**Attendu** : `regie_id` doit être NON NULL

### 5️⃣ Test frontend

1. Se connecter comme **régie**
2. Aller sur `/regie/locataires`
3. Cliquer "Nouveau locataire"
4. Remplir formulaire **SANS logement**
5. Soumettre

**Attendu** :
- ✅ Succès création
- ✅ Mot de passe affiché
- ✅ Locataire visible dans la liste
- ✅ Pas d'erreur "function not found"

---

## 🎯 POURQUOI CETTE CORRECTION EST DÉFINITIVE

### 1️⃣ Pas de workaround

- On ne modifie pas le backend pour "adapter" un appel incorrect
- On corrige la fonction SQL pour correspondre à la signature attendue
- Un seul script SQL à exécuter

### 2️⃣ Signature stable

```sql
creer_locataire_complet(
  -- Identité (4 params)
  p_nom, p_prenom, p_email, p_profile_id,
  -- Isolation (1 param) ← AJOUTÉ
  p_regie_id,
  -- Logement (2 params)
  p_logement_id, p_date_entree,
  -- Contact (4 params)
  p_telephone, p_date_naissance,
  p_contact_urgence_nom, p_contact_urgence_telephone
)
```

**Logique claire** :
- Groupe 1 : Identité locataire
- Groupe 2 : Isolation régie (OBLIGATOIRE)
- Groupe 3 : Logement (OPTIONNEL)
- Groupe 4 : Contact (OPTIONNEL)

### 3️⃣ Compatibilité backend

L'appel backend actuel (`api/locataires/create.js` lignes 195-207) passe les paramètres dans le BON ORDRE :

```javascript
{
  p_nom, p_prenom, p_email, p_profile_id,  // Groupe 1
  p_regie_id,                                // Groupe 2
  p_logement_id, p_date_entree,             // Groupe 3
  p_telephone, p_date_naissance,            // Groupe 4
  p_contact_urgence_nom, p_contact_urgence_telephone
}
```

**Conclusion** : Backend déjà correct, il suffit de mettre à jour la fonction SQL.

### 4️⃣ Isolation multi-tenant

Avec `p_regie_id` :
- ✅ Chaque locataire appartient à UNE régie
- ✅ Filtrage RLS garanti (`locataires.regie_id = régie connectée`)
- ✅ Pas de fuite de données entre régies

### 5️⃣ Support création sans logement

Avec `p_logement_id uuid DEFAULT NULL` :
- ✅ Régie peut créer locataire avant attribution logement
- ✅ Pas d'erreur "logement obligatoire"
- ✅ État "0 locataire" traité comme normal

---

## 📝 RÉSUMÉ EXÉCUTIF

### Problème

Base de données production contient ancienne version de `creer_locataire_complet` **sans paramètre `p_regie_id`**.

### Cause

Migration `2025-12-21_fix_locataire_sans_logement.sql` non exécutée en production.

### Solution

Exécuter la migration dans Supabase SQL Editor.

### Validation

5 tests (signature SQL, RPC direct, POST backend, isolation multi-tenant, frontend).

### Résultat

- ✅ Fonction SQL corrigée
- ✅ Appel backend compatible
- ✅ Isolation multi-tenant garantie
- ✅ Création sans logement supportée
- ✅ Pas de workaround nécessaire

---

**Document généré le** : 24 décembre 2025  
**Statut** : ⚠️ Migration en attente d'exécution  
**Prochaine étape** : Exécuter `2025-12-21_fix_locataire_sans_logement.sql` dans Supabase
