# 🚀 DÉPLOIEMENT M57 - WORKFLOW REFUS + PDF + CORRECTIONS UX

## 📋 RÉSUMÉ
Migration M57 corrige 4 bugs critiques après M56 :
1. ✅ Bug déconnexion Régie sur page Factures
2. ✅ Boutons incorrects côté Entreprise (Marquer payée/Refuser)
3. ✅ Workflow refus incomplet (manque colonnes + RPC)
4. ✅ Manque bouton PDF

## 🎯 ORDRE DE DÉPLOIEMENT

### ÉTAPE 1 : Migration SQL (Supabase SQL Editor)
```sql
-- Fichier: supabase/migrations/20260109010000_m57_fix_workflow_refus.sql
-- Exécuter dans : Supabase Dashboard → SQL Editor

-- Ajout colonnes refus
-- Création RPC refuser_facture()
-- Création RPC corriger_et_renvoyer_facture()
-- Fix policy RLS regies
```

**Résultat attendu :**
- ✅ Colonnes `refus_reason`, `refused_at`, `refused_by` ajoutées à `factures`
- ✅ RPC `refuser_facture(p_facture_id, p_raison)` disponible
- ✅ RPC `corriger_et_renvoyer_facture(p_facture_id)` disponible
- ✅ Policy `regies_read_self` créée

### ÉTAPE 2 : Déploiement fichiers modifiés
Fichiers à déployer sur Vercel (push git) :

```bash
# Frontend modifié
public/regie/factures.html           # Auth fix + RPC refus + PDF
public/entreprise/dashboard.html     # Boutons corrigés + PDF

# Backend nouveau
api/facture-pdf.js                   # Route PDF individuelle
```

**Commandes :**
```bash
cd /workspaces/JETC_IMMO_SaaS
git add public/regie/factures.html
git add public/entreprise/dashboard.html
git add api/facture-pdf.js
git add supabase/migrations/20260109010000_m57_fix_workflow_refus.sql
git commit -m "M57: Fix workflow refus + PDF + UX buttons"
git push origin main
```

**Vercel déploie automatiquement.**

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Régie ne se déconnecte plus
1. Se connecter en tant que **Régie**
2. Cliquer sur menu **"Factures"**
3. ✅ **ATTENDU** : Page s'affiche sans déconnexion
4. ❌ **AVANT** : Déconnexion immédiate + redirect login

### Test 2 : Boutons Entreprise corrects
1. Se connecter en tant que **Entreprise**
2. Aller sur **Factures**
3. ✅ **ATTENDU** :
   - Statut `brouillon` : Éditer + Envoyer à la régie
   - Statut `envoyee` : "En attente validation Régie" (texte passif)
   - Statut `refusee` : "Corriger et renvoyer" + encadré raison refus
   - Statut `payee` : "Payée" (texte passif)
4. ❌ **AVANT** : Boutons "Marquer payée" et "Refuser" visibles (erreur métier)

### Test 3 : Workflow refus complet
**Côté Régie :**
1. Facture `envoyee` affichée
2. Cliquer **"❌ Refuser"**
3. Saisir raison : "IBAN incorrect"
4. ✅ **ATTENDU** : Facture passe à `refusee` + raison enregistrée

**Côté Entreprise :**
1. Voir facture `refusee` avec raison affichée
2. Cliquer **"🔄 Corriger et renvoyer"**
3. ✅ **ATTENDU** : Facture passe à `brouillon` + modal édition ouvert
4. Corriger IBAN
5. Cliquer **"Envoyer à la régie"**
6. ✅ **ATTENDU** : Facture passe à `envoyee` + raison refus effacée

### Test 4 : PDF fonctionne
**Côté Régie :**
1. Cliquer **"📄 Télécharger PDF"**
2. ✅ **ATTENDU** : PDF téléchargé avec :
   - Numéro facture
   - Entreprise + Régie
   - Détails mission
   - Lignes facturation
   - Totaux HT/TVA/TTC
   - Commission JETC
   - IBAN
   - Statut

**Côté Entreprise :**
1. Cliquer **"📥 Télécharger PDF"**
2. ✅ **ATTENDU** : Même PDF

---

## 🔍 VÉRIFICATIONS SQL DIRECTES

### Vérifier colonnes refus
```sql
SELECT 
  id, numero, statut, 
  refus_reason, refused_at, refused_by
FROM factures
WHERE statut = 'refusee';
```

### Tester RPC refuser_facture
```sql
-- Remplacer l'UUID par une vraie facture envoyee
SELECT refuser_facture(
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 
  'Test raison refus'
);

-- Vérifier résultat
SELECT statut, refus_reason, refused_at FROM factures WHERE id = 'xxx...';
```

### Tester RPC corriger_et_renvoyer
```sql
SELECT corriger_et_renvoyer_facture('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');

-- Vérifier
SELECT statut, refus_reason FROM factures WHERE id = 'xxx...';
-- ATTENDU: statut=brouillon, refus_reason=NULL
```

---

## ⚠️ ROLLBACK SI PROBLÈME

### Annuler M57 (SQL)
```sql
-- 1. Supprimer RPC
DROP FUNCTION IF EXISTS refuser_facture(UUID, TEXT);
DROP FUNCTION IF EXISTS corriger_et_renvoyer_facture(UUID);

-- 2. Supprimer colonnes
ALTER TABLE factures 
  DROP COLUMN IF EXISTS refus_reason,
  DROP COLUMN IF EXISTS refused_at,
  DROP COLUMN IF EXISTS refused_by;

-- 3. Supprimer policy
DROP POLICY IF EXISTS regies_read_self ON regies;
```

### Revenir fichiers frontend
```bash
git revert HEAD
git push origin main
```

---

## 📊 CHANGELOG M57

### Ajouts SQL
- ✅ `factures.refus_reason TEXT`
- ✅ `factures.refused_at TIMESTAMPTZ`
- ✅ `factures.refused_by UUID`
- ✅ `refuser_facture(p_facture_id UUID, p_raison TEXT)`
- ✅ `corriger_et_renvoyer_facture(p_facture_id UUID)`
- ✅ Policy `regies_read_self` pour RLS sur table `regies`

### Modifications Frontend
**public/regie/factures.html :**
- ✅ Ligne 504-508 : Supprimé `signOut()` sur erreur profile
- ✅ Fonction `refuserFacture()` : Appelle RPC `refuser_facture` (plus `update_facture_status`)
- ✅ Ajout fonction `telechargerPDF()`
- ✅ Bouton PDF ajouté pour toutes factures

**public/entreprise/dashboard.html :**
- ✅ Ligne 2225 : Supprimé `canPay` et `canRefuse`
- ✅ Ligne 2225 : Ajouté `canEdit`, `canSend`, `canCorrect`
- ✅ Ligne 2275-2300 : Boutons Marquer payée/Refuser supprimés
- ✅ Ligne 2290 : Ajouté bouton "Corriger et renvoyer"
- ✅ Ajout affichage raison refus si `refusee`
- ✅ Ajout fonction `corrigerEtRenvoyerFacture()`
- ✅ Ajout fonction `telechargerFacturePDF()`
- ✅ Bouton PDF ajouté pour toutes factures

### Nouveaux fichiers
**api/facture-pdf.js :**
- ✅ Route GET `/api/facture-pdf?facture_id=xxx`
- ✅ Auth : Entreprise (sa facture) ou Régie (facture de sa mission)
- ✅ Génération PDF avec PDFKit
- ✅ Inclut : numéro, entreprise, régie, mission, lignes, totaux, IBAN, statut

---

## 🎉 RÉSULTAT FINAL

### Workflow Métier Complet
```
[Entreprise] Crée facture → brouillon
           ↓
[Entreprise] Envoie → envoyee
           ↓
    ┌──────┴──────┐
    ↓             ↓
[Régie]      [Régie]
Valider      Refuser + raison
    ↓             ↓
  payee       refusee
                  ↓
           [Entreprise]
           Corriger et renvoyer
                  ↓
              brouillon → envoyee
```

### UX Corrigée
- ✅ **Régie** : Accès sans déconnexion + boutons Valider/Refuser/PDF
- ✅ **Entreprise** : Boutons contextuels (pas de droits Régie) + PDF
- ✅ **Tous** : Téléchargement PDF pour archive/comptabilité

---

## 📞 SUPPORT
En cas de problème :
1. Vérifier logs Vercel : `vercel logs`
2. Vérifier RLS Supabase : Dashboard → Table Editor → Policies
3. Tester RPC dans SQL Editor
4. Rollback si nécessaire (voir section ci-dessus)
