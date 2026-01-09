# 🧪 TESTS M61B - LOGIQUE FACTURATION MULTI-DEVISE

## ✅ PRÉREQUIS

Exécuter d'abord :
- Migration M60A (structure multi-devise)
- Migration M61B (logique facturation)

## 📋 SCÉNARIOS DE TEST

### TEST 1 : Génération facture EUR (TVA 20%)

**Contexte :**
- Régie avec currency = 'EUR'
- Mission terminée appartenant à cette régie

**Requête SQL :**
```sql
-- Supposons:
-- - Une régie EUR: regie_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- - Une mission terminée: mission_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
-- - Montant HT: 1000.00 EUR

SELECT generate_facture_from_mission(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
  1000.00,
  'Test facture EUR',
  'FR76 1234 5678 9012 3456 7890 123'
);
```

**Résultat attendu :**
```json
{
  "success": true,
  "facture_id": "uuid-généré",
  "numero": "FAC-2026-0001",
  "currency": "EUR",
  "montant_ht": 1000.00,
  "taux_tva": 20.00,
  "taux_commission": 2.00,
  "message": "Facture générée avec TVA 20.0% (EUR)"
}
```

**Vérification calculs automatiques :**
```sql
SELECT 
  numero,
  currency,
  montant_ht,
  taux_tva,
  montant_tva, -- Doit être 200.00 (1000 * 20%)
  montant_ttc, -- Doit être 1200.00 (1000 + 200)
  taux_commission,
  montant_commission -- Doit être 20.00 (1000 * 2%)
FROM factures
WHERE numero = 'FAC-2026-0001';
```

**Valeurs attendues :**
- `montant_ht` = 1000.00
- `taux_tva` = 20.00
- `montant_tva` = 200.00 ✅ (calculé automatiquement)
- `montant_ttc` = 1200.00 ✅ (calculé automatiquement)
- `taux_commission` = 2.00
- `montant_commission` = 20.00 ✅ (calculé automatiquement)
- `currency` = 'EUR'

---

### TEST 2 : Génération facture CHF (TVA 8.1%)

**Contexte :**
- Régie avec currency = 'CHF'
- Mission terminée appartenant à cette régie

**Requête SQL :**
```sql
-- Supposons:
-- - Une régie CHF: regie_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
-- - Une mission terminée: mission_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
-- - Montant HT: 1000.00 CHF

SELECT generate_facture_from_mission(
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
  1000.00,
  'Test facture CHF',
  'CH93 0076 2011 6238 5295 7'
);
```

**Résultat attendu :**
```json
{
  "success": true,
  "facture_id": "uuid-généré",
  "numero": "FAC-2026-0002",
  "currency": "CHF",
  "montant_ht": 1000.00,
  "taux_tva": 8.1,
  "taux_commission": 2.00,
  "message": "Facture générée avec TVA 8.1% (CHF)"
}
```

**Vérification calculs automatiques :**
```sql
SELECT 
  numero,
  currency,
  montant_ht,
  taux_tva,
  montant_tva, -- Doit être 81.00 (1000 * 8.1%)
  montant_ttc, -- Doit être 1081.00 (1000 + 81)
  taux_commission,
  montant_commission -- Doit être 20.00 (1000 * 2%)
FROM factures
WHERE numero = 'FAC-2026-0002';
```

**Valeurs attendues :**
- `montant_ht` = 1000.00
- `taux_tva` = 8.10
- `montant_tva` = 81.00 ✅ (calculé automatiquement)
- `montant_ttc` = 1081.00 ✅ (calculé automatiquement)
- `taux_commission` = 2.00
- `montant_commission` = 20.00 ✅ (calculé automatiquement)
- `currency` = 'CHF'

---

### TEST 3 : Édition facture EUR (recalcul TVA)

**Contexte :**
- Facture EUR existante (créée par TEST 1)
- Modification du montant HT

**Requête SQL :**
```sql
-- Supposons facture_id de TEST 1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
-- Nouveau montant HT: 1500.00 EUR

SELECT editer_facture(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::UUID,
  1500.00,
  'Montant ajusté après révision',
  'FR76 1234 5678 9012 3456 7890 123'
);
```

**Résultat attendu :**
```json
{
  "success": true,
  "facture_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  "montant_ht": 1500.00,
  "taux_tva": 20.00,
  "montant_tva": 300.00,
  "montant_ttc": 1800.00,
  "montant_commission": 30.00,
  "currency": "EUR",
  "updated_at": "timestamp-actuel"
}
```

**Vérification :**
```sql
SELECT 
  numero,
  montant_ht,
  montant_tva, -- Doit être 300.00 (1500 * 20%)
  montant_ttc, -- Doit être 1800.00 (1500 + 300)
  montant_commission, -- Doit être 30.00 (1500 * 2%)
  currency,
  notes
FROM factures
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
```

**Valeurs attendues :**
- `montant_ht` = 1500.00
- `montant_tva` = 300.00 ✅ (recalculé automatiquement)
- `montant_ttc` = 1800.00 ✅ (recalculé automatiquement)
- `montant_commission` = 30.00 ✅ (recalculé automatiquement)
- `currency` = 'EUR' (inchangé)
- `notes` = 'Montant ajusté après révision'

---

### TEST 4 : Helper calculer_montants_facture (frontend)

**Contexte :**
- Fonction utilitaire pour calcul côté client
- Test avec EUR et CHF

**Requête SQL (EUR) :**
```sql
SELECT calculer_montants_facture(250.50, 'EUR');
```

**Résultat attendu (EUR) :**
```json
{
  "currency": "EUR",
  "montant_ht": 250.50,
  "taux_tva": 20.00,
  "montant_tva": 50.10,
  "taux_commission": 2.00,
  "montant_commission": 5.01,
  "montant_ttc": 300.60
}
```

**Requête SQL (CHF) :**
```sql
SELECT calculer_montants_facture(250.50, 'CHF');
```

**Résultat attendu (CHF) :**
```json
{
  "currency": "CHF",
  "montant_ht": 250.50,
  "taux_tva": 8.10,
  "montant_tva": 20.29,
  "taux_commission": 2.00,
  "montant_commission": 5.01,
  "montant_ttc": 270.79
}
```

**Calculs détaillés :**

**Pour EUR :**
- TVA : 250.50 × 20% = 50.10 ✅
- Commission : 250.50 × 2% = 5.01 ✅
- TTC : 250.50 + 50.10 = 300.60 ✅

**Pour CHF :**
- TVA : 250.50 × 8.1% = 20.2905 → arrondi 20.29 ✅
- Commission : 250.50 × 2% = 5.01 ✅
- TTC : 250.50 + 20.29 = 270.79 ✅

---

## 🔒 TESTS DE SÉCURITÉ

### TEST 5 : Refus accès non autorisé

**Requête SQL (utilisateur non propriétaire) :**
```sql
-- Simuler connexion utilisateur A tentant d'accéder à facture utilisateur B
-- Doit échouer avec "Accès refusé"

SELECT generate_facture_from_mission(
  'mission-appartenant-a-autre-entreprise'::UUID,
  1000.00,
  'Tentative non autorisée',
  'CH93 0076 2011 6238 5295 7'
);
```

**Résultat attendu :**
```
ERREUR: Accès refusé : vous n'êtes pas autorisé à créer une facture pour cette mission
```

### TEST 6 : Refus édition facture payée

**Requête SQL :**
```sql
-- Marquer facture comme payée
UPDATE factures SET statut = 'payee' WHERE id = 'facture-test-id';

-- Tenter édition
SELECT editer_facture('facture-test-id'::UUID, 2000.00, NULL, NULL);
```

**Résultat attendu :**
```
ERREUR: Impossible de modifier une facture avec statut payee
```

---

## 📊 RÉCAPITULATIF FORMULES

### Colonnes GENERATED (auto-calculées)

```sql
montant_tva = montant_ht * taux_tva / 100
montant_ttc = montant_ht + (montant_ht * taux_tva / 100)
montant_commission = montant_ht * taux_commission / 100
```

### Taux appliqués

| Devise | TVA   | Commission |
|--------|-------|------------|
| EUR    | 20%   | 2%         |
| CHF    | 8.1%  | 2%         |

---

## ✅ CHECKLIST VALIDATION

- [ ] TEST 1 : Facture EUR créée avec TVA 20%
- [ ] TEST 2 : Facture CHF créée avec TVA 8.1%
- [ ] TEST 3 : Édition facture recalcule automatiquement
- [ ] TEST 4 : Helper retourne calculs corrects EUR/CHF
- [ ] TEST 5 : Accès non autorisé refusé
- [ ] TEST 6 : Facture payée non modifiable
- [ ] Colonnes GENERATED calculent automatiquement
- [ ] Devise héritée correctement de la régie
- [ ] Numérotation unique par année
- [ ] Commission 2% appliquée (JETC standard)

---

**Date :** 2026-01-09
**Migration :** M61B_SAFE
**Statut :** Prêt pour exécution
