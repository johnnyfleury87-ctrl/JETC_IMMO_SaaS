# 🔍 AUDIT COMPLET - PROCESSUS TICKETS JETC_IMMO

**Date** : 26 décembre 2025  
**Périmètre** : Flux Tickets (Locataire → Régie → Entreprise)  
**Objectif** : Analyse exhaustive sans modification de code

---

## 📋 SOMMAIRE

1. [Vue d'ensemble du système](#1-vue-densemble-du-système)
2. [Cycle de vie fonctionnel d'un ticket](#2-cycle-de-vie-fonctionnel-dun-ticket)
3. [Audit des tables Supabase](#3-audit-des-tables-supabase)
4. [Audit des Row Level Security (RLS)](#4-audit-des-row-level-security-rls)
5. [Audit des migrations](#5-audit-des-migrations)
6. [Audit frontend et API](#6-audit-frontend-et-api)
7. [Problèmes identifiés par gravité](#7-problèmes-identifiés-par-gravité)
8. [Recommandations](#8-recommandations)

---

## 1. VUE D'ENSEMBLE DU SYSTÈME

### 1.1. Architecture globale

```
┌─────────────┐
│  LOCATAIRE  │ Crée ticket pour SON logement
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  TABLE: tickets                 │
│  - statut: 'nouveau'            │
│  - locataire_id                 │
│  - logement_id                  │
│  - regie_id (calculé auto)      │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────┐
│    RÉGIE    │ Visualise, diffuse aux entreprises
└──────┬──────┘
       │
       │  Diffusion (statut: 'nouveau' → 'en_attente')
       │
       ▼
┌─────────────────────────────────┐
│  VUE: tickets_visibles_         │
│       entreprise                │
│  - Mode diffusion 'general'     │
│  - Mode diffusion 'restreint'   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────┐
│ ENTREPRISE  │ Voit tickets autorisés, accepte
└──────┬──────┘
       │
       │  Acceptation (crée mission)
       │
       ▼
┌─────────────────────────────────┐
│  FONCTION SQL:                  │
│  accept_ticket_and_create_      │
│  mission()                      │
│  - Vérifie autorisation         │
│  - Crée mission                 │
│  - Verrouille ticket            │
│  - Statut: 'en_cours'           │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  TABLE: missions                │
│  - ticket_id (UNIQUE)           │
│  - entreprise_id                │
│  - technicien_id (optionnel)    │
│  - statut: 'en_attente'         │
└─────────────────────────────────┘
```

### 1.2. Rôles impliqués

| Rôle | Périmètre | Responsabilités |
|------|-----------|-----------------|
| **locataire** | SON logement uniquement | Créer tickets, voir SES tickets et missions |
| **regie** | SA régie (tous immeubles) | Voir tous tickets, gérer, diffuser aux entreprises |
| **entreprise** | Tickets autorisés par régies | Voir tickets selon mode diffusion, accepter, créer missions |
| **technicien** | Missions assignées | Voir et mettre à jour SES missions |
| **admin_jtec** | TOUT | Accès global (debugging) |

---

## 2. CYCLE DE VIE FONCTIONNEL D'UN TICKET

### 2.1. Flux attendu (théorique)

```
ÉTAPE 1: CRÉATION PAR LOCATAIRE
├─ Locataire authentifié crée ticket
├─ Champs obligatoires: titre, description, categorie
├─ Validation categorie, priorite
├─ logement_id = logement du locataire (vérifié par RLS)
├─ locataire_id = id du locataire
├─ regie_id = calculé automatiquement via trigger
└─ statut initial: 'nouveau'

ÉTAPE 2: VISIBILITÉ RÉGIE
├─ Régie voit tous tickets de SA régie (via regie_id)
├─ Policy RLS: "Regie can view own tickets" (using regie_id = get_user_regie_id())
└─ Régie peut modifier statut

ÉTAPE 3: DIFFUSION AUX ENTREPRISES
├─ Régie diffuse ticket (API POST /api/tickets/diffuser)
├─ Transition statut: 'nouveau' → 'en_attente'
├─ Utilise RPC: update_ticket_statut()
└─ Entreprises autorisées voient le ticket selon mode_diffusion

ÉTAPE 4: VISIBILITÉ ENTREPRISE
├─ Entreprise voit tickets via VUE tickets_visibles_entreprise
├─ Condition 1 (mode 'general'): TOUS tickets 'ouvert' de régies autorisées
├─ Condition 2 (mode 'restreint'): UNIQUEMENT tickets assignés (entreprise_id = id)
└─ ⚠️ INCOHÉRENCE: Vue filtre statut='ouvert' mais diffusion met 'en_attente'

ÉTAPE 5: ACCEPTATION PAR ENTREPRISE
├─ Entreprise accepte ticket (API POST /api/tickets/accept)
├─ Appelle RPC: accept_ticket_and_create_mission()
├─ Vérifications:
│  ├─ Ticket existe
│  ├─ Ticket non verrouillé (locked_at IS NULL)
│  └─ Entreprise autorisée (via regies_entreprises)
├─ Crée mission (INSERT INTO missions)
├─ Verrouille ticket (UPDATE tickets SET locked_at = now())
├─ Change statut ticket: 'en_cours'
└─ Retourne mission_id

ÉTAPE 6: EXÉCUTION MISSION
├─ Mission créée avec statut 'en_attente'
├─ Entreprise peut assigner technicien (technicien_id)
├─ Entreprise peut mettre à jour: devis_url, montant, statut
├─ Statuts mission: en_attente → en_cours → terminee → validee
└─ Régie valide mission (statut: 'validee')

ÉTAPE 7: CLÔTURE
├─ Mission validée par régie
├─ Ticket reste 'en_cours' (pas de transition auto vers 'clos')
└─ ⚠️ MANQUE: Processus de clôture finale ticket
```

### 2.2. Flux réel (implémenté)

**✅ Implémenté correctement** :
- Création ticket par locataire avec validation
- Calcul automatique regie_id via trigger
- Isolation stricte RLS par rôle
- Acceptation ticket avec vérification autorisation
- Contrainte UNIQUE ticket_id sur missions (1 mission max par ticket)
- Verrouillage ticket après acceptation

**❌ Incohérent ou manquant** :
- Décalage statut ticket lors diffusion ('en_attente' backend vs 'ouvert' vue)
- Pas de processus de clôture formalisé ticket → 'clos'
- Mode diffusion 'general' filtre statut='ouvert' mais tickets diffusés sont 'en_attente'
- Pas de gestion refus entreprise (mission annulée)
- Pas de workflow de validation finale ticket après mission validée

---

## 3. AUDIT DES TABLES SUPABASE

### 3.1. Table `tickets`

**Fichier** : `supabase/schema/12_tickets.sql`

**Structure** :
```sql
CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  titre text NOT NULL,
  description text NOT NULL,
  categorie text NOT NULL,
  priorite text NOT NULL DEFAULT 'normale',
  statut ticket_status NOT NULL DEFAULT 'nouveau',
  
  -- Relations
  logement_id uuid NOT NULL REFERENCES logements(id) ON DELETE CASCADE,
  locataire_id uuid NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
  regie_id uuid NOT NULL, -- Calculé automatiquement via trigger
  
  -- Assignation (nullable tant que pas assigné)
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  technicien_id uuid REFERENCES techniciens(id) ON DELETE SET NULL,
  
  -- Dates
  date_creation timestamptz DEFAULT now(),
  date_cloture timestamptz,
  date_limite timestamptz,
  
  -- Informations complémentaires
  photos text[], -- URLs photos
  urgence boolean DEFAULT false,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes** :
- ✅ CHECK priorite IN ('faible', 'normale', 'haute', 'urgente')
- ✅ CHECK categorie IN ('plomberie', 'électricité', 'chauffage', 'serrurerie', 'vitrerie', 'menuiserie', 'peinture', 'autre')
- ✅ CHECK date_cloture >= date_creation
- ✅ FK vers logements, locataires (CASCADE)
- ✅ FK vers entreprises, techniciens (SET NULL)

**Colonnes critiques** :
- `statut` : Type **ticket_status** (ENUM)
- `regie_id` : Calculé via trigger `set_ticket_regie_id()` avant INSERT
- `entreprise_id` : NULL au départ, assigné manuellement ou lors acceptation ⚠️ AMBIGUÏTÉ
- `locked_at` : Ajouté dans `13_missions.sql` pour verrouillage

**Index performance** :
- idx_tickets_logement_id
- idx_tickets_locataire_id
- idx_tickets_regie_id
- idx_tickets_statut
- idx_tickets_priorite
- idx_tickets_entreprise_id
- idx_tickets_technicien_id
- idx_tickets_date_creation

**Trigger** :
```sql
-- Trigger set_ticket_regie_id_trigger (BEFORE INSERT)
-- Calcule regie_id via logements → immeubles → regie_id
```

### 3.2. Table `missions`

**Fichier** : `supabase/schema/13_missions.sql`

**Structure** :
```sql
CREATE TABLE missions (
  id uuid PRIMARY KEY,
  
  -- Références
  ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  technicien_id uuid REFERENCES techniciens(id) ON DELETE SET NULL,
  
  -- Dates intervention
  date_intervention_prevue timestamptz,
  date_intervention_realisee timestamptz,
  
  -- Statut mission
  statut text NOT NULL DEFAULT 'en_attente' CHECK (
    statut IN ('en_attente', 'en_cours', 'terminee', 'validee', 'annulee')
  ),
  
  -- Dates
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  validated_at timestamptz,
  
  -- Informations complémentaires
  notes text,
  devis_url text,
  facture_url text,
  montant decimal(10,2),
  
  -- Audit
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Contraintes** :
- ✅ **UNIQUE** sur `ticket_id` : Une seule mission par ticket
- ✅ FK vers tickets (CASCADE)
- ✅ FK vers entreprises (CASCADE)
- ✅ FK vers techniciens (SET NULL)
- ✅ CHECK statut (5 valeurs)

**Colonnes critiques** :
- `ticket_id` : UNIQUE, empêche doublons missions
- `statut` : Type **text** avec CHECK (pas d'ENUM mission_status utilisé ⚠️)
- `technicien_id` : Optionnel, assigné après création mission

**Index performance** :
- idx_missions_ticket_id
- idx_missions_entreprise_id
- idx_missions_technicien_id
- idx_missions_statut
- idx_missions_created_at
- idx_missions_date_intervention_prevue

### 3.3. Table `entreprises`

**Fichier** : `supabase/schema/10_entreprises.sql`

**Structure** :
```sql
CREATE TABLE entreprises (
  id uuid PRIMARY KEY,
  nom text NOT NULL,
  siret text UNIQUE,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email text NOT NULL,
  
  -- Spécialités
  specialites text[], -- Tableau spécialités
  
  -- Rattachement profil
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Infos complémentaires
  description text,
  site_web text,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes** :
- ✅ UNIQUE sur `nom`
- ✅ UNIQUE sur `siret`
- ✅ CHECK format email
- ✅ CHECK format telephone
- ✅ FK vers profiles (CASCADE)

**Index** :
- idx_entreprises_profile_id
- idx_entreprises_nom
- idx_entreprises_specialites (GIN pour recherche dans tableau)

### 3.4. Table `regies_entreprises`

**Fichier** : `supabase/schema/10_entreprises.sql`

**Structure** :
```sql
CREATE TABLE regies_entreprises (
  id uuid PRIMARY KEY,
  regie_id uuid NOT NULL REFERENCES regies(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  
  -- Mode de diffusion
  mode_diffusion text NOT NULL DEFAULT 'restreint',
  
  -- Métadonnées
  date_autorisation timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes** :
- ✅ UNIQUE sur (regie_id, entreprise_id) : Une autorisation unique par couple
- ✅ CHECK mode_diffusion IN ('general', 'restreint')
- ✅ FK vers regies, entreprises (CASCADE)

**Modes de diffusion** :
- **'general'** : Entreprise voit TOUS les tickets ouverts de la régie
- **'restreint'** : Entreprise voit UNIQUEMENT les tickets qui lui sont assignés

**⚠️ PROBLÈME IDENTIFIÉ** : Colonne `autorise` manquante mais utilisée dans RPC `accept_ticket_and_create_mission()` (ligne 127) :
```sql
select exists (
  select 1 from regies_entreprises
  where regie_id = v_ticket_regie_id
  and entreprise_id = p_entreprise_id
  and autorise = true  -- ⚠️ COLONNE N'EXISTE PAS
) into v_is_authorized;
```

### 3.5. Table `profiles`

**Fichier** : `supabase/schema/04_profiles.sql` (non lu mais référencé partout)

**Colonnes attendues** :
- `id` (uuid, PK, = auth.uid())
- `email` (text)
- `role` (user_role ENUM)
- `regie_id` (uuid, nullable, pour rôle 'regie')
- `created_at`, `updated_at`

### 3.6. Table `locataires`

**Fichier** : `supabase/schema/08_locataires.sql` (non lu)

**Colonnes attendues** :
- `id` (uuid, PK)
- `profile_id` (uuid, FK → profiles)
- `logement_id` (uuid, FK → logements)
- `nom`, `prenom`, `email`, `telephone`
- `date_entree`, `date_sortie`
- `created_at`, `updated_at`

### 3.7. Dépendances entre tables

```
profiles (auth.uid)
   ├─> regies (profile_id)
   │      └─> immeubles (regie_id)
   │             └─> logements (immeuble_id)
   │                    └─> locataires (logement_id)
   │                           └─> tickets (locataire_id, logement_id)
   │                                  ├─> missions (ticket_id UNIQUE)
   │                                  └─> [regie_id calculé auto]
   │
   ├─> locataires (profile_id)
   │
   ├─> entreprises (profile_id)
   │      └─> regies_entreprises (entreprise_id)
   │             └─> missions (entreprise_id)
   │
   └─> techniciens (profile_id)
          └─> missions (technicien_id)
```

---

## 4. AUDIT DES ROW LEVEL SECURITY (RLS)

### 4.1. Table `tickets` - Policies

**Fichier** : `supabase/schema/18_rls.sql`

#### Policy 1 : Locataire voit SES tickets

```sql
create policy "Locataire can view own tickets"
on tickets for select
using (
  exists (
    select 1
    from locataires
    where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Isolation stricte : Locataire voit UNIQUEMENT tickets où `locataire_id` = son ID
- ✅ Pas de récursion : Jointure locataires simple
- ✅ Index existant : `idx_tickets_locataire_id`
- **Performance** : OK (SELECT ciblé)

#### Policy 2 : Locataire crée SES tickets

```sql
create policy "Locataire can create own tickets"
on tickets for insert
with check (
  exists (
    select 1
    from locataires
    where locataires.id = tickets.locataire_id
      and locataires.profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Vérification WITH CHECK : Locataire ne peut créer ticket que pour LUI-MÊME
- ✅ Empêche création ticket pour autre locataire
- **Cohérence** : API `/api/tickets/create` vérifie déjà cette contrainte, policy est sécurité défensive

#### Policy 3 : Régie voit SES tickets

```sql
create policy "Regie can view own tickets"
on tickets for select
using (regie_id = get_user_regie_id());
```

**Analyse** :
- ✅ Isolation stricte : Régie voit UNIQUEMENT tickets de SA régie
- ✅ Fonction helper : `get_user_regie_id()` définie dans `09b_helper_functions.sql`
- ✅ Index existant : `idx_tickets_regie_id`
- **Performance** : OK (fonction STABLE, résultat cachable)

**Fonction helper `get_user_regie_id()` :**
```sql
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    -- Rôle 'regie' : regie_id depuis regies.profile_id
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Rôle 'locataire' : remonte via locataires → logements → immeubles
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;
```

**Risques** :
- ⚠️ **SECURITY DEFINER** : Fonction bypass RLS, accès direct aux tables
- ✅ **STABLE** : Résultat constant pendant transaction
- ⚠️ **Utilisation locataire** : Fonction utilisée dans policy locataires, mais policy locataire sur tickets utilise locataires.id directement (pas de conflit)

#### Policy 4 : Régie gère SES tickets

```sql
create policy "Regie can manage own tickets"
on tickets for all
using (regie_id = get_user_regie_id());
```

**Analyse** :
- ✅ **FOR ALL** : Régie peut SELECT, INSERT, UPDATE, DELETE sur SES tickets
- ✅ Isolation stricte : `regie_id = get_user_regie_id()`
- **Cohérence** : OK, régie doit pouvoir modifier statuts, assigner entreprises

#### Policy 5 : Entreprise voit tickets autorisés

```sql
create policy "Entreprise can view authorized tickets"
on tickets for select
using (
  exists (
    select 1
    from entreprises e
    where e.profile_id = auth.uid()
      and (
        exists (
          select 1
          from regies_entreprises re
          where re.entreprise_id = e.id
            and re.regie_id = tickets.regie_id
            and re.mode_diffusion = 'general'
            and tickets.statut = 'ouvert'  -- ⚠️ PROBLÈME ICI
        )
        or
        exists (
          select 1
          from regies_entreprises re
          where re.entreprise_id = e.id
            and re.regie_id = tickets.regie_id
            and re.mode_diffusion = 'restreint'
            and tickets.entreprise_id = e.id
        )
      )
  )
);
```

**Analyse** :
- ✅ Vérification autorisation via `regies_entreprises`
- ✅ Mode 'general' : Tous tickets ouverts
- ✅ Mode 'restreint' : Uniquement tickets assignés (`tickets.entreprise_id = e.id`)
- **⚠️ PROBLÈME MAJEUR** :
  - Policy filtre `tickets.statut = 'ouvert'` pour mode 'general'
  - API `/api/tickets/diffuser` change statut en **'en_attente'**
  - **Incohérence** : Tickets diffusés ne sont plus visibles en mode 'general' ❌

**Impact** :
- Entreprises en mode 'general' ne voient PAS les tickets diffusés
- Workflow cassé : diffusion → invisible

#### Policy 6 : Admin JTEC voit tout

```sql
create policy "Admin JTEC can view all tickets"
on tickets for select
using (public.is_admin_jtec());
```

**Analyse** :
- ✅ Fonction helper `is_admin_jtec()` (SECURITY DEFINER)
- ✅ Accès global pour debugging
- **Performance** : OK (fonction simple)

### 4.2. Table `missions` - Policies

**Fichier** : `supabase/schema/13_missions.sql`

#### Policy 1 : Régie voit missions de SES tickets

```sql
create policy "Regie can view missions for own tickets"
on missions for select
using (
  exists (
    select 1 from tickets t
    join logements l on t.logement_id = l.id
    join immeubles i on l.immeuble_id = i.id
    where missions.ticket_id = t.id
    and i.regie_id = get_user_regie_id()
  )
);
```

**Analyse** :
- ✅ Isolation stricte : Régie voit missions liées à SES tickets
- ✅ Jointures : tickets → logements → immeubles → regie_id
- **Performance** : Index existants OK

#### Policy 2 : Entreprise voit SES missions

```sql
create policy "Entreprise can view own missions"
on missions for select
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Isolation stricte : Entreprise voit UNIQUEMENT SES missions
- **Performance** : OK (sous-requête simple)

#### Policy 3 : Locataire voit missions de SES tickets

```sql
create policy "Locataire can view missions for own tickets"
on missions for select
using (
  exists (
    select 1 from tickets t
    join locataires loc on t.locataire_id = loc.id
    where missions.ticket_id = t.id
    and loc.profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Isolation stricte : Locataire voit missions liées à SES tickets
- **Cohérence** : OK, locataire peut suivre avancement

#### Policy 4 : Entreprise met à jour SES missions

```sql
create policy "Entreprise can update own missions"
on missions for update
using (
  entreprise_id = (
    select id from entreprises
    where profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Isolation stricte
- **Cas d'usage** : Entreprise change statut, ajoute devis_url, montant

#### Policy 5 : Régie met à jour missions de SES tickets

```sql
create policy "Regie can update missions for own tickets"
on missions for update
using (
  exists (
    select 1 from tickets t
    join logements l on t.logement_id = l.id
    join immeubles i on l.immeuble_id = i.id
    where missions.ticket_id = t.id
    and i.regie_id = get_user_regie_id()
  )
);
```

**Analyse** :
- ✅ Isolation stricte
- **Cas d'usage** : Régie valide mission (statut: 'validee')

#### Policies 6 & 7 : Admin JTEC & Technicien

```sql
-- Admin JTEC voit tout
create policy "Admin JTEC can view all missions"
on missions for select
using (public.is_admin_jtec());

-- Technicien voit SES missions assignées
create policy "Technicien can view assigned missions"
on missions for select
using (
  technicien_id = (
    select id from techniciens
    where profile_id = auth.uid()
  )
);

-- Technicien met à jour SES missions
create policy "Technicien can update assigned missions"
on missions for update
using (
  technicien_id = (
    select id from techniciens
    where profile_id = auth.uid()
  )
);
```

**Analyse** :
- ✅ Isolation stricte pour techniciens
- ✅ Admin JTEC accès global

### 4.3. Résumé RLS - Problèmes identifiés

| Table | Policy | Gravité | Problème |
|-------|--------|---------|----------|
| **tickets** | Entreprise can view authorized tickets | 🔴 BLOQUANT | Filtre `statut='ouvert'` mais diffusion met `'en_attente'` → tickets invisibles |
| **regies_entreprises** | - | 🔴 BLOQUANT | Colonne `autorise` manquante mais utilisée dans RPC |
| **tickets** | Regie can manage own tickets | 🟡 RISQUE | FOR ALL permet DELETE sans vérification tickets ouverts |
| **get_user_regie_id()** | Fonction helper | 🟡 RISQUE | SECURITY DEFINER bypass RLS, usage correct mais sensible |

---

## 5. AUDIT DES MIGRATIONS

### 5.1. Migrations existantes liées aux tickets

**Répertoire** : `supabase/migrations/`

#### Fichiers identifiés :
- `20251223000002_add_trigger_ticket_requires_logement.sql` : Ajout trigger validation logement_id
- `20251224000000_fix_logement_id_nullable.sql` : Fix logement_id nullable

**⚠️ PROBLÈME** :
- **Aucune migration formelle pour tickets/missions** : Schéma défini dans `supabase/schema/` mais pas versionné dans `migrations/`
- **Risque** : Décalage entre schéma de développement et production

### 5.2. Schéma actuel vs. migrations

| Élément | Schéma fichier | Migration versionnée |
|---------|---------------|---------------------|
| Table tickets | ✅ `12_tickets.sql` | ❌ Manquant |
| Table missions | ✅ `13_missions.sql` | ❌ Manquant |
| Table entreprises | ✅ `10_entreprises.sql` | ❌ Manquant |
| Table regies_entreprises | ✅ `10_entreprises.sql` | ❌ Manquant |
| RLS tickets | ✅ `18_rls.sql` | ❌ Manquant |
| RLS missions | ✅ `13_missions.sql` | ❌ Manquant |
| Vue tickets_visibles_entreprise | ✅ `17_views.sql` | ❌ Manquant |
| Fonction accept_ticket_and_create_mission | ✅ `13_missions.sql` | ❌ Manquant |

**Recommandation** :
- Créer migrations numérotées pour tous les schémas de production
- Format : `YYYYMMDDHHMMSS_description.sql`
- Idempotence : Utiliser `IF NOT EXISTS`, `IF EXISTS`

### 5.3. Trigger `set_ticket_regie_id`

**Définition** : `supabase/schema/12_tickets.sql`

```sql
create or replace function set_ticket_regie_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_regie_id uuid;
begin
  select i.regie_id into v_regie_id
  from logements l
  join immeubles i on l.immeuble_id = i.id
  where l.id = new.logement_id;
  
  if v_regie_id is null then
    raise exception 'Impossible de déterminer la régie pour le logement %', new.logement_id;
  end if;
  
  new.regie_id := v_regie_id;
  return new;
end;
$$;

create trigger set_ticket_regie_id_trigger
  before insert on tickets
  for each row execute function set_ticket_regie_id();
```

**Analyse** :
- ✅ **BEFORE INSERT** : Calcule `regie_id` avant insertion
- ✅ **SECURITY DEFINER** : Bypass RLS pour accéder immeubles
- ✅ Validation : RAISE EXCEPTION si logement_id invalide
- **Dépendances** : Requiert tables logements, immeubles existantes

---

## 6. AUDIT FRONTEND ET API

### 6.1. API Backend - Routes tickets

**Répertoire** : `api/tickets/`

#### Route 1 : `POST /api/tickets/create`

**Fichier** : `api/tickets/create.js`

**Flux** :
1. Vérifie token JWT
2. Vérifie role = 'locataire'
3. Récupère locataire depuis `locataires` (WHERE profile_id = auth.uid())
4. Vérifie locataire.logement_id NOT NULL
5. Valide données formulaire (titre, description, categorie, priorite)
6. INSERT INTO tickets avec supabaseAdmin (bypass RLS)
7. Retourne ticket créé avec jointures

**Analyse** :
- ✅ **Validation complète** : Rôle, logement, champs obligatoires
- ✅ **Isolation** : Locataire ne peut créer ticket que pour SON logement
- ✅ **supabaseAdmin** : Utilise SERVICE_ROLE_KEY (bypass RLS)
- **Cohérence RLS** : Policy "Locataire can create own tickets" redondante mais sécurité défensive

**Code critique** :
```javascript
// Validation catégorie
const categoriesValides = [
  'plomberie', 'électricité', 'chauffage', 'serrurerie',
  'vitrerie', 'menuiserie', 'peinture', 'autre'
];
if (!categoriesValides.includes(categorie)) {
  return 400; // ✅ Cohérent avec CHECK SQL
}

// Validation priorité
const prioritesValides = ['faible', 'normale', 'haute', 'urgente'];
const prioriteFinale = priorite && prioritesValides.includes(priorite) 
  ? priorite 
  : 'normale'; // ✅ Cohérent avec CHECK SQL

// INSERT avec supabaseAdmin
const { data: ticket, error: ticketError } = await supabaseAdmin
  .from('tickets')
  .insert({
    titre,
    description,
    categorie,
    priorite: prioriteFinale,
    urgence: urgence === true,
    logement_id: locataire.logement_id,
    locataire_id: locataire.id,
    statut: 'ouvert' // ⚠️ DEVRAIT ÊTRE 'nouveau' selon ENUM
  })
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- Statut initial hardcodé `'ouvert'` au lieu de `'nouveau'` selon enum ticket_status
- Incohérence avec valeur par défaut table : `DEFAULT 'nouveau'`

#### Route 2 : `POST /api/tickets/diffuser`

**Fichier** : `api/tickets/diffuser.js`

**Flux** :
1. Vérifie token JWT
2. Vérifie role = 'regie' OU 'admin_jtec'
3. Appelle RPC `update_ticket_statut(ticket_id, 'en_attente', role)`
4. Retourne succès

**Analyse** :
- ✅ Validation rôle
- ✅ Utilise RPC centralisée (bonne pratique)
- **⚠️ PROBLÈME** : Transition vers 'en_attente' rend tickets invisibles pour entreprises (cf. Policy RLS)

**Code** :
```javascript
const { data: result, error: updateError } = await supabase
  .rpc('update_ticket_statut', {
    p_ticket_id: ticket_id,
    p_nouveau_statut: 'en_attente', // ⚠️ Rend invisible pour entreprises
    p_role: profile.role
  });
```

**RPC `update_ticket_statut`** : Non trouvée dans schémas audités (fichier manquant ou non lu)

#### Route 3 : `POST /api/tickets/accept`

**Fichier** : `api/tickets/accept.js`

**Flux** :
1. Vérifie token JWT
2. Vérifie role = 'entreprise'
3. Récupère entreprise.id depuis profile_id
4. Appelle RPC `accept_ticket_and_create_mission(ticket_id, entreprise_id)`
5. Retourne mission_id

**Analyse** :
- ✅ Validation rôle entreprise
- ✅ Utilise RPC (logique métier centralisée)
- **⚠️ PROBLÈME** : RPC utilise colonne `autorise` inexistante dans `regies_entreprises`

**Code** :
```javascript
const { data: result, error: acceptError } = await supabase
  .rpc('accept_ticket_and_create_mission', {
    p_ticket_id: ticket_id,
    p_entreprise_id: entreprise.id
  });
```

**RPC `accept_ticket_and_create_mission`** :
```sql
-- Vérification entreprise autorisée (ligne 124-130)
select exists (
  select 1 from regies_entreprises
  where regie_id = v_ticket_regie_id
  and entreprise_id = p_entreprise_id
  and autorise = true  -- ⚠️ COLONNE N'EXISTE PAS
) into v_is_authorized;
```

**Impact** :
- **Erreur SQL** lors acceptation ticket par entreprise
- Blocage complet du workflow

#### Route 4 : `GET /api/tickets/entreprise`

**Fichier** : `api/tickets/entreprise.js`

**Flux** :
1. Vérifie token JWT
2. Vérifie role = 'entreprise'
3. Récupère entreprise.id
4. SELECT depuis VUE `tickets_visibles_entreprise` WHERE entreprise_id = id
5. Retourne tickets (ou tableau vide si aucune autorisation)

**Analyse** :
- ✅ Utilise VUE (isolation logique)
- ✅ Retourne [] si pas d'autorisation (pas d'erreur)
- **⚠️ PROBLÈME** : Vue filtre `statut='ouvert'` mais tickets diffusés sont `'en_attente'` (incohérence)

**Code** :
```javascript
const { data: tickets, error: ticketsError } = await supabaseAdmin
  .from('tickets_visibles_entreprise')
  .select('*')
  .eq('entreprise_id', entreprise.id)
  .order('date_creation', { ascending: false });
```

**Vue `tickets_visibles_entreprise` (17_views.sql)** :
```sql
create or replace view tickets_visibles_entreprise as
select
  t.*,
  re.mode_diffusion,
  -- ... jointures ...
from tickets t
join regies_entreprises re on t.regie_id = re.regie_id
-- ... autres jointures ...
where
  (
    re.mode_diffusion = 'general'
    and t.statut = 'ouvert'  -- ⚠️ INCOHÉRENCE
  )
  or
  (
    re.mode_diffusion = 'restreint'
    and t.entreprise_id = re.entreprise_id
  );
```

### 6.2. Frontend locataire

**Fichier** : `public/locataire/dashboard.html`

**Fonctionnalités tickets** :
- ✅ Menu "Créer un ticket" visible
- ❌ Formulaire création ticket non implémenté dans le HTML fourni (lignes 1-800)
- ❌ Liste "Mes tickets" désactivée (menu-item disabled)

**Analyse** :
- Frontend partiel : Dashboard info logement OK, tickets manquants
- **Cohérence** : API `/api/tickets/create` existe mais pas de formulaire frontend

### 6.3. Résumé API - Incohérences

| Route | Problème | Gravité |
|-------|----------|---------|
| POST /api/tickets/create | Statut initial 'ouvert' au lieu de 'nouveau' | 🟡 MINEUR |
| POST /api/tickets/diffuser | Transition 'en_attente' rend tickets invisibles entreprises | 🔴 BLOQUANT |
| POST /api/tickets/accept | RPC utilise colonne `autorise` inexistante | 🔴 BLOQUANT |
| GET /api/tickets/entreprise | Vue filtre 'ouvert' mais tickets diffusés 'en_attente' | 🔴 BLOQUANT |

---

## 7. PROBLÈMES IDENTIFIÉS PAR GRAVITÉ

### 🔴 BLOQUANTS (workflow cassé)

#### P1 : Incohérence statut tickets diffusés (entreprise ne voit rien)

**Localisation** :
- API `/api/tickets/diffuser` : Transition vers `'en_attente'`
- Policy RLS `Entreprise can view authorized tickets` : Filtre `tickets.statut = 'ouvert'`
- Vue `tickets_visibles_entreprise` : Filtre `t.statut = 'ouvert'`

**Impact** :
- Entreprises en mode 'general' ne voient JAMAIS les tickets diffusés
- Workflow cassé : Locataire crée → Régie diffuse → Entreprise ne voit rien

**Cause** :
- Décalage sémantique entre statuts ENUM et logique métier
- ENUM définit 'nouveau', 'ouvert', 'en_attente' mais usage incohérent

**Solutions possibles** :
1. **Option A** : Modifier policy/vue pour filtrer `'en_attente'` au lieu de `'ouvert'`
2. **Option B** : Modifier API diffuser pour mettre statut `'ouvert'` au lieu de `'en_attente'`
3. **Option C** : Revoir cycle statuts complet (nouveau → en_attente pour régie, ouvert pour entreprise)

#### P2 : Colonne `autorise` manquante dans `regies_entreprises`

**Localisation** :
- RPC `accept_ticket_and_create_mission()` ligne 127
- Table `regies_entreprises` : Colonne absente

**Impact** :
- **Erreur SQL** lors acceptation ticket : `column "autorise" does not exist`
- Impossibilité pour entreprise d'accepter tickets
- Workflow bloqué après diffusion

**Cause** :
- Schéma table incomplet ou colonne supprimée sans mise à jour RPC

**Solution** :
1. Ajouter colonne `autorise boolean NOT NULL DEFAULT true`
2. OU supprimer vérification `and autorise = true` dans RPC (existence dans regies_entreprises = autorisation)

#### P3 : Fonction RPC `update_ticket_statut` manquante

**Localisation** :
- API `/api/tickets/diffuser` appelle `update_ticket_statut()`
- Aucun fichier schéma ne définit cette fonction

**Impact** :
- Erreur lors diffusion ticket : `function update_ticket_statut does not exist`
- Impossibilité de diffuser tickets

**Solution** :
- Créer fonction RPC ou utiliser UPDATE direct avec validation statuts

### 🟡 RISQUES (fonctionnalité fragile)

#### R1 : Statut initial ticket incohérent

**Localisation** :
- API `/api/tickets/create` : Hardcode `statut: 'ouvert'`
- Table `tickets` : DEFAULT `'nouveau'`
- ENUM `ticket_status` : Valeur 'nouveau' existe

**Impact** :
- Incohérence entre API et schéma
- Si API modifiée, valeur par défaut SQL prend le relais (comportement différent)

**Solution** :
- Harmoniser : Soit `'nouveau'` partout, soit `'ouvert'` partout

#### R2 : Pas de processus clôture formalisé

**Localisation** :
- Aucune API pour clôturer ticket
- Aucune transition mission.validee → ticket.clos

**Impact** :
- Tickets restent 'en_cours' même après mission validée
- Accumulation tickets non clos

**Solution** :
- Créer workflow : Régie valide mission → Option clôturer ticket → Statut 'clos'

#### R3 : Policy "Regie can manage own tickets" FOR ALL

**Localisation** :
- Policy RLS `18_rls.sql` ligne 213

**Impact** :
- Régie peut DELETE tickets sans vérification
- Risque suppression tickets avec missions actives

**Solution** :
- Séparer policies : SELECT/UPDATE/DELETE distincts
- Ajouter contrainte : Empêcher DELETE si mission existante

#### R4 : Pas de gestion refus entreprise

**Localisation** :
- Aucune API `/api/tickets/reject`
- Statut mission 'annulee' existe mais pas utilisé

**Impact** :
- Entreprise accepte ou rien
- Si entreprise refuse, ticket reste bloqué

**Solution** :
- Créer API refus avec déverrouillage ticket (locked_at = NULL)

### 🟢 AMÉLIORATIONS (bonnes pratiques)

#### A1 : Migrations non versionnées

**Impact** :
- Risque décalage dev/prod
- Pas d'historique modifications schéma

**Solution** :
- Créer migrations numérotées pour tous les schémas

#### A2 : ENUM `mission_status` non utilisé

**Localisation** :
- ENUM défini dans `02_enums.sql`
- Table `missions.statut` utilise `text` avec CHECK

**Solution** :
- Utiliser ENUM pour cohérence

#### A3 : Frontend tickets incomplet

**Impact** :
- Fonctionnalité annoncée mais non implémentée

**Solution** :
- Implémenter formulaire création ticket + liste tickets

---

## 8. RECOMMANDATIONS

### 8.1. Corrections prioritaires (avant déploiement)

#### 🔴 PRIORITÉ 1 : Corriger visibilité entreprises

**Option recommandée** : Modifier policy/vue pour filtrer `'en_attente'` au lieu de `'ouvert'`

**Fichiers à modifier** :
1. `supabase/schema/18_rls.sql` (Policy entreprise)
2. `supabase/schema/17_views.sql` (Vue tickets_visibles_entreprise)

**Changements** :
```sql
-- Dans Policy "Entreprise can view authorized tickets"
-- Remplacer :
and tickets.statut = 'ouvert'
-- Par :
and tickets.statut IN ('ouvert', 'en_attente')

-- Dans Vue tickets_visibles_entreprise
-- Remplacer :
and t.statut = 'ouvert'
-- Par :
and t.statut IN ('ouvert', 'en_attente')
```

#### 🔴 PRIORITÉ 2 : Ajouter colonne `autorise` à `regies_entreprises`

**Fichier** : `supabase/schema/10_entreprises.sql`

**Migration** :
```sql
-- Ajouter colonne autorise
ALTER TABLE regies_entreprises
ADD COLUMN IF NOT EXISTS autorise boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN regies_entreprises.autorise IS 
  'Indique si l''entreprise est activement autorisée pour la régie';
```

**Cas d'usage** :
- Permet désactivation temporaire entreprise sans supprimer autorisation
- Colonne utilisée dans RPC `accept_ticket_and_create_mission()`

#### 🔴 PRIORITÉ 3 : Créer fonction RPC `update_ticket_statut`

**Fichier** : Nouveau fichier `supabase/schema/12b_tickets_rpc.sql`

**Fonction** :
```sql
create or replace function update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status,
  p_role user_role
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ancien_statut ticket_status;
  v_regie_id uuid;
begin
  -- Récupérer ticket
  select statut, regie_id into v_ancien_statut, v_regie_id
  from tickets
  where id = p_ticket_id;
  
  if not found then
    return jsonb_build_object('success', false, 'error', 'Ticket non trouvé');
  end if;
  
  -- Vérifier transitions autorisées
  -- TODO: Ajouter matrice transitions selon rôle
  
  -- Mettre à jour statut
  update tickets
  set statut = p_nouveau_statut,
      updated_at = now()
  where id = p_ticket_id;
  
  return jsonb_build_object('success', true, 'ancien_statut', v_ancien_statut);
end;
$$;
```

### 8.2. Corrections secondaires (post-déploiement)

#### 🟡 Harmoniser statut initial ticket

**Fichier** : `api/tickets/create.js`

**Changement** :
```javascript
// Remplacer :
statut: 'ouvert'
// Par :
statut: 'nouveau'
```

**Justification** :
- Cohérence avec ENUM et DEFAULT SQL
- Sémantique claire : 'nouveau' = créé par locataire, 'ouvert' = validé par régie

#### 🟡 Créer workflow clôture ticket

**Nouvelle API** : `POST /api/tickets/close`

**Logique** :
1. Vérifier rôle = 'regie'
2. Vérifier mission validée (statut = 'validee')
3. UPDATE tickets SET statut = 'clos', date_cloture = now()

#### 🟡 Séparer policy DELETE régie

**Fichier** : `supabase/schema/18_rls.sql`

**Remplacer** :
```sql
-- Policy FOR ALL (actuelle)
create policy "Regie can manage own tickets"
on tickets for all
using (regie_id = get_user_regie_id());
```

**Par** :
```sql
-- Séparer en 3 policies
create policy "Regie can view own tickets"
on tickets for select
using (regie_id = get_user_regie_id());

create policy "Regie can update own tickets"
on tickets for update
using (regie_id = get_user_regie_id());

create policy "Regie can delete own tickets"
on tickets for delete
using (
  regie_id = get_user_regie_id()
  and not exists (
    select 1 from missions
    where missions.ticket_id = tickets.id
  )
);
```

### 8.3. Améliorations structurelles

#### 🟢 Créer migrations versionnées

**Structure recommandée** :
```
supabase/migrations/
├── 20251226000001_create_tables_tickets.sql
├── 20251226000002_create_tables_missions.sql
├── 20251226000003_create_tables_entreprises.sql
├── 20251226000004_create_rls_tickets.sql
├── 20251226000005_create_rls_missions.sql
├── 20251226000006_create_views_tickets.sql
└── 20251226000007_create_rpc_tickets.sql
```

#### 🟢 Utiliser ENUM `mission_status`

**Fichier** : `supabase/schema/13_missions.sql`

**Remplacer** :
```sql
statut text NOT NULL DEFAULT 'en_attente' CHECK (
  statut IN ('en_attente', 'en_cours', 'terminee', 'validee', 'annulee')
)
```

**Par** :
```sql
statut mission_status NOT NULL DEFAULT 'en_attente'
```

#### 🟢 Documenter matrice transitions statuts

**Fichier** : Nouveau `docs/STATUTS_TICKETS_MISSIONS.md`

**Contenu** :
```markdown
# Matrice transitions statuts

## Tickets

| De | Vers | Acteur autorisé | Conditions |
|----|------|-----------------|------------|
| nouveau | ouvert | régie | Validation ticket |
| ouvert | en_attente | régie | Diffusion entreprises |
| en_attente | en_cours | système | Mission créée |
| en_cours | clos | régie | Mission validée |
| * | annule | régie | Annulation |

## Missions

| De | Vers | Acteur | Conditions |
|----|------|--------|------------|
| en_attente | en_cours | entreprise | Démarrage intervention |
| en_cours | terminee | entreprise | Intervention terminée |
| terminee | validee | régie | Validation régie |
| * | annulee | régie/entreprise | Annulation |
```

---

## 🎯 CONCLUSION

### Points forts du système actuel

✅ **Isolation stricte par rôle** : RLS bien conçues pour locataire/régie  
✅ **Trigger automatique** : Calcul regie_id transparent  
✅ **Contrainte UNIQUE** : Une seule mission par ticket garantie  
✅ **Verrouillage ticket** : Empêche double acceptation  
✅ **Validation backend** : API créent tickets avec vérifications  
✅ **Fonction helper** : get_user_regie_id() réutilisable  

### Problèmes critiques à corriger AVANT production

🔴 **Incohérence statut** : Tickets diffusés invisibles pour entreprises  
🔴 **Colonne manquante** : `autorise` dans regies_entreprises  
🔴 **Fonction manquante** : `update_ticket_statut` RPC  

### Impact global

**Sans corrections** :
- Workflow tickets **COMPLÈTEMENT CASSÉ** après diffusion régie
- Entreprises ne peuvent jamais voir tickets en mode 'general'
- Entreprises ne peuvent jamais accepter tickets (erreur SQL)

**Avec corrections prioritaires** :
- Workflow fonctionnel de bout en bout
- Isolation sécurisée par rôle
- Processus tickets opérationnel

### Prochaines étapes recommandées

1. ✅ Valider audit avec équipe
2. 🔴 Appliquer corrections prioritaires (P1, P2, P3)
3. 🟡 Planifier corrections secondaires
4. 🟢 Implémenter améliorations structurelles
5. 🧪 Tests E2E complets du workflow tickets
6. 📦 Déployer en production

---

**Fin du rapport d'audit**
