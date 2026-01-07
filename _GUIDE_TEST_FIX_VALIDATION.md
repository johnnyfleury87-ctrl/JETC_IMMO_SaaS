# 🧪 GUIDE TEST RAPIDE - BUG VALIDATION RÉGIE

## ✅ Objectif
Vérifier que le bug de contrainte CHECK est résolu

## ⏱️ Durée : 2 minutes

---

## 📋 ÉTAPES DE TEST

### 1. Créer un ticket locataire (si aucun ticket "nouveau" existe)

**URL** : `http://localhost:5500/public/locataire/dashboard.html`

1. Se connecter comme locataire
2. Aller dans "Mes tickets"
3. Cliquer "Nouveau ticket"
4. Remplir :
   - Titre : "Test fuite robinet"
   - Catégorie : **Plomberie**
   - Sous-catégorie : **Fuite d'eau**
   - Pièce : Cuisine
   - Description : "Fuite sous évier"
5. Ajouter 1 créneau disponibilité
6. Soumettre

**Résultat attendu** : Ticket créé avec succès

---

### 2. Valider le ticket (Régie)

**URL** : `http://localhost:5500/public/regie/tickets.html`

1. Se connecter comme régie
2. Aller dans section **"Nouveaux"**
3. Repérer le ticket créé à l'étape 1
4. Cliquer **"✅ Valider et diffuser"**

**Vérifier dans la modale** :
- ✅ Sous-catégorie pré-remplie = "Fuite d'eau"
- ✅ Pièce pré-remplie = "cuisine"
- ✅ Les options du select affichent des valeurs correctes (ex: "Fuite d'eau", "WC bouché")

5. Remplir :
   - Plafond d'intervention : **500** CHF
   - Mode diffusion : **Général**
6. Cliquer **"✅ Valider et diffuser"**

---

## ✅ RÉSULTAT ATTENDU

### Avant le correctif (BUG) ❌
```
Error: new row for relation "tickets" violates check constraint "check_sous_categorie_valide"
Code: 23514
```

### Après le correctif (OK) ✅
```
✅ Ticket validé et diffusé avec succès !
Mode: general
Statut: en_attente
```

**Le ticket disparaît de "Nouveaux" et apparaît dans "En attente"**

---

## 🔍 VÉRIFICATION TECHNIQUE (optionnel)

### Console navigateur
Ouvrir DevTools (F12) → Console

Lors de la validation, chercher :
```javascript
[REGIE][ACTION] Validation ticket M32 + P1: {
  sous_categorie: "Fuite d'eau"  // ✅ Valeur correcte
  // ...
}
```

### Network Tab
Chercher la requête PATCH vers `tickets`

Payload :
```json
{
  "sous_categorie": "Fuite d'eau",  // ✅ Pas "fuite"
  "piece": "cuisine",
  "priorite": "normale",
  "plafond_intervention_chf": 500
}
```

---

## 🎯 AUTRES TESTS (optionnel)

Tester avec d'autres catégories :

| Catégorie | Sous-catégorie à tester | Attendu |
|-----------|------------------------|---------|
| Plomberie | WC bouché | ✅ |
| Électricité | Panne générale | ✅ |
| Chauffage | Radiateur | ✅ |
| Serrurerie | Porte bloquée | ✅ |
| Vitrerie | Vitre cassée | ✅ |
| Menuiserie | Fenêtre | ✅ |
| Peinture | Murs | ✅ |

---

## 🚨 SI LE BUG PERSISTE

1. **Vider le cache** : Ctrl+Shift+R (Chrome/Firefox)
2. **Vérifier le fichier déployé** :
   ```bash
   grep -A5 "validation-sous-categorie" public/regie/tickets.html
   ```
   Doit afficher :
   ```html
   <option value="Fuite d'eau">Fuite d'eau</option>
   ```
   PAS :
   ```html
   <option value="fuite">Fuite</option>
   ```

3. **Exécuter le script de test** :
   ```bash
   node _test_fix_validation_regie.js
   ```

4. **Vérifier la contrainte SQL** (Supabase Dashboard) :
   ```sql
   SELECT pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conname = 'check_sous_categorie_valide';
   ```

---

## 📞 CONTACT

En cas de problème :
- Consulter `_RAPPORT_FIX_VALIDATION_REGIE.md`
- Exécuter `_test_fix_validation_regie.js`
- Vérifier les logs console navigateur

**Priorité** : HAUTE (workflow régie bloqué)
