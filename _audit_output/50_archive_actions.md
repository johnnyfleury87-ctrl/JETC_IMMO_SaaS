# PLAN ARCHIVAGE MIGRATIONS — Actions de classification

**Date:** 2026-01-04  
**Contexte:** 110 migrations présentes, 7 appliquées (6 uniques)  
**Objectif:** Classifier et archiver migrations selon statut réel

---

## 🎯 RÈGLES D'ARCHIVAGE

### Classifications possibles

| Statut | Critère | Destination |
|--------|---------|-------------|
| **VALIDATED** | Migration appliquée ET confirmée en DB | `Archive/VALIDATED/` |
| **DEPRECATED** | Migration obsolète/remplacée par consolidation | `Archive/DEPRECATED/` |
| **ROLLBACK** | Fichier rollback d'une migration | `Archive/ROLLBACKS/` |
| **CONSOLIDATED** | Migration consolidée (remplace plusieurs M-numbers) | `Archive/CONSOLIDATED/` |
| **UNKNOWN** | Statut indéterminé (présence en DB incertaine) | **RESTE dans supabase/migrations/** |

### Règles strictes

❌ **INTERDICTIONS:**
- Ne JAMAIS supprimer un fichier migration
- Ne JAMAIS déplacer une migration UNKNOWN (risque perte historique)
- Ne JAMAIS archiver une migration sans confirmation DB

✅ **AUTORISATIONS:**
- Déplacer migrations VALIDATED uniquement si enregistrées dans `migration_logs`
- Archiver ROLLBACKS associés aux migrations VALIDATED
- Archiver DEPRECATED quand remplacées par CONSOLIDATED confirmée
- Archiver CONSOLIDATED après application + validation

---

## 📊 CLASSIFICATION DES 110 MIGRATIONS

### Groupe 1: Migrations VALIDATED (6 + 1 doublon)

**Critère:** Présentes dans `03_migrations_applied_from_db.csv`

| # | Fichier | M-number | Executed_at | Statut | Action |
|---|---------|----------|-------------|--------|--------|
| 1 | `2025-12-20_migration_locataires_contraintes.sql` | NONE | 2025-12-20 06:31:33 | ✅ VALIDATED | → Archive/VALIDATED/ |
| 2 | `2025-12-20_rls_locataires_policies.sql` | NONE | 2025-12-20 06:31:57 | ✅ VALIDATED | → Archive/VALIDATED/ |
| 3 | `2025-12-20_rpc_creer_locataire.sql` | NONE | 2025-12-20 06:32:14 + 2025-12-23 12:42:04 (DOUBLON) | ✅ VALIDATED | → Archive/VALIDATED/ |
| 4 | `20251224000000_fix_logement_id_nullable.sql` | NONE | 2025-12-24 12:03:44 | ✅ VALIDATED | → Archive/VALIDATED/ |
| 5 | `20251224000001_logements_adresse_caracteristiques.sql` | NONE | 2025-12-24 14:35:06 | ✅ VALIDATED | → Archive/VALIDATED/ |
| 6 | `20251224000002_immeubles_npa_suisse_caracteristiques.sql` | NONE | 2025-12-24 14:37:41 | ✅ VALIDATED | → Archive/VALIDATED/ |

**Total:** 6 migrations uniques VALIDATED

**Anomalie:** Migration `2025-12-20_rpc_creer_locataire.sql` appliquée 2 fois selon logs (erreur enregistrement ou réapplication réelle)

---

### Groupe 2: Migrations UNKNOWN (10 pré-M-numbering NON enregistrées)

**Critère:** Présentes dans `supabase/migrations/` MAIS absentes de `migration_logs`

| # | Fichier | M-number | Statut présumé | Action |
|---|---------|----------|----------------|--------|
| 1 | `2025-12-20_temporary_passwords.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 2 | `2025-12-21_fix_locataire_sans_logement.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 3 | `20251223000000_add_regie_id_to_locataires.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 4 | `20251223000001_add_fk_profiles_regie_id.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 5 | `20251223000001_fix_temporary_passwords_no_bcrypt.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 6 | `20251223000002_add_trigger_ticket_requires_logement.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 7 | `20251223000002_create_temporary_passwords_complete.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 8 | `20251223000003_add_unique_active_locataire.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 9 | `20251223000004_fix_rls_recursion_immeubles.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |
| 10 | `20251223000100_logements_regie_id.sql` | NONE | ⚠️ UNKNOWN | **GARDER** supabase/migrations/ |

**Total:** 10 migrations pré-M-numbering UNKNOWN

**Raison:** Objets présents en DB (triggers, RPC, policies) mais migrations non enregistrées → Application manuelle probable

**Action:** **NE PAS DÉPLACER** tant que statut DB non confirmé

---

### Groupe 3: Migrations M01-M42 UNKNOWN (86 fichiers)

**Critère:** Aucune migration M01-M42 enregistrée dans `migration_logs`

#### Sous-groupe 3A: Migrations M01-M42 Forward (43 fichiers)

| M-number | Fichier | Statut | Action |
|----------|---------|--------|--------|
| M01 | `20251226170000_m01_add_budget_columns.sql` | ⚠️ UNKNOWN | **GARDER** |
| M02 | `20251226170100_m02_add_mode_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M03 | `20251226170200_m03_create_rpc_update_ticket_statut.sql` | ⚠️ UNKNOWN | **GARDER** |
| M04 | `20251226170300_m04_create_rpc_diffuser_ticket.sql` | ⚠️ UNKNOWN | **GARDER** |
| M05 | `20251226170400_m05_fix_rpc_accept_ticket.sql` | ⚠️ UNKNOWN | **GARDER** |
| M06 | `20251226170500_m06_fix_view_tickets_visibles_entreprise.sql` | ⚠️ UNKNOWN | **GARDER** |
| M07 | `20251226170600_m07_fix_rls_policy_entreprise.sql` | ⚠️ UNKNOWN | **GARDER** |
| M08 | `20251226170700_m08_add_classification_columns.sql` | ⚠️ UNKNOWN | **GARDER** |
| M09 | `20251226170800_m09_create_tickets_disponibilites.sql` | ⚠️ UNKNOWN | **GARDER** |
| M10 | `20251226170900_m10_create_trigger_validate_disponibilites.sql` | ⚠️ UNKNOWN | **GARDER** |
| M11 | `20251226171000_m11_harmonize_missions_montant_chf.sql` | ⚠️ UNKNOWN | **GARDER** |
| M13 | `20251226171100_m13_secure_delete_tickets_rls.sql` | ⚠️ UNKNOWN | **GARDER** |
| M14 | `20251226171200_m14_sync_mission_ticket_statut.sql` | ⚠️ UNKNOWN | **GARDER** |
| M15 | `20251226180000_m15_allow_null_priorite_plafond.sql` | ⚠️ UNKNOWN | **GARDER** |
| M16 | `20251226181000_m16_add_ventilation_check.sql` | ⚠️ UNKNOWN | **GARDER** |
| M17 | `20251226190000_m17_fix_check_piece_case_insensitive.sql` | ⚠️ UNKNOWN | **GARDER** |
| M18 | `20251226200000_m18_replace_triggers_with_rpc.sql` | ⚠️ UNKNOWN | **GARDER** |
| M19 | `20251226210000_m19_audit_debug_rpc.sql` | ⚠️ UNKNOWN (debug) | **GARDER** |
| M20 | `20251226220000_m20_fix_rls_policy_insert.sql` | ⚠️ UNKNOWN | **GARDER** |
| M21 | `20251226230000_m21_rpc_create_ticket_locataire.sql` | ⚠️ UNKNOWN | **GARDER** |
| M22 | `20251226240000_m22_fix_notify_new_ticket.sql` | ⚠️ UNKNOWN | **GARDER** |
| M23 | `20251226250000_m23_fix_schema_notify.sql` | ⚠️ UNKNOWN | **GARDER** |
| M24 | `20251226260000_m24_rls_regie_select_tickets.sql` | ⚠️ UNKNOWN | **GARDER** |
| M24 | `20251227000000_m24_masquage_colonnes_sensibles.sql` | ⚠️ UNKNOWN (DOUBLON M24) | **GARDER** |
| M25 | `20251227000100_m25_validation_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M26 | `20251227000200_m26_rls_insert_entreprises_regie.sql` | ⚠️ UNKNOWN | **GARDER** |
| M27 | `20251227000300_m27_expose_get_user_regie_id_rpc.sql` | ⚠️ UNKNOWN | **GARDER** |
| M28 | `20251227000400_m28_fix_rls_recursion_entreprises.sql` | ⚠️ UNKNOWN | **GARDER** |
| M29 | `20251227000500_m29_final.sql` | ⚠️ UNKNOWN | **GARDER** |
| M29 | `20251227000500_m29_rpc_create_entreprise_complete.sql` | ⚠️ UNKNOWN (DOUBLON M29) | **GARDER** |
| M30 | `20251227000600_m30_fix_mode_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M31 | `20251227000700_m31_add_tracabilite_tickets.sql` | ⚠️ UNKNOWN | **GARDER** |
| M31 | `20251227002000_m31_m34_workflow_tickets_complet.sql` | ⚠️ UNKNOWN (consolidation M31-M34) | **GARDER** |
| M32 | `20251227000800_m32_rpc_valider_ticket_regie.sql` | ⚠️ UNKNOWN | **GARDER** |
| M33 | `20251227000900_m33_rpc_get_entreprises_autorisees.sql` | ⚠️ UNKNOWN | **GARDER** |
| M34 | `20251227001000_m34_rls_entreprise_tickets.sql` | ⚠️ UNKNOWN | **GARDER** |
| M35 | `20251227001100_m35_harmonize_mode_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M36 | `20260104001200_m36_fix_disponibilites_rule.sql` | ⚠️ UNKNOWN | **GARDER** |
| M37 | `20260104001300_m37_fix_vue_entreprise_terminologie.sql` | ⚠️ UNKNOWN | **GARDER** |
| M38 | `20260104001400_m38_rpc_update_mode_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M39 | `20260104001500_m39_fix_rls_mode_diffusion.sql` | ⚠️ UNKNOWN | **GARDER** |
| M40 | `20260104001600_m40_fix_rls_disponibilites.sql` | ⚠️ UNKNOWN | **GARDER** |
| M41 | `20260104001700_m41_harmonize_rpc_acceptation.sql` | ⚠️ UNKNOWN | **GARDER** |
| M42 | `20260104001800_m42_add_disponibilite_id_missions.sql` | ⚠️ UNKNOWN | **GARDER** |

**Total:** 43 migrations forward M01-M42 (dont 3 doublons M24/M29, 1 consolidation M31-M34)

**Note M12:** Manquant de la séquence M01-M42 (pas de fichier M12)

#### Sous-groupe 3B: Migrations M01-M42 Rollback (41 fichiers)

**Statut:** Tous ⚠️ UNKNOWN  
**Action:** **GARDER dans supabase/migrations/** (rollbacks associés aux forward)

#### Sous-groupe 3C: Migration Consolidée M31-M35 (1 fichier)

| M-number | Fichier | Type | Statut | Action |
|----------|---------|------|--------|--------|
| M31 | `20260104000000_m31_m35_workflow_complet_consolidated.sql` | consolidated | ⚠️ UNKNOWN | **GARDER** |

**Description:** Super-consolidation remplaçant M31→M35 (5 migrations fusionnées)

---

### Groupe 4: Fichiers hors nomenclature (8 fichiers)

**Critère:** Pas de M-number, fichiers debug/validation

| # | Fichier | Type | Statut | Action |
|---|---------|------|--------|--------|
| 1 | `M22.5.DEBUG_patch_raise_return.sql` | debug | ⚠️ UNKNOWN | **GARDER** |
| 2 | `M22.5_rpc_tickets_liste_detail_regie.sql` | forward | ⚠️ UNKNOWN | **GARDER** |
| 3 | `M22.6_validation_regies_nom_column.sql` | forward | ⚠️ UNKNOWN | **GARDER** |
| 4 | `M22_rpc_regie_dashboard_tickets.sql` | forward | ⚠️ UNKNOWN | **GARDER** |
| 5 | `M23_rpc_tickets_locataire.sql` | forward | ⚠️ UNKNOWN | **GARDER** |
| 6 | `VALIDATION_POST_MIGRATION.sql` | validation | ⚠️ UNKNOWN | **GARDER** |
| 7 | `debug_entreprise_login.sql` | debug | ⚠️ UNKNOWN | **GARDER** |
| 8 | `sanity_check_entreprise_workflow.sql` | validation | ⚠️ UNKNOWN | **GARDER** |

**Total:** 8 fichiers hors nomenclature

**Raison:** Scripts utilitaires/debug sans M-number → statut DB incertain

---

## 📋 RÉSUMÉ CLASSIFICATION

| Statut | Count | % | Action archivage |
|--------|-------|---|------------------|
| ✅ **VALIDATED** | 6 | 5.5% | → Archive/VALIDATED/ |
| ⚠️ **UNKNOWN** | 104 | 94.5% | **RESTER supabase/migrations/** |
| 🔴 **DEPRECATED** | 0 | 0% | (aucune identifiée) |
| 🔵 **CONSOLIDATED** | 0 | 0% | (aucune appliquée) |
| 📁 **ROLLBACK** | 0 fichiers seuls | 0% | (41 rollbacks liés aux forward UNKNOWN) |

**Total:** 110 fichiers

---

## 🎬 PLAN D'ACTIONS (PHASE PAR PHASE)

### Phase 1: Archivage VALIDATED (AUTORISÉ)

**Migrations à déplacer:** 6 fichiers

```bash
# Créer structure Archive/VALIDATED/ (déjà existante)
mkdir -p Archive/VALIDATED/

# Déplacer migrations VALIDATED confirmées
mv supabase/migrations/2025-12-20_migration_locataires_contraintes.sql Archive/VALIDATED/
mv supabase/migrations/2025-12-20_rls_locataires_policies.sql Archive/VALIDATED/
mv supabase/migrations/2025-12-20_rpc_creer_locataire.sql Archive/VALIDATED/
mv supabase/migrations/20251224000000_fix_logement_id_nullable.sql Archive/VALIDATED/
mv supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql Archive/VALIDATED/
mv supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql Archive/VALIDATED/
```

**Justification:**
- Toutes présentes dans `migration_logs`
- Dates d'exécution confirmées
- Pas de risque de perte historique

**Risque:** ⚠️ Migration `2025-12-20_rpc_creer_locataire.sql` appliquée 2x → vérifier raison doublon avant archivage

---

### Phase 2: Investigation UNKNOWN (BLOQUÉ)

**Migrations concernées:** 104 fichiers (94.5%)

**Actions requises AVANT archivage:**

1. **Vérifier présence objets en DB:**
   - Comparer CSV audit vs migrations M01-M42
   - Identifier quelles migrations ont été appliquées manuellement
   - Cross-référencer avec `30_incoherences.csv` (10 RPC présents sans migration enregistrée)

2. **Enregistrer rétroactivement dans migration_logs:**
   ```sql
   -- EXEMPLE (À ADAPTER selon investigation)
   INSERT INTO migration_logs (migration_name, executed_at, description)
   VALUES 
     ('20251226170000_m01_add_budget_columns', now(), 'Application manuelle - enregistrement rétroactif'),
     -- ... autres migrations confirmées appliquées
   ```

3. **Après confirmation DB → Reclasser:**
   - UNKNOWN → VALIDATED (si appliquée + objets présents)
   - UNKNOWN → DEPRECATED (si remplacée par consolidation)

**Décision:** **NE PAS ARCHIVER** tant que statut non confirmé

---

### Phase 3: Gestion DEPRECATED (EN ATTENTE)

**Migrations potentiellement DEPRECATED:**

#### Candidats DEPRECATED M31-M34 (4 migrations)

| M-number | Fichier | Remplacée par | Action future |
|----------|---------|---------------|---------------|
| M31 | `20251227000700_m31_add_tracabilite_tickets.sql` | `20251227002000_m31_m34_workflow_tickets_complet.sql` | → Archive/DEPRECATED/ (si consolidation appliquée) |
| M32 | `20251227000800_m32_rpc_valider_ticket_regie.sql` | `20251227002000_m31_m34_workflow_tickets_complet.sql` | → Archive/DEPRECATED/ |
| M33 | `20251227000900_m33_rpc_get_entreprises_autorisees.sql` | `20251227002000_m31_m34_workflow_tickets_complet.sql` | → Archive/DEPRECATED/ |
| M34 | `20251227001000_m34_rls_entreprise_tickets.sql` | `20251227002000_m31_m34_workflow_tickets_complet.sql` | → Archive/DEPRECATED/ |

#### Candidats DEPRECATED M31-M35 (5 migrations + consolidation M31-M34)

| M-number | Fichier | Remplacée par | Action future |
|----------|---------|---------------|---------------|
| M31-M34 | (4 fichiers ci-dessus) | `20260104000000_m31_m35_workflow_complet_consolidated.sql` | → Archive/DEPRECATED/ |
| M31-M34 consolidation | `20251227002000_m31_m34_workflow_tickets_complet.sql` | `20260104000000_m31_m35_workflow_complet_consolidated.sql` | → Archive/DEPRECATED/ |
| M35 | `20251227001100_m35_harmonize_mode_diffusion.sql` | `20260104000000_m31_m35_workflow_complet_consolidated.sql` | → Archive/DEPRECATED/ |

**Décision:** **NE PAS DÉPLACER** tant que consolidation non appliquée ET confirmée

---

### Phase 4: Archivage ROLLBACKS (EN ATTENTE)

**Fichiers concernés:** 41 fichiers `*_rollback.sql`

**Règle:** Rollback suit le statut de sa migration forward

| Statut forward | Action rollback |
|----------------|-----------------|
| VALIDATED | → Archive/ROLLBACKS/ |
| DEPRECATED | → Archive/ROLLBACKS/ (ou supprimer si consolidation appliquée) |
| UNKNOWN | **GARDER** supabase/migrations/ |
| CONSOLIDATED appliquée | → Archive/ROLLBACKS/ avec forward |

**Décision actuelle:** **GARDER tous les rollbacks** (aucune migration M01-M42 confirmée)

---

### Phase 5: Archivage CONSOLIDATED (EN ATTENTE)

**Fichiers concernés:**
1. `20251227002000_m31_m34_workflow_tickets_complet.sql` (M31-M34)
2. `20260104000000_m31_m35_workflow_complet_consolidated.sql` (M31-M35)

**Règle:** Migration CONSOLIDATED → Archive/CONSOLIDATED/ UNIQUEMENT après:
1. Application confirmée (enregistrée dans migration_logs)
2. Validation objets présents en DB
3. Migrations originales classées DEPRECATED

**Décision:** **NE PAS DÉPLACER** (consolidations non appliquées)

---

## ⚠️ RISQUES IDENTIFIÉS

### Risque 1: Perte historique

**Scénario:** Archiver migration UNKNOWN alors qu'elle n'a PAS été appliquée

**Impact:**
- Perte définitive de la migration
- Impossible de l'appliquer ultérieurement
- Schéma DB incomplet

**Mitigation:** **NE JAMAIS archiver migration UNKNOWN**

---

### Risque 2: Double application

**Scénario:** Migration `2025-12-20_rpc_creer_locataire.sql` enregistrée 2x dans logs

**Impact possible:**
- Double création RPC (erreur si pas IF NOT EXISTS)
- Données dupliquées
- Incohérence migration_logs

**Investigation requise:**
```sql
-- Vérifier raison doublon
SELECT * FROM migration_logs 
WHERE migration_name = '2025-12-20_rpc_creer_locataire'
ORDER BY executed_at;

-- Vérifier RPC existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('creer_locataire_complet', 'liberer_logement_locataire');
```

---

### Risque 3: Consolidation partielle

**Scénario:** Appliquer `m31_m35_workflow_complet_consolidated.sql` alors que M31-M34 individuelles déjà appliquées

**Impact:**
- Conflits création objets (duplicate key, already exists)
- Migration échoue
- État DB incohérent

**Mitigation:** Vérifier présence objets AVANT appliquer consolidation

---

## 📅 CALENDRIER ARCHIVAGE

### Immédiat (Phase 1)

✅ **AUTORISÉ:**
- Archiver 6 migrations VALIDATED dans `Archive/VALIDATED/`

⏳ **EN ATTENTE investigation doublon:**
- Migration `2025-12-20_rpc_creer_locataire.sql` (appliquée 2x)

---

### Court terme (après investigation DB)

⏳ **REQUIERT confirmation:**
- Vérifier état DB pour migrations M01-M42 UNKNOWN
- Cross-référencer avec RPC présents (10 RPC sans migration enregistrée)
- Enregistrer rétroactivement migrations confirmées appliquées
- Reclasser UNKNOWN → VALIDATED

---

### Moyen terme (après application consolidations)

⏳ **REQUIERT actions préalables:**
- Appliquer `20260104000000_m31_m35_workflow_complet_consolidated.sql`
- Valider objets créés
- Enregistrer dans migration_logs
- Déplacer vers Archive/CONSOLIDATED/
- Déplacer M31-M35 individuelles vers Archive/DEPRECATED/

---

## 🎯 STATUT FINAL

### Actions autorisées MAINTENANT

```bash
# Phase 1 uniquement
mkdir -p Archive/VALIDATED/
mv supabase/migrations/2025-12-20_migration_locataires_contraintes.sql Archive/VALIDATED/
mv supabase/migrations/2025-12-20_rls_locataires_policies.sql Archive/VALIDATED/
# ⚠️ SUSPENDRE 2025-12-20_rpc_creer_locataire.sql (investigation doublon requise)
mv supabase/migrations/20251224000000_fix_logement_id_nullable.sql Archive/VALIDATED/
mv supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql Archive/VALIDATED/
mv supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql Archive/VALIDATED/

# Créer fichier traçabilité
cat > Archive/VALIDATED/README.md << 'EOF'
# Migrations VALIDATED

Migrations confirmées appliquées et enregistrées dans migration_logs.

## Règles

- Toutes les migrations ici sont CONFIRMÉES appliquées
- Dates d'exécution disponibles dans migration_logs
- NE PAS réappliquer ces migrations

## Liste

- 2025-12-20_migration_locataires_contraintes.sql (2025-12-20 06:31:33)
- 2025-12-20_rls_locataires_policies.sql (2025-12-20 06:31:57)
- 20251224000000_fix_logement_id_nullable.sql (2025-12-24 12:03:44)
- 20251224000001_logements_adresse_caracteristiques.sql (2025-12-24 14:35:06)
- 20251224000002_immeubles_npa_suisse_caracteristiques.sql (2025-12-24 14:37:41)

## EN ATTENTE investigation

- 2025-12-20_rpc_creer_locataire.sql (appliquée 2x: 2025-12-20 06:32:14 + 2025-12-23 12:42:04)
EOF
```

### Actions BLOQUÉES (investigation requise)

❌ **INTERDIT avant confirmation DB:**
- Archiver migrations M01-M42 (104 fichiers UNKNOWN)
- Archiver fichiers hors nomenclature (8 fichiers)
- Archiver rollbacks (41 fichiers liés aux UNKNOWN)
- Archiver consolidations (2 fichiers non appliquées)

---

**FIN PLAN ARCHIVAGE**

