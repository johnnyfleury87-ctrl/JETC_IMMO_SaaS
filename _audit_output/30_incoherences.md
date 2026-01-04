# DIFF COMPLET — Incohérences Migrations ↔ Database

**Date:** 2026-01-04  
**ÉTAPE:** 4 / 7  
**Sources:**
- Base réelle : `supabase/Audit_supabase/*.csv` (0→15)
- Historique réel : `_audit_output/03_migrations_applied_from_db.csv`
- Migrations présentes : `supabase/migrations/*.sql` (110 fichiers)

---

## 📊 RÉSUMÉ EXÉCUTIF

### État Global

| Métrique | Valeur | Statut |
|----------|--------|--------|
| **Migrations présentes (supabase/migrations/)** | 110 fichiers | ✅ |
| **Migrations appliquées (migration_logs)** | 7 enregistrements | ⚠️ |
| **Migrations numérotées (M01-M42)** | 86 fichiers | ✅ |
| **Migrations sans M-number** | 24 fichiers | ⚠️ |
| **Incohérences détectées** | 80 | 🔴 |
| **Incohérences BLOCKER** | 10 | 🔴 |
| **Incohérences HIGH** | 41 | 🟠 |

### Constat Critique

**⚠️ ÉCART MASSIF DÉTECTÉ :** Seulement **7 migrations enregistrées** dans `migration_logs` pour **110 fichiers** présents dans `supabase/migrations/`.

**🔴 RLS DÉSACTIVÉ PARTOUT :** Les 19 tables de `public` ont RLS OFF alors que 315 policies sont définies = **policies inactives**.

---

## 🔥 INCOHÉRENCES BLOCKER (10)

Ces incohérences **empêchent le fonctionnement** du système.

| # | Type | Objet | Description | Fichiers impliqués |
|---|------|-------|-------------|-------------------|
| 1 | **MIGRATION_NON_APPLIQUEE** | `M02_add_mode_diffusion` | Colonne `tickets.mode_diffusion` manquante → erreur 400 entreprise | M02 forward + rollback |
| 2 | **MIGRATION_NON_APPLIQUEE** | `M05_fix_rpc_accept_ticket` | RPC `accept_ticket_and_create_mission()` désynchronisé | M05 forward + rollback |
| 3 | **MIGRATION_NON_APPLIQUEE** | `M09_create_tickets_disponibilites` | Table `tickets_disponibilites` manquante (bien que présente en DB orpheline) | M09 forward + rollback |
| 4 | **MIGRATION_NON_APPLIQUEE** | `M30_fix_mode_diffusion` | Correctif mode_diffusion NON appliqué = **cause racine erreur 400** | M30 forward |
| 5 | **MIGRATION_NON_APPLIQUEE** | `M35_harmonize_mode_diffusion` | Harmonisation mode_diffusion NON appliquée = **cause racine erreur 400** | M35 forward + rollback |
| 6 | **DOUBLON_MIGRATION** | `M31_m35_workflow_complet_consolidated` | Migration consolidée M31→M35 (type: consolidated) NON appliquée | M31_M35 consolidated |
| 7 | **MIGRATION_NON_APPLIQUEE** | `M38_rpc_update_mode_diffusion` | RPC `update_entreprise_mode_diffusion()` **MANQUANT EN DB** → impossible de changer mode | M38 forward + rollback |
| 8 | **MIGRATION_NON_APPLIQUEE** | `M39_fix_rls_mode_diffusion` | Policy RLS mode_diffusion désynchronisée → **empêche acceptation ticket** | M39 forward + rollback |
| 9 | **RPC_MANQUANT** | `update_entreprise_mode_diffusion` | RPC absent de CSV audit 9_Fonctions malgré migration M38 existante | M38 |
| 10 | **RLS_DESACTIVE_PARTOUT** | `ALL_TABLES (19 tables)` | **RLS OFF sur toutes les tables** → 315 policies définies mais **INACTIVES** | Affecte tout le schéma public |

---

## 🟠 INCOHÉRENCES HIGH (41)

Sélection des plus critiques (liste complète dans CSV) :

### Migrations non appliquées (exemples)

- **M01** : Colonnes budget tickets (`plafond_intervention_chf`, `devise`)
- **M04** : RPC `diffuser_ticket()` (présent en DB mais migration non enregistrée)
- **M06** : VIEW `tickets_visibles_entreprise` (absente de CSV audit 11_Views)
- **M07** : Policy RLS entreprise désynchronisée
- **M10** : Trigger validation disponibilités avant diffusion
- **M11** : Harmonisation `missions.montant_reel_chf`
- **M13** : Policy DELETE tickets sécurisée
- **M14** : Trigger sync mission/ticket statut
- **M18** : Refactoring triggers → RPC
- **M21** : RPC `create_ticket_locataire()` (présent en DB mais migration non enregistrée)
- **M26** : Policy INSERT entreprises (présente en DB mais migration non enregistrée)
- **M27** : RPC `get_user_regie_id()` (**utilisé par TOUTES les policies** mais migration non enregistrée)
- **M28** : Fix RLS récursion entreprises
- **M31 à M34** : Workflow tickets complet (4 migrations + consolidations)
- **M40** : Policy disponibilités entreprises
- **M41** : Harmonisation RPC acceptation
- **M42** : Colonne `missions.disponibilite_id`

### Objets orphelins (présents en DB sans migration enregistrée)

- **tickets_disponibilites** (table) : Présente en CSV audit 3_Tables mais migration M09 non appliquée selon logs
- **tickets_visibles_entreprise** (VIEW) : Absente de CSV audit 11_Views mais référencée dans M06/M37
- **accept_ticket_and_create_mission** (RPC) : Présent en DB mais M05/M41 non appliquées
- **get_user_regie_id** (RPC) : Présent en DB, utilisé partout, mais M27 non appliquée

---

## 🟡 INCOHÉRENCES MEDIUM (17)

Exemples :

- **M03** : RPC `update_ticket_statut()` absent
- **M08** : Colonnes classification (`sous_categorie`, `piece`)
- **M15** : Contraintes NULL sur priorite/plafond
- **M22** : RPC `notify_new_ticket()` (présent en DB mais migration non enregistrée)
- **M23** : Correctif schéma notify
- **M29** : 3 fichiers M29 (DOUBLON) - RPC création entreprise
- **M36** : Règle validation disponibilités
- **M22.5 à M23** : Fichiers hors nomenclature (RPC dashboard, tickets locataire)
- **Migration 2025-12-20_rpc_creer_locataire** : Appliquée 2 fois selon logs (double enregistrement)
- **M12 MANQUANT** : Trou dans séquence (M01-M11 → M13-M42)

---

## 🟢 INCOHÉRENCES LOW (12)

Exemples :

- **M16** : Contrainte ventilation
- **M17** : Contrainte piece case insensitive
- **M19** : RPC debug `jtec_debug_schema()` (présent en DB mais migration non enregistrée)
- **M37** : Terminologie vue entreprise
- **Fichiers debug/validation** : `VALIDATION_POST_MIGRATION.sql`, `debug_entreprise_login.sql`, `sanity_check_entreprise_workflow.sql` (hors nomenclature, non tracés)
- **Policies régies entreprises** : Présentes en DB mais M29 non enregistrée (impact faible)

---

## 📋 TABLEAU DES INCOHÉRENCES PAR CATÉGORIE

| Catégorie | Count | BLOCKER | HIGH | MEDIUM | LOW |
|-----------|-------|---------|------|--------|-----|
| **MIGRATION_NON_APPLIQUEE** | 47 | 6 | 32 | 7 | 2 |
| **DOUBLON_MIGRATION** | 3 | 1 | 2 | 0 | 0 |
| **OBJET_ORPHELIN** | 2 | 0 | 2 | 0 | 0 |
| **RPC_PRESENT_NON_ENREGISTRE** | 10 | 0 | 10 | 0 | 0 |
| **RPC_MANQUANT** | 1 | 1 | 0 | 0 | 0 |
| **COLONNE_MANQUANTE** | 5 | 0 | 5 | 0 | 0 |
| **POLICY_MANQUANTE** | 5 | 1 | 2 | 0 | 2 |
| **COLONNE_MODE_DIFFUSION_DESYNC** | 1 | 1 | 0 | 0 | 0 |
| **MIGRATION_APPLIQUEE_SANS_FICHIER** | 1 | 0 | 0 | 1 | 0 |
| **FICHIER_HORS_NOMENCLATURE** | 8 | 0 | 0 | 2 | 6 |
| **TRIGGER_MANQUANT** | 1 | 0 | 1 | 0 | 0 |
| **MIGRATION_MANQUANTE_M12** | 1 | 0 | 0 | 1 | 0 |
| **RLS_DESACTIVE_PARTOUT** | 1 | 1 | 0 | 0 | 0 |
| **TOTAL** | **80** | **10** | **41** | **17** | **12** |

---

## 🎯 FOCUS : ERREUR BLOCKER "Mode diffusion invalide: general"

### Migrations impliquées dans le bug (NON APPLIQUÉES)

| Migration | Objet | Impact sur le bug |
|-----------|-------|-------------------|
| **M02** | `ADD COLUMN tickets.mode_diffusion` | Colonne manquante ou mal typée |
| **M30** | `fix_mode_diffusion` | Correctif mode_diffusion NON appliqué |
| **M35** | `harmonize_mode_diffusion` | Harmonisation mode_diffusion + policies NON appliquées |
| **M38** | `rpc_update_mode_diffusion` | RPC `update_entreprise_mode_diffusion()` **ABSENT EN DB** |
| **M39** | `fix_rls_mode_diffusion` | Policy `Entreprise can view general tickets` **MANQUANTE** |

### État actuel (factuel)

**Colonne `tickets.mode_diffusion` (CSV audit 4_Colonnes) :**
- Type : `text`
- NULL : `YES`
- DEFAULT : `null`

**Colonne `regies_entreprises.mode_diffusion` (CSV audit 4_Colonnes) :**
- Type : `text`
- NULL : `NO`
- DEFAULT : `'restreint'::text`

**Policies tickets pour entreprises (CSV audit 8_Policies) :**
- ❌ `Entreprise can view general tickets` : **ABSENTE**
- ❌ `Entreprise can view assigned tickets` : **ABSENTE**
- ✅ `Admin JTEC can view all tickets` : PRÉSENTE

**RPC `update_entreprise_mode_diffusion` (CSV audit 9_Fonctions) :**
- ❌ **ABSENT** (migration M38 existe mais NON appliquée)

### Analyse factuelle

1. **tickets.mode_diffusion** peut être NULL (pas de contrainte NOT NULL)
2. Aucune policy ne permet aux entreprises de voir les tickets avec `mode_diffusion = 'general'`
3. RPC pour changer le mode de diffusion **n'existe pas** en DB
4. 5 migrations critiques (M02, M30, M35, M38, M39) **NON appliquées**

➡️ **HYPOTHÈSE :** L'erreur "Mode diffusion invalide: general" provient de :
- Soit `tickets.mode_diffusion` NULL et validation échoue
- Soit `mode_diffusion = 'general'` mais policy RLS bloque l'accès entreprise (policy manquante)
- Soit contrainte CHECK sur `mode_diffusion` refuse 'general' (migration M02 non appliquée)

---

## 📐 DOUBLONS DE MIGRATIONS

### M24 (2 fichiers)

1. **20251226260000_m24_rls_regie_select_tickets.sql** : Policy regie SELECT tickets
2. **20251227000000_m24_masquage_colonnes_sensibles.sql** : Masquage colonnes sensibles

➡️ Même M-number, objectifs différents

### M29 (3 fichiers)

1. **20251227000500_m29_final.sql** : Consolidation finale
2. **20251227000500_m29_rpc_create_entreprise_complete.sql** : RPC création entreprise

➡️ Même M-number, fichiers différents

### M31 (5 fichiers)

1. **20251227000700_m31_add_tracabilite_tickets.sql** : Colonnes traçabilité
2. **20251227002000_m31_m34_workflow_tickets_complet.sql** : Consolidation M31+M32+M33+M34
3. **20260104000000_m31_m35_workflow_complet_consolidated.sql** : Super-consolidation M31→M35 (type: consolidated)

➡️ Évolution par consolidations successives

---

## 🔍 OBJETS PRÉSENTS EN DB SANS MIGRATION ENREGISTRÉE

### Tables

- **tickets_disponibilites** : Présente en CSV audit 3_Tables (6 colonnes, RLS OFF) mais migration M09 non appliquée selon logs

### Views

- **tickets_visibles_entreprise** : Absente de CSV audit 11_Views mais référencée dans M06/M37

### RPC (10)

- `accept_ticket_and_create_mission` (M05/M41)
- `create_ticket_locataire` (M21)
- `diffuser_ticket` (M04)
- `get_entreprises_autorisees` (M33)
- `get_user_regie_id` (M27) **← UTILISÉ PAR TOUTES LES POLICIES**
- `valider_ticket_regie` (M32)
- `create_entreprise_simple` (M29)
- `create_entreprise_with_profile` (M29)
- `toggle_entreprise_mode` (M29)
- `jtec_debug_schema` (M19)

### Policies (5 exemples)

- `Regie can update authorized entreprises` (M29)
- `Regie can delete authorized entreprises` (M29)
- `Entreprise can view general tickets` ← **BLOCKER : ABSENTE**
- `Entreprise can view assigned tickets` ← **HIGH : ABSENTE**
- `Entreprise can view disponibilites for visible tickets` ← **HIGH : ABSENTE**

---

## 🗂️ FICHIERS HORS NOMENCLATURE (24)

### Fichiers pré-M-numbering (16)

- `2025-12-20_migration_locataires_contraintes.sql`
- `2025-12-20_rls_locataires_policies.sql`
- `2025-12-20_rpc_creer_locataire.sql`
- `2025-12-20_temporary_passwords.sql`
- `2025-12-21_fix_locataire_sans_logement.sql`
- `20251223000000_add_regie_id_to_locataires.sql`
- `20251223000001_add_fk_profiles_regie_id.sql`
- `20251223000001_fix_temporary_passwords_no_bcrypt.sql`
- `20251223000002_add_trigger_ticket_requires_logement.sql`
- `20251223000002_create_temporary_passwords_complete.sql`
- `20251223000003_add_unique_active_locataire.sql`
- `20251223000004_fix_rls_recursion_immeubles.sql`
- `20251223000100_logements_regie_id.sql`
- `20251224000000_fix_logement_id_nullable.sql`
- `20251224000001_logements_adresse_caracteristiques.sql`
- `20251224000002_immeubles_npa_suisse_caracteristiques.sql`

### Fichiers debug/validation (8)

- `M22.5.DEBUG_patch_raise_return.sql`
- `M22.5_rpc_tickets_liste_detail_regie.sql`
- `M22.6_validation_regies_nom_column.sql`
- `M22_rpc_regie_dashboard_tickets.sql`
- `M23_rpc_tickets_locataire.sql`
- `VALIDATION_POST_MIGRATION.sql`
- `debug_entreprise_login.sql`
- `sanity_check_entreprise_workflow.sql`

---

## 📅 HISTORIQUE MIGRATIONS APPLIQUÉES (FACTUEL)

Source : `_audit_output/03_migrations_applied_from_db.csv`

| # | migration_name | executed_at | description |
|---|----------------|-------------|-------------|
| 1 | `20251224000002_immeubles_npa_suisse_caracteristiques` | 2025-12-24 14:37:41 | Adaptation format NPA suisse + colonnes immeuble |
| 2 | `20251224000001_logements_adresse_caracteristiques` | 2025-12-24 14:35:06 | Ajout colonnes adresse + caractéristiques logements |
| 3 | `20251224000000_fix_logement_id_nullable` | 2025-12-24 12:03:44 | DROP NOT NULL sur locataires.logement_id |
| 4 | `2025-12-20_rpc_creer_locataire` | 2025-12-23 12:42:04 | RPC creer_locataire_complet() + liberer_logement_locataire() |
| 5 | `2025-12-20_rpc_creer_locataire` | 2025-12-20 06:32:14 | **DOUBLON** (même migration appliquée 2x) |
| 6 | `2025-12-20_rls_locataires_policies` | 2025-12-20 06:31:57 | Refonte policies locataires |
| 7 | `2025-12-20_migration_locataires_contraintes` | 2025-12-20 06:31:33 | Contraintes locataires (profile_id, logement_id, date_entree) |

**Observation :** Toutes les migrations appliquées sont **pré-M-numbering** (décembre 2025). Aucune migration M01-M42 n'est enregistrée.

---

## ⚠️ SÉCURITÉ CRITIQUE

### RLS désactivé sur TOUTES les tables

**CSV audit 7_RLS :**
- 19 tables dans `public`
- **TOUTES ont `rls_enabled = false`**

**CSV audit 8_Policies :**
- 315 policies définies

➡️ **IMPACT :** Les 315 policies sont **inactives** car RLS OFF. Aucun contrôle d'accès n'est appliqué au niveau base de données.

**Tables concernées :**
- `abonnements`
- `entreprises`
- `factures`
- `immeubles`
- `locataires`
- `logements`
- `messages`
- `migration_logs`
- `missions`
- `notifications`
- `plans`
- `profiles`
- `profiles_backup_20241220`
- `regies`
- `regies_backup_20241220`
- `regies_entreprises`
- `techniciens`
- `tickets`
- `tickets_disponibilites`

---

## 🔍 MIGRATIONS MANQUANTES

### M12

**Observation :** Séquence M01→M11 puis M13→M42. Pas de fichier M12 dans `supabase/migrations/`.

**Hypothèses possibles (AUCUNE VÉRIFICATION FAITE) :**
- Migration supprimée
- M-number jamais utilisé
- Fusion avec autre migration

---

## 📊 STATISTIQUES DÉTAILLÉES

### Répartition par type de migration (110 fichiers)

| Type | Count |
|------|-------|
| `forward` | 63 |
| `rollback` | 41 |
| `debug` | 3 |
| `validation` | 2 |
| `consolidated` | 1 |

### Répartition migrations numérotées

| Plage | Count |
|-------|-------|
| M01-M10 | 9 forward + 9 rollback |
| M11-M20 | 9 forward + 9 rollback (M12 absent) |
| M21-M30 | 11 forward + 8 rollback |
| M31-M42 | 15 forward + 14 rollback + 1 consolidated |

### Migrations appliquées vs présentes

- **Migrations présentes (supabase/migrations/)** : 110 fichiers
- **Migrations enregistrées (migration_logs)** : 7 enregistrements (dont 1 doublon)
- **Migrations uniques appliquées** : 6
- **Écart** : 104 migrations non enregistrées

---

## 🎯 CONCLUSION FACTUELLE

### État du système

1. **BASE RÉELLE :** 19 tables, 315 policies (inactives), 268 RPC (dont 10 sans migration enregistrée), 0 views publiques détectées
2. **HISTORIQUE :** 7 migrations appliquées (6 uniques), toutes pré-M-numbering (décembre 2025)
3. **MIGRATIONS DISPONIBLES :** 110 fichiers (86 numérotées M01-M42)
4. **ÉCART :** 104 migrations non appliquées selon logs

### Incohérences critiques

- **10 BLOCKER** : Empêchent le fonctionnement (mode_diffusion, RLS OFF, RPC manquants, policies manquantes)
- **41 HIGH** : Impact fonctionnel/sécurité majeur (migrations M01-M42 non appliquées, objets orphelins)
- **17 MEDIUM** : Impact fonctionnel modéré (doublons, fichiers hors nomenclature)
- **12 LOW** : Impact limité (debug, validation non tracée)

### Priorité d'action (SANS CORRECTION ICI)

1. **ÉTAPE 5 (prochain)** : Analyse root cause erreur "Mode diffusion invalide: general"
2. Activer RLS sur toutes les tables
3. Appliquer migrations M02, M30, M35, M38, M39 (mode_diffusion)
4. Appliquer migrations M01-M42 manquantes
5. Résoudre doublons M24, M29, M31
6. Tracer migrations pré-M-numbering
7. Archiver migrations selon classification

---

**FIN DU DIFF — AUCUNE CORRECTION APPLIQUÉE**

