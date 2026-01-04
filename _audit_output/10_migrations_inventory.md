# INVENTAIRE MIGRATIONS — Résumé

**Date:** 2026-01-04  
**Source:** `supabase/migrations/`  
**Total fichiers:** 110

---

## STATISTIQUES GLOBALES

### Répartition par type
| Type | Nombre | Description |
|------|--------|-------------|
| **forward** | 63 | Migrations principales (création/modification) |
| **rollback** | 41 | Rollbacks de migrations |
| **debug** | 3 | Fichiers de debug/patch temporaires |
| **validation** | 2 | Scripts de validation/sanity check |
| **consolidated** | 1 | Migration consolidée (M31_M35) |
| **TOTAL** | **110** | |

### Répartition par M-number
- **Migrations numérotées (M01-M42):** 86 fichiers
- **Fichiers sans M-number (NONE):** 24 fichiers
- **M-numbers uniques:** M01 à M42 (manquant: M12)

---

## ⚠️ DOUBLONS DÉTECTÉS (3)

### M24: 4 fichiers (attendu: 2)
```
- 20251226260000_m24_rls_regie_select_tickets.sql
- 20251226260000_m24_rls_regie_select_tickets_rollback.sql
- 20251227000000_m24_masquage_colonnes_sensibles.sql
- 20251227000000_m24_masquage_colonnes_sensibles_rollback.sql
```
**Observation:** M24 appliquée en 2 versions différentes (RLS régie + masquage colonnes)

---

### M29: 3 fichiers (attendu: 2)
```
- 20251227000500_m29_final.sql
- 20251227000500_m29_rpc_create_entreprise_complete.sql
- 20251227000500_m29_rpc_create_entreprise_complete_rollback.sql
```
**Observation:** M29 avec fichier "final.sql" + version RPC complète

---

### M31: 5 fichiers (attendu: 2)
```
- 20251227000700_m31_add_tracabilite_tickets.sql
- 20251227000700_m31_add_tracabilite_tickets_rollback.sql
- 20251227002000_m31_m34_workflow_tickets_complet.sql
- 20251227002000_m31_m34_workflow_tickets_complet_rollback.sql
- 20260104000000_m31_m35_workflow_complet_consolidated.sql
```
**Observation:** M31 avec 3 versions (traçabilité + workflow complet M34 + consolidated M35)

---

## 📁 FICHIERS SANS M-NUMBER (24)

### Migrations anciennes (16 fichiers)
**Période:** 2025-12-20 à 2025-12-24  
**Pattern:** `YYYY-MM-DD_*` ou `YYYYMMDDHHMMSS_*`

Exemples:
- `2025-12-20_migration_locataires_contraintes.sql`
- `2025-12-20_rls_locataires_policies.sql`
- `2025-12-20_rpc_creer_locataire.sql`
- `20251223000000_add_regie_id_to_locataires.sql`
- `20251224000001_logements_adresse_caracteristiques.sql`

**Type:** Migrations initiales avant adoption nomenclature M-XX

---

### Fichiers spéciaux M22/M23 (4 fichiers)
```
- M22_rpc_regie_dashboard_tickets.sql
- M22.5_rpc_tickets_liste_detail_regie.sql
- M22.5.DEBUG_patch_raise_return.sql
- M22.6_validation_regies_nom_column.sql
- M23_rpc_tickets_locataire.sql
```
**Type:** Migrations M22/M23 sans timestamp, pattern non-standard

---

### Fichiers utilitaires (4 fichiers)
```
- VALIDATION_POST_MIGRATION.sql
- debug_entreprise_login.sql
- sanity_check_entreprise_workflow.sql
- 20251227000600_m30_fix_mode_diffusion.sql (M30 sans rollback)
```
**Type:** Scripts debug/validation/fix isolés

---

## 🔍 MIGRATIONS STANDARDS (M01-M42)

### Migrations complètes (avec forward + rollback)
**M01 à M11:** ✅ Complètes  
**M13 à M28:** ✅ Complètes  
**M30:** ⚠️ Forward uniquement (pas de rollback)  
**M32 à M42:** ✅ Complètes

### Migration manquante
**M12:** ❌ Absente (saut de numérotation)

### Migrations récentes (2026-01-04)
**M36 à M42:** Corrections récentes
- M36: fix_disponibilites_rule
- M37: fix_vue_entreprise_terminologie
- M38: rpc_update_mode_diffusion
- M39: fix_rls_mode_diffusion
- M40: fix_rls_disponibilites
- M41: harmonize_rpc_acceptation
- M42: add_disponibilite_id_missions

---

## 📊 CHRONOLOGIE

### Phase 1: Migrations initiales sans M-number
**Période:** 2025-12-20 à 2025-12-24  
**Fichiers:** 16  
**Sujets:** Locataires, RLS, RPC, temporary_passwords, logements, immeubles

### Phase 2: Migrations M01-M11
**Période:** 2025-12-26  
**Fichiers:** 22 (11 forward + 11 rollback)  
**Sujets:** Budget, mode_diffusion, RPC tickets, disponibilités, missions

### Phase 3: Migrations M13-M28
**Période:** 2025-12-26 à 2025-12-27  
**Fichiers:** 32 (16 forward + 16 rollback)  
**Sujets:** RLS sécurité, sync missions, validation, workflow complet

### Phase 4: Migrations M29-M35
**Période:** 2025-12-27  
**Fichiers:** 14 (7 forward + 7 rollback)  
**Sujets:** Entreprises, traçabilité, harmonisation mode_diffusion

### Phase 5: Migrations M36-M42
**Période:** 2026-01-04  
**Fichiers:** 14 (7 forward + 7 rollback)  
**Sujets:** Corrections RLS, RPC acceptation, disponibilités

---

## 🎯 OBSERVATIONS CLÉS

1. **Doublons M24/M29/M31:** Nécessite clarification applicabilité
2. **M12 manquante:** Gap dans numérotation
3. **M30 sans rollback:** Risque si rollback nécessaire
4. **24 fichiers sans M-number:** Migrations anciennes pré-nomenclature
5. **3 fichiers debug:** `M22.5.DEBUG`, `debug_entreprise_login.sql`, `sanity_check`
6. **1 consolidated:** M31_M35 (consolidation workflow)

---

## 🔄 ACTIONS RECOMMANDÉES (pour étapes suivantes)

1. Vérifier état DB pour chaque migration (ÉTAPE 3)
2. Comparer avec schéma réel CSV audit (ÉTAPE 4)
3. Identifier migrations appliquées vs fichiers présents (ÉTAPE 4)
4. Clarifier doublons M24/M29/M31 (ÉTAPE 4)
5. Archiver migrations obsolètes/deprecated (ÉTAPE 6)

---

**Fichier source:** `_audit_output/10_migrations_inventory.csv` (110 lignes)  
**Statut:** ✅ INVENTAIRE COMPLET
