# ✅ M62 - PATCH TICKETS MULTI-DEVISES

## 🎯 Résumé exécutif

**Problème** : Contrainte `check_devise_chf` bloque création tickets EUR (France)  
**Solution** : Migration M62 autorisant CHF + EUR  
**Impact** : Débloquer tickets France sans casser Suisse

---

## 📋 Inspection contrainte

### Contrainte actuelle (M01 - 26 déc 2025)

```sql
ALTER TABLE tickets ADD CONSTRAINT check_devise_chf 
CHECK (devise = 'CHF');
```

**Effet** : ❌ Toute insertion avec `devise = 'EUR'` est rejetée

### Test pré-migration

```bash
node _test_m62_ticket_multi_devise.js
```

**Résultat attendu AVANT M62** :
```
Test 1 : Ticket CHF → ✅ OK
Test 2 : Ticket EUR → ❌ BLOQUÉ par check_devise_chf
Test 3 : Ticket USD → ✅ Rejeté (correct)

Tests passés : 1/3
➡️  M62 PAS ENCORE APPLIQUÉE
```

---

## 🔧 Solution M62

### Migration SQL

**Fichier** : [supabase/migrations/20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)

**Contenu clé** :
```sql
BEGIN;

-- 1. DROP contrainte CHF-only
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;

-- 2. ADD contrainte multi-devises
ALTER TABLE tickets ADD CONSTRAINT check_devise_multi_pays
CHECK (devise IN ('CHF', 'EUR'));

-- 3. LOG (avant COMMIT pour atomicité)
INSERT INTO migration_logs (migration_name, description)
VALUES ('20260109000003_m62_tickets_multi_devise', 
        'M62 : Support multi-devises tickets - CHF et EUR autorisés');

COMMIT;

-- 4. VALIDATION
DO $$
DECLARE
  v_total_tickets INTEGER;
  v_tickets_chf INTEGER;
  v_tickets_eur INTEGER;
BEGIN
  -- Compteurs
  SELECT COUNT(*) INTO v_total_tickets FROM tickets WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_tickets_chf FROM tickets WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_tickets_eur FROM tickets WHERE devise = 'EUR';
  
  RAISE NOTICE '✅ M62 OK: tickets.devise accepte CHF et EUR';
  RAISE NOTICE 'Total tickets : %', v_total_tickets;
  RAISE NOTICE 'Tickets CHF : %', v_tickets_chf;
  RAISE NOTICE 'Tickets EUR : %', v_tickets_eur;
END $$;
```

### Résultat attendu

```
✅ M62 OK: tickets.devise accepte CHF et EUR

Total tickets : X
Tickets CHF : X
Tickets EUR : 0
```

---

## 🚀 Procédure d'application

### 1. Ouvrir Dashboard Supabase

```
https://supabase.com/dashboard/project/[PROJECT_ID]
→ SQL Editor
→ New Query
```

### 2. Copier-coller le SQL

**Source** : [supabase/migrations/20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)

### 3. Exécuter (RUN)

Cliquer sur **RUN** dans SQL Editor

### 4. Vérifier output

Rechercher dans les logs :
```
✅ M62 OK: tickets.devise accepte CHF et EUR
```

### 5. Tester post-migration

```bash
node _test_m62_ticket_multi_devise.js
```

**Résultat attendu APRÈS M62** :
```
Test 1 : Ticket CHF → ✅ OK
Test 2 : Ticket EUR → ✅ OK
Test 3 : Ticket USD → ✅ Rejeté

Tests passés : 3/3
✅ TOUS LES TESTS PASSENT - M62 OK
```

---

## 📊 Comparatif avant/après

| Aspect | Avant M62 | Après M62 |
|--------|-----------|-----------|
| **Contrainte** | `check_devise_chf` | `check_devise_multi_pays` |
| **Définition** | `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| **Tickets CHF** | ✅ OK | ✅ OK |
| **Tickets EUR** | ❌ BLOQUÉ | ✅ OK |
| **Tickets USD** | ❌ BLOQUÉ | ❌ BLOQUÉ (correct) |
| **Données existantes** | Préservées | Préservées |

---

## 🎯 Cas d'usage

### Scénario 1 : Création ticket Suisse (CHF)

**Avant M62** : ✅ Fonctionne  
**Après M62** : ✅ Fonctionne

```javascript
{
  titre: "Fuite robinet",
  devise: "CHF",
  plafond_intervention_chf: 500
}
```

### Scénario 2 : Création ticket France (EUR)

**Avant M62** : ❌ Bloqué par `check_devise_chf`  
**Après M62** : ✅ Fonctionne

```javascript
{
  titre: "Fuite robinet",
  devise: "EUR",
  plafond_intervention_chf: 500  // Note: nom colonne conservé
}
```

### Scénario 3 : Tentative ticket invalide (USD)

**Avant M62** : ❌ Bloqué  
**Après M62** : ❌ Bloqué (correct - seuls CHF/EUR autorisés)

```javascript
{
  titre: "Test",
  devise: "USD"  // ❌ Rejeté par check_devise_multi_pays
}
```

---

## 📦 Fichiers livrés

1. **Migration SQL**  
   [supabase/migrations/20260109000003_m62_tickets_multi_devise.sql](supabase/migrations/20260109000003_m62_tickets_multi_devise.sql)
   - 67 lignes
   - Transaction atomique (BEGIN/COMMIT)
   - Validation post-migration incluse

2. **Guide d'application**  
   [_apply_m62_tickets_multi_devise.md](_apply_m62_tickets_multi_devise.md)
   - Procédure pas à pas
   - Captures d'écran à prévoir
   - Validation post-application

3. **Script de test**  
   [_test_m62_ticket_multi_devise.js](_test_m62_ticket_multi_devise.js)
   - Test CHF (Suisse) → doit passer
   - Test EUR (France) → doit passer après M62
   - Test USD (invalide) → doit échouer

4. **Documentation complète**  
   [_README_M62_TICKETS_MULTI_DEVISE.md](_README_M62_TICKETS_MULTI_DEVISE.md)
   - Analyse problème
   - Solution détaillée
   - Impact et compatibilité
   - Notes techniques

---

## 🔗 Contexte migrations

### Ordre d'application

```
✅ M61  → Immeubles/logements multi-pays (NPA 4-5 chiffres)
✅ M61b → Patch logements NPA (correction)
🔴 M62  → Tickets multi-devises (CHF + EUR) ← CETTE MIGRATION
```

### Migrations indépendantes

M62 peut être appliquée **indépendamment** de M61/M61b :
- Pas de dépendance directe
- Concerne uniquement table `tickets`
- N'impacte pas `immeubles` ou `logements`

---

## ⚠️ Limitations actuelles

### Frontend tickets.html

**Non modifié dans M62** (hors scope - patch minimal DB uniquement) :

```html
<!-- Ligne 659 - Actuel -->
<label for="validation-plafond">Plafond d'intervention (CHF) *</label>
```

**À adapter ultérieurement** (future migration frontend) :
```html
<!-- Futur : Sélecteur devise dynamique -->
<label for="devise">Devise *</label>
<select id="devise" name="devise">
  <option value="CHF" selected>CHF (Suisse)</option>
  <option value="EUR">EUR (France)</option>
</select>

<label for="plafond">
  Plafond d'intervention (<span id="devise-display">CHF</span>) *
</label>
<input type="number" id="plafond" name="plafond">
```

### Workflow missions/factures

**Non modifié** :
- Workflow existant `tickets → missions → factures` inchangé
- Colonne `devise` dans `missions` déjà flexible (vérifier M11)
- Facturation multi-devises à valider séparément

---

## ✅ Validation complète

### Checklist post-application

- [ ] Migration M62 exécutée via SQL Editor
- [ ] Log "✅ M62 OK" affiché dans output
- [ ] Entrée dans `migration_logs` visible
  ```sql
  SELECT * FROM migration_logs 
  WHERE migration_name = '20260109000003_m62_tickets_multi_devise';
  ```
- [ ] Test script `_test_m62_ticket_multi_devise.js` → 3/3 tests passent
- [ ] Contrainte `check_devise_chf` supprimée
  ```sql
  SELECT conname FROM pg_constraint 
  WHERE conname = 'check_devise_chf' 
  AND conrelid = 'tickets'::regclass;
  -- Attendu : 0 ligne
  ```
- [ ] Contrainte `check_devise_multi_pays` présente
  ```sql
  SELECT pg_get_constraintdef(oid) 
  FROM pg_constraint 
  WHERE conname = 'check_devise_multi_pays' 
  AND conrelid = 'tickets'::regclass;
  -- Attendu : CHECK ((devise = ANY (ARRAY['CHF'::text, 'EUR'::text])))
  ```

---

## 📝 Notes techniques

### Pourquoi IN ('CHF', 'EUR') et pas = ANY(ARRAY[...]) ?

PostgreSQL convertit automatiquement :
```sql
-- Écrit dans migration
CHECK (devise IN ('CHF', 'EUR'))

-- Stocké en base (forme normalisée)
CHECK ((devise = ANY (ARRAY['CHF'::text, 'EUR'::text])))
```

Les deux formes sont équivalentes.

### Pourquoi DROP IF EXISTS ?

Idempotence : si M62 est appliquée 2 fois par erreur, pas d'échec.

```sql
-- ✅ Idempotent
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;

-- ❌ Non-idempotent (échoue si déjà supprimée)
ALTER TABLE tickets DROP CONSTRAINT check_devise_chf;
```

### Pourquoi INSERT avant COMMIT ?

Atomicité : si le COMMIT échoue, le log n'est pas enregistré.

```sql
-- ✅ Atomique
BEGIN;
  ALTER TABLE ...
  INSERT INTO migration_logs ...
COMMIT;

-- ❌ Non-atomique (log enregistré même si ALTER échoue)
BEGIN;
  ALTER TABLE ...
COMMIT;
INSERT INTO migration_logs ...
```

---

## 🔒 Sécurité et rollback

### Transaction atomique

- ✅ `BEGIN` au début
- ✅ `COMMIT` à la fin
- ✅ Si erreur → rollback automatique

### Rollback manuel (si nécessaire)

```sql
-- Revenir à contrainte CHF-only
BEGIN;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_multi_pays;

ALTER TABLE tickets ADD CONSTRAINT check_devise_chf 
CHECK (devise = 'CHF');

DELETE FROM migration_logs 
WHERE migration_name = '20260109000003_m62_tickets_multi_devise';

COMMIT;
```

**⚠️ Attention** : Le rollback échouera si des tickets EUR existent en base.

---

## 📅 Historique

- **9 janvier 2026** : Création M62
- **M01 (26 déc 2025)** : Contrainte `check_devise_chf` introduite
- **M11 (26 déc 2025)** : Harmonisation missions (devise CHF)

---

## 🎯 Prochaines étapes

### Immédiat (requis)

1. ✅ Appliquer M62 via SQL Editor Supabase
2. ✅ Valider avec `_test_m62_ticket_multi_devise.js`

### Court terme (optionnel)

3. Adapter `tickets.html` pour sélection devise (CHF/EUR)
4. Mettre à jour labels "Plafond (CHF)" → "Plafond (devise)"
5. Valider workflow `missions` accepte EUR

### Moyen terme (optionnel)

6. Audit facturation multi-devises
7. Taux de change EUR ↔ CHF si nécessaire
8. Reporting financier par devise

---

**Date** : 9 janvier 2026  
**Migration** : M62  
**Risque** : Minimal (contrainte uniquement)  
**Durée** : < 1 seconde  
**Commit** : `eca26cd`
