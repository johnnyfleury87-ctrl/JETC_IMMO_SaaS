# 🎯 APPLICATION MIGRATION M63 - Multi-devises missions

## Contexte

**Problème rencontré** : Lors de l'acceptation d'un ticket, la création de mission échoue avec :

```
"new row for relation 'missions' violates check constraint 'check_mission_devise_chf'"
```

**Cause** : Contrainte `check_mission_devise_chf` sur table `missions` impose `devise = 'CHF'` uniquement.

```sql
-- Contrainte actuelle (M11)
ALTER TABLE missions ADD CONSTRAINT check_mission_devise_chf 
CHECK (devise = 'CHF');  -- ❌ Bloque missions EUR
```

## Solution M63

Migration qui :
1. Remplace contrainte CHF-only par multi-devises (CHF + EUR)
2. Ajoute trigger d'héritage automatique devise du ticket

### Modification

```sql
-- 1. Supprimer contrainte CHF-only
ALTER TABLE missions DROP CONSTRAINT IF EXISTS check_mission_devise_chf;

-- 2. Ajouter contrainte multi-devises
ALTER TABLE missions ADD CONSTRAINT check_mission_devise_multi_pays
CHECK (devise IN ('CHF', 'EUR'));

-- 3. Trigger héritage automatique
CREATE TRIGGER trigger_sync_mission_devise
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_devise_from_ticket();
```

## 🚀 Procédure d'application

### 1. Ouvrir SQL Editor Supabase

```
Dashboard Supabase → SQL Editor → New Query
```

### 2. Copier-coller le SQL

Copier le contenu de [supabase/migrations/20260109000004_m63_missions_multi_devise.sql](supabase/migrations/20260109000004_m63_missions_multi_devise.sql)

### 3. Exécuter (RUN)

### 4. Vérifier le résultat attendu

```
✅ M63 OK: missions.devise accepte CHF et EUR
✅ Trigger sync_mission_devise créé

Total missions : X
Missions CHF : X
Missions EUR : 0
```

## ✅ Validation

Après migration, tester :

```bash
node _test_m63_missions_devise.js
```

**Attendu** :
- ✅ Insertion mission CHF → OK
- ✅ Insertion mission EUR → OK
- ✅ Trigger hérite devise du ticket → OK
- ✅ Anciennes missions CHF préservées

## 🎯 Impact

| Avant M63 | Après M63 |
|-----------|-----------|
| `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| ❌ Acceptation ticket France bloquée | ✅ Suisse + France supportés |
| Pas de trigger devise | ✅ Trigger hérite devise ticket |
| CHF uniquement | CHF + EUR |

## 🔄 Workflow acceptation ticket

### Avant M63 (bloqué)

```javascript
1. Entreprise clique "Accepter ticket France (devise=EUR)"
2. RPC accept_ticket_and_create_mission()
3. INSERT missions (ticket_id, entreprise_id, statut='en_attente')
   ❌ ÉCHEC: violates check constraint "check_mission_devise_chf"
4. Transaction rollback
```

### Après M63 (fonctionnel)

```javascript
1. Entreprise clique "Accepter ticket France (devise=EUR)"
2. RPC accept_ticket_and_create_mission()
3. INSERT missions (ticket_id, entreprise_id, statut='en_attente')
4. TRIGGER sync_mission_devise → devise = EUR (héritée du ticket)
5. ✅ Mission créée avec devise EUR
6. Ticket verrouillé, statut → 'en_cours'
```

## ⚠️ Notes importantes

1. **Trigger automatique** : La devise est héritée du ticket automatiquement
2. **Rétrocompatibilité** : Missions CHF existantes préservées
3. **Workflow inchangé** : RPC `accept_ticket_and_create_mission` fonctionne tel quel
4. **Cohérence** : Mission hérite toujours la devise du ticket associé

## 📋 Ordre migrations

```
M61  → Immeubles/logements NPA multi-pays
M61b → Patch logements NPA
M62  → Tickets multi-devises (CHF + EUR)
M63  → Missions multi-devises (CHF + EUR) + trigger héritage ← CETTE MIGRATION
```

## 🔗 Dépendances

**Dépend de** :
- M62 (tickets multi-devises) - **RECOMMANDÉ** d'appliquer avant M63

**Impacte** :
- RPC `accept_ticket_and_create_mission` → débloquée pour tickets EUR
- Table `missions` → accepte CHF et EUR
- Workflow entreprise → acceptation tickets France fonctionnelle

---
**Date création** : 9 janvier 2026  
**Durée application** : < 1 seconde  
**Risque** : Minimal (contrainte + trigger, pas de données modifiées)
