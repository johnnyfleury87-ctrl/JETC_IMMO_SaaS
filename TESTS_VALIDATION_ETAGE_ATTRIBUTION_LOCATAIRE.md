# 🧪 TESTS VALIDATION ÉTAGE + ATTRIBUTION LOCATAIRE

**Date** : 24 décembre 2025  
**Fichier modifié** : `public/regie/logements.html`  
**Objectif** : Valider les 2 nouvelles fonctionnalités métier

---

## 🎯 PARTIE 1 : VALIDATION ÉTAGE <= NOMBRE_ETAGES

### ✅ Test 1.1 : Étage valide (doit passer)

**Contexte** :
- Immeuble : "Tour Mercure" avec 6 étages
- Logement : Appartement au 4ème étage

**Actions** :
1. Se connecter en tant que régie
2. Aller sur "Logements"
3. Cliquer "Ajouter un logement"
4. Sélectionner l'immeuble "Tour Mercure"
5. Remplir le formulaire avec étage = 4
6. Soumettre

**Résultat attendu** :
- ✅ Logement créé avec succès
- ✅ Message de confirmation affiché
- ✅ Logement visible dans la liste

---

### ❌ Test 1.2 : Étage invalide (doit être refusé)

**Contexte** :
- Immeuble : "Résidence du Parc" avec 5 étages
- Logement : Appartement au 8ème étage (INVALIDE)

**Actions** :
1. Se connecter en tant que régie
2. Aller sur "Logements"
3. Cliquer "Ajouter un logement"
4. Sélectionner l'immeuble "Résidence du Parc"
5. Remplir le formulaire avec étage = 8
6. Soumettre

**Résultat attendu** :
- ❌ Soumission bloquée (frontend)
- ❌ Message d'erreur clair :
  ```
  ❌ L'étage indiqué (8) dépasse le nombre d'étages de l'immeuble (max : 5).
  ```
- ❌ Logement NON créé en BDD
- ✅ Console affiche : `[LOGEMENTS][VALIDATION] Étage invalide`

---

### ❌ Test 1.3 : Étage invalide avec validation backend

**Contexte** :
- Contourner la validation frontend (console navigateur / manipulation DOM)
- Immeuble : "Les Acacias" avec 4 étages
- Logement : étage = 10

**Actions** :
1. Ouvrir la console navigateur (F12)
2. Exécuter :
   ```javascript
   document.getElementById('logementEtage').value = 10;
   ```
3. Soumettre le formulaire (sans validation frontend)

**Résultat attendu** :
- ❌ Requête Supabase bloquée (backend)
- ❌ Message d'erreur backend :
  ```
  ❌ Étage 10 invalide pour l'immeuble "Les Acacias" (max: 4).
  ```
- ❌ Logement NON créé en BDD
- ✅ Console affiche : `[LOGEMENTS][VALIDATION BACKEND] Étage invalide`

---

### ✅ Test 1.4 : Maison individuelle (pas de contrainte)

**Contexte** :
- Type : Maison individuelle
- immeuble_id = NULL
- Étage = 2 (par exemple)

**Actions** :
1. Cliquer "Ajouter un logement"
2. **Ne pas sélectionner d'immeuble** (laisser "Aucun immeuble")
3. Remplir le formulaire avec étage = 2
4. Soumettre

**Résultat attendu** :
- ✅ Logement créé avec succès (aucune validation étage)
- ✅ Message de confirmation
- ✅ Badge "🏡 Maison individuelle" dans la liste

---

### ❌ Test 1.5 : Modification avec étage invalide

**Contexte** :
- Logement existant : Appartement au 2ème étage dans "Tour Azur" (7 étages)
- Modification : changer étage à 10

**Actions** :
1. Cliquer "✏️" sur un logement existant
2. Modifier le champ étage : 10
3. Soumettre

**Résultat attendu** :
- ❌ Modification refusée
- ❌ Message d'erreur :
  ```
  ❌ L'étage indiqué (10) dépasse le nombre d'étages de l'immeuble (max : 7).
  ```
- ❌ Logement NON modifié en BDD

---

## 🎯 PARTIE 2 : ATTRIBUTION LOCATAIRE À LOGEMENT VACANT

### ✅ Test 2.1 : Attribution normale (doit passer)

**Prérequis** :
- 1 logement avec statut = "vacant"
- 1 locataire avec logement_id = NULL

**Actions** :
1. Aller sur "Logements"
2. Repérer un logement avec badge "Vacant"
3. Cliquer sur le bouton "👤+" (Attribuer un locataire)
4. Sélectionner un locataire dans la liste déroulante
5. Cliquer "Attribuer"

**Résultat attendu** :
- ✅ Message de succès :
  ```
  ✅ Locataire attribué avec succès
  ```
- ✅ Le logement passe au statut "Occupé" (badge "Occupé")
- ✅ Le locataire a maintenant `logement_id = <id_du_logement>`
- ✅ Le bouton "👤+" disparaît (remplacé par les boutons standard)
- ✅ Console affiche : `[ATTRIBUTION] ✅ Attribution réussie`

---

### ❌ Test 2.2 : Attribution refusée (locataire déjà lié)

**Contexte** :
- Locataire A déjà lié au logement B
- Tenter de lier locataire A au logement C

**Actions** :
1. Créer 2 logements vacants
2. Attribuer le locataire A au logement B (OK)
3. Tenter d'attribuer le même locataire A au logement C

**Résultat attendu** :
- ❌ Attribution refusée
- ❌ Message d'erreur :
  ```
  ❌ Martin Dupont est déjà lié à un logement.
  ```
- ❌ Locataire A reste lié au logement B
- ❌ Logement C reste vacant

---

### ⚠️ Test 2.3 : Aucun locataire disponible

**Contexte** :
- Tous les locataires de la régie sont déjà liés à un logement
- 1 logement vacant

**Actions** :
1. Cliquer sur "👤+" pour un logement vacant
2. Observer la liste déroulante

**Résultat attendu** :
- ⚠️ Message dans le select :
  ```
  Aucun locataire disponible
  ```
- ⚠️ Bouton "Attribuer" désactivé ou sans effet

---

### ✅ Test 2.4 : Bouton "👤+" visible uniquement sur logements vacants

**Contexte** :
- 3 logements :
  - Logement A : statut = "vacant"
  - Logement B : statut = "occupé"
  - Logement C : statut = "en_travaux"

**Actions** :
1. Consulter la liste des logements
2. Observer les boutons d'action

**Résultat attendu** :
- ✅ Logement A : bouton "👤+" visible
- ❌ Logement B : bouton "👤+" NON visible (occupé)
- ❌ Logement C : bouton "👤+" NON visible (en travaux)

---

### ✅ Test 2.5 : Annulation attribution

**Actions** :
1. Cliquer sur "👤+" pour un logement vacant
2. Sélectionner un locataire
3. Cliquer "Annuler"

**Résultat attendu** :
- ✅ Modal fermé
- ✅ Aucune modification en BDD
- ✅ Logement reste vacant
- ✅ Locataire reste sans logement

---

## 🔧 VÉRIFICATION BDD (SQL)

### Vérifier qu'un logement est bien occupé

```sql
SELECT 
  l.id,
  l.numero,
  l.statut,
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom
FROM logements l
LEFT JOIN locataires loc ON loc.logement_id = l.id
WHERE l.id = '<id_du_logement>';
```

**Résultat attendu après attribution** :
- `statut = 'occupé'`
- `locataire_nom` et `locataire_prenom` renseignés

---

### Vérifier qu'un locataire est bien lié

```sql
SELECT 
  id,
  nom,
  prenom,
  logement_id
FROM locataires
WHERE id = '<id_du_locataire>';
```

**Résultat attendu après attribution** :
- `logement_id = <id_du_logement_attribué>`

---

## 📊 RÉSUMÉ DES TESTS

| Test | Objectif | Statut attendu |
|------|----------|----------------|
| 1.1 | Étage valide | ✅ Création OK |
| 1.2 | Étage invalide (frontend) | ❌ Refusé (message clair) |
| 1.3 | Étage invalide (backend) | ❌ Refusé (sécurité) |
| 1.4 | Maison individuelle | ✅ Pas de contrainte |
| 1.5 | Modification étage invalide | ❌ Refusé |
| 2.1 | Attribution normale | ✅ Locataire lié + statut occupé |
| 2.2 | Locataire déjà lié | ❌ Refusé (message clair) |
| 2.3 | Aucun locataire disponible | ⚠️ Liste vide |
| 2.4 | Bouton visible seulement si vacant | ✅ Conditionnel |
| 2.5 | Annulation attribution | ✅ Pas de modification |

---

## 🚀 PROCHAINES ÉTAPES

Une fois ces tests validés, préparer :

1. **Désaffectation locataire**
   - Retirer un locataire d'un logement
   - Remettre le logement en "vacant"
   - Conserver l'historique (futur)

2. **Historique des occupations**
   - Table `locataires_logements_historique`
   - Dates début / fin
   - Traçabilité complète

3. **Tickets et interventions**
   - Lien logement ↔ ticket
   - Lien locataire ↔ ticket
   - Gestion des interventions techniciens

---

## ✅ VALIDATION FINALE

- [ ] Tous les tests Partie 1 passent (validation étage)
- [ ] Tous les tests Partie 2 passent (attribution locataire)
- [ ] Aucune erreur JavaScript dans la console
- [ ] Messages d'erreur clairs et compréhensibles
- [ ] Cohérence BDD garantie (pas de données incohérentes)
- [ ] Page responsive et accessible

**Prêt pour production** : OUI / NON

---

**Testeur** : ___________________________  
**Date** : ___________________________  
**Résultat** : ___________________________
