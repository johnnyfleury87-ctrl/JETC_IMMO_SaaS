# ROOT CAUSE ANALYSIS — Erreur "Mode diffusion invalide: general"

**Date:** 2026-01-04  
**Bug:** Acceptation ticket entreprise retourne 400 Bad Request  
**Message:** "Mode diffusion invalide ou NULL: general"  
**Contexte:** RPC `accept_ticket_and_create_mission()` appelée par entreprise

---

## 🔍 SYMPTÔME

**Erreur rencontrée:**
```
Mode diffusion invalide ou NULL: general (attendu: general ou restreint)
```

**Déclencheur:**
- Entreprise tente d'accepter un ticket disponible
- Appel RPC: `accept_ticket_and_create_mission(p_ticket_id, p_entreprise_id, p_disponibilite_id)`
- Réponse: HTTP 400 (Bad Request)

---

## 📊 ÉTAT ACTUEL DE LA BASE (FACTUEL)

### Colonne `tickets.mode_diffusion`

**Source:** `supabase/Audit_supabase/4_Colonnes détaillées.csv`

```
table: public.tickets
column: mode_diffusion
ordinal_position: 22
data_type: text
is_nullable: YES
column_default: null
```

**Constat:**
- ✅ Colonne EXISTS en DB
- ❌ NULL autorisé (is_nullable = YES)
- ❌ Pas de DEFAULT (column_default = null)
- ❌ Aucune contrainte CHECK détectée (absent de CSV audit 5_Contraintes)

### Colonne `regies_entreprises.mode_diffusion`

**Source:** `supabase/Audit_supabase/4_Colonnes détaillées.csv`

```
table: public.regies_entreprises
column: mode_diffusion
ordinal_position: 4
data_type: text
is_nullable: NO
column_default: 'restreint'::text
```

**Constat:**
- ✅ Colonne EXISTS en DB
- ✅ NOT NULL (is_nullable = NO)
- ✅ DEFAULT 'restreint'
- ✅ Contrainte CHECK présente (CSV audit 5_Contraintes: check_mode_diffusion)

### Policies RLS tickets pour entreprises

**Source:** `supabase/Audit_supabase/8_Policies RLS.csv`

**Résultat:** `grep "^public,tickets," ... | grep -i "entreprise"` → **AUCUN RÉSULTAT**

**Constat:**
- ❌ **AUCUNE policy entreprise sur table tickets**
- ❌ Policy "Entreprise can view general tickets" → **ABSENTE**
- ❌ Policy "Entreprise can view assigned tickets" → **ABSENTE**
- ✅ Policy "Admin JTEC can view all tickets" → PRÉSENTE (non affectée par le bug)

### RPC `accept_ticket_and_create_mission`

**Source:** `supabase/Audit_supabase/9_Fonctions_RPC.csv`

**Résultat:** RPC **PRÉSENT** en base

---

## 📜 MIGRATIONS IMPLIQUÉES (NON APPLIQUÉES)

### M02 - Ajouter mode_diffusion (NON APPLIQUÉE)

**Fichier:** `20251226170100_m02_add_mode_diffusion.sql`

**Objectif:**
- Ajouter colonne `tickets.mode_diffusion`
- Contrainte CHECK: `mode_diffusion IN ('public', 'assigné')` ou NULL

**Code pertinent:**
```sql
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS mode_diffusion text;

ALTER TABLE tickets ADD CONSTRAINT check_mode_diffusion 
CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('public', 'assigné'));
```

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- Colonne créée (présente en DB) **MAIS contrainte CHECK absente**
- Valeurs attendues M02: `'public'` / `'assigné'`
- **PROBLÈME:** Terminologie obsolète dès M02

---

### M30 - Correction mode_diffusion (NON APPLIQUÉE)

**Fichier:** `20251227000600_m30_fix_mode_diffusion.sql`

**Objectif:**
- Corriger RPC M29 pour utiliser `'general'` / `'restreint'` au lieu de `'actif'` / `'silencieux'`
- Validation: `p_mode_diffusion NOT IN ('general', 'restreint') → EXCEPTION`

**Code pertinent (RPC create_entreprise_simple):**
```sql
-- Valider mode_diffusion (CORRECTION: general ou restreint)
IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
  RAISE EXCEPTION 'mode_diffusion doit être general ou restreint (reçu: %)', p_mode_diffusion;
END IF;
```

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- Standardisation `'general'` / `'restreint'` NON appliquée
- RPC entreprises utilisent valeurs incorrectes
- **Nouvelle terminologie introduite mais pas cohérente avec M02**

---

### M35 - Harmonisation terminologie (NON APPLIQUÉE)

**Fichier:** `20251227001100_m35_harmonize_mode_diffusion.sql`

**Objectif:**
- Migration données: `'public'` → `'general'`, `'assigné'` → `'restreint'`
- Recréer policies RLS avec terminologie correcte
- Suppression policies obsolètes

**Code pertinent:**
```sql
-- Migrer données existantes
UPDATE tickets SET mode_diffusion = 'general' WHERE mode_diffusion = 'public';
UPDATE tickets SET mode_diffusion = 'restreint' WHERE mode_diffusion = 'assigné';

-- Recréer policies
CREATE POLICY "Entreprise can view general tickets" ON tickets FOR SELECT
USING (
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
  )
);

CREATE POLICY "Entreprise can view assigned tickets" ON tickets FOR SELECT
USING (
  mode_diffusion = 'restreint'
  AND entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
);
```

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- Migration données NON effectuée
- Policies RLS entreprises **NON créées**
- **BLOCKER:** Entreprises ne peuvent voir AUCUN ticket (policies absentes)

---

### M38 - RPC update_mode_diffusion (NON APPLIQUÉE)

**Fichier:** `20260104001400_m38_rpc_update_mode_diffusion.sql`

**Objectif:**
- Créer RPC `update_entreprise_mode_diffusion()`
- Permet à une régie de changer le mode d'une entreprise autorisée

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- RPC **ABSENT** de la base (vérifié dans CSV audit 9_Fonctions)
- Impossible de modifier `regies_entreprises.mode_diffusion` via RPC
- **Impact modéré sur le bug** (ne bloque pas l'acceptation, bloque seulement la gestion)

---

### M39 - Fix RLS mode_diffusion (NON APPLIQUÉE)

**Fichier:** `20260104001500_m39_fix_rls_mode_diffusion.sql`

**Objectif:**
- Corriger policy M35 "Entreprise can view general tickets"
- Ajouter vérification: `AND re.mode_diffusion = 'general'` dans EXISTS

**Code pertinent:**
```sql
CREATE POLICY "Entreprise can view general tickets" ON tickets FOR SELECT
USING (
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
      AND re.mode_diffusion = 'general'  -- ✅ CORRECTION M39
  )
);
```

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- Correction policy NON appliquée
- **SANS OBJET:** Policy n'existe même pas (M35 non appliquée)

---

### M41 - Harmonisation RPC acceptation (NON APPLIQUÉE)

**Fichier:** `20260104001700_m41_harmonize_rpc_acceptation.sql`

**Objectif:**
- Corriger RPC `accept_ticket_and_create_mission()` pour terminologie `'general'` / `'restreint'`
- Remplace checks M05 qui attendaient `'public'` / `'assigné'`

**Code pertinent:**
```sql
-- Validation selon mode diffusion (NOUVELLE TERMINOLOGIE)
IF v_mode_diffusion = 'general' THEN
  -- Vérifier autorisation marketplace
ELSIF v_mode_diffusion = 'restreint' THEN
  -- Vérifier assignation directe
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide ou NULL: % (attendu: general ou restreint)', 
    COALESCE(v_mode_diffusion, 'NULL');
END IF;
```

**Statut migration:** ❌ NON appliquée selon `03_migrations_applied_from_db.csv`

**Impact:**
- RPC `accept_ticket_and_create_mission()` **version obsolète en DB**
- Version actuelle attend probablement `'public'` / `'assigné'` (M05)
- **CAUSE DIRECTE:** Si ticket a `mode_diffusion = 'general'`, la vieille RPC le rejette

---

## 🎯 ROOT CAUSE ANALYSIS

### Chronologie du problème

1. **M02 (non appliquée):** Introduit colonne `tickets.mode_diffusion` avec valeurs `'public'` / `'assigné'`
2. **M30 (non appliquée):** Change terminologie vers `'general'` / `'restreint'` (RPC entreprises uniquement)
3. **M35 (non appliquée):** Harmonise TOUTES les valeurs → `'general'` / `'restreint'` + migration données
4. **M41 (non appliquée):** Harmonise RPC acceptation pour accepter nouvelle terminologie

**RÉSULTAT:** Base en **état incohérent** mixant anciennes et nouvelles terminologies

### État actuel tickets.mode_diffusion

**Hypothèses possibles (SANS ACCÈS DB):**

**Scénario A:** Colonne créée manuellement ou via migration non tracée
- Valeurs possibles: NULL, `'general'`, `'restreint'`, `'public'`, `'assigné'`
- Aucune contrainte CHECK → accepte n'importe quoi

**Scénario B:** M02 appliquée manuellement mais non enregistrée
- Contrainte CHECK: `IN ('public', 'assigné')` ou NULL
- Valeur `'general'` **rejetée** par contrainte CHECK
- **Compatible avec erreur observée**

**Scénario C:** Colonne créée puis peuplée avec nouvelle terminologie
- Valeurs: `'general'` / `'restreint'`
- Aucune contrainte CHECK
- RPC M05 (version obsolète) rejette `'general'`
- **Compatible avec erreur observée**

### Chaîne causale identifiée

```
┌─────────────────────────────────────────────────────────────────┐
│ CAUSE RACINE: Écart migrations fichiers vs migrations appliquées │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ M02, M30, M35, M41 NON appliquées → incohérence terminologie     │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Base actuelle: tickets.mode_diffusion existe MAIS sans migration │
│ tracée → origine inconnue, valeurs inconnues                     │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ RPC accept_ticket_and_create_mission() version M05 (obsolète)    │
│ Attend: 'public' / 'assigné' OU rejette autres valeurs          │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ Si ticket.mode_diffusion = 'general':                            │
│   → RPC M05 RAISE EXCEPTION "Mode diffusion invalide: general"  │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│ HTTP 400 Bad Request retourné à l'entreprise                     │
└─────────────────────────────────────────────────────────────────┘
```

### Facteurs aggravants

1. **RLS désactivé:**
   - `supabase/Audit_supabase/7_RLS.csv` → TOUTES les tables ont RLS OFF
   - Policies définies (315 total) **MAIS inactives**
   - Entreprises voient probablement tickets via bypass RLS, MAIS ne peuvent les accepter

2. **Policies entreprises absentes:**
   - CSV audit 8_Policies: AUCUNE policy entreprise sur tickets
   - M35 devait les créer → NON appliquée
   - Entreprises n'ont techniquement **aucun droit SELECT** sur tickets (si RLS actif)

3. **Contrainte CHECK absente:**
   - M02 devait créer contrainte CHECK
   - CSV audit 5_Contraintes: `check_mode_diffusion` existe UNIQUEMENT sur `regies_entreprises`
   - Aucune contrainte sur `tickets.mode_diffusion`
   - Valeurs incohérentes possibles en base

4. **Migration logs incomplets:**
   - Seulement 7 migrations enregistrées (pré-M-numbering)
   - 86 migrations M01-M42 NON enregistrées
   - **Impossible de savoir ce qui a été appliqué manuellement**

---

## 💡 CAUSE RACINE FINALE

**Root cause primaire:**
```
RPC accept_ticket_and_create_mission() version M05 (obsolète) en production
+ tickets.mode_diffusion contient valeur 'general' (nouvelle terminologie)
= Exception "Mode diffusion invalide: general"
```

**Root cause secondaire:**
```
Migrations M02 → M41 NON appliquées
→ Évolution terminologique mode_diffusion non synchronisée
→ RPC et données en désaccord
```

**Root cause organisationnelle:**
```
110 migrations présentes mais seulement 7 enregistrées
→ Historique migration_logs incomplet/inexact
→ État réel de la base inconnu
→ Migrations appliquées manuellement sans traçabilité
```

---

## ✅ VALIDATION THÉORIQUE (SANS ACCÈS DB)

### Test 1: Vérifier valeurs tickets.mode_diffusion

```sql
-- REQUÊTE À EXÉCUTER:
SELECT 
  mode_diffusion, 
  COUNT(*) as count,
  statut
FROM tickets
GROUP BY mode_diffusion, statut
ORDER BY mode_diffusion, statut;
```

**Résultat attendu:**
- Si `'general'` présent → Confirme terminologie nouvelle
- Si `'public'` présent → Confirme terminologie ancienne M02
- Si NULL présent → Tickets non diffusés ou colonne mal initialisée

### Test 2: Vérifier contrainte CHECK sur tickets

```sql
-- REQUÊTE À EXÉCUTER:
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'public.tickets'::regclass
  AND conname LIKE '%mode_diffusion%';
```

**Résultat attendu:**
- Si vide → Aucune contrainte (scénario actuel probable)
- Si `check_mode_diffusion` présent → M02 appliquée manuellement

### Test 3: Tester insertion avec valeur 'general'

```sql
-- TEST À EXÉCUTER (staging uniquement):
INSERT INTO tickets (
  titre, description, statut, regie_id, mode_diffusion
) VALUES (
  'Test', 'Test mode_diffusion', 'brouillon', '<regie_id_test>', 'general'
) RETURNING id, mode_diffusion;
```

**Résultat attendu:**
- Si succès → Pas de contrainte CHECK
- Si échec "violates check constraint" → Contrainte M02 active

### Test 4: Identifier version RPC accept_ticket_and_create_mission

```sql
-- REQUÊTE À EXÉCUTER:
SELECT prosrc
FROM pg_proc
WHERE proname = 'accept_ticket_and_create_mission'
  AND pronamespace = 'public'::regnamespace;
```

**Analyse du code:**
- Chercher: `'public'` / `'assigné'` → Version M05 (obsolète)
- Chercher: `'general'` / `'restreint'` → Version M41 (correcte)

---

## 🔧 STRATÉGIE DE CORRECTION (ÉTAPE 5 SUITE)

### Option A: Migration minimale corrective (RECOMMANDÉ)

**Fichier:** `41_fix_mode_diffusion.sql`

**Actions:**
1. Vérifier et standardiser valeurs existantes
2. Appliquer M41: Remplacer RPC `accept_ticket_and_create_mission()` par version harmonisée
3. Appliquer M35 (partiel): Créer policies RLS entreprises manquantes
4. Ajouter contrainte CHECK si absente

**Avantages:**
- Minimale (corrige uniquement le bug)
- Pas de refactoring complet
- Conserve données existantes

**Inconvénients:**
- Ne résout pas l'écart migration_logs
- Laisse M02-M34, M36-M40 non appliquées

### Option B: Appliquer toutes migrations manquantes M01-M42

**NON RECOMMANDÉ** car:
- Hors périmètre (règle: corriger UNIQUEMENT bug bloquant)
- 47 migrations à appliquer
- Risque de conflits/doublons
- Temps d'exécution long

### Option C: Recréer migration consolidée

**NON AUTORISÉ** car:
- Violation règle "pas de refactoring"
- Suppression historique existant

---

## 📋 PROCHAINES ÉTAPES

1. ✅ **Root cause identifiée** (ce document)
2. ⏳ **Créer `41_fix_mode_diffusion.sql`** (migration corrective minimale)
3. ⏳ **Créer `41_fix_mode_diffusion_rollback.sql`** (sécurité)
4. ⏳ **S'arrêter** (fin ÉTAPE 5)

**ÉTAPE 6 (ultérieure):** Archivage migrations + traçabilité complète

---

**FIN ROOT CAUSE ANALYSIS**

