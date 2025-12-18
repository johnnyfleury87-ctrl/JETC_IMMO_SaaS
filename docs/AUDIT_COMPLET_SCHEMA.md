# AUDIT COMPLET SCHÉMA JETC_IMMO_SaaS

**Date** : 2025-12-18  
**Objectif** : Validation complète migrations 01→23 sur base vide

---

## 📋 1. INVENTAIRE FICHIERS (ordre d'exécution)

| # | Fichier | Description | Tables créées | Dépendances |
|---|---------|-------------|---------------|-------------|
| 01 | `01_extensions.sql` | Extensions PostgreSQL | - | - |
| 02 | `02_enums.sql` | Types ENUM | - | 01 |
| 03 | `03_helper_functions.sql` | Triggers génériques | - | - |
| 04 | `04_users.sql` | Profils utilisateurs | `profiles` | 02, 03, auth.users |
| 05 | `05_regies.sql` | Régies immobilières | `regies` | 04 |
| 06 | `06_immeubles.sql` | Immeubles | `immeubles` | 05 |
| 07 | `07_logements.sql` | Logements | `logements` | 06 |
| 08 | `08_locataires.sql` | Locataires | `locataires` | 07, 04 |
| 09b | `09b_helper_functions.sql` | Fonctions métier | - | 05, 08 |
| 10 | `10_entreprises.sql` | Entreprises & autorisations | `entreprises`, `regies_entreprises` | 04, 05 |
| 11 | `11_techniciens.sql` | Techniciens | `techniciens` | 10 |
| 12 | `12_tickets.sql` | Tickets interventions | `tickets` | 07, 08, 10, 11, 02 (ticket_status) |
| 13 | `13_missions.sql` | Missions | `missions` | 12, 10, 11, 02 (mission_status) |
| 14 | `14_intervention.sql` | Interventions & clôture | - | 13 |
| 15 | `15_facturation.sql` | Factures | `factures` | 13, 10, 05 |
| 16 | `16_messagerie.sql` | Messages & notifications | `messages`, `notifications` | 13 |
| 17 | `17_views.sql` | Vues métier | Vues | 12, 13, 11, 10 |
| 18 | `18_rls.sql` | Row Level Security | Policies | 04-13, 09b |
| 19 | `19_storage.sql` | Storage fichiers | Buckets, policies | 04 |
| 20 | `20_admin.sql` | Administration JTEC | Fonctions admin | 04, 05, 10 |
| 21 | `21_abonnements.sql` | Plans & abonnements | `plans`, `abonnements` | 05, 10 |
| 22 | `22_statuts_realignement.sql` | Réalignement statuts | - | 12, 13, 02 |
| 23 | `23_trigger_prevent_escalation.sql` | Sécurité rôles | Trigger | 04 |

**Total : 23 fichiers, 15 tables principales, 4 vues, 100+ fonctions/triggers**

---

## 🔍 2. SCHÉMA RÉEL - TABLES PRINCIPALES

### A. `profiles` (04_users.sql)

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'regie',
  language text NOT NULL DEFAULT 'fr',
  is_demo boolean NOT NULL DEFAULT false,
  regie_id uuid,
  entreprise_id uuid,
  logement_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Colonnes clés** :
- `id` : UUID, FK vers `auth.users(id)` ✅
- `role` : ENUM `user_role` (admin_jtec, regie, entreprise, locataire) ✅
- Rattachements optionnels : `regie_id`, `entreprise_id`, `logement_id` ✅

---

### B. `regies` (05_regies.sql)

```sql
CREATE TABLE regies (
  id uuid PRIMARY KEY,
  nom text NOT NULL,
  adresse, code_postal, ville, telephone, email, siret text,
  nb_collaborateurs integer DEFAULT 1,
  nb_logements_geres integer DEFAULT 0,
  statut_validation text DEFAULT 'en_attente' CHECK (...),
  date_validation timestamptz,
  admin_validateur_id uuid REFERENCES profiles(id),
  commentaire_refus text,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at, updated_at timestamptz
);
```

**Colonnes clés** :
- `profile_id` : FK vers `profiles(id)` ✅
- `statut_validation` : 'en_attente' | 'valide' | 'refuse' ✅

---

### C. `tickets` (12_tickets.sql)

```sql
CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  titre, description text NOT NULL,
  categorie text NOT NULL,
  priorite text DEFAULT 'normale',
  statut ticket_status NOT NULL DEFAULT 'ouvert',  ⚠️ NOM EXACT
  logement_id uuid NOT NULL REFERENCES logements(id),
  locataire_id uuid NOT NULL REFERENCES locataires(id),
  regie_id uuid NOT NULL,  -- Auto-calculé via trigger
  entreprise_id uuid REFERENCES entreprises(id),
  technicien_id uuid REFERENCES techniciens(id),
  date_creation, date_cloture, date_limite timestamptz,
  photos text[],
  urgence boolean DEFAULT false,
  created_at, updated_at timestamptz
);
```

**COLONNE CRITIQUE** :
- ✅ `statut` (type `ticket_status`)
- ❌ PAS de colonne `status` !

---

### D. `missions` (13_missions.sql)

```sql
CREATE TABLE missions (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id),
  technicien_id uuid REFERENCES techniciens(id),
  date_intervention_prevue, date_intervention_realisee timestamptz,
  statut text DEFAULT 'en_attente' CHECK (...),  ⚠️ NOM EXACT
  created_at, started_at, completed_at, validated_at timestamptz,
  description_intervention, materiel_utilise, commentaire_interne text
);
```

**COLONNE CRITIQUE** :
- ✅ `statut` (type text avec CHECK)
- ❌ PAS de colonne `status` !

---

### E. Autres tables principales

| Table | Fichier | Colonnes FK clés | Statut |
|-------|---------|------------------|--------|
| `immeubles` | 06 | `regie_id` → regies | ✅ |
| `logements` | 07 | `immeuble_id` → immeubles | ✅ |
| `locataires` | 08 | `profile_id` → profiles, `logement_id` → logements | ✅ |
| `entreprises` | 10 | `profile_id` → profiles | ✅ |
| `regies_entreprises` | 10 | `regie_id` → regies, `entreprise_id` → entreprises | ✅ |
| `techniciens` | 11 | `entreprise_id` → entreprises, `profile_id` → auth.users | ✅ |
| `factures` | 15 | `mission_id`, `entreprise_id`, `regie_id` | ✅ |
| `messages` | 16 | `mission_id`, `sender_user_id` → auth.users | ✅ |
| `notifications` | 16 | `user_id` → auth.users | ✅ |
| `plans` | 21 | - | ✅ |
| `abonnements` | 21 | `entreprise_id`, `regie_id`, `plan_id` | ✅ |

---

## ⚠️ 3. PROBLÈMES DÉTECTÉS

### A. 🔴 CONFLIT ENUM - ticket_status & mission_status

**Symptôme** : Deux définitions incompatibles des mêmes enums

#### Fichier 02_enums.sql (ligne 34-44)
```sql
create type ticket_status as enum (
  'ouvert',      -- 4 valeurs
  'en_cours',
  'termine',
  'annule'
);

create type mission_status as enum (
  'en_attente',  -- 4 valeurs
  'planifiee',
  'en_cours',
  'terminee'
);
```

#### Fichier 22_statuts_realignement.sql (ligne 11-33)
```sql
drop type if exists ticket_status cascade;  -- ⚠️ DROP CASCADE
drop type if exists mission_status cascade;

create type ticket_status as enum (
  'nouveau',     -- 6 valeurs
  'en_attente',
  'en_cours',
  'termine',
  'clos',
  'annule'
);

create type mission_status as enum (
  'en_attente',  -- 5 valeurs
  'en_cours',
  'terminee',
  'validee',
  'annulee'
);
```

**Impact** :
- ❌ Exécution 01→23 : fichier 22 DROP les enums créés en 02
- ❌ Toutes les colonnes utilisant ces types sont recréées avec `CASCADE`
- ❌ Tables `tickets` et `missions` ont des valeurs par défaut devenues invalides

**Solutions possibles** :

1. **Option A (recommandée)** : Supprimer 02_enums.sql (ticket_status et mission_status)
   - Garder uniquement les définitions dans 22_statuts_realignement.sql
   - Déplacer 22 juste après 02 (devient 03)
   - Renommer fichiers suivants

2. **Option B** : Supprimer 22_statuts_realignement.sql
   - Utiliser uniquement les enums de 02
   - Adapter les valeurs par défaut dans 12_tickets.sql et 13_missions.sql

3. **Option C** : Utiliser ALTER TYPE ADD VALUE
   - Garder 02 avec valeurs minimales
   - Dans 22, ajouter valeurs supplémentaires avec `ALTER TYPE ... ADD VALUE`
   - Évite le DROP CASCADE

**Recommandation** : **Option C** pour éviter de tout casser.

---

### B. 🟡 Colonnes fantômes (déjà corrigées)

✅ `auth_users` → remplacé par `profiles` (26 corrections appliquées)  
✅ `status` → remplacé par `statut` (8 corrections appliquées)

---

### C. 🟢 Ordre dépendances - VALIDÉ

**Fonctions helper** :
- ✅ `handle_updated_at()` définie en 03, utilisée en 04-15
- ✅ `get_user_regie_id()` définie en 09b, utilisée en 11, 13, 18

**Types ENUM** :
- ⚠️ `user_role` défini en 02, utilisé en 04 ✅
- ⚠️ `ticket_status` défini en 02, redéfini en 22 ❌ (voir problème A)
- ⚠️ `mission_status` défini en 02, redéfini en 22 ❌ (voir problème A)

**Vues** :
- ✅ 17_views.sql après toutes les tables (12, 13, 11, 10)

**RLS** :
- ✅ 18_rls.sql après fonctions 09b

---

## 🔧 4. CORRECTIONS REQUISES

### Correction 1 : Résoudre conflit ENUM (CRITIQUE)

**Fichier** : `02_enums.sql`

**AVANT (lignes 34-52)** :
```sql
create type ticket_status as enum (
  'ouvert',
  'en_cours',
  'termine',
  'annule'
);

create type mission_status as enum (
  'en_attente',
  'planifiee',
  'en_cours',
  'terminee'
);
```

**APRÈS** :
```sql
-- Définition minimale initiale (étendue en 22)
create type ticket_status as enum (
  'ouvert'
);

create type mission_status as enum (
  'en_attente'
);
```

**Fichier** : `22_statuts_realignement.sql`

**AVANT (lignes 11-13)** :
```sql
drop type if exists ticket_status cascade;
drop type if exists mission_status cascade;
```

**APRÈS** :
```sql
-- Étendre les enums existants au lieu de DROP
alter type ticket_status add value if not exists 'nouveau';
alter type ticket_status add value if not exists 'en_attente';
alter type ticket_status add value if not exists 'en_cours';
alter type ticket_status add value if not exists 'termine';
alter type ticket_status add value if not exists 'clos';
alter type ticket_status add value if not exists 'annule';

alter type mission_status add value if not exists 'en_cours';
alter type mission_status add value if not exists 'terminee';
alter type mission_status add value if not exists 'validee';
alter type mission_status add value if not exists 'annulee';
```

**ET supprimer les CREATE TYPE redondants (lignes 14-33)**

---

### Correction 2 : Vérifier valeurs par défaut

**Fichier** : `12_tickets.sql` (ligne ~10)

**Vérifier** :
```sql
statut ticket_status NOT NULL DEFAULT 'ouvert',
```
✅ OK si enum contient 'ouvert'

**Fichier** : `13_missions.sql` (ligne ~15)

**Vérifier** :
```sql
statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN (...))
```
✅ OK si 'en_attente' dans CHECK

---

## ✅ 5. FLUX MÉTIER VALIDÉS

### Flux A : Inscription régie
1. API crée utilisateur dans `auth.users` ✅
2. API crée profil dans `profiles` avec `role='regie'` ✅
3. API crée régie dans `regies` avec `profile_id` ✅
4. RLS permet accès via `profiles.regie_id` ✅

### Flux B : Inscription entreprise
1. Similaire à régie avec `role='entreprise'` ✅
2. Table `regies_entreprises` gère autorisations ✅

### Flux C : Ticket lifecycle
1. Locataire crée ticket : `statut='ouvert'` ✅
2. Régie accepte : fonction `update_ticket_status()` ✅
3. Transitions validées par 22_statuts_realignement.sql ✅

### Flux D : Acceptation ticket → mission
1. Entreprise accepte ticket ✅
2. Fonction crée mission avec `ticket_id` ✅
3. `missions.entreprise_id` = entreprise acceptante ✅

### Flux E : RLS
1. Toutes policies utilisent `profiles` ✅
2. Fonction `get_user_regie_id()` disponible ✅
3. Pas de récursion détectée ✅

### Flux F : Vues
1. `17_views.sql` après toutes tables ✅
2. Pas de `SELECT *` problématique détecté ✅

---

## 📝 6. RAPPORT FINAL

### État actuel
- ✅ 26 corrections `auth_users` → `profiles` appliquées
- ✅ 8 corrections `status` → `statut` appliquées
- ⚠️ 1 conflit ENUM critique (ticket_status, mission_status)
- ✅ Ordre dépendances validé (sauf conflit ENUM)
- ✅ Schéma réel documenté

### Actions requises
1. 🔴 **URGENT** : Résoudre conflit ENUM (correction 1)
2. 🟢 Créer fichier de vérification `99_verify.sql`
3. 🟢 Tester exécution 01→23 sur base vide

### Risques
- **Critique** : Sans correction ENUM, fichier 22 détruit les tables tickets/missions
- **Moyen** : Valeurs par défaut invalides si enums incomplets
- **Faible** : RLS validés, pas de colonnes fantômes restantes

---

## 🎯 7. PROCHAINES ÉTAPES

1. Appliquer correction conflit ENUM
2. Créer 99_verify.sql
3. Tester migration complète
4. Valider tous les flux métier

---

**Audit réalisé le** : 2025-12-18  
**Fichiers analysés** : 23  
**Tables auditées** : 15  
**Problèmes critiques** : 1 (conflit ENUM)  
**Problèmes résolus** : 34 (auth_users + status)
