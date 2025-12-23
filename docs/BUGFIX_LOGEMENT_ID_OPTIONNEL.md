# 🔧 CORRECTION : Création de locataire SANS logement assigné

**Date :** 2025-12-21  
**Priorité :** 🔴 CRITIQUE - Bloque l'onboarding des régies  
**Status :** ✅ CORRIGÉ

---

## 📋 PROBLÈME INITIAL

### Contexte utilisateur

Une **régie** nouvellement inscrite ne peut PAS créer son premier locataire :

```
Scénario problématique :
1. Régie s'inscrit → crée profil → pas encore de locataires (NORMAL)
2. Va sur /regie/locataires.html
3. Voit message "Profil introuvable" (ERREUR - c'est un profil valide)
4. Formulaire exige un logement_id obligatoire
5. ❌ Impossible de créer le premier locataire
```

### Problème technique

**État initial :**
- ✅ Schéma DB : `logement_id` déjà optionnel (`ON DELETE SET NULL`)
- ❌ Frontend : `<select id="logement_id" required>`
- ❌ Backend : `if (!logement_id) { return 400 }`
- ❌ RPC SQL : `p_logement_id uuid` (obligatoire, pas de DEFAULT NULL)

**Conséquence :** Une régie ne pouvait pas créer un locataire AVANT de l'assigner à un logement.

---

## ✅ SOLUTION APPORTÉE

### 1. Backend API (`/api/locataires/create.js`)

**Ligne 74** - Retirer `logement_id` de la validation obligatoire :

```javascript
// AVANT
if (!nom || !prenom || !email || !logement_id || !date_entree) {
  return res.status(400).json({ 
    error: 'Champs obligatoires manquants',
    required: ['nom', 'prenom', 'email', 'logement_id', 'date_entree']
  });
}

// APRÈS
if (!nom || !prenom || !email || !date_entree) {
  return res.status(400).json({ 
    error: 'Champs obligatoires manquants',
    required: ['nom', 'prenom', 'email', 'date_entree']
  });
}
```

### 2. Frontend HTML (`/public/regie/locataires.html`)

**Ligne 692** - Retirer l'attribut `required` et adapter le label :

```html
<!-- AVANT -->
<label for="logement_id">Logement <span class="required">*</span></label>
<select id="logement_id" name="logement_id" required>
  <option value="">Sélectionner un logement</option>
</select>

<!-- APRÈS -->
<label for="logement_id">Logement (optionnel)</label>
<select id="logement_id" name="logement_id">
  <option value="">Aucun logement</option>
</select>
<small style="color: var(--gray-600); font-size: 12px; display: block; margin-top: 4px;">
  Le locataire peut être créé sans logement assigné
</small>
```

### 3. RPC SQL (`/supabase/migrations/2025-12-20_rpc_creer_locataire.sql`)

**Modification de la signature** :

```sql
-- AVANT
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_logement_id uuid,  -- ❌ Obligatoire
  p_date_entree date,
  ...
)

-- APRÈS
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_logement_id uuid DEFAULT NULL,  -- ✅ Optionnel
  p_date_entree date,
  ...
)
```

**Logique conditionnelle** :

```sql
-- Vérifications sur logement UNIQUEMENT si logement_id fourni
IF p_logement_id IS NOT NULL THEN
  -- Vérifier ownership du logement
  -- Vérifier disponibilité du logement
  -- UPDATE statut logement = 'occupé'
END IF;

-- Retour JSON adapté
RETURN json_build_object(
  'success', true,
  'locataire_id', v_locataire_id,
  'logement', CASE 
    WHEN p_logement_id IS NOT NULL THEN json_build_object(...)
    ELSE NULL
  END
);
```

---

## 📦 FICHIERS MODIFIÉS

| Fichier | Lignes | Action |
|---------|--------|--------|
| `/api/locataires/create.js` | 74-79 | Retirer `logement_id` validation |
| `/public/regie/locataires.html` | 692-698 | Retirer `required`, adapter label |
| `/supabase/migrations/2025-12-20_rpc_creer_locataire.sql` | 29-170 | Rendre `p_logement_id` optionnel |
| `/supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql` | - | Migration standalone pour déploiement |

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Création locataire SANS logement

```javascript
// Appel API
POST /api/locataires/create
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@test.com",
  "logement_id": null,  // ✅ NULL accepté
  "date_entree": "2025-01-01"
}

// Résultat attendu
{
  "success": true,
  "locataire": {
    "id": "uuid...",
    "nom": "Dupont",
    "prenom": "Jean",
    "logement": null  // ✅ Pas de logement assigné
  },
  "temporary_password": {
    "password": "ABCD-1234-EFGH",
    "expires_at": "2025-01-15T00:00:00Z"
  }
}
```

### Test 2 : Interface régie avec 0 locataires

1. ✅ Page charge sans erreur
2. ✅ Message : "👤 Aucun locataire - Commencez par créer votre premier locataire"
3. ✅ Bouton "Nouveau locataire" actif
4. ✅ Formulaire ouvert → champ "Logement" marqué (optionnel)
5. ✅ Création réussie sans assigner de logement

### Test 3 : Assignation ultérieure

```javascript
// Étape 1 : Créer locataire sans logement
POST /api/locataires/create { ..., logement_id: null }

// Étape 2 : Assigner logement plus tard (API à créer)
PATCH /api/locataires/:id
{
  "logement_id": "uuid-du-logement",
  "date_entree": "2025-02-01"
}
```

---

## 🚀 DÉPLOIEMENT

### Ordre d'application

```bash
# 1. Frontend & Backend (déjà déployés via Git)
git add api/locataires/create.js
git add public/regie/locataires.html
git commit -m "fix: Rendre logement_id optionnel pour création locataires"
git push

# 2. Migration SQL Supabase
# Via Supabase SQL Editor :
# Copier le contenu de /supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql
# Exécuter dans SQL Editor
# Vérifier : Success ✅
```

### Vérification post-déploiement

```sql
-- Tester la RPC avec logement_id NULL
SELECT creer_locataire_complet(
  p_nom := 'Test',
  p_prenom := 'Sans Logement',
  p_email := 'test@test.com',
  p_profile_id := (SELECT id FROM profiles WHERE role = 'locataire' LIMIT 1),
  p_logement_id := NULL,  -- ✅ Doit fonctionner
  p_date_entree := CURRENT_DATE
);
```

---

## 📝 IMPACTS

### Fonctionnalités corrigées

✅ **Régie peut créer premier locataire** sans bloquer l'onboarding  
✅ **Locataire peut exister avant assignation logement** (adresse en texte libre)  
✅ **Formulaire plus souple** : champ logement optionnel  
✅ **API backend accepte logement_id = null**  
✅ **RPC SQL gère les deux cas** : avec/sans logement  

### Comportement attendu

**CAS 1 : Créer locataire AVEC logement**
- Frontend : Sélectionner un logement dans le `<select>`
- Backend : Valide ownership du logement
- RPC : Marque logement comme `occupé`
- Résultat : Locataire créé ET assigné

**CAS 2 : Créer locataire SANS logement** (nouveau)
- Frontend : Laisser "Aucun logement"
- Backend : Accepte `logement_id = null`
- RPC : Skip validations sur logement
- Résultat : Locataire créé, adresse stockée en texte libre si besoin

---

## 🔄 SUIVI

- [x] Backend API modifié
- [x] Frontend HTML modifié
- [x] RPC SQL modifiée
- [x] Migration standalone créée
- [ ] Migration appliquée sur Supabase
- [ ] Tests manuels réussis
- [ ] Validation en production

---

## 📚 RÉFÉRENCES

- Schéma DB : `/supabase/schema/08_locataires.sql` ligne 28
- Backend API : `/api/locataires/create.js`
- Frontend : `/public/regie/locataires.html`
- RPC : `/supabase/migrations/2025-12-20_rpc_creer_locataire.sql`
- Migration : `/supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql`
