# 🐛 DIAGNOSTIC BUG VALIDATION RÉGIE

## ❌ PROBLÈME IDENTIFIÉ

**Erreur** : `new row for relation "tickets" violates check constraint "check_sous_categorie_valide"`  
**Code** : 23514  
**Moment** : PATCH/UPDATE tickets lors de la validation par la régie

---

## 🔍 CAUSE RACINE

### Contrainte CHECK (Supabase - M16)
```sql
CHECK (
  sous_categorie IS NULL 
  OR (categorie = 'plomberie' AND sous_categorie IN ('Fuite d''eau', 'WC bouché', 'Chauffe-eau', 'Robinetterie', 'Autre plomberie'))
  OR (categorie = 'electricite' AND sous_categorie IN ('Panne générale', 'Prise défectueuse', 'Interrupteur', 'Éclairage', 'Autre électricité'))
  OR (categorie = 'chauffage' AND sous_categorie IN ('Radiateur', 'Chaudière', 'Thermostat', 'Autre chauffage'))
  OR (categorie = 'ventilation' AND sous_categorie IN ('VMC défectueuse', 'Grille cassée', 'Bruit anormal', 'Autre ventilation'))
  -- ...etc
)
```

### Valeurs LOCATAIRE (correctes)
**Fichier** : `public/locataire/dashboard.html`  
**Ligne 1451** : `const sousCategories = { ... }`

Exemple :
- `"Fuite d'eau"` ✅ (majuscule F, apostrophe typographique)
- `"Panne générale"` ✅
- `"VMC défectueuse"` ✅

### Valeurs RÉGIE (INCORRECTES)
**Fichier** : `public/regie/tickets.html`  
**Ligne 570** : `<select id="validation-sous-categorie">`

Exemple :
- `<option value="fuite">Fuite</option>` ❌ (tout en minuscule)
- `<option value="panne">Panne</option>` ❌
- `<option value="robinet">Robinet</option>` ❌

---

## 💥 SCÉNARIO DU BUG

1. **Locataire crée ticket** :
   - categorie = `"plomberie"`
   - sous_categorie = `"Fuite d'eau"` ✅

2. **Régie valide le ticket** (modale) :
   - Charge le ticket existant
   - Pré-remplit avec `"Fuite d'eau"` ✅
   - Mais le `<select>` affiche :
     ```html
     <option value="fuite">Fuite</option>
     ```
   - Donc `document.getElementById('validation-sous-categorie').value` retourne `"fuite"` ❌

3. **UPDATE envoyé** :
   ```javascript
   {
     sous_categorie: "fuite", // ❌ INVALIDE
     piece: "cuisine",
     priorite: "normale"
   }
   ```

4. **Postgres rejette** : `"fuite"` n'est PAS dans la contrainte CHECK

---

## ✅ SOLUTION

### Option 1 : Aligner les valeurs du select régie sur les valeurs SQL (RECOMMANDÉ)

**Modifier** : `public/regie/tickets.html` ligne 565-610

Remplacer tous les `<option value="xxx">` par les valeurs EXACTES de la contrainte.

### Option 2 : Ne PAS réenvoyer categorie/sous_categorie si déjà remplies (PARTIEL)

Éviter l'UPDATE de ces champs s'ils sont déjà corrects, mais ne résout pas le cas où la régie doit corriger.

### Option 3 : Assouplir la contrainte (NON RECOMMANDÉ)

Accepter les minuscules, mais complexifie le modèle de données.

---

## 🎯 CORRECTIF APPLIQUÉ

**Option 1** : Alignement complet des valeurs frontend régie sur la contrainte SQL.

### Changements dans `public/regie/tickets.html`

**AVANT** :
```html
<option value="fuite">Fuite</option>
<option value="robinet">Robinet</option>
```

**APRÈS** :
```html
<option value="Fuite d'eau">Fuite d'eau</option>
<option value="Robinetterie">Robinetterie</option>
```

---

## 🧪 TEST DE VALIDATION

1. **Créer ticket locataire** : plomberie / Fuite d'eau
2. **Valider en tant que régie** : modale s'ouvre
3. **Vérifier** : sous-catégorie pré-remplie = "Fuite d'eau"
4. **Confirmer validation** : UPDATE réussit ✅
5. **Vérifier** : ticket passe en `en_attente`

---

## 📊 MAPPING COMPLET

| Catégorie | Valeurs acceptées par la contrainte SQL |
|-----------|----------------------------------------|
| **plomberie** | 'Fuite d''eau', 'WC bouché', 'Chauffe-eau', 'Robinetterie', 'Autre plomberie' |
| **electricite** | 'Panne générale', 'Prise défectueuse', 'Interrupteur', 'Éclairage', 'Autre électricité' |
| **chauffage** | 'Radiateur', 'Chaudière', 'Thermostat', 'Autre chauffage' |
| **ventilation** | 'VMC défectueuse', 'Grille cassée', 'Bruit anormal', 'Autre ventilation' |
| **serrurerie** | 'Porte bloquée', 'Clé perdue', 'Verrou défectueux', 'Autre serrurerie' |
| **vitrerie** | 'Vitre cassée', 'Double vitrage', 'Autre vitrerie' |
| **menuiserie** | 'Porte', 'Fenêtre', 'Parquet', 'Autre menuiserie' |
| **peinture** | 'Murs', 'Plafond', 'Boiseries', 'Autre peinture' |
| **autre** | 'Autre intervention' |

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Corriger les valeurs du select régie
2. ✅ Tester le workflow complet
3. ⚠️ Considérer : centraliser les valeurs (JSON partagé frontend/backend)
4. ⚠️ Considérer : validation TypeScript/Zod pour éviter ce genre de bug
