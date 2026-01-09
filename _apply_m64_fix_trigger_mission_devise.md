# 🎯 APPLICATION MIGRATION M64 - Correction trigger mission devise

## Contexte

**M63 fonctionne** mais le trigger écrase systématiquement la devise, même si fournie par le backend.

**M64 corrige** ce comportement pour respecter la devise si déjà fournie.

## 🚀 Procédure

### 1. Ouvrir SQL Editor Supabase

```
Dashboard Supabase → SQL Editor → New Query
```

### 2. Copier-coller le SQL M64

Copier le contenu de [supabase/migrations/20260109000005_m64_fix_trigger_mission_devise.sql](supabase/migrations/20260109000005_m64_fix_trigger_mission_devise.sql)

### 3. Exécuter (RUN)

### 4. Vérifier output

```
✅ M64 OK: Trigger mission devise corrigé
✅ DEFAULT CHF ajouté sur missions.devise

DEFAULT value: 'CHF'::text
Total missions : X
Missions CHF : X
Missions EUR : 0

🔒 Trigger respecte devise fournie
🔒 Hérite uniquement si devise IS NULL
```

## ✅ Validation

```bash
node _test_m64_trigger_securise.js
```

**Attendu** :
```
Test 1 : Mission sans devise + ticket CHF → hérite CHF ✅
Test 2 : Mission sans devise + ticket EUR → hérite EUR ✅
Test 3 : Mission avec devise EUR + ticket CHF → garde EUR ✅
Test 4 : Mission avec devise CHF + ticket EUR → garde CHF ✅
Test 5 : Mission sans ticket → DEFAULT CHF ✅

Tests passés : 5/5
✅ TOUS LES TESTS PASSENT - M64 OK
```

## 🔄 Changements

### Trigger corrigé

**Avant M64** :
```sql
IF NEW.ticket_id IS NOT NULL THEN
  SELECT t.devise INTO NEW.devise  -- ❌ Écrase toujours
  FROM tickets t WHERE t.id = NEW.ticket_id;
END IF;
```

**Après M64** :
```sql
IF NEW.devise IS NULL AND NEW.ticket_id IS NOT NULL THEN
  SELECT t.devise INTO NEW.devise  -- ✅ Hérite uniquement si NULL
  FROM tickets t WHERE t.id = NEW.ticket_id;
END IF;
```

### DEFAULT ajouté

```sql
ALTER TABLE missions 
  ALTER COLUMN devise SET DEFAULT 'CHF';
```

## ⚠️ Impact

### ✅ Pas de breaking change

- RPC `accept_ticket_and_create_mission` fonctionne identique
- Workflow standard inchangé
- Tests M63 toujours passent

### ✅ Sécurité renforcée

- Respecte devise fournie par backend
- DEFAULT garantit aucune devise NULL
- Double protection (DEFAULT + trigger)

---

**Ordre migrations** : M61 → M61b → M62 → M63 → **M64**  
**Durée** : < 1 seconde  
**Risque** : Aucun
