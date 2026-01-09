# 🧪 ÉTAPE 6 - TESTS NON-RÉGRESSION MULTI-DEVISE

## 📋 OBJECTIF

Valider que l'implémentation EUR/CHF fonctionne correctement sans régressions sur le système existant.

---

## 🚀 EXÉCUTION

### Méthode 1 : Script automatisé
```bash
node _tests_non_regression_multi_devise.js
```

### Méthode 2 : NPM script (à ajouter dans package.json)
```bash
npm run test:multi-devise
```

---

## 📊 GROUPES DE TESTS

### **GROUPE 1 : STRUCTURE TABLES** (4 tests)
Vérifie que les colonnes `currency` existent sur toutes les tables cibles :
- ✅ Test 1.1 : `regies.currency`
- ✅ Test 1.2 : `entreprises.currency`
- ✅ Test 1.3 : `factures.currency` + colonnes générées
- ✅ Test 1.4 : `locataires.regie_id`

---

### **GROUPE 2 : FONCTIONS RPC** (3 tests)
Valide les fonctions PostgreSQL avec signatures correctes :
- ✅ Test 2.1 : `calculer_montants_facture(1000, 'EUR')`
  - Montant HT : 1000€
  - TVA 20% : 200€
  - TTC : 1200€
  - Commission 2% : 20€

- ✅ Test 2.2 : `calculer_montants_facture(1000, 'CHF')`
  - Montant HT : 1000.-
  - TVA 8.1% : 81.-
  - TTC : 1081.-
  - Commission 2% : 20.-

- ✅ Test 2.3 : `get_user_regie_id()` existe

---

### **GROUPE 3 : DONNÉES EXISTANTES** (4 tests)
Analyse les données migrées :
- ✅ Test 3.1 : Régies avec devise (comptage)
- ✅ Test 3.2 : Entreprises avec devise (comptage)
- ✅ Test 3.3 : Factures avec devise (comptage)
- ✅ Test 3.4 : Répartition EUR/CHF (statistiques)

---

### **GROUPE 4 : COLONNES GÉNÉRÉES** (2 tests)
Vérifie les calculs automatiques PostgreSQL :
- ✅ Test 4.1 : Calculs TVA EUR corrects
  - Formule : `montant_tva = montant_ht * taux_tva / 100`
  - Formule : `montant_ttc = montant_ht + montant_tva`
  - Échantillon : 3 factures EUR

- ✅ Test 4.2 : Calculs TVA CHF corrects
  - Même formule avec taux_tva = 8.1%
  - Échantillon : 3 factures CHF

---

### **GROUPE 5 : INTÉGRITÉ RÉFÉRENTIELLE** (2 tests)
Valide la cohérence des devises :
- ✅ Test 5.1 : Factures héritent devise de la régie
  - `factures.currency` = `regies.currency`
  - Échantillon : 10 factures

- ✅ Test 5.2 : Entreprises multi-régies
  - Vérifier si entreprises avec plusieurs régies
  - Cas acceptable : devise différente si multi-régies

---

### **GROUPE 6 : NON-RÉGRESSION** (3 tests)
Détecte les régressions potentielles :
- ✅ Test 6.1 : Aucune facture avec `currency NULL`
  - Post-M60A : toutes doivent avoir une devise
  - Alerte si count > 0

- ✅ Test 6.2 : Taux TVA cohérents
  - EUR → 20.00%
  - CHF → 8.1%
  - Échantillon : 20 factures

- ✅ Test 6.3 : Commission 2% (nouveau standard)
  - Post-M61B : nouvelles factures à 2%
  - Legacy 10% accepté (factures anciennes)

---

## 📈 CRITÈRES DE RÉUSSITE

| Taux de réussite | Verdict | Action |
|------------------|---------|--------|
| **100%** | ✅ Système opérationnel | Déploiement OK |
| **80-99%** | ⚠️ Erreurs mineures | Vérifier warnings |
| **< 80%** | ❌ Échec critique | Bloquer déploiement |

---

## 🔍 EXEMPLE DE SORTIE

```
╔════════════════════════════════════════╗
║  TESTS NON-RÉGRESSION MULTI-DEVISE     ║
║  EUR / CHF - Migration M60A + M61B     ║
╚════════════════════════════════════════╝

========================================
GROUPE 1: STRUCTURE TABLES
========================================

✅ TEST 1: Colonne currency existe sur table regies
✅ TEST 2: Colonne currency existe sur table entreprises
✅ TEST 3: Colonne currency existe sur table factures avec colonnes générées
✅ TEST 4: Colonne regie_id existe sur table locataires

========================================
GROUPE 2: FONCTIONS RPC
========================================

✅ TEST 5: calculer_montants_facture EUR (1000€ → TVA 20% = 200€)
✅ TEST 6: calculer_montants_facture CHF (1000.- → TVA 8.1% = 81.-)
✅ TEST 7: Fonction get_user_regie_id existe

========================================
RAPPORT FINAL - TESTS NON-RÉGRESSION
========================================

Total tests: 18
✅ Réussis: 18
Taux de réussite: 100%

✅ TOUS LES TESTS RÉUSSIS - SYSTÈME MULTI-DEVISE OPÉRATIONNEL
```

---

## 🛠️ DÉPANNAGE

### Erreur : "supabaseUrl is required"
```bash
# Vérifier .env
cat .env | grep SUPABASE

# Recharger les variables
source .env
```

### Erreur : "function not found"
```sql
-- Vérifier dans Supabase SQL Editor
SELECT proname FROM pg_proc 
WHERE proname IN ('calculer_montants_facture', 'editer_facture', 'generate_facture_from_mission');

-- Si absente : exécuter M61B_SAFE
```

### Tests échouent avec RLS
```javascript
// Le script utilise SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
// Si erreur : vérifier permissions service role
```

---

## 📁 FICHIERS LIÉS

- **Script principal** : [_tests_non_regression_multi_devise.js](_tests_non_regression_multi_devise.js)
- **Tests M61B** : [_TESTS_M61B_FACTURATION_MULTI_DEVISE.md](_TESTS_M61B_FACTURATION_MULTI_DEVISE.md)
- **Tests get_user_regie_id** : [_TESTS_get_user_regie_id.sql](_TESTS_get_user_regie_id.sql)
- **Rapport RLS** : [_RAPPORT_RLS_MULTI_DEVISE_ETAPE5.md](_RAPPORT_RLS_MULTI_DEVISE_ETAPE5.md)

---

## ✅ CHECKLIST POST-TESTS

- [ ] Tous les tests passent (taux ≥ 100%)
- [ ] Aucune facture avec `currency NULL`
- [ ] Taux TVA cohérents (20% EUR, 8.1% CHF)
- [ ] Colonnes générées calculent correctement
- [ ] Fonctions RPC accessibles
- [ ] RLS fonctionnent (isolation par entité)
- [ ] Commission 2% appliquée (nouvelles factures)
- [ ] Documentation mise à jour

---

**Date** : 2026-01-09  
**Migrations** : M60A + M61B  
**Statut** : ✅ PRÊT POUR EXÉCUTION
