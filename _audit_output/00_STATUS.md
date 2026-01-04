# AUDIT MIGRATIONS SUPABASE — STATUS

**Date/Heure:** 2026-01-04  
**Branche:** main  
**Commit:** 979aadb

---

## OBJECTIF

1. Check complet entre:
   - Audit Supabase CSV (fichiers 0→15)
   - Dossier `supabase/migrations/` (toutes migrations)
   - Table DB `public.migration_logs` (historique exécution)

2. Identifier toutes incohérences (base réelle vs migrations)

3. Corriger UNIQUEMENT les incohérences bloquantes:
   - **PRIORITÉ #1:** Erreur "Mode diffusion invalide ou NULL: general" lors acceptation ticket entreprise

4. Archiver proprement migrations validées dans `Archive/`

---

## RÈGLES STRICTES

- ❌ Pas de suppositions
- ❌ Pas de changement de périmètre
- ❌ Pas de nouvelles features
- ❌ Pas de refactoring
- ✅ Produire EXACTEMENT les fichiers demandés
- ✅ S'arrêter après chaque étape avec livrables

---

## ÉTAPES (0→6)

### ÉTAPE 0 — Préparation
**Statut:** ✅ **TERMINÉ**  
**Livrables:**
- ✅ Dossiers créés: `_audit_output/`, `Archive/VALIDATED/`, `Archive/DEPRECATED/`, `Archive/ROLLBACKS/`, `Archive/CONSOLIDATED/`
- ✅ Fichier: `00_STATUS.md` (ce fichier)

---

### ÉTAPE 1 — Inventaire migrations (local, sans DB)
**Statut:** ✅ **TERMINÉ**  
**Livrables attendus:**
- ✅ `10_migrations_inventory.csv` (110 migrations)
- ✅ `10_migrations_inventory.md` (résumé complet)

**Résultats:**
- 110 fichiers SQL analysés
- 86 migrations numérotées (M01-M42, manquant M12)
- 24 fichiers sans M-number (migrations anciennes)
- **Doublons détectés:** M24 (4 fichiers), M29 (3 fichiers), M31 (5 fichiers)
- Répartition: 63 forward, 41 rollback, 3 debug, 2 validation, 1 consolidated

---

### ÉTAPE 2 — Inventaire base réelle (CSV audit 0→15)
**Statut:** ✅ **TERMINÉ**  
**Livrables attendus:**
- ✅ `20_db_inventory_from_csv.md` (225 lignes)

**Résultats:**
- 19 tables (schéma public)
- 3 colonnes `mode_diffusion` identifiées:
  * `regies_entreprises.mode_diffusion`: text NOT NULL DEFAULT 'restreint'
  * `tickets.mode_diffusion`: text NULL
  * (1 autre)
- 315 policies RLS
- 31 triggers
- 456 contraintes
- **OBSERVATION CRITIQUE:** RLS activé sur AUCUNE table (tous ❌)

---

### ÉTAPE 3 — Historique exécution migrations (DB)
**Statut:** ✅ **TERMINÉ**  
**Livrable produit:**
- ✅ `03_REQUETE_SQL_MIGRATION_LOGS.sql` (requête exacte)
- ✅ `03_migrations_applied_from_db.csv` (CSV réel fourni par utilisateur)

**Résultats:**
- 7 migrations enregistrées (dont 1 doublon)
- 6 migrations uniques appliquées
- Toutes pré-M-numbering (décembre 2025)
- **AUCUNE migration M01-M42 enregistrée**

---

### ÉTAPE 4 — DIFF complet: migrations ↔ audit ↔ migration_logs
**Statut:** ✅ **TERMINÉ**  
**Livrables produits:**
- ✅ `30_incoherences.csv` (80 incohérences détectées)
- ✅ `30_incoherences.md` (résumé structuré complet)

**Résultats DIFF:**
- **80 incohérences totales:** 10 BLOCKER, 41 HIGH, 17 MEDIUM, 12 LOW
- **Écart massif:** 7 migrations appliquées vs 110 fichiers présents (103 non enregistrées)
- **47 migrations non appliquées** (M01-M42 absentes de migration_logs)
- **3 doublons de migrations** (M24, M29, M31 avec fichiers multiples)
- **10 RPC présents en DB** sans migration enregistrée (dont `get_user_regie_id` utilisé partout)
- **1 RPC manquant** (`update_entreprise_mode_diffusion` - migration M38 non appliquée)
- **5 colonnes manquantes** (traçabilité tickets, disponibilite_id missions)
- **3 policies manquantes** (entreprises tickets general/assigned, disponibilités)
- **1 trigger manquant** (validation disponibilités avant diffusion)
- **RLS désactivé sur TOUTES les 19 tables** (315 policies définies mais INACTIVES)

**Focus bug BLOCKER "Mode diffusion invalide: general":**
- 5 migrations critiques NON appliquées: M02, M30, M35, M38, M39
- `tickets.mode_diffusion`: type text, NULL autorisé, DEFAULT null
- Policy `Entreprise can view general tickets`: **ABSENTE**
- RPC `update_entreprise_mode_diffusion`: **ABSENT EN DB**

---

### ÉTAPE 5 — Root cause + fix erreur mode_diffusion
**Statut:** ✅ **TERMINÉ**  
**Livrables produits:**
- ✅ `40_rootcause_mode_diffusion.md` (analyse root cause complète)
- ✅ `41_fix_mode_diffusion.sql` (migration corrective)
- ✅ `41_fix_mode_diffusion_rollback.sql` (rollback sécurisé)

**Root cause identifiée:**
- RPC `accept_ticket_and_create_mission()` version M05 (obsolète) en production
- Attend valeurs `'public'` / `'assigné'` MAIS tickets contiennent `'general'` / `'restreint'`
- Policies RLS entreprises **ABSENTES** (M35 non appliquée)
- Contrainte CHECK sur `tickets.mode_diffusion` **ABSENTE**

**Solution corrective:**
1. Standardiser valeurs existantes: `'public'` → `'general'`, `'assigné'` → `'restreint'`
2. Ajouter contrainte CHECK: `IN ('general', 'restreint', NULL)`
3. Remplacer RPC par version M41 (accepte nouvelle terminologie)
4. Créer policies RLS entreprises manquantes (M35 + M39)

**Actions requises (utilisateur):**
1. Exécuter `41_fix_mode_diffusion.sql` dans Supabase Studio > SQL Editor
2. Vérifier validation finale (logs RAISE NOTICE)
3. Tester acceptation ticket entreprise
4. Enregistrer migration dans `migration_logs` si succès

---

### ÉTAPE 6 — Archivage contrôlé + historique
**Statut:** ✅ **TERMINÉ**  
**Livrables produits:**
- ✅ `50_archive_actions.md` (plan archivage détaillé)
- ✅ `60_historique_migrations.md` (chronologie complète)

**Classification complète:**
- ✅ **VALIDATED:** 6 migrations confirmées (5.5% total)
- ⚠️ **UNKNOWN:** 104 migrations non tracées (94.5% total)
- 🔵 **CONSOLIDATED:** 2 fichiers non appliqués
- 🔴 **DEPRECATED:** 0 (aucune consolidation appliquée)

**Archivage Phase 1 AUTORISÉ:**
- 5 migrations VALIDATED prêtes pour `Archive/VALIDATED/`
- 1 migration VALIDATED en attente investigation doublon

**Archivage Phases 2-5 BLOQUÉ:**
- 104 migrations UNKNOWN nécessitent investigation DB
- **Règle stricte:** JAMAIS archiver UNKNOWN (risque perte historique)

**Anomalies détectées:**
- Doublon: `2025-12-20_rpc_creer_locataire.sql` appliquée 2 fois (2025-12-20 + 2025-12-23)
- M12 manquant dans séquence M01-M42
- Doublons M-numbers: M24 (2 fichiers), M29 (2 fichiers), M31 (5 fichiers)
- Écart massif: 110 fichiers présents vs 7 enregistrées (93.6% écart)

**Historique chronologique:**
- Timeline 2025-12-20 → 2026-01-04 (15 jours)
- Phases: Locataires (VALIDATED), Workflow Tickets (UNKNOWN), Entreprises (UNKNOWN), Mode Diffusion (UNKNOWN CRITICAL)
- Actions prioritaires: Application migration corrective → Investigation DB → Archivage progressif

---

## FICHIERS SOURCES (OBLIGATOIRES)

- ✅ `Audit_supabase/*.csv` (fichiers 0→15)
- ✅ `supabase/migrations/*.sql`
- ✅ Base: `public.migration_logs`

---

## PRIORITÉ BLOQUANTE

**Erreur:** "Mode diffusion invalide ou NULL: general"  
**Contexte:** Acceptation ticket côté entreprise  
**Réponse:** Supabase RPC 400 (Bad Request)  
**Traitement:** ÉTAPE 5 (après audit complet)

---

**Dernière mise à jour:** 2026-01-04  
**Statut global:** ✅ AUDIT COMPLET TERMINÉ (ÉTAPES 0-6)

---

## 📊 SYNTHÈSE AUDIT

**Total migrations:** 110 fichiers  
**Migrations appliquées:** 7 enregistrées (6 uniques)  
**Écart:** 103 migrations non tracées (93.6%)

**Incohérences:** 80 détectées  
- 🔴 BLOCKER: 10  
- 🟠 HIGH: 41  
- 🟡 MEDIUM: 17  
- 🔵 LOW: 12

**Bug BLOCKER:** "Mode diffusion invalide: general"  
- ✅ Root cause identifiée (RPC M05 obsolète)  
- ✅ Migration corrective créée: `41_fix_mode_diffusion.sql`  
- ⏳ Application utilisateur requise

**Archivage:**
- Phase 1 AUTORISÉ: 6 migrations VALIDATED  
- Phases 2-5 BLOQUÉ: 104 migrations UNKNOWN (investigation DB requise)

---

## 📋 ACTIONS UTILISATEUR IMMÉDIATES

### 1. Appliquer migration corrective (PRIORITÉ 1)
```sql
-- Dans Supabase Studio > SQL Editor:
-- Copier/coller contenu de: _audit_output/41_fix_mode_diffusion.sql
-- Exécuter et vérifier logs validation
```

### 2. Tester acceptation ticket
```
1. Se connecter comme entreprise
2. Accepter un ticket avec mode_diffusion = 'general'
3. Vérifier succès (plus d'erreur 400)
```

### 3. Enregistrer migration (si succès)
```sql
INSERT INTO migration_logs (migration_name, description)
VALUES (
  '41_fix_mode_diffusion',
  'Correctif BLOCKER: harmonisation mode_diffusion + RPC M41 + policies entreprises'
);
```

### 4. Archiver migrations VALIDATED (Phase 1)
```bash
# Exécuter commandes dans 50_archive_actions.md section "Phase 1"
# Déplacer 5 migrations confirmées vers Archive/VALIDATED/
```

### 5. Investiguer migrations UNKNOWN (Phases 2-5)
```sql
-- Vérifier présence objets en DB pour chaque migration M01-M42
-- Voir requêtes SQL dans 50_archive_actions.md section "Investigation"
-- Reclasser UNKNOWN → VALIDATED si objets présents
-- Enregistrer rétroactivement dans migration_logs
```

---

## 📚 LIVRABLES AUDIT (13 fichiers)

**Planification & Tracking:**
- `00_STATUS.md` (ce fichier)

**ÉTAPE 1 — Inventaire migrations:**
- `10_migrations_inventory.csv` (110 lignes)
- `10_migrations_inventory.md` (résumé)

**ÉTAPE 2 — Inventaire DB:**
- `20_db_inventory_from_csv.md` (225 lignes)

**ÉTAPE 3 — Migrations appliquées:**
- `03_REQUETE_SQL_MIGRATION_LOGS.sql` (requête extraction)
- `03_migrations_applied_from_db.csv` (7 lignes)

**ÉTAPE 4 — DIFF complet:**
- `30_incoherences.csv` (80 incohérences)
- `30_incoherences.md` (rapport détaillé)

**ÉTAPE 5 — Root cause + fix:**
- `40_rootcause_mode_diffusion.md` (analyse complète)
- `41_fix_mode_diffusion.sql` (migration corrective)
- `41_fix_mode_diffusion_rollback.sql` (rollback)

**ÉTAPE 6 — Archivage + historique:**
- `50_archive_actions.md` (plan archivage)
- `60_historique_migrations.md` (chronologie)
