# 🧪 RÉSUMÉ ÉTAPE 6 - TESTS NON-RÉGRESSION

## ✅ LIVRABLES CRÉÉS

### 1. **Script de tests automatisé**
- **Fichier** : [_tests_non_regression_multi_devise.js](_tests_non_regression_multi_devise.js)
- **Contenu** : 18 tests répartis en 6 groupes
- **Exécution** : `node _tests_non_regression_multi_devise.js`

### 2. **Guide d'utilisation**
- **Fichier** : [_GUIDE_TESTS_ETAPE6.md](_GUIDE_TESTS_ETAPE6.md)
- **Contenu** : Documentation complète des tests, critères de réussite, dépannage

---

## 📊 GROUPES DE TESTS

| Groupe | Tests | Description |
|--------|-------|-------------|
| **1. Structure** | 4 | Vérification colonnes `currency` sur regies/entreprises/factures/locataires |
| **2. RPC Functions** | 3 | Validation fonctions PostgreSQL (signatures, calculs EUR/CHF) |
| **3. Données existantes** | 4 | Analyse données migrées (comptage, répartition EUR/CHF) |
| **4. Colonnes générées** | 2 | Vérification calculs automatiques montant_tva/montant_ttc |
| **5. Intégrité** | 2 | Cohérence devise entre factures/régies/entreprises |
| **6. Non-régression** | 3 | Détection régressions (currency NULL, taux TVA, commissions) |
| **TOTAL** | **18** | **Tests automatisés complets** |

---

## ⚠️ EXÉCUTION REQUISE MANUELLEMENT

Le script nécessite les variables d'environnement Supabase :

```bash
# 1. Vérifier .env
cat .env | grep SUPABASE

# Si vide, copier depuis .env.example et remplir
cp .env.example .env
nano .env

# 2. Variables requises
VITE_SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# 3. Exécuter tests
node _tests_non_regression_multi_devise.js
```

---

## 🎯 TESTS MANUELS SQL (ALTERNATIVE)

Si impossible d'exécuter le script Node.js, utiliser ces requêtes SQL dans Supabase SQL Editor :

### **Test 1 : Vérifier structure**
```sql
-- Colonnes currency existent
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'currency';
```

### **Test 2 : Fonctions RPC**
```sql
-- Test EUR
SELECT * FROM calculer_montants_facture(1000, 'EUR');

-- Test CHF
SELECT * FROM calculer_montants_facture(1000, 'CHF');
```

### **Test 3 : Données existantes**
```sql
-- Répartition factures par devise
SELECT currency, COUNT(*) as nb
FROM factures
GROUP BY currency;
```

### **Test 4 : Colonnes générées**
```sql
-- Vérifier calculs EUR (TVA 20%)
SELECT 
  numero,
  montant_ht,
  taux_tva,
  montant_tva,
  montant_ht * taux_tva / 100 AS expected_tva,
  ABS(montant_tva - (montant_ht * taux_tva / 100)) AS diff
FROM factures
WHERE currency = 'EUR'
LIMIT 5;
```

### **Test 5 : Non-régression**
```sql
-- Factures sans devise (doit être 0)
SELECT COUNT(*) FROM factures WHERE currency IS NULL;

-- Taux TVA incohérents
SELECT numero, currency, taux_tva
FROM factures
WHERE (currency = 'EUR' AND taux_tva != 20.00)
   OR (currency = 'CHF' AND taux_tva != 8.1);
```

---

## ✅ VALIDATION ÉTAPE 6

### **Checklist finale**

- [x] Script de tests créé (_tests_non_regression_multi_devise.js)
- [x] Guide utilisateur créé (_GUIDE_TESTS_ETAPE6.md)
- [x] 18 tests définis (6 groupes)
- [x] Alternative SQL manuelle fournie
- [ ] **ACTION UTILISATEUR** : Configurer .env et exécuter tests
- [ ] **ACTION UTILISATEUR** : Valider taux réussite ≥ 100%

---

## 🚀 PROCHAINES ÉTAPES

1. **Configurer variables d'environnement**
   ```bash
   cp .env.example .env
   # Remplir VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Exécuter suite de tests**
   ```bash
   node _tests_non_regression_multi_devise.js
   ```

3. **Analyser rapport**
   - Taux réussite 100% → ✅ Déploiement OK
   - Taux 80-99% → ⚠️ Vérifier warnings
   - Taux < 80% → ❌ Bloquer déploiement

4. **Si tests échouent** : Utiliser tests SQL manuels ci-dessus

---

## 📁 FICHIERS FINAUX

| Fichier | Description | Statut |
|---------|-------------|--------|
| [_tests_non_regression_multi_devise.js](_tests_non_regression_multi_devise.js) | Script Node.js automatisé | ✅ Créé |
| [_GUIDE_TESTS_ETAPE6.md](_GUIDE_TESTS_ETAPE6.md) | Documentation complète | ✅ Créé |
| [_TESTS_M61B_FACTURATION_MULTI_DEVISE.md](_TESTS_M61B_FACTURATION_MULTI_DEVISE.md) | Tests RPC détaillés | ✅ Créé |
| [_TESTS_get_user_regie_id.sql](_TESTS_get_user_regie_id.sql) | Tests fonction helper | ✅ Créé |
| [_RAPPORT_RLS_MULTI_DEVISE_ETAPE5.md](_RAPPORT_RLS_MULTI_DEVISE_ETAPE5.md) | Analyse RLS | ✅ Créé |

---

**Date** : 2026-01-09  
**Étape** : 6/6 - Tests non-régression  
**Statut** : ✅ **LIVRABLES COMPLETS - PRÊT POUR VALIDATION UTILISATEUR**
