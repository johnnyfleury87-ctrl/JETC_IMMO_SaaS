# ÉTAPE 3 — PRÉPARATION M41 (FIX RPC MODE_DIFFUSION)

**Date:** 2026-01-04  
**Migration:** M41 - Harmonisation terminologie RPC `accept_ticket_and_create_mission`  
**Objectif:** Corriger blocker #2 "Mode diffusion invalide: general"

---

## RÉSUMÉ

| Check | Élément | Statut | Détail |
|-------|---------|--------|--------|
| ✅ | Migration M05 (obsolète) | Identifiée | Lignes 48/59: attend 'public'/'assigné' |
| ✅ | Migration M41 (correcte) | Prête | Lignes 55/66: attend 'general'/'restreint' |
| ✅ | SQL copié pour application | Oui | `_fix_output/03_m41_to_apply.sql` (135 lignes) |
| ⚠️ | Version RPC en production | Non testable | Extraction pg_get_functiondef requise (SQL manuelle) |

**🎯 STATUT: ✅ PRÊT POUR APPLICATION**

---

## PREUVES BLOCKER #2

### Root Cause - Migration M05 (version obsolète)

**Fichier:** [supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql](supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql)

**Code problématique (lignes 48-72):**
```sql
-- Validation selon mode diffusion
IF v_mode_diffusion = 'public' THEN
  -- Mode public: Vérifier que entreprise est autorisée en mode 'general'
  IF NOT EXISTS (
    SELECT 1 FROM regies_entreprises 
    WHERE regie_id = v_regie_id 
    AND entreprise_id = p_entreprise_id 
    AND mode_diffusion = 'general'
  ) THEN
    RAISE EXCEPTION 'Entreprise % non autorisée pour tickets publics de régie %', p_entreprise_id, v_regie_id;
  END IF;
  
ELSIF v_mode_diffusion = 'assigné' THEN
  -- Mode assigné: Vérifier que entreprise correspond à celle assignée
  IF v_entreprise_assignee IS NULL THEN
    RAISE EXCEPTION 'Ticket en mode assigné mais aucune entreprise assignée (données incohérentes)';
  END IF;
  IF v_entreprise_assignee != p_entreprise_id THEN
    RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
  END IF;
  
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %', COALESCE(v_mode_diffusion, 'NULL');
END IF;
```

**Analyse:**
- **Ligne 48:** `IF v_mode_diffusion = 'public'` → attend ancienne valeur
- **Ligne 59:** `ELSIF v_mode_diffusion = 'assigné'` → attend ancienne valeur
- **Ligne 71:** `ELSE RAISE EXCEPTION 'Mode diffusion invalide: %'` → **CAUSE BLOCKER #2**

**Scénario erreur:**
1. Frontend crée ticket avec `mode_diffusion = 'general'` (terminologie correcte post-M35)
2. Entreprise accepte ticket → appelle RPC `accept_ticket_and_create_mission()`
3. RPC ligne 48: `IF v_mode_diffusion = 'public'` → **FAUX** (valeur = 'general')
4. RPC ligne 59: `ELSIF v_mode_diffusion = 'assigné'` → **FAUX** (valeur = 'general')
5. RPC ligne 71: **`ELSE RAISE EXCEPTION 'Mode diffusion invalide: general'`** ❌

**Conclusion:** RPC M05 est incompatible avec terminologie actuelle (M35).

---

### Fix - Migration M41 (version correcte)

**Fichier:** [supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql](supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql)

**Code corrigé (lignes 55-83):**
```sql
-- Validation selon mode diffusion (NOUVELLE TERMINOLOGIE)
IF v_mode_diffusion = 'general' THEN
  -- Mode general (marketplace): Vérifier que entreprise est autorisée
  IF NOT EXISTS (
    SELECT 1 FROM regies_entreprises 
    WHERE regie_id = v_regie_id 
    AND entreprise_id = p_entreprise_id 
    AND mode_diffusion = 'general'
  ) THEN
    RAISE EXCEPTION 'Entreprise % non autorisée pour tickets marketplace de régie %', p_entreprise_id, v_regie_id;
  END IF;
  
ELSIF v_mode_diffusion = 'restreint' THEN
  -- Mode restreint (assignation): Vérifier que entreprise correspond
  IF v_entreprise_assignee IS NULL THEN
    RAISE EXCEPTION 'Ticket en mode restreint mais aucune entreprise assignée (données incohérentes)';
  END IF;
  IF v_entreprise_assignee != p_entreprise_id THEN
    RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
  END IF;
  
ELSE
  RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %', COALESCE(v_mode_diffusion, 'NULL');
END IF;
```

**Changements:**
- **Ligne 55:** `'public'` → `'general'` ✅
- **Ligne 66:** `'assigné'` → `'restreint'` ✅
- Logique identique, seule la terminologie change

**Impact après application:**
1. Frontend crée ticket avec `mode_diffusion = 'general'`
2. Entreprise accepte ticket → appelle RPC
3. RPC ligne 55: `IF v_mode_diffusion = 'general'` → **VRAI** ✅
4. Vérification autorisations réussit
5. Mission créée avec succès

---

## COMPARAISON TERMINOLOGIE

| Concept | M05 (OBSOLÈTE) | M41 (CORRECTE) | Migration source |
|---------|----------------|----------------|------------------|
| Diffusion marketplace | `'public'` | `'general'` | M35 |
| Assignation spécifique | `'assigné'` | `'restreint'` | M35 |
| Colonne tickets.mode_diffusion | TEXT (valeurs libres) | Enum mode_diffusion | M30 |

**Note:** Migration M35 a harmonisé la terminologie dans les données (`tickets`, `regies_entreprises`), mais M05 n'a jamais été mise à jour → incohérence.

---

## VALIDATION SQL MANUELLE (REQUISE)

### Extraire version RPC actuellement en production

**Requête à exécuter dans Supabase Studio:**
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'accept_ticket_and_create_mission'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Analyse attendue:**
- Si contient `IF v_mode_diffusion = 'public'` → **M05 en production** (blocker actif)
- Si contient `IF v_mode_diffusion = 'general'` → **M41 déjà appliquée** (blocker résolu)

**Alternative (plus lisible):**
```sql
\sf accept_ticket_and_create_mission
```
(via psql CLI, si disponible)

---

## PRÉPARATION APPLICATION M41

### Fichier prêt à exécuter

**Chemin:** `_fix_output/03_m41_to_apply.sql`  
**Taille:** 135 lignes (4.6 KB)  
**Contenu:** Copie exacte de `supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql`

### Instructions application manuelle

**1. Ouvrir Supabase Studio SQL Editor:**
```
https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql
```

**2. Copier contenu:**
```bash
cat _fix_output/03_m41_to_apply.sql
```

**3. Coller dans SQL Editor et exécuter (RUN)**

**4. Vérifier message succès:**
```
✅ M41: RPC accept_ticket_and_create_mission harmonisée
```

**5. (Optionnel) Enregistrer dans migration_logs:**
```sql
-- À adapter selon schéma exact de migration_logs
INSERT INTO migration_logs (migration_name, description, created_at)
VALUES (
  '20260104001700_m41_harmonize_rpc_acceptation', 
  'Harmonisation terminologie RPC: public/assigné → general/restreint (M41)',
  now()
);
```

---

## VALIDATION POST-APPLICATION (À FAIRE APRÈS)

### Test 1: Vérifier contenu RPC

**Requête:**
```sql
SELECT pg_get_functiondef(oid)::text LIKE '%general%' as contains_new_term,
       pg_get_functiondef(oid)::text LIKE '%public%' as contains_old_term
FROM pg_proc
WHERE proname = 'accept_ticket_and_create_mission';
```

**Résultat attendu:**
```
contains_new_term: true
contains_old_term: false
```

### Test 2: Simuler acceptation ticket

**Requête (simulation sans exécution):**
```sql
-- PRÉPARATION: Créer ticket test avec mode_diffusion='general'
-- (ou utiliser ticket existant si présent)

-- TEST RPC (remplacer UUIDs):
SELECT accept_ticket_and_create_mission(
  '<ticket_id>'::uuid,
  '<entreprise_id>'::uuid,
  NULL
);
```

**Résultat attendu:**
- Pas d'erreur `"Mode diffusion invalide: general"`
- Retour: UUID de mission créée OU erreur métier valide (entreprise non autorisée, etc.)

---

## ROLLBACK M41 (SI NÉCESSAIRE)

**Fichier:** [supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql](supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation_rollback.sql)

**Action:** Restaure RPC M05 (terminologie 'public'/'assigné')

**Quand l'utiliser:**
- Si M41 cause erreurs imprévues
- Pour revenir à état stable avant M41
- **ATTENTION:** Re-créera blocker #2 (erreur "Mode diffusion invalide: general")

---

## RÉSUMÉ ÉTAPE 3

### ✅ PRÉPARATION TERMINÉE

**Preuves établies:**
1. ✅ M05 identifiée: lignes 48/59 utilisent 'public'/'assigné' → **CAUSE BLOCKER #2**
2. ✅ M41 prête: lignes 55/66 utilisent 'general'/'restreint' → **FIX BLOCKER #2**
3. ✅ SQL copié: `_fix_output/03_m41_to_apply.sql` (prêt pour Supabase Studio)

**Impact après application:**
- **Blocker #2 RÉSOLU:** Erreur "Mode diffusion invalide: general" ne peut plus se produire
- RPC accepte tickets avec `mode_diffusion = 'general'` ou `'restreint'`
- Workflow acceptation entreprise débloqué (après fix blocker #3 si nécessaire)

**Action immédiate:**
→ **Appliquer M41 dans Supabase Studio SQL Editor** (voir instructions ci-dessus)

**Statut:**
```
ÉTAPE 2 (M42): ✅ TERMINÉE
ÉTAPE 3 (M41): ✅ PRÉPARÉE - ATTENTE APPLICATION MANUELLE
ÉTAPE 4 (enum): ⏳ EN ATTENTE
```

---

**Fichiers générés:**
- `_fix_output/03_pre_apply_m41_results.json` (résultats analyse)
- `_fix_output/03_m41_to_apply.sql` (migration prête) ⭐
- `_fix_output/03_pre_apply_m41_proofs.md` (ce document)

**Prochaine étape:** ÉTAPE 3 validation post-apply (après exécution manuelle M41)
