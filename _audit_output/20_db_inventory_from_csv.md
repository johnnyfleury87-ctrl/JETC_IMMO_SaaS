# INVENTAIRE BASE RÉELLE — Synthèse CSV Audit

**Date:** 2026-01-04
**Source:** CSV Audit 0-15
**Méthode:** Factuel uniquement

---

## 📊 RÉSUMÉ GLOBAL

- **Tables (public):** 19
- **Views (public):** 0
- **Fonctions/RPC (public):** 0
- **Triggers:** 31
- **Policies RLS:** 315
- **Index:** 304
- **Contraintes:** 456

---

## 📋 TABLES (schéma public)

### `abonnements`
- **Colonnes:** 14
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `entreprises`
- **Colonnes:** 15
- **RLS:** ❌
- **Policies:** 6
- **Index:** 0

### `factures`
- **Colonnes:** 19
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `immeubles`
- **Colonnes:** 19
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `locataires`
- **Colonnes:** 16
- **RLS:** ❌
- **Policies:** 1
- **Index:** 0

### `logements`
- **Colonnes:** 29
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `messages`
- **Colonnes:** 8
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `migration_logs`
- **Colonnes:** 4
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `missions`
- **Colonnes:** 20
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `notifications`
- **Colonnes:** 12
- **RLS:** ❌
- **Policies:** 1
- **Index:** 0

### `plans`
- **Colonnes:** 14
- **RLS:** ❌
- **Policies:** 1
- **Index:** 0

### `profiles`
- **Colonnes:** 10
- **RLS:** ❌
- **Policies:** 4
- **Index:** 0

### `profiles_backup_20241220`
- **Colonnes:** 10
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `regies`
- **Colonnes:** 17
- **RLS:** ❌
- **Policies:** 5
- **Index:** 0

### `regies_backup_20241220`
- **Colonnes:** 17
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

### `regies_entreprises`
- **Colonnes:** 7
- **RLS:** ❌
- **Policies:** 7
- **Index:** 0

### `techniciens`
- **Colonnes:** 11
- **RLS:** ❌
- **Policies:** 2
- **Index:** 0

### `tickets`
- **Colonnes:** 28
- **RLS:** ❌
- **Policies:** 1
- **Index:** 0

### `tickets_disponibilites`
- **Colonnes:** 6
- **RLS:** ❌
- **Policies:** 0
- **Index:** 0

---

## 🔍 COLONNES CLÉS

### Colonnes `mode_diffusion`

- **regies_entreprises.mode_diffusion**
  - Type: `text`
  - NULL: NO
  - DEFAULT: `'restreint'::text`

- **tickets.mode_diffusion**
  - Type: `text`
  - NULL: YES
  - DEFAULT: `null`

- **tickets_visibles_entreprise.mode_diffusion**
  - Type: `text`
  - NULL: YES
  - DEFAULT: `null`

---

## ⚙️ FONCTIONS / RPC PERTINENTES

**Total:** 0

---

## 🔔 TRIGGERS

**Total:** 31

- `trigger_abonnement_updated_at` sur `` ( )
- `set_updated_at_entreprises` sur `` ( )
- `facture_status_change_trigger` sur `` ( )
- `factures_updated_at` sur `` ( )
- `set_updated_at_immeubles` sur `` ( )
- `set_updated_at_locataires` sur `` ( )
- `set_updated_at_logements` sur `` ( )
- `mission_status_change` sur `` ( )
- `mission_status_change_notification` sur `` ( )
- `missions_updated_at` sur `` ( )
- `technicien_assignment_notification` sur `` ( )
- `trigger_sync_ticket_statut_from_mission` sur `` ( )
- `trigger_plan_updated_at` sur `` ( )
- `on_profile_updated` sur `` ( )
- `trigger_prevent_role_self_escalation` sur `` ( )
- `set_updated_at_regies` sur `` ( )
- `set_updated_at_regies_entreprises` sur `` ( )
- `techniciens_updated_at` sur `` ( )
- `ensure_locataire_has_logement_before_ticket` sur `` ( )
- `new_ticket_notification` sur `` ( )

... et 11 autres

---

## 👁️ VIEWS

**Total (public):** 0

**Views tickets:** 0


**Views entreprises:** 0


---

## 🔒 POLICIES RLS CRITIQUES

### Policies `tickets` (1)

- `Admin JTEC can view all tickets` (SELECT)

### Policies `entreprises` (6)

- `Admin JTEC can view all entreprises` (SELECT)
- `Entreprise can insert own profile` (INSERT)
- `Entreprise can manage own profile` (ALL)
- `Entreprise can update own profile` (UPDATE)
- `Entreprise can view own profile` (SELECT)
- `Regie can insert entreprise` (INSERT)

---

## 🔗 CONTRAINTES CLÉS
