# 🧪 Plan de Tests - Support Multi-pays Formulaire Immeuble

## ⚠️ PRÉREQUIS OBLIGATOIRE
**La migration M61 DOIT être appliquée en base de données avant les tests.**

Voir : [_apply_m61_via_sql_editor.md](_apply_m61_via_sql_editor.md)

---

## 📋 Scénarios de test

### ✅ TEST 1 : Création immeuble SUISSE (comportement existant)

**Objectif** : Vérifier qu'aucune régression n'a été introduite

**Étapes :**
1. Se connecter en tant que **Régie**
2. Aller dans **Immeubles**
3. Cliquer sur **"➕ Nouvel immeuble"**
4. Vérifier l'état initial du formulaire :
   - ✓ Pays = "Suisse" (par défaut)
   - ✓ Label = "NPA / Code postal *"
   - ✓ Placeholder = "1000"
   - ✓ Hint = "Format suisse : 4 chiffres"
   - ✓ MaxLength = 4
5. Remplir le formulaire :
   ```
   Nom : Résidence Les Acacias
   Adresse : Rue de Lausanne 45
   NPA : 1000
   Ville : Lausanne
   Pays : Suisse
   Nombre d'étages : 5
   ```
6. Cliquer sur **"Créer"**

**Résultat attendu :**
- ✅ Message de succès : "Immeuble créé avec succès"
- ✅ Immeuble apparaît dans la liste
- ✅ Données correctement enregistrées en base
- ✅ Aucune console error

---

### ✅ TEST 2 : Création immeuble FRANCE (nouvelle fonctionnalité)

**Objectif** : Vérifier le support du format français

**Étapes :**
1. Se connecter en tant que **Régie**
2. Aller dans **Immeubles**
3. Cliquer sur **"➕ Nouvel immeuble"**
4. **Changer le pays** : sélectionner **"France"** dans le select
5. Vérifier que l'interface s'adapte :
   - ✓ Placeholder change → "75001"
   - ✓ Hint change → "Format français : 5 chiffres"
   - ✓ MaxLength passe à 5
6. Remplir le formulaire :
   ```
   Nom : Résidence Victor Hugo
   Adresse : 12 Avenue Victor Hugo
   Code postal : 75116
   Ville : Paris
   Pays : France
   Nombre d'étages : 6
   ```
7. Cliquer sur **"Créer"**

**Résultat attendu :**
- ✅ Message de succès : "Immeuble créé avec succès"
- ✅ Immeuble apparaît dans la liste avec pays = France
- ✅ Code postal = "75116" (5 chiffres) enregistré
- ✅ Aucune console error

---

### ❌ TEST 3 : Validation erreurs - NPA suisse invalide

**Objectif** : Vérifier que la validation stricte fonctionne

**Étapes :**
1. Formulaire "Nouvel immeuble"
2. Pays = **Suisse**
3. Essayer de saisir NPA = **"75116"** (5 chiffres)
4. Remplir les autres champs obligatoires
5. Cliquer sur **"Créer"**

**Résultat attendu :**
- ❌ Message d'erreur : "Le NPA suisse doit contenir exactement 4 chiffres"
- ❌ Formulaire non soumis
- ✅ Pas de création en base

---

### ❌ TEST 4 : Validation erreurs - Code postal français invalide

**Objectif** : Vérifier que la validation stricte fonctionne pour la France

**Étapes :**
1. Formulaire "Nouvel immeuble"
2. Pays = **France**
3. Essayer de saisir Code postal = **"1000"** (4 chiffres)
4. Remplir les autres champs obligatoires
5. Cliquer sur **"Créer"**

**Résultat attendu :**
- ❌ Message d'erreur : "Le code postal français doit contenir exactement 5 chiffres"
- ❌ Formulaire non soumis
- ✅ Pas de création en base

---

### ❌ TEST 5 : Validation erreurs - Caractères non numériques

**Étapes :**
1. Pays = Suisse, NPA = **"ABCD"** → ❌ Erreur
2. Pays = France, Code postal = **"ABCDE"** → ❌ Erreur
3. Pays = Suisse, NPA = **"10A0"** → ❌ Erreur
4. Pays = France, Code postal = **"7511A"** → ❌ Erreur

**Résultat attendu :**
- ❌ Message d'erreur pour chaque cas
- ❌ Formulaire non soumis

---

### ✅ TEST 6 : Édition immeuble existant (rétrocompatibilité)

**Objectif** : Vérifier qu'aucun immeuble existant n'est cassé

**Prérequis** : Avoir un immeuble suisse créé AVANT cette modification

**Étapes :**
1. Aller dans **Immeubles**
2. Cliquer sur **"✏️ Modifier"** sur un immeuble suisse existant
3. Vérifier que les données s'affichent correctement :
   - ✓ NPA = 4 chiffres
   - ✓ Pays = Suisse
4. Modifier un champ quelconque (ex: description)
5. Cliquer sur **"Modifier"**

**Résultat attendu :**
- ✅ Message de succès : "Immeuble modifié avec succès"
- ✅ Modifications enregistrées
- ✅ NPA reste valide et inchangé
- ✅ Aucune erreur de validation

---

### ✅ TEST 7 : UX dynamique - Changement pays en direct

**Objectif** : Vérifier que l'interface réagit correctement

**Étapes :**
1. Formulaire "Nouvel immeuble"
2. Pays = **Suisse** (par défaut)
   - Observer : placeholder = "1000", hint = "4 chiffres", maxLength = 4
3. Saisir NPA = **"1005"**
4. **Changer le pays** → **France**
   - Observer : placeholder change → "75001", hint → "5 chiffres", maxLength → 5
   - Valeur saisie "1005" reste présente (pas d'effacement)
5. **Changer à nouveau** → **Suisse**
   - Observer : retour aux paramètres suisses

**Résultat attendu :**
- ✅ Interface réactive instantanément au changement de pays
- ✅ Pas de perte de données saisies
- ✅ Transitions fluides

---

### ✅ TEST 8 : Création avec logements automatiques

**Objectif** : Vérifier que la création auto de logements fonctionne avec les deux pays

**Test A - Suisse :**
```
Nom : Immeuble Test CH
NPA : 1003
Pays : Suisse
Nombre d'étages : 3
☑️ Créer les logements maintenant
Nombre total de logements : 12
```
→ ✅ Doit créer 12 logements avec NPA = "1003"

**Test B - France :**
```
Nom : Immeuble Test FR
Code postal : 69001
Pays : France
Nombre d'étages : 4
☑️ Créer les logements maintenant
Nombre total de logements : 16
```
→ ✅ Doit créer 16 logements avec NPA = "69001"

---

## 📊 Récapitulatif des résultats

| Test | Scénario | Résultat | Commentaire |
|------|----------|----------|-------------|
| ✅ 1 | Création Suisse (4 chiffres) | | Comportement existant |
| ✅ 2 | Création France (5 chiffres) | | Nouvelle fonctionnalité |
| ❌ 3 | Erreur NPA suisse invalide | | Validation stricte |
| ❌ 4 | Erreur CP français invalide | | Validation stricte |
| ❌ 5 | Erreur caractères non numériques | | Validation stricte |
| ✅ 6 | Édition immeuble existant | | Rétrocompatibilité |
| ✅ 7 | UX dynamique changement pays | | Expérience utilisateur |
| ✅ 8 | Création avec logements auto | | Intégration complète |

---

## 🐛 En cas d'erreur

### Erreur : "Could not insert row into table immeubles"
**Cause** : La migration M61 n'a pas été appliquée  
**Solution** : Appliquer [_apply_m61_via_sql_editor.md](_apply_m61_via_sql_editor.md)

### Erreur : NPA 5 chiffres refusé pour France
**Cause** : Contrainte DB toujours restrictive à 4 chiffres  
**Solution** : Vérifier que la contrainte `check_npa_multi_pays` existe bien

### Interface ne réagit pas au changement de pays
**Cause** : Cache navigateur  
**Solution** : Vider le cache ou Ctrl+Shift+R (hard refresh)

---

## ✅ Validation finale

Une fois tous les tests passés :

```bash
# Vérifier l'état en base
SELECT 
  npa, ville, pays 
FROM immeubles 
ORDER BY created_at DESC 
LIMIT 10;

# Résultat attendu : mix de NPA 4 et 5 chiffres selon pays
```

---

**Testeur recommandé** : Product Owner ou Tech Lead  
**Durée estimée** : 15-20 minutes  
**Environnement** : Développement puis Production
