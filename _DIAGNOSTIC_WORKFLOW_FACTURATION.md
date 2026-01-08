# DIAGNOSTIC COMPLET - WORKFLOW FACTURATION

**Date:** 2026-01-08
**Mission:** Réparer le workflow de facturation entreprise → régie → clos

---

## ✅ ÉTAT DES LIEUX (AUDIT)

### 1. BASE DE DONNÉES

**Table `factures`** : ✅ Accessible et bien structurée
- Colonnes présentes: id, mission_id, entreprise_id, regie_id, numero, montant_ht, taux_tva, montant_tva, montant_ttc, taux_commission, montant_commission, statut, date_emission, date_echeance, date_envoi, date_paiement, notes, iban, created_at, updated_at

**Factures existantes:**
- 2 factures en statut `brouillon`
- FAC-2026-0001: ✅ Complète (montant: 120 CHF, IBAN présent)
- FAC-2026-0002: ⚠️ Incomplète (montant_ttc: NULL, IBAN: NULL)

**Missions terminées:**
- 2 missions avec statut `terminee`
- ✅ Toutes les missions terminées ont une facture associée (relation OK)

### 2. RPC FUNCTIONS

✅ Toutes les RPC existent et sont fonctionnelles:
- `editer_facture` ✅
- `envoyer_facture` ✅
- `valider_paiement_facture` ✅
- `refuser_facture` ✅

### 3. RLS POLICIES

⚠️ Impossible de vérifier automatiquement via script
→ Test manuel requis côté interface entreprise

### 4. INTERFACE UTILISATEUR (UI)

**Fichier:** `public/entreprise/dashboard.html`

#### Fonctionnalités EXISTANTES ✅
- Section "Mes factures" avec liste des factures
- Modal "Créer une facture" (pour missions sans facture)
- Affichage des factures dans des cards avec:
  - Numéro, statut, montants HT/TTC, commission
  - Bouton "Voir mission"
  - Bouton "Marquer payée" (si brouillon/envoyée)

#### Fonctionnalités MANQUANTES ❌

1. **AUCUN BOUTON "ÉDITER"** dans la liste des factures
   - Le code affiche uniquement "Marquer payée" et "Refuser"
   - Pas de bouton pour éditer une facture brouillon
   
2. **AUCUNE FONCTION `editerFacture()` dans le code JS**
   - Existe: `confirmerCreerFacture()` pour créer
   - Manque: fonction pour éditer une facture existante
   
3. **PAS DE BOUTON "ENVOYER À LA RÉGIE"**
   - Workflow incomplet: pas de moyen d'envoyer la facture une fois éditée

---

## 🔴 PROBLÈMES IDENTIFIÉS

### Problème #1: UI INCOMPLÈTE (CRITIQUE)
**Symptôme:** L'entreprise ne peut pas éditer les factures brouillon
**Cause racine:** Le code HTML ne génère pas de bouton "Éditer" pour les factures en statut `brouillon`
**Impact:** Blocage total du workflow, l'entreprise ne peut pas compléter/corriger une facture

### Problème #2: FONCTION D'ÉDITION MANQUANTE (CRITIQUE)
**Symptôme:** Pas de fonction JS pour éditer une facture
**Cause racine:** Le code a `confirmerCreerFacture()` mais pas `confirmerEditerFacture()`
**Impact:** Même si on ajoute le bouton, aucune action possible

### Problème #3: ENVOI À LA RÉGIE NON IMPLÉMENTÉ (CRITIQUE)
**Symptôme:** Pas de bouton/fonction pour envoyer la facture à la régie
**Cause racine:** La RPC `envoyer_facture` existe mais n'est pas appelée par l'UI
**Impact:** Workflow bloqué après édition, facture reste en brouillon

### Problème #4: WORKFLOW RÉGIE NON VISIBLE (HAUTE)
**Symptôme:** Pas d'interface côté régie pour voir/valider les factures
**Localisation:** `public/regie/` - à vérifier
**Impact:** Même si l'entreprise envoie, la régie ne peut pas traiter

---

## ✅ PLAN DE CORRECTION

### Étape 1: AJOUTER BOUTON "ÉDITER" dans la liste factures
**Fichier:** `public/entreprise/dashboard.html`
**Ligne:** ~2140 (fonction `renderFactureCard`)
**Action:** Ajouter un bouton "Éditer" visible uniquement si `facture_statut === 'brouillon'`

### Étape 2: CRÉER FONCTION `editerFacture(factureId)`
**Fichier:** `public/entreprise/dashboard.html`
**Action:** 
1. Charger les données de la facture
2. Pré-remplir le modal `modalCreerFacture` avec les données existantes
3. Changer le titre du modal en "Éditer la facture"
4. Modifier le bouton de confirmation

### Étape 3: CRÉER FONCTION `confirmerEditerFacture()`
**Fichier:** `public/entreprise/dashboard.html`
**Action:**
1. Récupérer les valeurs du formulaire
2. Appeler RPC `editer_facture` avec les nouvelles valeurs
3. Recharger la liste des factures
4. Fermer le modal

### Étape 4: AJOUTER BOUTON "ENVOYER À LA RÉGIE"
**Fichier:** `public/entreprise/dashboard.html`
**Action:**
1. Ajouter bouton visible si `facture_statut === 'brouillon'` ET facture complète (montant + IBAN)
2. Créer fonction `envoyerFactureRegie(factureId)`
3. Appeler RPC `envoyer_facture`
4. Mettre à jour le statut en `envoyee`

### Étape 5: INTERFACE RÉGIE - VALIDATION FACTURES
**Fichier:** À créer ou modifier dans `public/regie/`
**Action:**
1. Section "Factures reçues" dans dashboard régie
2. Liste des factures avec statut `envoyee`
3. Boutons "Payer" et "Refuser"
4. Appeler RPC `valider_paiement_facture` ou `refuser_facture`

### Étape 6: EFFET CASCADE "PAYÉ" → CLOS
**Fichier:** Vérifier la RPC `valider_paiement_facture`
**Action:**
1. Vérifier que la RPC met à jour:
   - `factures.statut` → `payee`
   - `factures.date_paiement` → NOW()
   - `missions.statut` → `clos`
   - `tickets.statut` → `clos`

---

## 📋 CHECKLIST AVANT APPLICATION

- [x] Diagnostic DB complet
- [x] Vérification RPC existantes
- [x] Analyse UI entreprise
- [ ] Analyse UI régie
- [ ] Vérification RLS policies (test manuel)
- [ ] Test workflow complet bout-en-bout

---

## 🎯 PROCHAINES ACTIONS

1. ✅ **Implémenter Étapes 1-4** (UI Entreprise)
2. ⏳ **Vérifier/Créer UI Régie** (Étape 5)
3. ⏳ **Vérifier RPC valider_paiement** (Étape 6)
4. ⏳ **Tests end-to-end** avec preuves
