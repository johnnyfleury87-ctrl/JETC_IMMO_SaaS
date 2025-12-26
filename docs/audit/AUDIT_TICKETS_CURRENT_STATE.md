# 📊 AUDIT TICKETS - ÉTAT ACTUEL DE LA BASE

**Date** : 26 décembre 2025  
**Périmètre** : Flux Locataire → Régie → Entreprise (tickets + missions)  
**Source** : Analyse des fichiers `supabase/schema/` + `api/tickets/`

---

## 🎯 OBJECTIF

Document de référence listant **TOUT** ce qui existe actuellement dans la base concernant le flux tickets, avant toute modification.

---

## 📋 TABLES PRINCIPALES

### 1. TABLE `tickets`

**Fichier source** : `supabase/schema/12_tickets.sql`

#### Structure

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `titre` | text | NO | - | - |
| `description` | text | NO | - | - |
| `categorie` | text | NO | - | CHECK IN (...) |
| `priorite` | text | NO | `'normale'` | CHECK IN (...) |
| `statut` | ticket_status | NO | `'nouveau'` | ENUM |
| `logement_id` | uuid | NO | - | FK → logements CASCADE |
| `locataire_id` | uuid | NO | - | FK → locataires CASCADE |
| `regie_id` | uuid | NO | - | Calculé via trigger |
| `entreprise_id` | uuid | YES | NULL | FK → entreprises SET NULL |
| `technicien_id` | uuid | YES | NULL | FK → techniciens SET NULL |
| `date_creation` | timestamptz | YES | `now()` | - |
| `date_cloture` | timestamptz | YES | NULL | CHECK >= date_creation |
| `date_limite` | timestamptz | YES | NULL | - |
| `photos` | text[] | YES | NULL | URLs |
| `urgence` | boolean | YES | `false` | - |
| `created_at` | timestamptz | YES | `now()` | - |
| `updated_at` | timestamptz | YES | `now()` | - |
| `locked_at` | timestamptz | YES | NULL | Ajouté dans 13_missions.sql |

#### Contraintes CHECK

```sql
CHECK (priorite IN ('faible', 'normale', 'haute', 'urgente'))

CHECK (categorie IN (
  'plomberie', 'électricité', 'chauffage', 'serrurerie',
  'vitrerie', 'menuiserie', 'peinture', 'autre'
))

CHECK (date_cloture IS NULL OR date_cloture >= date_creation)
```

#### Index

- `idx_tickets_logement_id` sur `logement_id`
- `idx_tickets_locataire_id` sur `locataire_id`
- `idx_tickets_regie_id` sur `regie_id`
- `idx_tickets_statut` sur `statut`
- `idx_tickets_priorite` sur `priorite`
- `idx_tickets_entreprise_id` sur `entreprise_id`
- `idx_tickets_technicien_id` sur `technicien_id`
- `idx_tickets_date_creation` sur `date_creation`

#### Trigger

**`set_ticket_regie_id_trigger`** (BEFORE INSERT)

- Fonction : `set_ticket_regie_id()`
- Calcule automatiquement `regie_id` via `logements → immeubles → regie_id`
- RAISE EXCEPTION si logement_id invalide

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Structure de base** | ✅ OK | Colonnes essentielles présentes |
| **Catégories** | 🟡 PARTIEL | Liste fixe 8 valeurs, pas de sous-catégories |
| **Pièce** | 🔴 MANQUANT | Colonne n'existe pas |
| **Disponibilités** | 🔴 MANQUANT | Pas de table liée |
| **Plafond CHF** | 🔴 MANQUANT | Colonne n'existe pas |
| **Mode diffusion** | 🔴 MANQUANT | Pas sur ticket (existe sur regies_entreprises) |
| **Statut initial** | 🟡 INCOHÉRENT | ENUM dit 'nouveau', API crée 'ouvert' |

---

### 2. TABLE `missions`

**Fichier source** : `supabase/schema/13_missions.sql`

#### Structure

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `ticket_id` | uuid | NO | - | FK → tickets CASCADE, **UNIQUE** |
| `entreprise_id` | uuid | NO | - | FK → entreprises CASCADE |
| `technicien_id` | uuid | YES | NULL | FK → techniciens SET NULL |
| `date_intervention_prevue` | timestamptz | YES | NULL | - |
| `date_intervention_realisee` | timestamptz | YES | NULL | - |
| `statut` | text | NO | `'en_attente'` | CHECK IN (...) |
| `created_at` | timestamptz | NO | `now()` | - |
| `started_at` | timestamptz | YES | NULL | - |
| `completed_at` | timestamptz | YES | NULL | - |
| `validated_at` | timestamptz | YES | NULL | - |
| `notes` | text | YES | NULL | - |
| `devis_url` | text | YES | NULL | Storage |
| `facture_url` | text | YES | NULL | Storage |
| `montant` | decimal(10,2) | YES | NULL | **⚠️ Pas d'unité explicite** |
| `updated_at` | timestamptz | NO | `now()` | - |

#### Contraintes CHECK

```sql
CHECK (statut IN ('en_attente', 'en_cours', 'terminee', 'validee', 'annulee'))
```

#### Contrainte UNIQUE

- **`ticket_id` UNIQUE** : Garantit 1 mission maximum par ticket ✅

#### Index

- `idx_missions_ticket_id` sur `ticket_id`
- `idx_missions_entreprise_id` sur `entreprise_id`
- `idx_missions_technicien_id` sur `technicien_id`
- `idx_missions_statut` sur `statut`
- `idx_missions_created_at` sur `created_at`
- `idx_missions_date_intervention_prevue` sur `date_intervention_prevue`

#### Trigger

**`missions_updated_at`** (BEFORE UPDATE)

- Met à jour `updated_at = now()`

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Contrainte UNIQUE** | ✅ OK | Anti-doublon garanti |
| **Statuts mission** | ✅ OK | 5 valeurs cohérentes |
| **Montant** | 🟡 AMBIGUÏTÉ | Type decimal OK, mais pas de colonne devise explicite |
| **ENUM non utilisé** | 🟢 AMÉLIORATION | `mission_status` existe mais pas utilisé |

---

### 3. TABLE `entreprises`

**Fichier source** : `supabase/schema/10_entreprises.sql`

#### Structure

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `nom` | text | NO | - | UNIQUE |
| `siret` | text | YES | NULL | UNIQUE |
| `adresse` | text | YES | NULL | - |
| `code_postal` | text | YES | NULL | - |
| `ville` | text | YES | NULL | - |
| `telephone` | text | YES | NULL | CHECK format |
| `email` | text | NO | - | CHECK format |
| `specialites` | text[] | YES | NULL | Tableau |
| `profile_id` | uuid | YES | NULL | FK → profiles CASCADE |
| `description` | text | YES | NULL | - |
| `site_web` | text | YES | NULL | - |
| `created_at` | timestamptz | YES | `now()` | - |
| `updated_at` | timestamptz | YES | `now()` | - |

#### Contraintes

```sql
UNIQUE (nom)
UNIQUE (siret)
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
CHECK (telephone ~ '^[0-9+\s\-().]+$' OR telephone IS NULL)
```

#### Index

- `idx_entreprises_profile_id` sur `profile_id`
- `idx_entreprises_nom` sur `nom`
- `idx_entreprises_specialites` (GIN) sur `specialites`

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Structure** | ✅ OK | Complète |
| **Spécialités** | ✅ OK | Tableau extensible |

---

### 4. TABLE `regies_entreprises`

**Fichier source** : `supabase/schema/10_entreprises.sql`

#### Structure

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `regie_id` | uuid | NO | - | FK → regies CASCADE |
| `entreprise_id` | uuid | NO | - | FK → entreprises CASCADE |
| `mode_diffusion` | text | NO | `'restreint'` | CHECK IN (...) |
| `date_autorisation` | timestamptz | YES | `now()` | - |
| `created_at` | timestamptz | YES | `now()` | - |
| `updated_at` | timestamptz | YES | `now()` | - |

#### Contraintes

```sql
UNIQUE (regie_id, entreprise_id)
CHECK (mode_diffusion IN ('general', 'restreint'))
```

#### Index

- `idx_regies_entreprises_regie_id` sur `regie_id`
- `idx_regies_entreprises_entreprise_id` sur `entreprise_id`
- `idx_regies_entreprises_mode` sur `mode_diffusion`

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Mode diffusion** | ✅ OK | 2 modes existants |
| **Colonne `autorise`** | 🔴 MANQUANT | Utilisée dans RPC mais n'existe PAS |

---

## 📐 ENUMS

### ENUM `ticket_status`

**Fichier source** : `supabase/schema/02_enums.sql`

**Valeurs** :
```sql
'nouveau'      -- Ticket créé par locataire
'ouvert'       -- Ticket validé par régie
'en_attente'   -- En attente d'assignation
'en_cours'     -- Mission en cours
'termine'      -- Intervention terminée
'clos'         -- Ticket clôturé et validé
'annule'       -- Ticket annulé
```

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Usage cohérent** | 🔴 INCOHÉRENT | API crée avec 'ouvert', default SQL = 'nouveau' |
| **Valeurs** | ✅ OK | Cycle de vie complet |

### ENUM `mission_status`

**Fichier source** : `supabase/schema/02_enums.sql`

**Valeurs** :
```sql
'en_attente'
'en_cours'
'terminee'
'validee'
'annulee'
```

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Utilisé** | 🟢 NON | Table missions utilise `text` avec CHECK |
| **Recommandation** | 🟢 AMÉLIORATION | Utiliser ENUM pour cohérence |

---

## 🔍 VUES

### 1. VUE `tickets_visibles_entreprise`

**Fichier source** : `supabase/schema/17_views.sql`

**Objectif** : Tickets visibles par entreprises selon règles diffusion

**Logique** :

```sql
WHERE
  (
    re.mode_diffusion = 'general'
    AND t.statut = 'ouvert'  -- ⚠️ PROBLÈME
  )
  OR
  (
    re.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  )
```

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Logique diffusion** | ✅ OK | 2 modes distincts |
| **Filtre statut** | 🔴 INCOHÉRENT | Filtre 'ouvert' mais diffusion met 'en_attente' |

### 2. VUE `tickets_complets`

**Fichier source** : `supabase/schema/17_views.sql`

**Objectif** : Tickets avec jointures locataire, logement, immeuble, régie

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Structure** | ✅ OK | Jointures complètes |

### 3. VUE `missions_details`

**Fichier source** : `supabase/schema/13_missions.sql`

**Objectif** : Missions avec toutes infos (ticket, entreprise, locataire, logement, régie)

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Structure** | ✅ OK | Jointures complètes |

---

## ⚙️ FONCTIONS / RPC

### 1. `accept_ticket_and_create_mission()`

**Fichier source** : `supabase/schema/13_missions.sql`

**Signature** :
```sql
accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
) RETURNS jsonb
```

**Logique** :
1. Récupère regie_id du ticket
2. ✅ Vérifie ticket non verrouillé (`locked_at IS NULL`)
3. 🔴 **Vérifie `autorise = true`** (colonne n'existe pas)
4. ✅ Crée mission (INSERT)
5. ✅ Verrouille ticket (`locked_at = now()`)
6. ✅ Change statut ticket → 'en_cours'

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Anti-doublon** | ✅ OK | Vérifie locked_at |
| **Colonne autorise** | 🔴 BLOQUANT | Ligne 127 : `and autorise = true` → erreur SQL |
| **Transactionnel** | ✅ OK | SECURITY DEFINER |

### 2. `update_ticket_statut()`

**État** : 🔴 **N'EXISTE PAS**

**Utilisation** : Appelée par API `/api/tickets/diffuser`

**Impact** : Erreur SQL lors diffusion

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Existence** | 🔴 MANQUANT | Fonction non définie |

### 3. `get_user_regie_id()`

**Fichier source** : `supabase/schema/09b_helper_functions.sql`

**Logique** :
- Retourne `regie_id` de l'utilisateur connecté
- Rôle 'regie' : depuis `regies.profile_id`
- Rôle 'locataire' : remonte via `locataires → logements → immeubles`

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Fonctionnement** | ✅ OK | Utilisée partout dans RLS |
| **SECURITY DEFINER** | 🟡 RISQUE | Bypass RLS (usage correct mais sensible) |

### 4. `is_admin_jtec()`

**Fichier source** : `supabase/schema/18_rls.sql`

**Logique** :
- Vérifie si `auth.uid()` a `role = 'admin_jtec'`

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Fonctionnement** | ✅ OK | Utilisée dans policies admin |

---

## 🛡️ ROW LEVEL SECURITY (RLS)

### TABLE `tickets` - 6 policies

| Policy | Command | Qui | Logique | État |
|--------|---------|-----|---------|------|
| Locataire can view own tickets | SELECT | locataire | `locataires.id = tickets.locataire_id AND locataires.profile_id = auth.uid()` | ✅ OK |
| Locataire can create own tickets | INSERT | locataire | Même vérification | ✅ OK |
| Regie can view own tickets | SELECT | regie | `regie_id = get_user_regie_id()` | ✅ OK |
| Regie can manage own tickets | **ALL** | regie | `regie_id = get_user_regie_id()` | 🟡 RISQUE (DELETE sans vérif) |
| Entreprise can view authorized tickets | SELECT | entreprise | Mode general ET `statut = 'ouvert'` OU mode restreint | 🔴 INCOHÉRENT |
| Admin JTEC can view all tickets | SELECT | admin_jtec | `is_admin_jtec()` | ✅ OK |

#### Problèmes identifiés

**🔴 P1 - Entreprise ne voit pas tickets diffusés** :
- Policy filtre `tickets.statut = 'ouvert'`
- API diffuser met `statut = 'en_attente'`
- **Impact** : Workflow cassé

**🟡 R1 - Régie peut DELETE sans vérification** :
- Policy FOR ALL permet DELETE
- Risque suppression tickets avec missions actives

### TABLE `missions` - 8 policies

| Policy | Command | Qui | Logique | État |
|--------|---------|-----|---------|------|
| Regie can view missions for own tickets | SELECT | regie | Via tickets → logements → immeubles | ✅ OK |
| Entreprise can view own missions | SELECT | entreprise | `entreprise_id = (...)` | ✅ OK |
| Locataire can view missions for own tickets | SELECT | locataire | Via tickets → locataires | ✅ OK |
| Admin JTEC can view all missions | SELECT | admin_jtec | `is_admin_jtec()` | ✅ OK |
| Technicien can view assigned missions | SELECT | technicien | `technicien_id = (...)` | ✅ OK |
| Entreprise can update own missions | UPDATE | entreprise | `entreprise_id = (...)` | ✅ OK |
| Regie can update missions for own tickets | UPDATE | regie | Via tickets → logements → immeubles | ✅ OK |
| Technicien can update assigned missions | UPDATE | technicien | `technicien_id = (...)` | ✅ OK |

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Isolation par rôle** | ✅ OK | Policies bien conçues |
| **Performance** | ✅ OK | Index existants |

---

## 🔄 API BACKEND

### 1. `POST /api/tickets/create`

**Fichier** : `api/tickets/create.js`

**Logique** :
1. ✅ Vérifie role = 'locataire'
2. ✅ Vérifie locataire.logement_id NOT NULL
3. ✅ Valide categorie, priorite
4. 🟡 INSERT avec `statut: 'ouvert'` (incohérent avec ENUM default 'nouveau')

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Validation** | ✅ OK | Complète |
| **Statut initial** | 🟡 INCOHÉRENT | Hardcode 'ouvert' au lieu de 'nouveau' |

### 2. `POST /api/tickets/diffuser`

**Fichier** : `api/tickets/diffuser.js`

**Logique** :
1. ✅ Vérifie role = 'regie' ou 'admin_jtec'
2. 🔴 Appelle RPC `update_ticket_statut()` qui n'existe pas
3. 🔴 Met statut = 'en_attente' (invisible pour entreprises)

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **RPC manquante** | 🔴 BLOQUANT | `update_ticket_statut` n'existe pas |
| **Incohérence statut** | 🔴 BLOQUANT | 'en_attente' invisible pour entreprises |

### 3. `POST /api/tickets/accept`

**Fichier** : `api/tickets/accept.js`

**Logique** :
1. ✅ Vérifie role = 'entreprise'
2. 🔴 Appelle RPC `accept_ticket_and_create_mission()` qui utilise colonne `autorise` inexistante

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Colonne manquante** | 🔴 BLOQUANT | Erreur SQL lors acceptation |

### 4. `GET /api/tickets/entreprise`

**Fichier** : `api/tickets/entreprise.js`

**Logique** :
1. ✅ Vérifie role = 'entreprise'
2. 🔴 SELECT depuis vue `tickets_visibles_entreprise` (filtre 'ouvert', tickets diffusés sont 'en_attente')

#### Conformité

| Critère | État | Notes |
|---------|------|-------|
| **Incohérence vue** | 🔴 BLOQUANT | Tickets diffusés invisibles |

---

## 📊 RÉSUMÉ - CONFORMITÉ GLOBALE

### Conformité par composant

| Composant | ✅ OK | 🟡 Risque | 🔴 Bloquant | 🗑️ À supprimer |
|-----------|-------|-----------|-------------|----------------|
| **Tables** | 3/4 | 1/4 | 0/4 | 0/4 |
| **ENUMS** | 1/2 | 1/2 | 0/2 | 0/2 |
| **Vues** | 2/3 | 0/3 | 1/3 | 0/3 |
| **RPC** | 2/4 | 1/4 | 1/4 | 0/4 |
| **RLS** | 12/14 | 1/14 | 1/14 | 0/14 |
| **API** | 1/4 | 1/4 | 2/4 | 0/4 |

### Top 3 problèmes bloquants

| # | Problème | Impact | Localisation |
|---|----------|--------|--------------|
| **1** | Statut 'en_attente' invisible entreprises | Workflow cassé | Policy RLS + Vue + API diffuser |
| **2** | Colonne `autorise` manquante | Erreur SQL acceptation | `regies_entreprises` + RPC |
| **3** | Fonction `update_ticket_statut` manquante | Erreur SQL diffusion | API diffuser |

---

## 🚫 COLONNES / FONCTIONNALITÉS MANQUANTES

### Par rapport à la spec cible

| Fonctionnalité | État actuel | Spec cible | Impact |
|----------------|-------------|------------|--------|
| **Sous-catégories** | 🔴 N'existe pas | Obligatoire | Enrichissement classification |
| **Pièce concernée** | 🔴 N'existe pas | Obligatoire | Localisation précise |
| **Disponibilités** | 🔴 N'existe pas | 3 créneaux | Planification intervention |
| **Plafond CHF** | 🔴 N'existe pas | Obligatoire | Budget intervention |
| **Mode diffusion sur ticket** | 🔴 N'existe pas | public/assigné | Visibilité entreprises |
| **Colonne devise** | 🔴 N'existe pas | CHF explicite | Clarté montants |

---

## 🎯 CONCLUSION

### Points forts
- ✅ Structure de base solide (tables, FK, index)
- ✅ RLS bien conçues pour locataire/régie
- ✅ Contrainte UNIQUE anti-doublon missions
- ✅ Trigger automatique regie_id

### Points critiques
- 🔴 Workflow tickets cassé (entreprises ne voient rien)
- 🔴 2 fonctions manquantes/cassées
- 🔴 Fonctionnalités spec manquantes (sous-catégories, pièce, disponibilités, plafond CHF)

### Prochaine étape
→ **Gap Analysis** (comparaison détaillée existant vs spec cible)

---

**Fin du document AUDIT_TICKETS_CURRENT_STATE**
