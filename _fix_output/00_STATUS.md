# STATUS FIX BLOCKERS — PROGRESSION

**Date:** 2026-01-04  
**Objectif:** Corriger 3 blockers critiques production  
**Méthode:** Migrations propres + Tests automatisés

---

## PROGRESSION GLOBALE

```
[███████░░░░░░░░░░░░░] 35% (2.5/6 étapes terminées)

✅ ÉTAPE 1: Vérifications DB réelles (TERMINÉ)
✅ ÉTAPE 2: Application M42 - disponibilite_id (TERMINÉ)
⏳ ÉTAPE 3: Application M41 - RPC mode_diffusion (PRÉPARÉ - attente application)
⏳ ÉTAPE 4: Fix enum ticket_status (EN ATTENTE)
⏳ ÉTAPE 5: Tests automatisés (EN ATTENTE)
⏳ ÉTAPE 6: Recap final + archivage (EN ATTENTE)
```

---

## ÉTAPE 1 — VÉRIFICATIONS DB RÉELLES

**Statut:** ✅ **TERMINÉ** (2026-01-04)

**Livrables produits:**
- `_fix_output/01_db_proofs.json` (résultats bruts)
- `_fix_output/01_db_proofs.md` (preuves formatées)
- `_fix_output/01_blockers_matrix.md` (matrice blockers)

**Preuves établies:**

| Blocker | Preuve | Conclusion |
|---------|--------|------------|
| #1: disponibilite_id missing | CSV 4_Colonnes: 20 colonnes missions, disponibilite_id absente | ✅ CONFIRMÉ - M42 non appliquée |
| #2: mode_diffusion 'general' | Migration M05 lignes 49-71: attend 'public'/'assigné' | ✅ CONFIRMÉ - M41 non appliquée |
| #3: enum 'diffuse' invalide | CSV 4_Colonnes: statut type USER-DEFINED (enum) | ⚠️ PARTIEL - requête pg_enum requise |

**Actions déterminées:**
1. Appliquer M42 (ajouter colonne missions.disponibilite_id)
2. Appliquer M41 (remplacer RPC mode_diffusion)
3. Investiguer enum + décision migration/code

---

## ÉTAPE 2 — APPLICATION MIGRATION M42

**Statut:** ✅ **TERMINÉ** (application manuelle validée)

**Date:** 2026-01-04

**Livrables produits:**
- `_fix_output/02_apply_m42_log.md` (log complet + instructions)
- `_fix_output/02_before_after_checks.sql` (requêtes vérification)
- `_fix_output/02_migration_m42_to_apply.sql` (migration appliquée)
- `_fix_output/02_post_apply_m42_results.json` (résultats validation)
- `_fix_output/02_post_apply_m42_proofs.md` (preuves post-apply)

**Vérifications avant (✅ TERMINÉ):**
- [x] Colonne disponibilite_id absente confirmée
- [x] Table tickets_disponibilites existe (FK target)
- [x] Migration M42 préparée et validée
- [x] Rollback M42 prêt

**Application DB (✅ TERMINÉ):**
- [x] **ACTION UTILISATEUR:** M42 exécutée dans Supabase Studio SQL Editor ⭐
- [x] Colonne `missions.disponibilite_id` ajoutée
- [x] FK vers `tickets_disponibilites.id` créée
- [x] Index `idx_missions_disponibilite_id` créé

**Validation post (✅ TERMINÉ):**
- [x] SELECT disponibilite_id FROM missions → **SUCCÈS** ✅
- [x] Table tickets_disponibilites accessible
- [x] Base vide (0 missions) mais schéma correct
- [x] Blocker #1 RÉSOLU (SQLSTATE 42703 ne peut plus se produire)

**Commande vérification:**
```bash
node _fix_step2b_validate_m42_v2.js
```

**Résultat validation:**
```
✅ VALIDATION CRITIQUE: SUCCÈS
→ Colonne missions.disponibilite_id PRÉSENTE
→ Blocker #1 RÉSOLU
```

**Rollback disponible:**
```sql
-- Fichier: supabase/migrations/20260104001800_m42_add_disponibilite_id_missions_rollback.sql
DROP INDEX IF EXISTS idx_missions_disponibilite_id;
ALTER TABLE missions DROP COLUMN IF EXISTS disponibilite_id;
```

---

## ÉTAPE 3 — APPLICATION MIGRATION M41

**Statut:** ⏳ **PRÉPARÉ** (attente application manuelle)

**Date:** 2026-01-04

**Objectif:** Remplacer RPC accept_ticket_and_create_mission() version M05 (obsolète) par M41 (correcte)

**Blocker ciblé:** #2 - Mode diffusion invalide "general"

**Livrables produits:**
- `_fix_output/03_pre_apply_m41_results.json` (résultats analyse)
- `_fix_output/03_m41_to_apply.sql` (migration prête - 135 lignes) ⭐
- `_fix_output/03_pre_apply_m41_proofs.md` (preuves complètes)

**Analyse versions (✅ TERMINÉ):**
- [x] M05 identifiée: lignes 48/59 utilisent 'public'/'assigné' → **CAUSE BLOCKER #2**
- [x] M41 analysée: lignes 55/66 utilisent 'general'/'restreint' → **FIX BLOCKER #2**
- [x] Migration M41 copiée pour application

**Preuve blocker #2:**
```
Scénario erreur (M05 en production):
1. Ticket créé: mode_diffusion = 'general' ✅
2. Entreprise accepte → RPC
3. RPC ligne 48: IF v_mode_diffusion = 'public' → FAUX ❌
4. RPC ligne 59: ELSIF v_mode_diffusion = 'assigné' → FAUX ❌
5. RPC ligne 71: RAISE EXCEPTION 'Mode invalide: general' ❌❌❌
```

**Application DB (⏳ EN ATTENTE):**
- [ ] **ACTION UTILISATEUR:** Exécuter M41 dans Supabase Studio SQL Editor
- [ ] Instructions: voir `_fix_output/03_pre_apply_m41_proofs.md`
- [ ] Fichier SQL: `_fix_output/03_m41_to_apply.sql` (135 lignes)

**Validation post (⏳ EN ATTENTE):**
- [ ] Extraction RPC: pg_get_functiondef() contient 'general'/'restreint'
- [ ] Test acceptation ticket mode_diffusion='general' (doit réussir)
- [ ] Blocker #2 résolu

**Instructions application:**
1. Ouvrir: https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql
2. Copier: `cat _fix_output/03_m41_to_apply.sql`
3. Coller dans SQL Editor → RUN
4. Vérifier: `✅ M41: RPC harmonisée`

---

## ÉTAPE 4 — FIX ENUM TICKET_STATUS

**Statut:** ⏳ **EN ATTENTE** (après ÉTAPE 3)

**Objectif:** Corriger incohérence enum ticket_status valeur 'diffuse'

**Blocker ciblé:** #3 - Enum 'diffuse' invalide

**Investigation requise:**
1. Requête pg_enum pour extraire valeurs réelles
2. Grep codebase pour identifier usages 'diffuse' vs 'diffusé' vs 'diffusee'
3. Décision: migration enum OU patch code

**Options fix:**
- **Option A:** Migration ADD VALUE 'diffuse' à enum (irreversible)
- **Option B:** Corriger code pour utiliser valeur existante

---

## ÉTAPE 5 — TESTS AUTOMATISÉS

**Statut:** ⏳ **EN ATTENTE** (après ÉTAPES 2-3-4)

**Objectif:** Script validation workflow complet

**Tests prévus:**
1. Création ticket
2. Diffusion ticket
3. Listing tickets entreprise
4. Acceptation ticket entreprise (création mission avec disponibilite_id)
5. Vérification colonnes/enum/policies RLS

**Livrable:** `tests/db_workflow_smoke.test.js`

---

## ÉTAPE 6 — RECAP FINAL + ARCHIVAGE

**Statut:** ⏳ **EN ATTENTE** (après ÉTAPE 5)

**Objectif:** Document récapitulatif unique + archivage migrations

**Livrables prévus:**
- `_fix_output/FINAL_RECAP_DB_AND_MIGRATIONS.md` (recap complet)
- `_fix_output/ARCHIVE_ACTIONS.md` (archivage contrôlé)

---

## BLOCKERS STATUS

| # | Blocker | Gravité | Fix | Statut |
|---|---------|---------|-----|--------|
| 1 | disponibilite_id missing | 🔴 CRITICAL | M42 | ✅ **RÉSOLU** (colonne présente) |
| 2 | mode_diffusion 'general' | 🔴 CRITICAL | M41 | ⏳ PRÉPARÉ (attente application) |
| 3 | enum 'diffuse' invalide | 🟠 HIGH | TBD | ⏳ EN ATTENTE (investigation) |

---

## FICHIERS GÉNÉRÉS (CUMUL)

### ÉTAPE 1 (Vérifications)
- `_fix_output/01_db_proofs.json`
- `_fix_output/01_db_proofs.md`
- `_fix_output/01_blockers_matrix.md`

### ÉTAPE 2 (M42 - ✅ TERMINÉ)
- `_fix_output/02_apply_m42_log.md` (log complet)
- `_fix_output/02_before_after_checks.sql` (requêtes validation)
- `_fix_output/02_migration_m42_to_apply.sql` (SQL appliqué)
- `_fix_output/02_post_apply_m42_results.json` (résultats validation)
- `_fix_output/02_post_apply_m42_proofs.md` (preuves post-apply)

### ÉTAPE 3 (M41 - ⏳ PRÉPARÉ)
- `_fix_output/03_pre_apply_m41_results.json` (analyse M05/M41)
- `_fix_output/03_m41_to_apply.sql` ⭐ (SQL prêt - 135 lignes)
- `_fix_output/03_pre_apply_m41_proofs.md` (preuves complètes)

### ÉTAPE 4-6
- ⏳ En attente

### Status tracking
- `_fix_output/00_STATUS.md` (ce fichier)
- `_fix_output/STATUS_FIX_BLOCKERS.md` (rapport complet)

---

## ACTIONS IMMÉDIATES REQUISES

### 🔴 PRIORITÉ 1: Appliquer migration M41 (BLOCKER #2)

**Instructions complètes:** Voir `_fix_output/03_pre_apply_m41_proofs.md`

**Résumé:**
1. Ouvrir Supabase Studio SQL Editor: https://bwzyajsrmfhrxdmfpyqy.supabase.co/project/_/sql
2. Copier contenu: `cat _fix_output/03_m41_to_apply.sql`
3. Coller dans SQL Editor
4. Exécuter (RUN)
5. Vérifier message: `✅ M41: RPC accept_ticket_and_create_mission harmonisée`

**Résultat attendu:**
- RPC accepte `mode_diffusion = 'general'` et `'restreint'`
- Erreur "Mode diffusion invalide: general" disparaît
- Workflow acceptation tickets débloqué

### 🟠 PRIORITÉ 2: Investigation enum ticket_status (BLOCKER #3)

**Action:** Extraire valeurs enum dans Supabase Studio

**Requête:**
```sql
SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ticket_status'
ORDER BY enumsortorder;
```

**À documenter:**
- Valeurs présentes (nouveau, en_attente, diffusé, etc.)
- Présence de 'diffuse', 'diffusé', 'diffusee'
- Décision: migration enum OU patch code

### 🟢 PRIORITÉ 3: Validation complète (OPTIONNEL)

**Action:** Exécuter requêtes validation FK et index M42

**Fichier:** `_fix_output/02_before_after_checks.sql` (checks 5-8)

---

**Dernière mise à jour:** 2026-01-04  
**Prochaine action:** Application manuelle M42 (utilisateur)
