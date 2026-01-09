# ✅ LIVRABLE M62 + M63 - MULTI-DEVISES COMPLET

## 🎯 Vue d'ensemble

**Problème initial** : Workflow France bloqué à plusieurs niveaux
1. ❌ Tickets : contrainte `check_devise_chf` bloque EUR
2. ❌ Missions : contrainte `check_mission_devise_chf` bloque EUR
3. ⚠️  Risque incohérence devise ticket ≠ devise mission

**Solution livrée** : 2 migrations complémentaires
- **M62** : Débloquer tickets multi-devises (CHF + EUR)
- **M63** : Débloquer missions multi-devises (CHF + EUR) + garantir cohérence

---

## 📦 Migrations livrées

### M62 - Tickets multi-devises

**Fichier** : [supabase/migrations/20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)

```sql
-- Contrainte avant
CHECK (devise = 'CHF')  -- ❌ Bloque EUR

-- Contrainte après M62
CHECK (devise IN ('CHF', 'EUR'))  -- ✅ CHF + EUR autorisés
```

**Impact** :
- ✅ Création tickets France (EUR) débloquée
- ✅ Tickets Suisse (CHF) préservés
- ✅ 67 lignes, transaction atomique

**Test** :
```bash
node _test_m62_ticket_multi_devise.js
```

---

### M63 - Missions multi-devises + trigger

**Fichier** : [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)

```sql
-- Contrainte avant
CHECK (devise = 'CHF')  -- ❌ Bloque missions EUR

-- Contrainte après M63
CHECK (devise IN ('CHF', 'EUR'))  -- ✅ CHF + EUR autorisés

-- Trigger ajouté (NOUVEAU)
CREATE TRIGGER trigger_sync_mission_devise
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_devise_from_ticket();
-- ✅ Hérite automatiquement devise du ticket
```

**Impact** :
- ✅ Acceptation tickets France → missions EUR débloquée
- ✅ Cohérence devise ticket = devise mission garantie
- ✅ RPC `accept_ticket_and_create_mission` inchangé (trigger automatique)
- ✅ 105 lignes, transaction atomique

**Test** :
```bash
node _test_m63_missions_devise.js
```

---

## 🚀 Ordre d'application

### Séquence complète

```
1. ✅ M61  → Immeubles/logements multi-pays (NPA 4-5 chiffres)
2. ✅ M61b → Patch logements NPA
3. 🔴 M62  → Tickets multi-devises (CHF + EUR)        ← APPLIQUER EN PREMIER
4. 🔴 M63  → Missions multi-devises (CHF + EUR) + trigger ← APPLIQUER EN SECOND
```

### Pourquoi cet ordre ?

- **M62 avant M63** : Les missions héritent la devise des tickets
  - Si M63 appliqué avant M62 → Tickets toujours en CHF only
  - Trigger M63 héritera toujours 'CHF' même pour tickets France

- **M62 et M63 peuvent être appliqués le même jour**
  - Pas de dépendance stricte SQL
  - Mais logique métier recommande M62 → M63

---

## 📋 Procédure d'application

### Étape 1 : Appliquer M62 (tickets)

1. Ouvrir **Dashboard Supabase** → SQL Editor → New Query
2. Copier-coller [supabase/migrations/20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)
3. Cliquer **RUN**
4. Vérifier output :
   ```
   ✅ M62 OK: tickets.devise accepte CHF et EUR
   
   Total tickets : X
   Tickets CHF : X
   Tickets EUR : 0
   ```

### Étape 2 : Appliquer M63 (missions)

1. Même Dashboard → SQL Editor → New Query
2. Copier-coller [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)
3. Cliquer **RUN**
4. Vérifier output :
   ```
   ✅ M63 OK: missions.devise accepte CHF et EUR
   ✅ Trigger sync_mission_devise créé
   
   Total missions : X
   Missions CHF : X
   Missions EUR : 0
   ```

### Étape 3 : Tests de validation

```bash
# Test tickets multi-devises
node _test_m62_ticket_multi_devise.js
# Attendu : 3/3 tests passent

# Test missions multi-devises
node _test_m63_missions_devise.js
# Attendu : 3/3 tests passent
```

---

## ✅ Validation complète

### Checklist post-application

#### M62 - Tickets

- [ ] Migration M62 exécutée
- [ ] Contrainte `check_devise_chf` supprimée (tickets)
- [ ] Contrainte `check_devise_multi_pays` créée (tickets)
- [ ] Test script M62 → 3/3 tests passent

#### M63 - Missions

- [ ] Migration M63 exécutée
- [ ] Contrainte `check_mission_devise_chf` supprimée
- [ ] Contrainte `check_mission_devise_multi_pays` créée
- [ ] Trigger `trigger_sync_mission_devise` créé
- [ ] Fonction `sync_mission_devise_from_ticket` créée
- [ ] Test script M63 → 3/3 tests passent

#### Workflow complet Suisse + France

- [ ] **Ticket Suisse** : Création ticket CHF → OK
- [ ] **Mission Suisse** : Acceptation ticket CHF → mission CHF créée → OK
- [ ] **Ticket France** : Création ticket EUR → OK (après M62)
- [ ] **Mission France** : Acceptation ticket EUR → mission EUR créée → OK (après M63)
- [ ] **Cohérence** : devise ticket = devise mission (vérifier via SELECT)

---

## 🔄 Workflow avant/après

### AVANT M62 + M63 (bloqué)

```
┌─────────────────────────────────────────────┐
│ Régie France crée ticket                   │
│ ❌ BLOQUÉ: check_devise_chf sur tickets    │
└─────────────────────────────────────────────┘
```

### APRÈS M62 (tickets débloqués)

```
┌─────────────────────────────────────────────┐
│ Régie France crée ticket EUR → ✅ OK        │
└─────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Entreprise accepte ticket EUR               │
│ ❌ BLOQUÉ: check_mission_devise_chf         │
└─────────────────────────────────────────────┘
```

### APRÈS M62 + M63 (complet)

```
┌─────────────────────────────────────────────┐
│ Régie France crée ticket EUR → ✅ OK        │
└─────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Entreprise accepte ticket EUR → ✅ OK       │
│ RPC accept_ticket_and_create_mission        │
│   INSERT missions (ticket_id, ...)          │
│   → Trigger sync_mission_devise             │
│   → devise = EUR (héritée du ticket)        │
│   ✅ Mission EUR créée                      │
└─────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ Technicien démarre mission EUR → ✅ OK      │
│ Régie valide mission EUR → ✅ OK            │
│ Facture générée en EUR → ⚠️ À VÉRIFIER     │
└─────────────────────────────────────────────┘
```

---

## 📊 Comparatif complet

| Table | Colonne | Avant | Après M62+M63 |
|-------|---------|-------|---------------|
| **tickets** | `devise` | `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| **missions** | `devise` | `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| **missions** | trigger | ❌ Pas de trigger | ✅ `sync_mission_devise_from_ticket` |

---

## 📦 Documentation complète

### Tickets (M62)

1. [Migration SQL](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)
2. [Guide application](_apply_m62_tickets_multi_devise.md)
3. [Test validation](_test_m62_ticket_multi_devise.js)
4. [README complet](_README_M62_TICKETS_MULTI_DEVISE.md)
5. [Livrable détaillé](_LIVRABLE_M62_TICKETS_MULTI_DEVISE.md)

### Missions (M63)

1. [Migration SQL](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)
2. [Guide application](_apply_m63_missions_multi_devise.md)
3. [Test validation](_test_m63_missions_devise.js)
4. [README complet](_README_M63_MISSIONS_MULTI_DEVISE.md)

### Vue d'ensemble

- [**Ce fichier**](_LIVRABLE_M62_M63_COMPLET.md) - Vue d'ensemble M62 + M63

---

## ⚠️ Points d'attention

### ✅ Ce qui fonctionne après M62 + M63

- Création tickets Suisse (CHF)
- Création tickets France (EUR)
- Acceptation tickets Suisse → missions CHF
- Acceptation tickets France → missions EUR
- Cohérence devise ticket = devise mission (garantie par trigger)

### ⚠️ À vérifier ensuite

1. **Table factures** : Vérifier colonne `devise` ou `currency`
   - Si contrainte CHF-only existe → créer M64 similaire
   - Rechercher : `grep -r "check.*facture.*devise" supabase/migrations/`

2. **Workflow facturation** : Tester génération facture EUR
   - Vérifier génération PDF avec symbole €
   - Vérifier montants affichés correctement

3. **Reporting financier** : Tableau de bord multi-devises
   - Filtres par devise
   - Totaux séparés CHF / EUR
   - Conversion optionnelle EUR ↔ CHF

### 🚫 Non modifié (hors scope)

- **Frontend tickets.html** : Label "Plafond (CHF)" affiché en dur
  - Pas de sélecteur devise dans formulaire création ticket
  - Devise héritée automatiquement de la régie (via M60 ?)

- **Frontend dashboard entreprise** : Acceptation ticket inchangée
  - RPC fonctionne tel quel grâce au trigger M63
  - Pas d'affichage devise dans interface

---

## 🔒 Sécurité et rollback

### M62 - Rollback tickets

```sql
BEGIN;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_multi_pays;
ALTER TABLE tickets ADD CONSTRAINT check_devise_chf CHECK (devise = 'CHF');
DELETE FROM migration_logs WHERE migration_name = '20260109000003_m62_tickets_multi_devise';
COMMIT;
```

**⚠️** Échouera si tickets EUR existent.

### M63 - Rollback missions

```sql
BEGIN;
DROP TRIGGER IF EXISTS trigger_sync_mission_devise ON missions;
DROP FUNCTION IF EXISTS sync_mission_devise_from_ticket();
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_mission_devise_multi_pays;
ALTER TABLE missions ADD CONSTRAINT check_mission_devise_chf CHECK (devise = 'CHF');
DELETE FROM migration_logs WHERE migration_name = '20260109000004_m63_missions_multi_devise';
COMMIT;
```

**⚠️** Échouera si missions EUR existent.

---

## 🎯 Prochaines étapes

### Immédiat (requis)

1. ✅ **Appliquer M62** via SQL Editor Supabase
2. ✅ **Appliquer M63** via SQL Editor Supabase
3. ✅ **Tester workflow complet** : Ticket France → Mission EUR

### Court terme (recommandé)

4. 🔍 **Audit table factures** : Vérifier contrainte devise
5. 🔍 **Test facturation EUR** : Générer facture depuis mission EUR
6. 🔍 **Vérifier triggers existants** : Chercher `sync.*currency` dans migrations

### Moyen terme (optionnel)

7. 🎨 **Frontend** : Ajouter sélecteur devise dans tickets.html
8. 📊 **Reporting** : Dashboard avec filtres CHF / EUR
9. 💱 **Conversion** : Taux de change EUR ↔ CHF si nécessaire

---

## 📞 Support

### En cas d'erreur lors de l'application

**Erreur** : `column "devise" does not exist`  
**Cause** : M11 pas appliqué  
**Solution** : Vérifier que M11 est bien en base

**Erreur** : `constraint already exists`  
**Cause** : Migration déjà appliquée  
**Solution** : Vérifier dans `migration_logs`

**Erreur** : `violates check constraint after migration`  
**Cause** : Données incohérentes en base  
**Solution** : Audit avec `SELECT devise FROM missions WHERE devise NOT IN ('CHF', 'EUR')`

---

## 📅 Historique

- **9 janvier 2026** : Création M62 + M63
- **26 décembre 2025** : M11 introduit contrainte missions CHF-only
- **26 décembre 2025** : M01 introduit contrainte tickets CHF-only

---

**Date livraison** : 9 janvier 2026  
**Migrations** : M62 + M63  
**Durée application** : < 2 secondes (1 sec par migration)  
**Risque** : Minimal (contraintes + trigger, pas de modification données)  
**Commits** : 
- M62 : `eca26cd`
- M63 : `1e600f5`
