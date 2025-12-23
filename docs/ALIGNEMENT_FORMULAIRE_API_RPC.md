# 📊 ALIGNEMENT COMPLET - FORMULAIRE / API / RPC

**Date**: 23 décembre 2025  
**Issue**: `Could not find the function public.creer_locataire_complet(...)`  
**Root Cause**: Champs vides envoyés comme `""` au lieu de `null` → type mismatch PostgreSQL

---

## 🎯 TABLEAU D'ALIGNEMENT FINAL

| Champ | Formulaire | API Backend | RPC PostgreSQL | Obligatoire | Type | Nettoyage |
|-------|------------|-------------|----------------|-------------|------|-----------|
| **nom** | `<input name="nom" required>` | `nom` | `p_nom text` | ✅ OUI | text | - |
| **prenom** | `<input name="prenom" required>` | `prenom` | `p_prenom text` | ✅ OUI | text | - |
| **email** | `<input name="email" required>` | `email` | `p_email text` | ✅ OUI | text | - |
| **profile_id** | ❌ (généré backend) | `profileId` | `p_profile_id uuid` | ✅ OUI | uuid | - |
| **regie_id** | ❌ (récupéré backend) | `regieId` | `p_regie_id uuid` | ✅ OUI | uuid | - |
| **logement_id** | `<select name="logement_id">` | `cleanLogementId` | `p_logement_id uuid DEFAULT NULL` | ❌ NON | uuid | `"" → null` |
| **date_entree** | `<input name="date_entree" required>` | `date_entree` | `p_date_entree date DEFAULT NULL` | ✅ OUI* | date | - |
| **telephone** | `<input name="telephone">` | `cleanTelephone` | `p_telephone text DEFAULT NULL` | ❌ NON | text | `"" → null` |
| **date_naissance** | `<input name="date_naissance">` | `cleanDateNaissance` | `p_date_naissance date DEFAULT NULL` | ❌ NON | date | `"" → null` |
| **contact_urgence_nom** | `<input name="contact_urgence_nom">` | `cleanContactNom` | `p_contact_urgence_nom text DEFAULT NULL` | ❌ NON | text | `"" → null` |
| **contact_urgence_telephone** | `<input name="contact_urgence_telephone">` | `cleanContactTel` | `p_contact_urgence_telephone text DEFAULT NULL` | ❌ NON | text | `"" → null` |

\* *date_entree marqué required dans formulaire, mais DEFAULT NULL en RPC pour compatibilité PostgreSQL*

---

## 🔧 CORRECTIONS APPLIQUÉES

### 1. Backend - [api/locataires/create.js](../api/locataires/create.js)

**AVANT** (problème) :
```javascript
const { logement_id, telephone, date_naissance } = req.body;

.rpc('creer_locataire_complet', {
  p_logement_id: logement_id,           // ❌ peut être ""
  p_telephone: telephone || null,       // ⚠️ "" || null → ""
  p_date_naissance: date_naissance || null
});
```

**APRÈS** (corrigé) :
```javascript
// Nettoyage CRITIQUE : strings vides → null
const cleanLogementId = logement_id && logement_id.trim() !== '' ? logement_id : null;
const cleanTelephone = telephone && telephone.trim() !== '' ? telephone : null;
const cleanDateNaissance = date_naissance && date_naissance.trim() !== '' ? date_naissance : null;
const cleanContactNom = contact_urgence_nom && contact_urgence_nom.trim() !== '' ? contact_urgence_nom : null;
const cleanContactTel = contact_urgence_telephone && contact_urgence_telephone.trim() !== '' ? contact_urgence_telephone : null;

.rpc('creer_locataire_complet', {
  p_nom: nom,
  p_prenom: prenom,
  p_email: email,
  p_profile_id: profileId,
  p_regie_id: regieId,
  p_logement_id: cleanLogementId,        // ✅ null si vide
  p_date_entree: date_entree,
  p_telephone: cleanTelephone,           // ✅ null si vide
  p_date_naissance: cleanDateNaissance,  // ✅ null si vide
  p_contact_urgence_nom: cleanContactNom,
  p_contact_urgence_telephone: cleanContactTel
});
```

**Pourquoi cette correction ?**
- PostgreSQL distingue `""` de `NULL`
- Un champ `uuid` ne peut pas recevoir `""`
- Un champ `date` ne peut pas recevoir `""`
- `telephone || null` ne fonctionne PAS car `"" || null` → `""`

### 2. Formulaire - [public/regie/locataires.html](../public/regie/locataires.html)

**État actuel** : ✅ Correct, pas de modification nécessaire

```html
<!-- Champs obligatoires -->
<input type="text" name="nom" required>
<input type="text" name="prenom" required>
<input type="email" name="email" required>
<input type="date" name="date_entree" required>

<!-- Champs optionnels (peuvent être vides) -->
<select name="logement_id">
  <option value="">Aucun logement</option>
</select>
<input type="tel" name="telephone">
<input type="date" name="date_naissance">
<input type="text" name="contact_urgence_nom">
<input type="tel" name="contact_urgence_telephone">
```

Le formulaire envoie correctement :
- Champs obligatoires : toujours remplis (validation HTML5)
- Champs optionnels : peuvent être `""` → backend les convertit en `null`

### 3. RPC - [supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql](../supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql)

**État actuel** : ✅ Correct, signature valide

```sql
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,                           -- OBLIGATOIRE
  p_prenom text,                        -- OBLIGATOIRE
  p_email text,                         -- OBLIGATOIRE
  p_profile_id uuid,                    -- OBLIGATOIRE
  p_regie_id uuid,                      -- OBLIGATOIRE
  p_logement_id uuid DEFAULT NULL,      -- OPTIONNEL
  p_date_entree date DEFAULT NULL,      -- OPTIONNEL (DEFAULT requis par PostgreSQL)
  p_telephone text DEFAULT NULL,        -- OPTIONNEL
  p_date_naissance date DEFAULT NULL,   -- OPTIONNEL
  p_contact_urgence_nom text DEFAULT NULL,
  p_contact_urgence_telephone text DEFAULT NULL
)
```

**Validations internes** :
- ✅ Vérifie que `p_regie_id` existe dans `regies`
- ✅ Si `p_logement_id` fourni, vérifie qu'il appartient à la régie
- ✅ Si `p_logement_id` fourni, vérifie qu'aucun locataire actif n'y est déjà
- ✅ Vérifie que `p_profile_id` existe et a role='locataire'
- ✅ Insère dans `locataires` avec `regie_id`

---

## ✅ FLUX COMPLET VALIDÉ

### Cas 1 : Locataire AVEC logement
```
Formulaire:
  nom: "Dupont"
  prenom: "Jean"
  email: "jean@example.com"
  logement_id: "uuid-123-456"
  date_entree: "2025-01-01"
  telephone: "0612345678"
  date_naissance: "1990-05-15"
  contact_urgence_nom: "Marie Dupont"
  contact_urgence_telephone: "0698765432"

→ Backend nettoie:
  cleanLogementId: "uuid-123-456" ✅
  cleanTelephone: "0612345678" ✅
  cleanDateNaissance: "1990-05-15" ✅
  cleanContactNom: "Marie Dupont" ✅
  cleanContactTel: "0698765432" ✅

→ RPC reçoit:
  p_logement_id: uuid "uuid-123-456" ✅
  p_telephone: text "0612345678" ✅
  p_date_naissance: date "1990-05-15" ✅

→ Résultat: ✅ SUCCÈS
```

### Cas 2 : Locataire SANS logement (champs optionnels vides)
```
Formulaire:
  nom: "Martin"
  prenom: "Sophie"
  email: "sophie@example.com"
  logement_id: ""                    ← VIDE
  date_entree: "2025-01-15"
  telephone: ""                      ← VIDE
  date_naissance: ""                 ← VIDE
  contact_urgence_nom: ""            ← VIDE
  contact_urgence_telephone: ""      ← VIDE

→ Backend nettoie:
  cleanLogementId: null ✅
  cleanTelephone: null ✅
  cleanDateNaissance: null ✅
  cleanContactNom: null ✅
  cleanContactTel: null ✅

→ RPC reçoit:
  p_logement_id: NULL ✅
  p_telephone: NULL ✅
  p_date_naissance: NULL ✅

→ Résultat: ✅ SUCCÈS
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Champs obligatoires manquants
```bash
curl -X POST /api/locataires/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nom": "Dupont"}'

→ 400 Bad Request
{
  "error": "Champs obligatoires manquants",
  "required": ["nom", "prenom", "email", "date_entree"]
}
```

### Test 2 : Locataire avec logement
```bash
curl -X POST /api/locataires/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean@example.com",
    "logement_id": "uuid-valide",
    "date_entree": "2025-01-01"
  }'

→ 201 Created
{
  "success": true,
  "locataire": { ... },
  "temporary_password": { "password": "Test1234!" }
}
```

### Test 3 : Locataire SANS logement
```bash
curl -X POST /api/locataires/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nom": "Martin",
    "prenom": "Sophie",
    "email": "sophie@example.com",
    "logement_id": "",
    "date_entree": "2025-01-15",
    "telephone": "",
    "date_naissance": ""
  }'

→ 201 Created
{
  "success": true,
  "locataire": { "logement": null },
  "temporary_password": { "password": "Test1234!" }
}
```

---

## 🎯 RÉSULTAT FINAL

### Avant corrections
❌ `Could not find the function public.creer_locataire_complet(...)`  
❌ Erreur type mismatch : `""` envoyé pour champs uuid/date  
❌ PostgreSQL rejetait les appels RPC

### Après corrections
✅ Backend nettoie tous les champs vides → `null`  
✅ RPC reçoit types corrects (uuid | NULL, date | NULL)  
✅ Formulaire → API → RPC parfaitement alignés  
✅ Locataire créé avec ou sans logement  
✅ Pas d'erreur "function does not exist"

---

## 📋 CHECKLIST DÉPLOIEMENT

- [x] Backend nettoie champs vides avant appel RPC
- [x] Tous paramètres RPC correspondent à la signature
- [x] Types PostgreSQL respectés (uuid, date, text)
- [x] Formulaire envoie champs cohérents
- [x] Validation champs obligatoires (nom, prenom, email, date_entree)
- [x] Champs optionnels peuvent être null
- [x] Tests cas avec/sans logement validés
- [ ] **Déployer sur Vercel**
- [ ] **Tester en production**

---

## 🔍 DÉTAILS TECHNIQUES

### Pourquoi `telephone || null` ne fonctionne pas ?
```javascript
// ❌ INCORRECT
const telephone = "";
const clean = telephone || null;
console.log(clean); // "" (pas null !)

// JavaScript : "" est falsy MAIS || retourne la première valeur truthy
// "" || null → null ❌ FAUX, ça retourne ""

// ✅ CORRECT
const clean = telephone && telephone.trim() !== '' ? telephone : null;
console.log(clean); // null
```

### Pourquoi PostgreSQL rejette `""` pour uuid/date ?
```sql
-- PostgreSQL est strict sur les types
SELECT '""'::uuid;  -- ❌ ERROR: invalid input syntax for type uuid

-- Il faut explicitement NULL
SELECT NULL::uuid;  -- ✅ OK
```

### Ordre des paramètres RPC
PostgreSQL résout les fonctions par **signature complète** (nom + types).  
Si un paramètre est `""` au lieu de `NULL`, PostgreSQL cherche une fonction avec signature différente → erreur "function does not exist".

**Solution** : Toujours passer les types exacts attendus.
