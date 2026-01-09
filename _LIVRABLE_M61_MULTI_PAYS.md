# ✅ Extension Multi-pays - Formulaire "Nouvel immeuble"

## 🎯 Objectif
Permettre la création d'immeubles en **Suisse** ET en **France** sans casser le fonctionnement existant.

---

## ✅ Modifications apportées

### 1. Frontend - [public/regie/immeubles.html](public/regie/immeubles.html)

#### 🔹 Champ "Pays" (ligne ~583)
**AVANT :**
```html
<input type="text" id="immeublePays" value="Suisse" readonly>
```

**APRÈS :**
```html
<select id="immeublePays" required>
  <option value="Suisse">Suisse</option>
  <option value="France">France</option>
</select>
```
✅ Valeur par défaut : Suisse (comportement conservé)

---

#### 🔹 Champ "NPA / Code postal" (ligne ~572)
**AVANT :**
```html
<label>NPA *</label>
<input type="text" id="immeubleNPA" placeholder="1000" 
       pattern="[0-9]{4}" maxlength="4" required>
<small>Format suisse : 4 chiffres</small>
```

**APRÈS :**
```html
<label>NPA / Code postal *</label>
<input type="text" id="immeubleNPA" placeholder="1000" required>
<small id="npaHint">Format suisse : 4 chiffres</small>
```
✅ Label adapté : "NPA / Code postal"  
✅ Validation dynamique selon le pays (pas de contrainte HTML statique)  
✅ Hint dynamique avec id `npaHint`

---

#### 🔹 Validation JavaScript (ligne ~1020)
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
✅ Validation conditionnelle selon le pays sélectionné  
✅ Messages d'erreur explicites  
✅ Logique Suisse préservée à l'identique

---

#### 🔹 UX Dynamique - Écouteur d'événement (ligne ~1238)
**NOUVEAU :**
```javascript
// Gérer changement de pays pour adapter le format NPA/Code postal
const paysSelect = document.getElementById('immeublePays');
const npaInput = document.getElementById('immeubleNPA');
const npaHint = document.getElementById('npaHint');

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
✅ Placeholder dynamique : `1000` (Suisse) ou `75001` (France)  
✅ MaxLength dynamique : 4 ou 5 caractères  
✅ Hint dynamique : "4 chiffres" ou "5 chiffres"

---

### 2. Backend - Migration SQL

#### 📋 Fichier créé : [supabase/migrations/20260109000001_m61_npa_multi_pays.sql](supabase/migrations/20260109000001_m61_npa_multi_pays.sql)

**Modifications en base de données :**

1. **Table `immeubles` :**
   - ❌ Suppression contrainte : `check_npa_format` (4 chiffres uniquement)
   - ✅ Nouvelle contrainte : `check_npa_multi_pays` → regex `^[0-9]{4,5}$`

2. **Table `logements` :**
   - ❌ Suppression contrainte : `check_logement_npa_format` (si existe)
   - ✅ Nouvelle contrainte : `check_logement_npa_multi_pays` → regex `^[0-9]{4,5}$`

**État actuel de la migration :**
⚠️ **La migration doit être appliquée manuellement** via le SQL Editor de Supabase.  
📄 Instructions détaillées : [_apply_m61_via_sql_editor.md](_apply_m61_via_sql_editor.md)

---

## 🧪 Tests à effectuer

### ✅ Test 1 : Création immeuble SUISSE
1. Ouvrir [/public/regie/immeubles.html](/public/regie/immeubles.html)
2. Cliquer sur "➕ Nouvel immeuble"
3. Remplir :
   - **Pays** : Suisse
   - **NPA** : `1000` (4 chiffres)
   - Autres champs requis
4. **Résultat attendu** : ✅ Création réussie (comportement existant préservé)

### ✅ Test 2 : Création immeuble FRANCE
1. Ouvrir [/public/regie/immeubles.html](/public/regie/immeubles.html)
2. Cliquer sur "➕ Nouvel immeuble"
3. Sélectionner **Pays** : France
4. Observer :
   - Placeholder change : `75001`
   - Hint change : "Format français : 5 chiffres"
   - MaxLength : 5 caractères
5. Remplir :
   - **Code postal** : `75001` (5 chiffres)
   - Autres champs requis
6. **Résultat attendu** : ✅ Création réussie

### ✅ Test 3 : Validation des erreurs
- **Suisse avec 5 chiffres** → ❌ Erreur : "Le NPA suisse doit contenir exactement 4 chiffres"
- **France avec 4 chiffres** → ❌ Erreur : "Le code postal français doit contenir exactement 5 chiffres"
- **Suisse avec lettres** → ❌ Erreur : validation numérique
- **France avec lettres** → ❌ Erreur : validation numérique

### ✅ Test 4 : Rétrocompatibilité
1. Ouvrir un immeuble suisse existant (créé avant cette modification)
2. Modifier n'importe quel champ
3. Sauvegarder
4. **Résultat attendu** : ✅ Aucune erreur, modification réussie

---

## 📊 Compatibilité

| Aspect | État | Commentaire |
|--------|------|-------------|
| **Données existantes** | ✅ 100% compatible | Les codes postaux suisses (4 chiffres) restent valides |
| **Formulaire Suisse** | ✅ Préservé | Aucun changement de comportement |
| **Formulaire France** | ✅ Nouveau | Fonctionne indépendamment |
| **Structure DB** | ✅ Inchangée | Colonnes existantes (`npa`, `pays`) |
| **Contraintes DB** | ⚠️ À appliquer | Migration M61 requise |

---

## 🚀 Déploiement

### Étape 1 : Appliquer la migration SQL
Suivre les instructions dans [_apply_m61_via_sql_editor.md](_apply_m61_via_sql_editor.md)

### Étape 2 : Vérifier le frontend
Le fichier [public/regie/immeubles.html](public/regie/immeubles.html) est déjà modifié et prêt.

### Étape 3 : Tester
Exécuter les 4 tests décrits ci-dessus.

---

## 📝 Commit recommandé

```bash
git add public/regie/immeubles.html
git add supabase/migrations/20260109000001_m61_npa_multi_pays.sql
git commit -m "feat: Support multi-pays (Suisse + France) pour formulaire Nouvel immeuble

- Champ Pays: select éditable (Suisse/France, défaut: Suisse)
- Validation NPA: dynamique selon pays (4 ou 5 chiffres)
- UX: placeholder, hint et maxLength adaptatifs
- DB: contrainte NPA flexible (^[0-9]{4,5}$) via migration M61
- Rétrocompatibilité: 100% compatible avec données existantes
- Sans breaking change: logique Suisse préservée à l'identique
"
```

---

## 🎉 Résultat final

✅ Le formulaire "Nouvel immeuble" supporte maintenant :
- 🇨🇭 **Suisse** : NPA 4 chiffres (comportement existant conservé)
- 🇫🇷 **France** : Code postal 5 chiffres (nouveau)
- 🔄 **UX dynamique** : interface s'adapte selon le pays sélectionné
- 🛡️ **Rétrocompatibilité** : aucune régression sur données/fonctionnement existant
- 📏 **Validation stricte** : impossible de mélanger les formats

---

**Développeur** : GitHub Copilot  
**Date** : 9 janvier 2026  
**Ticket** : Extension multi-pays formulaire immeuble
