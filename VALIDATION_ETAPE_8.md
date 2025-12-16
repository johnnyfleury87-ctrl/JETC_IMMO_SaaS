# ✅ VALIDATION ÉTAPE 8 - Storage & fichiers

**Date** : 2025  
**Statut** : ✅ **VALIDÉE** (38/38 tests réussis)

---

## 📋 Objectifs de l'ÉTAPE 8

Gérer les **fichiers de manière sécurisée** :
- Photos d'immeubles et logements
- Signatures numériques (locataires, entreprises)
- **Buckets privés** (aucun accès public)
- **Accès cohérent par rôle**

---

## 🗂️ Structure créée

### 1. Colonnes ajoutées aux tables

**Fichier** : `supabase/schema/12_storage.sql`

| Table | Colonne | Type | Usage |
|-------|---------|------|-------|
| `immeubles` | `photo_url` | text | URL de la photo de l'immeuble |
| `logements` | `photo_url` | text | URL de la photo du logement |
| `locataires` | `signature_url` | text | URL de la signature du locataire |
| `entreprises` | `signature_url` | text | URL de la signature de l'entreprise |

---

### 2. Buckets Storage créés

#### Bucket : `photos-immeubles`

**Configuration** :
- ✅ **Privé** (public = false)
- ✅ Types autorisés : image/jpeg, image/png, image/webp
- ✅ Taille max : 5MB

**Structure** :
```
photos-immeubles/
  └─ {immeuble_id}/
      ├─ {timestamp}-photo1.jpg
      ├─ {timestamp}-photo2.jpg
      └─ ...
```

**Accès** :
- ✅ Régie peut uploader/voir/supprimer les photos de SES immeubles
- ✅ Admin JTEC peut tout voir
- ❌ Locataire ne peut pas voir les photos d'immeubles

---

#### Bucket : `photos-logements`

**Configuration** :
- ✅ **Privé** (public = false)
- ✅ Types autorisés : image/jpeg, image/png, image/webp
- ✅ Taille max : 5MB

**Structure** :
```
photos-logements/
  └─ {logement_id}/
      ├─ {timestamp}-photo1.jpg
      ├─ {timestamp}-photo2.jpg
      └─ ...
```

**Accès** :
- ✅ Régie peut uploader/voir/supprimer les photos de SES logements
- ✅ Locataire peut voir la photo de SON logement
- ✅ Admin JTEC peut tout voir

---

#### Bucket : `signatures`

**Configuration** :
- ✅ **Privé** (public = false)
- ✅ Types autorisés : image/png, image/svg+xml
- ✅ Taille max : 1MB

**Structure** :
```
signatures/
  ├─ {locataire_id}/
  │   └─ {timestamp}-signature.png
  └─ {entreprise_id}/
      └─ {timestamp}-signature.png
```

**Accès** :
- ✅ Locataire peut uploader/voir SA signature
- ✅ Entreprise peut uploader/voir SA signature
- ✅ Régie peut voir signatures de SES locataires
- ✅ Régie peut voir signatures des entreprises AUTORISÉES
- ✅ Admin JTEC peut tout voir

---

## 🛡️ Policies Storage (RLS sur fichiers)

### Bucket `photos-immeubles` (4 policies)

1. ✅ `Regie can upload photos for own immeubles`
   - Régie peut uploader des photos pour ses immeubles
   - Vérifie via `immeubles.regie_id`

2. ✅ `Regie can view photos of own immeubles`
   - Régie peut voir les photos de ses immeubles
   - Filtre par `immeubles.regie_id = regie.profile_id`

3. ✅ `Regie can delete photos of own immeubles`
   - Régie peut supprimer les photos de ses immeubles

4. ✅ `Admin JTEC can view all photos immeubles`
   - Admin JTEC voit toutes les photos

---

### Bucket `photos-logements` (5 policies)

1. ✅ `Regie can upload photos for own logements`
   - Régie peut uploader des photos pour ses logements
   - Vérifie via `logements → immeubles.regie_id`

2. ✅ `Regie can view photos of own logements`
   - Régie peut voir les photos de ses logements

3. ✅ `Locataire can view photo of own logement`
   - Locataire peut voir la photo de SON logement
   - Vérifie via `locataires.logement_id`

4. ✅ `Regie can delete photos of own logements`
   - Régie peut supprimer les photos de ses logements

5. ✅ `Admin JTEC can view all photos logements`
   - Admin JTEC voit toutes les photos

---

### Bucket `signatures` (7 policies)

1. ✅ `Locataire can upload own signature`
   - Locataire peut uploader SA signature

2. ✅ `Locataire can view own signature`
   - Locataire peut voir SA signature

3. ✅ `Regie can view signatures of own locataires`
   - Régie peut voir les signatures de SES locataires
   - Vérifie via `locataires → logements → immeubles.regie_id`

4. ✅ `Entreprise can upload own signature`
   - Entreprise peut uploader SA signature

5. ✅ `Entreprise can view own signature`
   - Entreprise peut voir SA signature

6. ✅ `Regie can view signatures of authorized entreprises`
   - Régie peut voir les signatures des entreprises AUTORISÉES
   - Vérifie via `regies_entreprises`

7. ✅ `Admin JTEC can view all signatures`
   - Admin JTEC voit toutes les signatures

---

## 🔌 APIs créées

### 1. `POST /api/storage/upload-immeuble`

Upload une photo d'immeuble.

**Fichier** : `api/storage/upload-immeuble.js`

**Sécurité** :
- ✅ Vérifie que l'utilisateur est authentifié
- ✅ Vérifie que `role = 'regie'`
- ✅ Vérifie que l'immeuble appartient à la régie

**Body** :
```json
{
  "immeuble_id": "uuid",
  "file_base64": "base64_encoded_image",
  "filename": "photo.jpg"
}
```

**Réponse** :
```json
{
  "success": true,
  "file_path": "immeuble_id/timestamp-photo.jpg",
  "url": "https://supabase.co/storage/..."
}
```

**Actions** :
1. Upload du fichier dans `photos-immeubles`
2. Mise à jour de `immeubles.photo_url`

---

### 2. `POST /api/storage/upload-logement`

Upload une photo de logement.

**Fichier** : `api/storage/upload-logement.js`

**Sécurité** :
- ✅ Vérifie que l'utilisateur est authentifié
- ✅ Vérifie que `role = 'regie'`
- ✅ Vérifie que le logement appartient à la régie (via immeuble)

**Body** :
```json
{
  "logement_id": "uuid",
  "file_base64": "base64_encoded_image",
  "filename": "photo.jpg"
}
```

**Réponse** :
```json
{
  "success": true,
  "file_path": "logement_id/timestamp-photo.jpg",
  "url": "https://supabase.co/storage/..."
}
```

**Actions** :
1. Upload du fichier dans `photos-logements`
2. Mise à jour de `logements.photo_url`

---

### 3. `POST /api/storage/upload-signature`

Upload une signature (locataire ou entreprise).

**Fichier** : `api/storage/upload-signature.js`

**Sécurité** :
- ✅ Vérifie que l'utilisateur est authentifié
- ✅ Vérifie que `role = 'locataire' OU 'entreprise'`
- ✅ Upload dans le dossier correspondant à l'entity_id

**Body** :
```json
{
  "file_base64": "base64_encoded_image",
  "filename": "signature.png"
}
```

**Réponse** :
```json
{
  "success": true,
  "file_path": "entity_id/timestamp-signature.png",
  "url": "https://supabase.co/storage/..."
}
```

**Actions** :
1. Upload du fichier dans `signatures`
2. Mise à jour de `locataires.signature_url` OU `entreprises.signature_url`

---

## 🧪 Tests de validation

**Fichier** : `tests/storage.test.js`

### Résultats

✅ **38/38 tests réussis**

### Catégories testées

#### Structure SQL (9 tests)
1. ✅ Fichier 12_storage.sql existe
2. ✅ Colonne photo_url ajoutée à immeubles
3. ✅ Colonne photo_url ajoutée à logements
4. ✅ Colonne signature_url ajoutée à locataires
5. ✅ Colonne signature_url ajoutée à entreprises
6. ✅ Documentation du bucket photos-immeubles
7. ✅ Documentation du bucket photos-logements
8. ✅ Documentation du bucket signatures
9. ✅ Buckets configurés en privé

#### Policies photos-immeubles (4 tests)
10. ✅ Policy : Régie peut uploader photos immeubles
11. ✅ Policy : Régie peut voir photos de ses immeubles
12. ✅ Policy : Régie peut supprimer photos de ses immeubles
13. ✅ Policy : Admin JTEC peut voir toutes les photos immeubles

#### Policies photos-logements (5 tests)
14. ✅ Policy : Régie peut uploader photos logements
15. ✅ Policy : Régie peut voir photos de ses logements
16. ✅ Policy : Locataire peut voir photo de son logement
17. ✅ Policy : Régie peut supprimer photos de ses logements
18. ✅ Policy : Admin JTEC peut voir toutes les photos logements

#### Policies signatures (7 tests)
19. ✅ Policy : Locataire peut uploader sa signature
20. ✅ Policy : Locataire peut voir sa signature
21. ✅ Policy : Régie peut voir signatures de ses locataires
22. ✅ Policy : Entreprise peut uploader sa signature
23. ✅ Policy : Entreprise peut voir sa signature
24. ✅ Policy : Régie peut voir signatures des entreprises autorisées
25. ✅ Policy : Admin JTEC peut voir toutes les signatures

#### APIs (9 tests)
26. ✅ API upload-immeuble existe
27. ✅ API upload-immeuble vérifie le rôle régie
28. ✅ API upload-immeuble vérifie l'appartenance de l'immeuble
29. ✅ API upload-logement existe
30. ✅ API upload-logement vérifie le rôle régie
31. ✅ API upload-logement vérifie l'appartenance du logement
32. ✅ API upload-signature existe
33. ✅ API upload-signature accepte locataire et entreprise
34. ✅ API upload-signature met à jour la bonne table

#### Sécurité globale (4 tests)
35. ✅ Toutes les policies Storage utilisent auth.uid()
36. ✅ Pas d'accès public : aucune policy publique
37. ✅ APIs uploadent dans les bons buckets
38. ✅ APIs mettent à jour les colonnes *_url

---

## 🔒 Garanties de sécurité

### 1. Aucun accès public

✅ **Tous les buckets sont privés**  
❌ Impossible d'accéder aux fichiers sans authentification

### 2. Accès cohérent par rôle

| Rôle | Photos immeubles | Photos logements | Signatures |
|------|------------------|------------------|------------|
| **Régie** | Ses immeubles | Ses logements | Ses locataires + entreprises autorisées |
| **Locataire** | ❌ | Son logement | Sa signature |
| **Entreprise** | ❌ | ❌ | Sa signature |
| **Admin JTEC** | Tout | Tout | Tout |

### 3. Isolation par régie

✅ Régie A ne peut pas voir les photos de Régie B  
✅ Régie A ne peut pas voir les signatures des locataires de Régie B

### 4. Traçabilité

✅ Tous les fichiers sont organisés par dossier ({entity_id}/)  
✅ Les URL sont stockées dans les tables pour référence

---

## 📊 Schéma du système de fichiers

```
SUPABASE STORAGE (PRIVÉ)

Bucket: photos-immeubles
  ├─ {immeuble_1}/
  │   └─ {timestamp}-photo.jpg → immeubles.photo_url
  └─ {immeuble_2}/
      └─ {timestamp}-photo.jpg

Bucket: photos-logements
  ├─ {logement_1}/
  │   └─ {timestamp}-photo.jpg → logements.photo_url
  └─ {logement_2}/
      └─ {timestamp}-photo.jpg

Bucket: signatures
  ├─ {locataire_1}/
  │   └─ {timestamp}-signature.png → locataires.signature_url
  └─ {entreprise_1}/
      └─ {timestamp}-signature.png → entreprises.signature_url
```

---

## 🎯 Critères de validation ÉTAPE 8

| Critère | Statut | Détails |
|---------|--------|---------|
| **Buckets privés créés** | ✅ | 3 buckets (photos-immeubles, photos-logements, signatures) |
| **Colonnes *_url ajoutées** | ✅ | immeubles, logements, locataires, entreprises |
| **Policies Storage configurées** | ✅ | 16 policies (4 + 5 + 7) |
| **Aucun accès public** | ✅ | Tous les buckets sont privés |
| **Accès cohérent par rôle** | ✅ | Régie, locataire, entreprise, admin_jtec |
| **APIs upload créées** | ✅ | 3 APIs (immeuble, logement, signature) |
| **Vérifications de sécurité** | ✅ | Rôle + appartenance vérifiés |
| **Mise à jour des colonnes** | ✅ | URLs stockées dans les tables |
| **Tests automatisés** | ✅ | 38 tests passés |

---

## 🚀 Prochaine étape

**ÉTAPE 9** : Dashboards complets et interfaces utilisateur

---

## 📝 Commandes de test

```bash
# Lancer les tests ÉTAPE 8
node tests/storage.test.js

# Résultat attendu
✅ 38/38 tests réussis
ÉTAPE 8 VALIDÉE
```

---

## 💡 Usage des APIs

### Exemple : Upload photo d'immeuble

```javascript
const response = await fetch('/api/storage/upload-immeuble', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    immeuble_id: 'uuid-immeuble',
    file_base64: 'data:image/jpeg;base64,...',
    filename: 'facade.jpg'
  })
});

const result = await response.json();
// { success: true, file_path: "...", url: "..." }
```

### Exemple : Upload signature locataire

```javascript
const response = await fetch('/api/storage/upload-signature', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_base64: 'data:image/png;base64,...',
    filename: 'signature.png'
  })
});

const result = await response.json();
// { success: true, file_path: "...", url: "..." }
```

---

## 📅 Historique

- **ÉTAPE 0** : ✅ Initialisation (healthcheck, Supabase)
- **ÉTAPE 1** : ✅ Landing page multilingue
- **ÉTAPE 2** : ✅ Authentification (register, login, me)
- **ÉTAPE 3** : ✅ Profiles avec trigger automatique
- **ÉTAPE 4** : ✅ Structure immobilière (régies, immeubles, logements, locataires)
- **ÉTAPE 5** : ✅ Création de tickets par les locataires
- **ÉTAPE 6** : ✅ Diffusion des tickets aux entreprises
- **ÉTAPE 7** : ✅ Row Level Security (RLS)
- **ÉTAPE 8** : ✅ **Storage & fichiers** ⬅ ACTUEL
- **ÉTAPE 9** : 🔜 À venir

---

**✅ ÉTAPE 8 COMPLÈTE ET VALIDÉE**

**SYSTÈME DE FICHIERS SÉCURISÉ ACTIVÉ** 📁🔐
