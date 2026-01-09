# 🔧 M61b - Patch Logements : Support Multi-pays

## 🎯 Problème identifié

Après l'implémentation de M61 pour les **immeubles**, les **logements** ont encore un problème :

### ❌ Symptômes
1. **DB** : Insertion logement avec NPA 5 chiffres échoue  
   - Erreur : `violates check constraint "check_npa_format"`
   - Code : 23514
2. **UI** : Formulaire logement ne propose pas "France" comme pays
   - Champ pays bloqué sur "Suisse"
   - Validation NPA forcée à 4 chiffres

### 🔍 Cause racine
La migration M61 a modifié :
- ✅ Table `immeubles` → contrainte assouplie
- ❌ Table `logements` → contrainte `check_npa_format` toujours stricte (4 chiffres)

---

## ✅ Solution appliquée

### 1️⃣ Migration DB - [supabase/migrations/20260109000002_m61b_patch_logements_npa.sql](supabase/migrations/20260109000002_m61b_patch_logements_npa.sql)

**Modifications** :
- ❌ Supprime : `check_npa_format` (4 chiffres uniquement)
- ✅ Ajoute : `check_logement_npa_multi_pays` (regex `^[0-9]{4,5}$`)
- 📝 Met à jour le commentaire de colonne

**Résultat** :
```sql
-- AVANT
CHECK (npa ~ '^[0-9]{4}$')  -- Bloque France

-- APRÈS  
CHECK (npa ~ '^[0-9]{4,5}$')  -- Accepte Suisse ET France
```

---

### 2️⃣ Frontend - [public/regie/logements.html](public/regie/logements.html)

#### 🔹 Champ "Pays" (ligne ~688)
**AVANT :**
```html
<input type="text" id="logementPays" value="Suisse" readonly>
```

**APRÈS :**
```html
<select id="logementPays" required>
  <option value="Suisse">Suisse</option>
  <option value="France">France</option>
</select>
```

---

#### 🔹 Champ "NPA / Code postal" (ligne ~678)
**AVANT :**
```html
<label>NPA *</label>
<input type="text" id="logementNPA" placeholder="1000" 
       pattern="[0-9]{4}" maxlength="4" required>
```

**APRÈS :**
```html
<label>NPA / Code postal *</label>
<input type="text" id="logementNPA" placeholder="1000" required>
<small id="logementNpaHint">Format suisse : 4 chiffres</small>
```

---

#### 🔹 Validation JavaScript (ligne ~1307)
**AVANT :**
```javascript
if (!/^[0-9]{4}$/.test(npa)) {
  showModalError('⚠️ Le NPA doit contenir exactement 4 chiffres (format suisse)');
  return;
}
```

**APRÈS :**
```javascript
// Validation NPA/Code postal selon le pays
if (pays === 'Suisse') {
  if (!/^[0-9]{4}$/.test(npa)) {
    showModalError('⚠️ Le NPA suisse doit contenir exactement 4 chiffres');
    return;
  }
} else if (pays === 'France') {
  if (!/^[0-9]{5}$/.test(npa)) {
    showModalError('⚠️ Le code postal français doit contenir exactement 5 chiffres');
    return;
  }
}
```

---

#### 🔹 UX Dynamique - Event listener (ligne ~1622)
**NOUVEAU :**
```javascript
// Gérer changement de pays pour adapter le format NPA/Code postal
const paysSelect = document.getElementById('logementPays');
const npaInput = document.getElementById('logementNPA');
const npaHint = document.getElementById('logementNpaHint');

paysSelect.addEventListener('change', function() {
  if (this.value === 'Suisse') {
    npaInput.placeholder = '1000';
    npaInput.maxLength = 4;
    npaHint.textContent = 'Format suisse : 4 chiffres';
  } else if (this.value === 'France') {
    npaInput.placeholder = '75001';
    npaInput.maxLength = 5;
    npaHint.textContent = 'Format français : 5 chiffres';
  }
});
```

---

## ⚠️ Action requise AVANT utilisation

**La migration M61b DOIT être appliquée manuellement**

👉 **Instructions** : [_apply_m61b_logements_patch.md](_apply_m61b_logements_patch.md)

**Durée** : 2 minutes  
**Risque** : Aucun (100% rétrocompatible)

---

## 🧪 Tests

### ✅ Test automatique
```bash
node _test_m61b_insertion.js
```

**Résultat attendu après migration** :
```
Test 1️⃣ : Logement Suisse (NPA 4 chiffres)
✅ OK - Logement suisse créé

Test 2️⃣ : Logement France (Code postal 5 chiffres)
✅ OK - Logement français créé

🎉 TOUS LES TESTS PASSENT
```

---

### ✅ Tests manuels UI

#### Test 1 : Création logement SUISSE
1. Ouvrir [/public/regie/logements.html](/public/regie/logements.html)
2. Créer un logement :
   - **Pays** : Suisse
   - **NPA** : `1000` (4 chiffres)
3. **Résultat** : ✅ Création réussie

#### Test 2 : Création logement FRANCE
1. Ouvrir [/public/regie/logements.html](/public/regie/logements.html)
2. Sélectionner **Pays** : France
   - Observer : placeholder → `75001`, hint → "5 chiffres"
3. Créer un logement :
   - **Code postal** : `75001` (5 chiffres)
4. **Résultat** : ✅ Création réussie

#### Test 3 : Validation erreurs
- **Suisse + 5 chiffres** → ❌ Erreur
- **France + 4 chiffres** → ❌ Erreur

---

## 📊 Impact

| Composant | Avant | Après |
|-----------|-------|-------|
| **Table logements** | Contrainte stricte 4 digits | Flexible 4-5 digits |
| **Formulaire logement** | Pays fixe (Suisse) | Select Suisse/France |
| **Validation NPA** | Statique 4 chiffres | Dynamique selon pays |
| **UX** | Statique | Adaptative (placeholder/hint) |
| **Rétrocompatibilité** | - | ✅ 100% |

---

## 🔗 Cohérence avec M61

| Feature | Immeubles (M61) | Logements (M61b) |
|---------|-----------------|------------------|
| Contrainte DB | ✅ `check_npa_multi_pays` | ✅ `check_logement_npa_multi_pays` |
| Regex | ✅ `^[0-9]{4,5}$` | ✅ `^[0-9]{4,5}$` |
| UI Pays | ✅ Select Suisse/France | ✅ Select Suisse/France |
| Validation JS | ✅ Conditionnelle | ✅ Conditionnelle |
| UX dynamique | ✅ Event listener | ✅ Event listener |

---

## 📚 Documentation

- 📖 [_PATCH_M61b_LOGEMENTS.md](_PATCH_M61b_LOGEMENTS.md) ← Ce document
- 🛠️ [_apply_m61b_logements_patch.md](_apply_m61b_logements_patch.md) → Instructions migration
- 🧪 `_test_m61b_insertion.js` → Script de test automatique
- 📋 [_README_M61_MULTI_PAYS.md](_README_M61_MULTI_PAYS.md) → Vue d'ensemble M61

---

## 🎉 Résultat final

✅ **Immeubles** ET **Logements** supportent maintenant :
- 🇨🇭 **Suisse** : NPA 4 chiffres
- 🇫🇷 **France** : Code postal 5 chiffres
- 🔄 **UX dynamique** : interface adaptative
- 🛡️ **Rétrocompatibilité** : 100% avec données existantes
- 📏 **Validation stricte** : impossible de mélanger les formats

---

**Développeur** : GitHub Copilot  
**Date** : 9 janvier 2026  
**Ticket** : Patch M61b - Logements multi-pays
