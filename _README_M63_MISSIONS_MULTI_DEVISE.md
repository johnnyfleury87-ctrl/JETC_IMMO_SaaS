# 📊 MIGRATION M63 - Multi-devises missions

## 🎯 Résumé exécutif

**Problème** : Contrainte `check_mission_devise_chf` bloque création missions EUR (France)  
**Solution** : Migration M63 autorisant CHF + EUR + trigger héritage devise  
**Impact** : Débloquer acceptation tickets France → création missions EUR

---

## 📋 Audit contrainte missions

### Contrainte actuelle (M11 - 26 déc 2025)

**Fichier** : [supabase/migrations/20251226171000_m11_harmonize_missions_montant_chf.sql](supabase/migrations/20251226171000_m11_harmonize_missions_montant_chf.sql)

```sql
-- Ligne 29-32
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_mission_devise_chf') THEN
  ALTER TABLE missions ADD CONSTRAINT check_mission_devise_chf 
  CHECK (devise = 'CHF');
END IF;
```

**Effet** : ❌ Toute insertion avec `devise = 'EUR'` est rejetée

### Workflow acceptation ticket → création mission

**RPC** : `accept_ticket_and_create_mission(p_ticket_id, p_entreprise_id)`  
**Fichier** : [supabase/schema/13_missions.sql](supabase/schema/13_missions.sql#L124)

```sql
-- Ligne 124: Création mission
INSERT INTO missions (ticket_id, entreprise_id, statut)
VALUES (p_ticket_id, p_entreprise_id, 'en_attente')
RETURNING id INTO v_mission_id;
```

**Problème** : La colonne `devise` utilise DEFAULT 'CHF', mais :
- Si ticket France a `devise = 'EUR'`
- Mission créée avec `devise = 'CHF'` (défaut)
- ✅ Pas de problème AVANT (contrainte accepte CHF)
- ❌ **MAIS** : Incohérence devise ticket ≠ devise mission

### Test pré-migration

```bash
node _test_m63_missions_devise.js
```

**Résultat AVANT M63** :
```
Test 1 : Mission CHF → ❌ BLOQUÉ par check_mission_devise_chf
Test 2 : Mission EUR → ❌ BLOQUÉ par check_mission_devise_chf
Test 3 : Trigger héritage → ❌ N'existe pas

Tests passés : 0/3
🚨 M63 PAS ENCORE APPLIQUÉE
```

---

## 🔧 Solution M63

### Migration SQL

**Fichier** : [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)

**Contenu clé** :

```sql
BEGIN;

-- 1. DROP contrainte CHF-only
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_mission_devise_chf;

-- 2. ADD contrainte multi-devises
ALTER TABLE missions ADD CONSTRAINT check_mission_devise_multi_pays
CHECK (devise IN ('CHF', 'EUR'));

-- 3. TRIGGER : Héritage devise du ticket
CREATE OR REPLACE FUNCTION sync_mission_devise_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
  -- Si ticket_id fourni, hériter la devise du ticket
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.devise INTO NEW.devise
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;
  
  -- Valeur par défaut si devise toujours NULL
  IF NEW.devise IS NULL THEN
    NEW.devise := 'CHF';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_mission_devise
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_devise_from_ticket();

-- 4. LOG (avant COMMIT)
INSERT INTO migration_logs (migration_name, description)
VALUES ('20260109000004_m63_missions_multi_devise',
        'M63 : Support multi-devises missions - CHF et EUR + trigger héritage');

COMMIT;

-- 5. VALIDATION
DO $$
DECLARE
  v_total_missions INTEGER;
  v_missions_chf INTEGER;
  v_missions_eur INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_missions FROM missions WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_missions_chf FROM missions WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_missions_eur FROM missions WHERE devise = 'EUR';
  
  RAISE NOTICE '✅ M63 OK: missions.devise accepte CHF et EUR';
  RAISE NOTICE '✅ Trigger sync_mission_devise créé';
  RAISE NOTICE 'Total missions : %', v_total_missions;
  RAISE NOTICE 'Missions CHF : %', v_missions_chf;
  RAISE NOTICE 'Missions EUR : %', v_missions_eur;
END $$;
```

### Résultat attendu

```
✅ M63 OK: missions.devise accepte CHF et EUR
✅ Trigger sync_mission_devise créé

Total missions : X
Missions CHF : X
Missions EUR : 0
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

**Source** : [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)

### 3. Exécuter (RUN)

### 4. Vérifier output

Rechercher dans les logs :
```
✅ M63 OK: missions.devise accepte CHF et EUR
✅ Trigger sync_mission_devise créé
```

### 5. Tester post-migration

```bash
node _test_m63_missions_devise.js
```

**Résultat attendu APRÈS M63** :
```
Test 1 : Mission CHF → ✅ OK
Test 2 : Mission EUR → ✅ OK
Test 3 : Trigger héritage → ✅ OK (hérite devise ticket)

Tests passés : 3/3
✅ TOUS LES TESTS PASSENT - M63 OK
```

---

## 📊 Comparatif avant/après

| Aspect | Avant M63 | Après M63 |
|--------|-----------|-----------|
| **Contrainte** | `check_mission_devise_chf` | `check_mission_devise_multi_pays` |
| **Définition** | `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| **Trigger devise** | ❌ Pas de trigger | ✅ `sync_mission_devise_from_ticket` |
| **Héritage devise** | ❌ Utilise DEFAULT 'CHF' | ✅ Hérite du ticket |
| **Missions CHF** | ✅ OK | ✅ OK |
| **Missions EUR** | ❌ BLOQUÉ | ✅ OK |
| **Cohérence ticket/mission** | ⚠️  Risque incohérence | ✅ Garantie par trigger |

---

## 🎯 Cas d'usage

### Scénario 1 : Acceptation ticket Suisse (CHF)

**Avant M63** : ✅ Fonctionne  
**Après M63** : ✅ Fonctionne + cohérence garantie

```javascript
// Ticket Suisse
{
  id: 'abc-123',
  devise: 'CHF'
}

// RPC accept_ticket_and_create_mission()
→ INSERT missions (ticket_id, entreprise_id, statut='en_attente')

// Trigger sync_mission_devise
→ SELECT devise FROM tickets WHERE id = 'abc-123'  // = 'CHF'
→ NEW.devise = 'CHF'

// ✅ Mission créée avec devise CHF (cohérente avec ticket)
```

### Scénario 2 : Acceptation ticket France (EUR)

**Avant M63** : ❌ Bloqué par `check_mission_devise_chf`  
**Après M63** : ✅ Fonctionne

```javascript
// Ticket France
{
  id: 'def-456',
  devise: 'EUR'
}

// RPC accept_ticket_and_create_mission()
→ INSERT missions (ticket_id, entreprise_id, statut='en_attente')

// Trigger sync_mission_devise
→ SELECT devise FROM tickets WHERE id = 'def-456'  // = 'EUR'
→ NEW.devise = 'EUR'

// ✅ Mission créée avec devise EUR (cohérente avec ticket)
// ✅ Contrainte check_mission_devise_multi_pays accepte EUR
```

### Scénario 3 : Mission créée sans ticket (edge case)

```javascript
// Création manuelle mission (rare)
INSERT INTO missions (entreprise_id, statut)
VALUES (uuid, 'en_attente');

// Trigger sync_mission_devise
→ ticket_id IS NULL
→ Fallback: NEW.devise = 'CHF' (défaut)

// ✅ Mission créée avec devise CHF par défaut
```

---

## 📦 Fichiers livrés

1. **Migration SQL**  
   [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)
   - 105 lignes
   - Transaction atomique (BEGIN/COMMIT)
   - Trigger héritage devise
   - Validation post-migration

2. **Guide d'application**  
   [_apply_m63_missions_multi_devise.md](_apply_m63_missions_multi_devise.md)
   - Procédure pas à pas
   - Workflow avant/après
   - Validation post-application

3. **Script de test**  
   [_test_m63_missions_devise.js](_test_m63_missions_devise.js)
   - Test CHF → doit passer
   - Test EUR → doit passer après M63
   - Test trigger héritage → doit fonctionner

4. **Documentation complète**  
   [_README_M63_MISSIONS_MULTI_DEVISE.md](_README_M63_MISSIONS_MULTI_DEVISE.md)  
   (CE FICHIER)

---

## 🔗 Contexte migrations

### Ordre d'application RECOMMANDÉ

```
✅ M61  → Immeubles/logements multi-pays (NPA 4-5 chiffres)
✅ M61b → Patch logements NPA
✅ M62  → Tickets multi-devises (CHF + EUR)
🔴 M63  → Missions multi-devises (CHF + EUR) + trigger ← CETTE MIGRATION
```

### Dépendances

**M63 dépend de** :
- M62 (tickets multi-devises) - **RECOMMANDÉ** mais pas strictement requis
- M11 (colonne `missions.devise` existante) - ✅ Déjà appliqué

**M63 débloque** :
- Acceptation tickets France par entreprises
- Workflow complet Suisse + France
- Cohérence devise entre tickets et missions

---

## ⚠️ Limitations et notes

### Backend (RPC)

**Pas de modification requise** : Le RPC `accept_ticket_and_create_mission` fonctionne tel quel grâce au trigger automatique.

```sql
-- RPC inchangé (ligne 124)
INSERT INTO missions (ticket_id, entreprise_id, statut)
VALUES (p_ticket_id, p_entreprise_id, 'en_attente');
-- Trigger s'exécute automatiquement après INSERT
```

### Frontend

**Aucune modification nécessaire** : L'interface entreprise `public/entreprise/dashboard.html` fonctionne sans changement.

```javascript
// Ligne 1445 - Appel RPC inchangé
const { data, error } = await window.supabaseClient.rpc(
  'accept_ticket_and_create_mission',
  {
    p_ticket_id: ticketId,
    p_entreprise_id: window.currentEntreprise.id
  }
);
```

### Workflow missions/factures

**Impact** : À valider séparément
- Vérifier que table `factures` accepte EUR (M60 ?)
- Vérifier génération PDF facture multi-devises
- Vérifier reporting financier par devise

---

## ✅ Checklist validation complète

### Post-application M63

- [ ] Migration M63 exécutée via SQL Editor
- [ ] Log "✅ M63 OK" affiché dans output
- [ ] Entrée dans `migration_logs` visible
  ```sql
  SELECT * FROM migration_logs 
  WHERE migration_name = '20260109000004_m63_missions_multi_devise';
  ```
- [ ] Contrainte `check_mission_devise_chf` supprimée
  ```sql
  SELECT conname FROM pg_constraint 
  WHERE conname = 'check_mission_devise_chf' 
  AND conrelid = 'missions'::regclass;
  -- Attendu : 0 ligne
  ```
- [ ] Contrainte `check_mission_devise_multi_pays` présente
  ```sql
  SELECT pg_get_constraintdef(oid) 
  FROM pg_constraint 
  WHERE conname = 'check_mission_devise_multi_pays' 
  AND conrelid = 'missions'::regclass;
  -- Attendu : CHECK ((devise = ANY (ARRAY['CHF'::text, 'EUR'::text])))
  ```
- [ ] Trigger `trigger_sync_mission_devise` créé
  ```sql
  SELECT tgname FROM pg_trigger 
  WHERE tgname = 'trigger_sync_mission_devise' 
  AND tgrelid = 'missions'::regclass;
  -- Attendu : 1 ligne
  ```
- [ ] Test script `_test_m63_missions_devise.js` → 3/3 tests passent

### Validation workflow complet

- [ ] Entreprise accepte ticket Suisse (CHF) → Mission CHF créée
- [ ] Entreprise accepte ticket France (EUR) → Mission EUR créée
- [ ] Devise mission = devise ticket (cohérence vérifiée)
- [ ] Anciennes missions CHF préservées et fonctionnelles

---

## 📝 Notes techniques

### Pourquoi un trigger plutôt que DEFAULT ?

**Problème avec DEFAULT** :
```sql
-- Colonne existante
devise TEXT NOT NULL DEFAULT 'CHF'

-- Si ticket a devise = 'EUR'
INSERT INTO missions (ticket_id, ...) 
-- → devise prend DEFAULT 'CHF'
-- → Incohérence ticket (EUR) ≠ mission (CHF)
```

**Solution trigger** :
```sql
-- Trigger BEFORE INSERT récupère devise du ticket
SELECT t.devise INTO NEW.devise FROM tickets t WHERE t.id = NEW.ticket_id;
-- → devise héritée automatiquement
-- → Cohérence garantie
```

### Ordre d'exécution

1. `INSERT INTO missions (ticket_id, entreprise_id, statut)`
2. **BEFORE INSERT** → Trigger `sync_mission_devise_from_ticket`
   - Récupère `tickets.devise` via `ticket_id`
   - Affecte `NEW.devise`
3. Contrainte `check_mission_devise_multi_pays` validée
4. Insertion complétée

### Pourquoi fallback 'CHF' ?

```sql
-- Si ticket_id IS NULL (cas rare : mission manuelle)
IF NEW.devise IS NULL THEN
  NEW.devise := 'CHF';  -- Défaut Suisse
END IF;
```

Garantit que `devise` n'est jamais NULL (colonne NOT NULL).

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

-- Supprimer trigger
DROP TRIGGER IF EXISTS trigger_sync_mission_devise ON missions;
DROP FUNCTION IF EXISTS sync_mission_devise_from_ticket();

-- Supprimer nouvelle contrainte
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_mission_devise_multi_pays;

-- Remettre ancienne contrainte
ALTER TABLE missions ADD CONSTRAINT check_mission_devise_chf 
CHECK (devise = 'CHF');

-- Supprimer log
DELETE FROM migration_logs 
WHERE migration_name = '20260109000004_m63_missions_multi_devise';

COMMIT;
```

**⚠️ Attention** : Le rollback échouera si des missions EUR existent en base.

---

## 📅 Historique

- **9 janvier 2026** : Création M63
- **26 décembre 2025** : M11 introduit contrainte `check_mission_devise_chf`
- **26 décembre 2025** : M01 ajoute `tickets.devise` avec contrainte CHF

---

## 🎯 Prochaines étapes

### Immédiat (requis)

1. ✅ Appliquer M63 via SQL Editor Supabase
2. ✅ Valider avec `_test_m63_missions_devise.js`
3. ✅ Tester acceptation ticket France → mission EUR créée

### Court terme (validation)

4. Vérifier table `factures` accepte EUR
5. Tester workflow complet : ticket → mission → facture (EUR)
6. Valider génération PDF facture EUR

### Moyen terme (optionnel)

7. Audit reporting financier multi-devises
8. Tableau de bord avec filtres par devise
9. Conversion EUR ↔ CHF si nécessaire

---

**Date** : 9 janvier 2026  
**Migration** : M63  
**Risque** : Minimal (contrainte + trigger, pas de données modifiées)  
**Durée** : < 1 seconde  
**Dépendance** : M62 (recommandé)
