# HISTORIQUE MIGRATIONS — Chronologie complète

**Date:** 2026-01-04  
**Total migrations:** 110 fichiers  
**Migrations appliquées:** 7 enregistrements (6 uniques)

---

## 📅 CHRONOLOGIE PAR DATE D'EXÉCUTION (CONFIRMÉE)

### 2025-12-20 — Phase 1: Locataires (3 migrations)

| Timestamp | Migration | Statut | Description |
|-----------|-----------|--------|-------------|
| 06:31:33 | `2025-12-20_migration_locataires_contraintes.sql` | ✅ VALIDATED | Application NOT NULL sur profile_id, logement_id, date_entree + ON DELETE RESTRICT |
| 06:31:57 | `2025-12-20_rls_locataires_policies.sql` | ✅ VALIDATED | Refonte policies locataires : séparation SELECT/INSERT/UPDATE/DELETE + policies restrictives locataire sur logements/immeubles |
| 06:32:14 | `2025-12-20_rpc_creer_locataire.sql` | ✅ VALIDATED | Création RPC creer_locataire_complet() et liberer_logement_locataire() avec transaction atomique |

**Contexte:** Mise en place système locataires avec contraintes référentielles et RPC création complète

---

### 2025-12-23 — Réapplication RPC (1 migration doublon)

| Timestamp | Migration | Statut | Description |
|-----------|-----------|--------|-------------|
| 12:42:04 | `2025-12-20_rpc_creer_locataire.sql` | ⚠️ DOUBLON | Création RPC creer_locataire_complet() et liberer_logement_locataire() avec transaction atomique |

**⚠️ ANOMALIE:** Même migration réappliquée 3 jours après application initiale

**Hypothèses possibles:**
- Correction bug dans RPC (réapplication intentionnelle)
- Erreur manipulation manuelle
- Rollback + réapplication

**Action requise:** Investiguer raison doublon

---

### 2025-12-24 — Phase 2: Logements & Immeubles (3 migrations)

| Timestamp | Migration | Statut | Description |
|-----------|-----------|--------|-------------|
| 12:03:44 | `20251224000000_fix_logement_id_nullable.sql` | ✅ VALIDATED | Correctif : DROP NOT NULL sur locataires.logement_id (erreur migration 2025-12-20) |
| 14:35:06 | `20251224000001_logements_adresse_caracteristiques.sql` | ✅ VALIDATED | Ajout colonnes adresse + caractéristiques + propriétaire pour logements |
| 14:37:41 | `20251224000002_immeubles_npa_suisse_caracteristiques.sql` | ✅ VALIDATED | Adaptation format NPA suisse + ajout colonnes type_immeuble, description, pays, proprietaire_id |

**Contexte:** 
- Fix contrainte NOT NULL trop restrictive (locataires.logement_id)
- Enrichissement données logements/immeubles (adresses, caractéristiques)

---

### 2025-12-26 — Phase 3: Migrations M01-M23 (NON APPLIQUÉES)

| M-number | Fichier timestamp | Statut | Description |
|----------|-------------------|--------|-------------|
| M01 | 17:00:00 | ⚠️ UNKNOWN | Colonnes budget tickets (plafond_intervention_chf, devise) |
| M02 | 17:01:00 | ⚠️ UNKNOWN | Colonne mode_diffusion tickets (terminologie obsolète: 'public'/'assigné') |
| M03 | 17:02:00 | ⚠️ UNKNOWN | RPC update_ticket_statut() |
| M04 | 17:03:00 | ⚠️ UNKNOWN | RPC diffuser_ticket() |
| M05 | 17:04:00 | ⚠️ UNKNOWN | RPC accept_ticket_and_create_mission() (version obsolète) |
| M06 | 17:05:00 | ⚠️ UNKNOWN | VIEW tickets_visibles_entreprise |
| M07 | 17:06:00 | ⚠️ UNKNOWN | Policy RLS entreprise |
| M08 | 17:07:00 | ⚠️ UNKNOWN | Colonnes classification (sous_categorie, piece) |
| M09 | 17:08:00 | ⚠️ UNKNOWN | Table tickets_disponibilites |
| M10 | 17:09:00 | ⚠️ UNKNOWN | Trigger validation disponibilités |
| M11 | 17:10:00 | ⚠️ UNKNOWN | Harmonisation missions.montant_reel_chf |
| M13 | 17:11:00 | ⚠️ UNKNOWN | Policy DELETE tickets sécurisée |
| M14 | 17:12:00 | ⚠️ UNKNOWN | Trigger sync mission/ticket statut |
| M15 | 18:00:00 | ⚠️ UNKNOWN | Allow NULL priorite/plafond |
| M16 | 18:10:00 | ⚠️ UNKNOWN | Contrainte ventilation |
| M17 | 19:00:00 | ⚠️ UNKNOWN | Fix contrainte piece case insensitive |
| M18 | 20:00:00 | ⚠️ UNKNOWN | Remplacer triggers par RPC |
| M19 | 21:00:00 | ⚠️ UNKNOWN | RPC debug jtec_debug_schema() |
| M20 | 22:00:00 | ⚠️ UNKNOWN | Fix policy RLS INSERT locataire |
| M21 | 23:00:00 | ⚠️ UNKNOWN | RPC create_ticket_locataire() |
| M22 | 24:00:00 | ⚠️ UNKNOWN | Fix RPC notify_new_ticket() |
| M23 | 25:00:00 | ⚠️ UNKNOWN | Fix schema notify |

**Note:** Timestamps fichiers (17h-25h) = ordre de création, PAS d'exécution réelle

**Statut:** **AUCUNE migration M01-M23 enregistrée dans migration_logs**

---

### 2025-12-26 — Suite: Migrations M24-M25 (NON APPLIQUÉES)

| M-number | Fichier timestamp | Statut | Description |
|----------|-------------------|--------|-------------|
| M24 | 26:00:00 | ⚠️ UNKNOWN | Policy regie SELECT tickets |
| M25 | 00:01:00 (27/12) | ⚠️ UNKNOWN | Validation diffusion |

---

### 2025-12-27 — Phase 4: Migrations M24-M35 (NON APPLIQUÉES)

| M-number | Fichier timestamp | Statut | Description |
|----------|-------------------|--------|-------------|
| M24 (doublon) | 00:00:00 | ⚠️ UNKNOWN | Masquage colonnes sensibles (DOUBLON M24) |
| M26 | 00:02:00 | ⚠️ UNKNOWN | Policy INSERT entreprises régie |
| M27 | 00:03:00 | ⚠️ UNKNOWN | Exposer RPC get_user_regie_id() |
| M28 | 00:04:00 | ⚠️ UNKNOWN | Fix RLS récursion entreprises |
| M29 | 00:05:00 | ⚠️ UNKNOWN | Final consolidation + RPC create_entreprise (2 fichiers DOUBLON) |
| M30 | 00:06:00 | ⚠️ UNKNOWN | **FIX mode_diffusion** (correctif terminologie) |
| M31 | 00:07:00 | ⚠️ UNKNOWN | Colonnes traçabilité tickets |
| M32 | 00:08:00 | ⚠️ UNKNOWN | RPC valider_ticket_regie() |
| M33 | 00:09:00 | ⚠️ UNKNOWN | RPC get_entreprises_autorisees() |
| M34 | 00:10:00 | ⚠️ UNKNOWN | Policies RLS entreprise tickets |
| M35 | 00:11:00 | ⚠️ UNKNOWN | **Harmonisation mode_diffusion** (migration données + policies) |
| M31-M34 consolidation | 00:20:00 | ⚠️ UNKNOWN | Workflow tickets complet (consolidation M31→M34) |

**Note:** M12 manquant dans séquence (pas de fichier)

---

### 2026-01-04 — Phase 5: Migrations M31-M42 (NON APPLIQUÉES)

| M-number | Fichier timestamp | Statut | Description |
|----------|-------------------|--------|-------------|
| M31-M35 consolidation | 00:00:00 | ⚠️ UNKNOWN | **Workflow complet consolidated** (super-consolidation M31→M35) |
| M36 | 00:12:00 | ⚠️ UNKNOWN | Fix règle validation disponibilités |
| M37 | 00:13:00 | ⚠️ UNKNOWN | Fix terminologie vue entreprise |
| M38 | 00:14:00 | ⚠️ UNKNOWN | **RPC update_entreprise_mode_diffusion()** (ABSENT DB) |
| M39 | 00:15:00 | ⚠️ UNKNOWN | **Fix policy RLS mode_diffusion** |
| M40 | 00:16:00 | ⚠️ UNKNOWN | Fix policy RLS disponibilités |
| M41 | 00:17:00 | ⚠️ UNKNOWN | **Harmonisation RPC acceptation** (fix terminologie) |
| M42 | 00:18:00 | ⚠️ UNKNOWN | Colonne disponibilite_id missions |

**Contexte:** Dernières migrations créées le 04/01/2026 pour corrections finales mode_diffusion

---

## 📊 HISTORIQUE PAR PHASE FONCTIONNELLE

### Phase A: Locataires (2025-12-20 à 2025-12-24)

**Migrations VALIDATED:** 6 (+1 doublon)

| Date | Migration | Objet principal |
|------|-----------|----------------|
| 2025-12-20 | `migration_locataires_contraintes` | Contraintes référentielles locataires |
| 2025-12-20 | `rls_locataires_policies` | Policies RLS locataires |
| 2025-12-20 | `rpc_creer_locataire` | RPC création locataire complet |
| 2025-12-24 | `fix_logement_id_nullable` | Correctif contrainte NOT NULL |
| 2025-12-24 | `logements_adresse_caracteristiques` | Enrichissement logements |
| 2025-12-24 | `immeubles_npa_suisse_caracteristiques` | Enrichissement immeubles |

**Statut:** ✅ Phase complète et validée

---

### Phase B: Workflow Tickets M01-M11 (créées 2025-12-26)

**Migrations UNKNOWN:** 11 migrations M01-M11 (M12 manquant)

**Objectif:** Débloquer workflow tickets (budget, mode_diffusion, RPC, disponibilités)

**Statut:** ⚠️ Non enregistrées dans migration_logs MAIS objets potentiellement présents en DB

**Indices présence DB:**
- RPC `diffuser_ticket()` présent (CSV audit 9_Fonctions)
- RPC `accept_ticket_and_create_mission()` présent
- Table `tickets_disponibilites` présente (CSV audit 3_Tables)

---

### Phase C: Sécurité & Policies M13-M20 (créées 2025-12-26)

**Migrations UNKNOWN:** 8 migrations M13-M20

**Objectif:** Sécuriser DELETE, sync statuts, policies INSERT

**Statut:** ⚠️ Non enregistrées, présence DB incertaine

---

### Phase D: RPC Locataire/Régie M21-M23 (créées 2025-12-26)

**Migrations UNKNOWN:** 3 migrations M21-M23

**Objectif:** RPC création tickets locataire, notifications

**Indices présence DB:**
- RPC `create_ticket_locataire()` présent (CSV audit 9_Fonctions)
- RPC `notify_new_ticket()` présent

---

### Phase E: Entreprises M24-M29 (créées 2025-12-26 à 2025-12-27)

**Migrations UNKNOWN:** 6 migrations + doublons

**Objectif:** Policies RLS entreprises, RPC création, masquage données

**Statut:** ⚠️ Non enregistrées

**Doublons détectés:**
- M24: 2 fichiers (rls_regie_select + masquage_colonnes)
- M29: 2 fichiers (final + rpc_create_entreprise)

**Indices présence DB:**
- RPC `create_entreprise_simple()` présent (CSV audit 9_Fonctions)
- RPC `create_entreprise_with_profile()` présent
- RPC `toggle_entreprise_mode()` présent
- RPC `get_user_regie_id()` présent (utilisé par TOUTES les policies)

---

### Phase F: Mode Diffusion M30, M35, M38-M39 (créées 2025-12-27 à 2026-01-04)

**Migrations UNKNOWN:** 5 migrations **CRITIQUES**

**Objectif:** Corriger incohérence terminologique mode_diffusion

**Chronologie problème:**
1. **M02 (2025-12-26):** Introduit `'public'` / `'assigné'` (obsolète dès création)
2. **M30 (2025-12-27):** Correctif RPC entreprises → `'general'` / `'restreint'`
3. **M35 (2025-12-27):** Harmonisation complète + migration données + policies
4. **M38 (2026-01-04):** RPC update_entreprise_mode_diffusion() ← **ABSENT DB**
5. **M39 (2026-01-04):** Correctif policy RLS mode_diffusion
6. **M41 (2026-01-04):** Harmonisation RPC acceptation

**Statut:** ⚠️ BLOCKER non résolu → Erreur "Mode diffusion invalide: general"

**Impact:** Entreprises ne peuvent accepter tickets (RPC version obsolète M05)

---

### Phase G: Workflow Complet M31-M34 (créées 2025-12-27)

**Migrations UNKNOWN:** 4 individuelles + 1 consolidation

**Objectif:** Traçabilité tickets, RPC validation, policies entreprises

**Évolution:**
1. **M31-M34 individuelles** (00:07-00:10): Migrations séparées
2. **M31-M34 consolidation** (00:20): Fusion 4 migrations en 1 fichier
3. **M31-M35 super-consolidation** (2026-01-04): Fusion 5 migrations (M31→M35)

**Statut:** ⚠️ Aucune version appliquée

**Indices présence DB:**
- RPC `valider_ticket_regie()` présent (CSV audit 9_Fonctions)
- RPC `get_entreprises_autorisees()` présent

---

### Phase H: Corrections Finales M36-M42 (créées 2026-01-04)

**Migrations UNKNOWN:** 7 migrations

**Objectif:** Fixes terminologie, policies, colonnes missions

**Statut:** ⚠️ Créées aujourd'hui, non appliquées

---

## 📋 HISTORIQUE PAR STATUT

### ✅ VALIDATED (6 migrations)

| # | Migration | Date exécution | Phase |
|---|-----------|----------------|-------|
| 1 | `2025-12-20_migration_locataires_contraintes.sql` | 2025-12-20 06:31:33 | Locataires |
| 2 | `2025-12-20_rls_locataires_policies.sql` | 2025-12-20 06:31:57 | Locataires |
| 3 | `2025-12-20_rpc_creer_locataire.sql` | 2025-12-20 06:32:14 | Locataires |
| 4 | `20251224000000_fix_logement_id_nullable.sql` | 2025-12-24 12:03:44 | Correctifs |
| 5 | `20251224000001_logements_adresse_caracteristiques.sql` | 2025-12-24 14:35:06 | Enrichissement |
| 6 | `20251224000002_immeubles_npa_suisse_caracteristiques.sql` | 2025-12-24 14:37:41 | Enrichissement |

**Total:** 6 migrations confirmées appliquées (5.5% du total)

---

### ⚠️ UNKNOWN (104 migrations)

**Répartition:**

| Catégorie | Count | Période création |
|-----------|-------|------------------|
| Pré-M-numbering non enregistrées | 10 | 2025-12-20 à 2025-12-23 |
| M01-M42 forward | 43 | 2025-12-26 à 2026-01-04 |
| M01-M42 rollback | 41 | 2025-12-26 à 2026-01-04 |
| Hors nomenclature (debug/validation) | 8 | Diverses dates |
| Consolidations | 2 | 2025-12-27, 2026-01-04 |

**Total:** 104 migrations (94.5% du total)

**Statut:** Présence en DB à confirmer avant archivage

---

### 🔴 DEPRECATED (0 migrations)

**Candidats potentiels:**
- M31-M34 individuelles (si consolidation appliquée)
- M31-M34 consolidation (si super-consolidation M31-M35 appliquée)

**Statut:** Aucune dépreciation confirmée (consolidations non appliquées)

---

### 🔵 CONSOLIDATED (2 fichiers non appliqués)

| # | Fichier | Remplace | Date création |
|---|---------|----------|---------------|
| 1 | `20251227002000_m31_m34_workflow_tickets_complet.sql` | M31→M34 (4 migrations) | 2025-12-27 00:20 |
| 2 | `20260104000000_m31_m35_workflow_complet_consolidated.sql` | M31→M35 (5 migrations) | 2026-01-04 00:00 |

**Statut:** Non appliquées, non enregistrées

---

## 🔍 ANOMALIES DÉTECTÉES

### Anomalie 1: Migration doublon

**Migration:** `2025-12-20_rpc_creer_locataire.sql`

**Enregistrements:**
1. 2025-12-20 06:32:14 (application initiale)
2. 2025-12-23 12:42:04 (réapplication +3 jours)

**Investigation requise:**
```sql
-- Vérifier historique complet
SELECT * FROM migration_logs 
WHERE migration_name LIKE '%creer_locataire%'
ORDER BY executed_at;

-- Vérifier version RPC actuelle
SELECT prosrc FROM pg_proc 
WHERE proname = 'creer_locataire_complet';
```

---

### Anomalie 2: M12 manquant

**Observation:** Séquence M01→M11 puis M13→M42

**Hypothèses:**
- Migration supprimée après création
- M-number jamais utilisé (saut intentionnel)
- Fusion avec autre migration

**Impact:** Aucun (numérotation n'affecte pas fonctionnement)

---

### Anomalie 3: Doublons M-numbers

**M24:** 2 fichiers différents
- `20251226260000_m24_rls_regie_select_tickets.sql`
- `20251227000000_m24_masquage_colonnes_sensibles.sql`

**M29:** 2 fichiers différents
- `20251227000500_m29_final.sql`
- `20251227000500_m29_rpc_create_entreprise_complete.sql`

**M31:** 5 fichiers (évolution consolidation)
- `20251227000700_m31_add_tracabilite_tickets.sql` (individuelle)
- `20251227002000_m31_m34_workflow_tickets_complet.sql` (consolidation 4)
- `20260104000000_m31_m35_workflow_complet_consolidated.sql` (super-consolidation 5)

**Action requise:** Clarifier quelle version appliquer (consolidation recommandée)

---

### Anomalie 4: Écart massif appliqué/présent

**Statistiques:**
- Migrations présentes: 110 fichiers
- Migrations enregistrées: 7 (6 uniques)
- Écart: 103 migrations non enregistrées (93.6%)

**Hypothèses:**
1. Application manuelle massive sans traçabilité
2. Migration_logs incomplet/corrompu
3. Migrations créées mais jamais appliquées

**Indices application manuelle:**
- 10 RPC présents en DB sans migration enregistrée
- Table `tickets_disponibilites` présente (M09 non enregistrée)
- Policies présentes (M26, M27 non enregistrées)

**Action requise:** Investigation DB complète pour identifier migrations réellement appliquées

---

## 📈 TIMELINE VISUELLE

```
2025-12-20    [VALIDATED] Phase Locataires (3 migrations)
              ├─ 06:31:33 migration_locataires_contraintes
              ├─ 06:31:57 rls_locataires_policies
              └─ 06:32:14 rpc_creer_locataire

2025-12-23    [ANOMALIE] Doublon rpc_creer_locataire (réapplication)

2025-12-24    [VALIDATED] Phase Correctifs/Enrichissement (3 migrations)
              ├─ 12:03:44 fix_logement_id_nullable
              ├─ 14:35:06 logements_adresse_caracteristiques
              └─ 14:37:41 immeubles_npa_suisse_caracteristiques

2025-12-26    [UNKNOWN] Création M01-M25 (25 migrations)
              └─ Workflow tickets, RPC, policies (NON enregistrées)

2025-12-27    [UNKNOWN] Création M24-M35 + consolidation M31-M34
              └─ Entreprises, mode_diffusion, workflow complet (NON enregistrées)

2026-01-04    [UNKNOWN] Création M36-M42 + super-consolidation M31-M35
              └─ Corrections finales mode_diffusion (NON appliquées)

              [AUDIT] ÉTAPES 0-5 complètes
              ├─ Root cause identifiée: incohérence terminologie mode_diffusion
              ├─ Migration corrective créée: 41_fix_mode_diffusion.sql
              └─ 80 incohérences documentées
```

---

## 🎯 ACTIONS REQUISES (PAR PRIORITÉ)

### Priorité 1: Résoudre bug BLOCKER

✅ **FAIT:**
- Root cause identifiée (ÉTAPE 5)
- Migration corrective `41_fix_mode_diffusion.sql` créée

⏳ **EN ATTENTE:**
- Application migration corrective par utilisateur
- Test acceptation ticket entreprise
- Enregistrement dans migration_logs

---

### Priorité 2: Archiver migrations VALIDATED

✅ **AUTORISÉ:**
- Déplacer 5 migrations confirmées vers Archive/VALIDATED/
- Créer README.md traçabilité

⚠️ **EN ATTENTE investigation:**
- Migration `2025-12-20_rpc_creer_locataire.sql` (doublon)

---

### Priorité 3: Investiguer migrations UNKNOWN

⏳ **REQUIERT actions:**
1. Vérifier présence objets en DB (RPC, tables, policies)
2. Cross-référencer avec 30_incoherences.csv
3. Identifier migrations appliquées manuellement
4. Enregistrer rétroactivement dans migration_logs
5. Reclasser UNKNOWN → VALIDATED

**Méthode:**
```sql
-- Exemple vérification RPC M04
SELECT proname, prosrc FROM pg_proc 
WHERE proname = 'diffuser_ticket';
-- Si présent → M04 probablement appliquée manuellement

-- Exemple vérification table M09
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'tickets_disponibilites';
-- Si présent → M09 probablement appliquée manuellement
```

---

### Priorité 4: Consolider migrations

⏳ **EN ATTENTE après investigation:**
1. Appliquer super-consolidation M31-M35 si pertinent
2. Enregistrer dans migration_logs
3. Déplacer vers Archive/CONSOLIDATED/
4. Déplacer M31-M35 individuelles vers Archive/DEPRECATED/

---

## 📝 NOTES FINALES

### État actuel

- **6 migrations VALIDATED** (5.5% du total)
- **104 migrations UNKNOWN** (94.5% du total)
- **0 migrations DEPRECATED** (aucune consolidation appliquée)
- **Écart historique:** 103 migrations non tracées

### Prochaines étapes

1. ✅ **ÉTAPE 5 terminée:** Root cause + migration corrective
2. ⏳ **Application migration corrective** (action utilisateur)
3. ⏳ **Investigation DB** (identifier UNKNOWN réellement appliquées)
4. ⏳ **Archivage Phase 1** (migrations VALIDATED confirmées)
5. ⏳ **ÉTAPE 6 complète** (après investigation + archivage)

### Recommandations

1. **Court terme:** Appliquer `41_fix_mode_diffusion.sql` (résout bug BLOCKER)
2. **Moyen terme:** Investigation DB complète (103 migrations UNKNOWN)
3. **Long terme:** Réenregistrer historique migration_logs (traçabilité complète)

---

**FIN HISTORIQUE MIGRATIONS**

