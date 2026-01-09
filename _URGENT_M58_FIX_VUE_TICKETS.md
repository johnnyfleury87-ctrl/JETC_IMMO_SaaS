# 🚨 FIX TICKETS PUBLICS INVISIBLES - M58

## 🎯 PROBLÈME IDENTIFIÉ

### Symptôme
Entreprise affiliée à une régie ne voit PAS les tickets publiés en mode "public/général", même quand:
- ✅ Ticket existe (mode_diffusion='general', statut='en_attente')
- ✅ Entreprise liée à la régie (regies_entreprises)
- ✅ Mode diffusion correct (re.mode_diffusion='general')

### Root Cause
**Vue `tickets_visibles_entreprise` filtre sur le MAUVAIS statut**

```sql
-- ❌ VUE ACTUELLE (INCORRECTE)
WHERE
  re.mode_diffusion = 'general'
  AND t.statut = 'ouvert'  -- BUG: tickets diffusés sont 'en_attente'
```

**Workflow réel:**
1. Régie crée ticket → statut='nouveau'
2. Régie valide ticket → statut='ouvert'
3. Régie diffuse ticket → **statut='en_attente'** (RPC diffuser_ticket)
4. Vue filtre statut='ouvert' → **AUCUN MATCH** (0 résultat)

### Données Réelles (Audit DB)
```
Ticket ID: 4b1a200e-ac1d-4289-b4aa-e43729ddb4ac
- mode_diffusion: 'general'
- statut: 'en_attente'  ✅
- locked_at: NULL
- regie_id: 194c3e16-40f7-451d-ac49-25803d4e970d

Entreprise: Toutpourpout (898b4b8b-e7aa-4bd4-9390-b489519c7f19)
- Liaison regies_entreprises: ✅ Existe
- Régie: 194c3e16-40f7-451d-ac49-25803d4e970d ✅ Match
- Mode diffusion: 'restreint' (dans cet exemple test)

Entreprise: Perreti SA (6ff210bc-9985-457c-8851-4185123edb07)
- Liaison regies_entreprises: ✅ Existe
- Mode diffusion: 'general' ✅
```

**Conclusion:** La vue ne retourne RIEN car elle cherche `statut='ouvert'` alors que tous les tickets diffusés sont en `statut='en_attente'`.

---

## ✅ SOLUTION - MIGRATION M58

### Fichier Migration
**Path:** `supabase/migrations/20260109010003_m58_fix_vue_tickets_entreprise.sql`

### Correction Appliquée

```sql
CREATE OR REPLACE VIEW tickets_visibles_entreprise AS
SELECT
  t.*,
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS entreprise_mode_diffusion,
  -- ... colonnes jointures ...
FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id
-- ... autres jointures ...
WHERE
  -- ✅ CAS 1: Mode GENERAL (marketplace)
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'general'
    AND t.statut = 'en_attente'         -- ✅ CORRECTION
    AND t.locked_at IS NULL
  )
  OR
  -- CAS 2: Mode RESTREINT (assignation)
  (
    re.mode_diffusion = 'restreint'
    AND t.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  )
  OR
  -- CAS 3: Historique missions
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );
```

### Changements Clés

| Critère | Avant M58 | Après M58 |
|---------|-----------|-----------|
| Filtre statut (mode general) | `'ouvert'` ❌ | `'en_attente'` ✅ |
| Vérif mode_diffusion ticket | Absent | `t.mode_diffusion = 'general'` ✅ |
| Vérif mode_diffusion entreprise | `re.mode_diffusion = 'general'` ✅ | Identique ✅ |
| Vérif locked_at | Absent | `t.locked_at IS NULL` ✅ |

---

## 🚀 DÉPLOIEMENT

### ⚠️ Application MANUELLE Requise

La migration M58 doit être appliquée **dans Supabase SQL Editor** (pas via API).

### Procédure

1. **Ouvrir Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql
   ```

2. **Copier contenu migration**
   ```bash
   cat supabase/migrations/20260109010003_m58_fix_vue_tickets_entreprise.sql
   ```

3. **Coller dans SQL Editor**

4. **Cliquer RUN**

5. **Vérifier message**
   ```
   ✅ M58: Vue tickets_visibles_entreprise corrigée avec succès
   ```

6. **Enregistrer migration (automatique)**
   ```sql
   INSERT INTO supabase_migrations (name, executed_at)
   VALUES ('20260109010003_m58_fix_vue_tickets_entreprise.sql', NOW());
   ```

---

## 🧪 TESTS DE VALIDATION

### Test 1: Entreprise Mode GENERAL

**Contexte:**
- Entreprise "Perreti SA" 
- Liaison: regies_entreprises.mode_diffusion = 'general'

**Actions:**
1. Se connecter comme entreprise
2. Naviguer vers "Tickets disponibles"

**✅ ATTENDU:**
- Liste affiche le(s) ticket(s) public(s)
- Ticket visible: "Serrurerie // Porte bloquée"

**❌ AVANT M58:**
- Liste vide (aucun ticket)
- Vue retournait 0 résultat (filtre statut='ouvert')

### Test 2: Entreprise Mode RESTREINT

**Contexte:**
- Entreprise "Toutpourpout"
- Liaison: regies_entreprises.mode_diffusion = 'restreint'

**Actions:**
1. Se connecter comme entreprise
2. Naviguer vers "Tickets disponibles"

**✅ ATTENDU:**
- Liste VIDE (pas de tickets assignés directs)
- Message: "Aucun ticket disponible"

### Test 3: Vérification DB Directe

```sql
-- Test vue pour entreprise en mode general
SELECT 
  ticket_id,
  titre,
  statut,
  mode_diffusion,
  entreprise_mode_diffusion
FROM tickets_visibles_entreprise
WHERE visible_par_entreprise_id = '6ff210bc-9985-457c-8851-4185123edb07' -- Perreti SA
  AND statut = 'en_attente';

-- Attendu: 1+ résultat(s)
```

```sql
-- Test vue pour entreprise en mode restreint
SELECT COUNT(*)
FROM tickets_visibles_entreprise
WHERE visible_par_entreprise_id = '898b4b8b-e7aa-4bd4-9390-b489519c7f19' -- Toutpourpout
  AND statut = 'en_attente'
  AND mode_diffusion = 'general';

-- Attendu: 0 (mode restreint ne voit pas tickets publics)
```

### Test 4: Autre Régie (Isolation)

**Contexte:**
- Entreprise affiliée à Régie A
- Ticket public de Régie B

**✅ ATTENDU:**
- Entreprise NE VOIT PAS le ticket de Régie B
- Vue filtre sur `re.regie_id = t.regie_id`

---

## 📊 IMPACT

### Avant M58

| Rôle | Mode diffusion | Tickets visibles | Cause |
|------|----------------|------------------|-------|
| Entreprise (general) | general | ❌ 0 | Vue filtre statut='ouvert' ≠ 'en_attente' |
| Entreprise (restreint) | restreint | ✅ Assignés seuls | Filtre entreprise_id OK |

### Après M58

| Rôle | Mode diffusion | Tickets visibles | Méthode |
|------|----------------|------------------|---------|
| Entreprise (general) | general | ✅ Tickets publics | Vue filtre statut='en_attente' ✅ |
| Entreprise (restreint) | restreint | ✅ Assignés seuls | Identique (non affecté) |

---

## 🔄 ROLLBACK

Si M58 cause des problèmes (peu probable):

```bash
# Fichier rollback
supabase/migrations/20260109010003_m58_fix_vue_tickets_entreprise_rollback.sql
```

**Appliquer dans SQL Editor:**
```sql
-- Restaure vue M17 originale (avec bug statut='ouvert')
\i 20260109010003_m58_fix_vue_tickets_entreprise_rollback.sql
```

**⚠️ Attention:** Le rollback réintroduit le bug (tickets invisibles).

---

## 📝 HISTORIQUE TECHNIQUE

### Migrations Liées

| Migration | Fichier | Statut | Description |
|-----------|---------|--------|-------------|
| M17 | `17_views.sql` | ✅ Appliqué | Vue tickets_visibles_entreprise (BUG) |
| M34 | `m34_rls_entreprise_tickets.sql` | ✅ Appliqué | Policies RLS entreprise (correctes mais non utilisées) |
| M39 | `m39_fix_rls_mode_diffusion.sql` | ❌ Jamais appliqué | Fix RLS mode_diffusion (non pertinent ici) |
| **M58** | `m58_fix_vue_tickets_entreprise.sql` | 🔴 **À appliquer** | **Fix vue statut en_attente** |

### Frontend Architecture

**Fichier:** `public/entreprise/dashboard.html`

**Code (ligne 1131):**
```javascript
const { data: tickets, error } = await window.supabaseClient
  .from('tickets_visibles_entreprise')  // ✅ Utilise la vue
  .select('*')
  .eq('visible_par_entreprise_id', window.currentEntreprise.id)
  .eq('statut', 'en_attente')           // ✅ Frontend filtre aussi
  .is('locked_at', null)
  .order('created_at', { ascending: false });
```

**Analyse:**
- ✅ Frontend utilise la vue (pas accès direct table tickets)
- ✅ Frontend filtre `statut='en_attente'` (compense bug vue AVANT M58)
- ❌ **MAIS** vue retourne 0 résultat en amont → frontend reçoit []
- ✅ Après M58: vue retournera résultats → frontend affichera

---

## ⚠️ CHECKLIST DÉPLOIEMENT

- [ ] **Script diagnostic exécuté** (_apply_m58_fix_vue.js)
- [ ] **Situation confirmée** (tickets en_attente, vue filtre ouvert)
- [ ] **Migration M58 appliquée** (Supabase SQL Editor)
- [ ] **Message validation vu** (✅ M58: Vue corrigée)
- [ ] **Test Entreprise general** → Tickets visibles
- [ ] **Test Entreprise restreint** → Tickets NON visibles
- [ ] **Test DB directe** → SELECT COUNT(*) retourne > 0
- [ ] **Logs propres** → Pas d'erreur frontend

---

## 📞 SUPPORT

**En cas d'erreur lors de l'application:**
1. Vérifier logs SQL Editor (message d'erreur PostgreSQL)
2. Vérifier que vue `tickets_visibles_entreprise` existe déjà
3. Vérifier que tables `tickets`, `regies_entreprises` existent
4. Vérifier permissions utilisateur Supabase (admin requis)

**Validation post-migration:**
```sql
-- Vérifier vue existe
SELECT * FROM pg_views WHERE viewname = 'tickets_visibles_entreprise';

-- Tester vue
SELECT COUNT(*) FROM tickets_visibles_entreprise;
```

---

**Statut:** 🔴 CRITIQUE - Appliquer M58 maintenant

**Priorité:** 🔥 BLOQUANT (Entreprises ne peuvent pas voir tickets publics)

**Date:** 2026-01-09

**Auteur:** GitHub Copilot
