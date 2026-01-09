# 🎯 CORRECTION FACTURATION - M56 FIX RLS + FRONTEND

## 📋 Diagnostic complet effectué

### ❌ Problèmes identifiés

1. **RLS Policies obsolètes**
   - Les policies utilisaient une table `profiles` qui n'existe pas dans le système
   - `auth.uid()` correspond directement à `entreprise_id` ou `regie_id`
   - Résultat : **AUCUNE ENTREPRISE/RÉGIE ne pouvait voir les factures**

2. **Menu Factures désactivé** (Entreprise)
   - Classe CSS `disabled` empêchait l'accès
   - Pourtant le code backend était fonctionnel

3. **Page Factures manquante** (Régie)
   - Aucune interface pour traiter les factures
   - Lien menu non fonctionnel

### ✅ Corrections apportées

#### 1. Migration M56 : Fix RLS Policies

**Fichier:** `supabase/migrations/20260109000000_m56_fix_rls_factures_urgent.sql`

- ❌ Suppression anciennes policies (basées sur `profiles`)
- ✅ Nouvelles policies correctes :
  - **Entreprise** : voit ses factures (`entreprise_id = auth.uid()`)
  - **Entreprise** : édite ses factures brouillon
  - **Entreprise** : crée ses factures
  - **Régie** : voit les factures envoyées (`regie_id = auth.uid()` + statut `IN ('envoyee', 'payee', 'refusee')`)
  - **Régie** : traite les factures (changer statut)

#### 2. Frontend Entreprise

**Fichier:** `public/entreprise/dashboard.html`

- ✅ Menu "Factures" activé (suppression classe `disabled`)
- ✅ Ajout attribut `data-view="factures"` et `onclick="switchView('factures')"`
- ⚡ Le code de chargement existait déjà (fonction `loadFactures()`)

#### 3. Frontend Régie - Nouvelle page

**Fichier:** `public/regie/factures.html` (créé)

- ✅ Page complète de gestion des factures
- ✅ Filtres par statut et entreprise
- ✅ Actions : Valider paiement / Refuser
- ✅ Utilise `missions_factures_complet` vue
- ✅ RPC `update_facture_status` pour changer statut

**Fichier:** `public/regie/dashboard.html`

- ✅ Lien menu corrigé : `href="/regie/factures.html"`

## 🚀 Déploiement

### Étape 1 : Appliquer migration SQL

Copier-coller dans **Supabase SQL Editor** :

```bash
cat supabase/migrations/20260109000000_m56_fix_rls_factures_urgent.sql
```

OU via API :

```bash
node _apply_m56_fix_rls.js
```

### Étape 2 : Déployer frontend

Les fichiers modifiés sont automatiquement pris en compte :

- ✅ `public/entreprise/dashboard.html` (modifié)
- ✅ `public/regie/dashboard.html` (modifié)
- ✅ `public/regie/factures.html` (nouveau)

Aucune action supplémentaire nécessaire.

### Étape 3 : Vider cache navigateur

Forcer rafraîchissement : `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)

## ✅ Tests de validation

### Test 1 : Entreprise voit ses factures

```javascript
// Connexion Entreprise
// Aller sur Dashboard > Factures (menu actif)
// Vérifier que les factures s'affichent
```

### Test 2 : Régie voit les factures envoyées

```javascript
// Connexion Régie
// Aller sur Factures (menu)
// Vérifier que seules les factures envoyées/payées/refusées apparaissent
```

### Test 3 : Régie traite une facture

```javascript
// Sur une facture statut "envoyee"
// Cliquer "✅ Valider paiement"
// Vérifier changement statut → "payee"
// Vérifier que mission + ticket → statut "validee" / "clos"
```

### Test 4 : SQL direct

```sql
-- Test Entreprise (remplacer UUID)
SELECT * FROM factures WHERE entreprise_id = '<UUID_ENTREPRISE>';

-- Test Régie (remplacer UUID)
SELECT * FROM factures WHERE regie_id = '<UUID_REGIE>' AND statut IN ('envoyee', 'payee', 'refusee');

-- Vérifier policies
SELECT * FROM pg_policies WHERE tablename = 'factures';
```

## 📊 Workflow attendu (complet)

1. **Mission terminée** → Facture générée automatiquement (statut `brouillon`)
2. **Entreprise** :
   - Voit sa facture dans "Factures"
   - Peut éditer montant/notes/IBAN (si brouillon)
   - Envoie la facture → statut `envoyee`
3. **Régie** :
   - Voit la facture dans "Factures" (liste)
   - Peut valider paiement → statut `payee` → Mission validée, Ticket clos
   - Peut refuser → statut `refusee`

## 🔒 Sécurité RLS

| Rôle | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| **Entreprise** | Ses factures | Ses factures | Ses factures (brouillon) |
| **Régie** | Factures envoyées | ❌ | Factures envoyées |
| **Service Role** | Toutes | Toutes | Toutes |

## 📂 Fichiers modifiés

- ✅ `supabase/migrations/20260109000000_m56_fix_rls_factures_urgent.sql`
- ✅ `public/entreprise/dashboard.html`
- ✅ `public/regie/dashboard.html`
- ✅ `public/regie/factures.html` (nouveau)
- ✅ `_README_M56_FIX_FACTURATION.md` (ce fichier)

## 🎉 Résultat attendu

- ✅ Entreprise peut voir et gérer ses factures
- ✅ Régie peut voir et traiter les factures envoyées
- ✅ Workflow facturation complet fonctionnel
- ✅ RLS correctement implémenté
- ✅ Aucune manipulation manuelle de données requise

---

**Date:** 2026-01-09  
**Migration:** M56  
**Status:** ✅ READY TO DEPLOY
