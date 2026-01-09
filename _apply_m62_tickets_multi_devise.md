# 🎯 APPLICATION MIGRATION M62 - Multi-devises tickets

## Contexte

**Problème identifié** : La contrainte `check_devise_chf` sur `tickets` bloque la création de tickets avec `devise = 'EUR'` (France).

```sql
-- Contrainte actuelle (M01)
ALTER TABLE tickets ADD CONSTRAINT check_devise_chf 
CHECK (devise = 'CHF');  -- ❌ Bloque EUR
```

## Solution M62

Migration ciblée pour autoriser **CHF ET EUR** sur tickets.

### Modification

```sql
-- Suppression contrainte CHF-only
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_devise_chf;

-- Ajout contrainte multi-devises
ALTER TABLE tickets ADD CONSTRAINT check_devise_multi_pays
CHECK (devise IN ('CHF', 'EUR'));
```

## 🚀 Procédure d'application

### 1. Ouvrir SQL Editor Supabase

```
Dashboard Supabase → SQL Editor → New Query
```

### 2. Copier-coller le SQL

```sql
-- =====================================================
-- MIGRATION M62 : Multi-devises pour tickets
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Autoriser CHF ET EUR pour tickets France/Suisse
--           Remplace contrainte CHECK (devise = 'CHF')
--           par CHECK (devise IN ('CHF', 'EUR'))
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SUPPRIMER CONTRAINTE CHF ONLY
-- =====================================================

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS check_devise_chf;

-- =====================================================
-- 2. AJOUTER CONTRAINTE MULTI-DEVISES
-- =====================================================

ALTER TABLE tickets
  ADD CONSTRAINT check_devise_multi_pays
  CHECK (devise IN ('CHF', 'EUR'));

-- Mise à jour commentaire colonne
COMMENT ON COLUMN tickets.devise IS 'Devise du ticket - CHF (Suisse) ou EUR (France)';

-- =====================================================
-- 3. LOG MIGRATION (AVANT COMMIT)
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000003_m62_tickets_multi_devise',
  'M62 : Support multi-devises tickets - CHF et EUR autorisés'
);

COMMIT;

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_tickets INTEGER;
  v_tickets_chf INTEGER;
  v_tickets_eur INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_tickets FROM tickets WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_tickets_chf FROM tickets WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_tickets_eur FROM tickets WHERE devise = 'EUR';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ M62 OK: tickets.devise accepte CHF et EUR';
  RAISE NOTICE '';
  RAISE NOTICE 'Total tickets : %', v_total_tickets;
  RAISE NOTICE 'Tickets CHF : %', v_tickets_chf;
  RAISE NOTICE 'Tickets EUR : %', v_tickets_eur;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
```

### 3. Exécuter (RUN)

Résultat attendu :
```
✅ M62 OK: tickets.devise accepte CHF et EUR

Total tickets : X
Tickets CHF : X
Tickets EUR : 0
```

## ✅ Validation

Après migration, tester :

```bash
node _test_m62_ticket_multi_devise.js
```

**Attendu** :
- ✅ Création ticket CHF (Suisse) → OK
- ✅ Création ticket EUR (France) → OK
- ✅ Anciens tickets CHF préservés

## 🎯 Impact

| Avant M62 | Après M62 |
|-----------|-----------|
| `CHECK (devise = 'CHF')` | `CHECK (devise IN ('CHF', 'EUR'))` |
| ❌ Bloque tickets France | ✅ Suisse + France supportés |
| CHF uniquement | CHF + EUR |

## ⚠️ Notes importantes

1. **Pas de changement données** : Tous les tickets existants (CHF) restent valides
2. **Minimal** : Ne touche QUE la contrainte devise, rien d'autre
3. **Compatible** : Workflow tickets/missions/factures inchangé
4. **Dépendances** : Aucune (migration indépendante)

## 📋 Ordre migrations

```
M61  → Immeubles/logements NPA multi-pays
M61b → Patch logements NPA
M62  → Tickets multi-devises (CETTE MIGRATION)
```

---
**Date création** : 9 janvier 2026  
**Durée application** : < 1 seconde  
**Risque** : Minimal (DROP + ADD contrainte, pas de données modifiées)
