# 🎯 ÉTAPE 2 - MODÈLE DE DONNÉES CIBLE : LOCATAIRE AUTHENTIFIÉ

**Date :** 20 décembre 2025  
**Objectif :** Définir le modèle cible final pour la gestion des locataires  
**Statut :** ANALYSE UNIQUEMENT - AUCUNE MODIFICATION CODE/BDD

---

## ⚠️ RECADRAGE MÉTIER OFFICIEL

### Correction de l'ÉTAPE 1

**Erreur identifiée dans l'analyse précédente :**
- ❌ Proposition "Option A : Locataire non authentifié"
- ❌ Recommandation de supprimer `profile_id`
- ❌ Recommandation de supprimer policies locataire

### ✅ POSITION MÉTIER VALIDÉE

**LE LOCATAIRE EST UN UTILISATEUR AUTHENTIFIÉ ET ACTEUR CENTRAL DU SYSTÈME.**

**Caractéristiques du locataire dans JETC_IMMO :**
1. Possède un profil authentifié (`auth.users → profiles`)
2. A un accès dédié (dashboard locataire)
3. **Crée les tickets** (point de départ du workflow métier)
4. Est TOUJOURS affilié à un logement
5. Hérite indirectement de la régie via : `locataire → logement → immeuble → régie`

**Flux métier central :**
```
Locataire (authentifié) → Crée Ticket → Régie valide → Diffuse à Entreprise
```

---

## 📊 MODÈLE DE DONNÉES CIBLE

### 1. Architecture hiérarchique finale

```
                auth.users (Supabase Auth)
                      ↓
                  profiles
                   ↓     ↓
    [role=regie] ↓       ↓ [role=locataire]
              ↓             ↓
           regies      locataires
              ↓             ↓
         immeubles    logement_id (FK NOT NULL)
              ↓             ↑
          logements ←───────┘
```

### 2. Flux de données et responsabilités

**Régie (rôle = 'regie') :**
```
Régie crée :
  → Immeuble (regie_id)
    → Logement (immeuble_id)
      → Locataire (logement_id + profile_id)
        → Profile locataire (auth.users + profiles)
```

**Locataire (rôle = 'locataire') :**
```
Locataire connecté :
  → Voit SON logement
  → Crée SES tickets
  → Voit SES factures
  → Contacte SA régie (via immeuble)
```

---

## 🗄️ TABLES IMPACTÉES : ÉTAT CIBLE

### Table `locataires` - État cible

**Fichier :** `/supabase/schema/08_locataires.sql`

#### Structure ACTUELLE (problématique)
```sql
create table locataires (
  id uuid primary key,
  nom text not null,
  prenom text not null,
  email text not null,
  
  -- ⚠️ NULLABLE (à corriger)
  profile_id uuid unique references profiles(id) on delete cascade,
  
  -- ⚠️ NULLABLE (à corriger)
  logement_id uuid references logements(id) on delete set null,
  
  date_entree date,
  date_sortie date,
  telephone text,
  date_naissance date,
  contact_urgence_nom text,
  contact_urgence_telephone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### Structure CIBLE (recommandée)

```sql
create table locataires (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text not null,
  email text not null,
  
  -- ✅ OBLIGATOIRE : Locataire = utilisateur authentifié
  profile_id uuid not null unique references profiles(id) on delete cascade,
  
  -- ✅ OBLIGATOIRE : Locataire toujours affilié à un logement
  logement_id uuid not null references logements(id) on delete restrict,
  
  date_entree date not null,          -- ✅ Obligatoire (date d'arrivée dans le logement)
  date_sortie date,                    -- Optionnel (NULL si locataire actuel)
  telephone text,
  date_naissance date,
  
  -- Contact d'urgence (optionnel)
  contact_urgence_nom text,
  contact_urgence_telephone text,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- ✅ CONTRAINTE : Date sortie après date entrée
  constraint check_dates_locataire check (
    date_sortie is null or date_sortie >= date_entree
  )
);
```

#### Modifications proposées (à appliquer ÉTAPE 3)

| Colonne | État actuel | État cible | Justification |
|---------|-------------|------------|---------------|
| `profile_id` | NULLABLE | **NOT NULL** | Locataire = utilisateur auth OBLIGATOIREMENT |
| `logement_id` | NULLABLE | **NOT NULL** | Règle métier "toujours affilié" |
| `logement_id` cascade | ON DELETE SET NULL | **ON DELETE RESTRICT** | Empêcher suppression logement si locataire présent |
| `date_entree` | NULLABLE | **NOT NULL** | Date d'entrée obligatoire (traçabilité) |

#### Commentaires métier

```sql
comment on table locataires is 'JETC_IMMO - Locataires authentifiés (acteurs centraux créateurs de tickets)';
comment on column locataires.profile_id is 'Profil authentifié du locataire (obligatoire, role=locataire)';
comment on column locataires.logement_id is 'Logement occupé (obligatoire, un locataire est toujours affilié)';
comment on column locataires.date_entree is 'Date d''entrée dans le logement (obligatoire pour traçabilité)';
comment on column locataires.date_sortie is 'Date de sortie (NULL = locataire actuel, NOT NULL = ancien locataire)';
```

---

### Table `profiles` - État cible

**Fichier :** `/supabase/schema/04_users.sql`

#### Structure ACTUELLE
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'regie',  -- ENUM: admin_jtec, regie, entreprise, locataire
  language text not null default 'fr',
  is_demo boolean not null default false,
  
  -- Rattachements optionnels (selon le rôle)
  regie_id uuid,              -- ⚠️ Pas de FK
  entreprise_id uuid,
  logement_id uuid,           -- ⚠️ Synchronisé par trigger
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### Structure CIBLE (recommandée)

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'regie',
  language text not null default 'fr',
  is_demo boolean not null default false,
  
  -- Rattachements optionnels (selon le rôle)
  regie_id uuid,              -- Pour futur multi-users régie (pas utilisé actuellement)
  entreprise_id uuid,         -- Pour rôle entreprise
  logement_id uuid,           -- ⚠️ DÉPRÉCIÉ : redondant avec locataires.logement_id
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### Analyse `profiles.logement_id`

**Question métier :** Faut-il conserver `profiles.logement_id` ?

**État actuel :**
- Synchronisé par trigger `sync_profile_logement_id()`
- Redondant avec `locataires.logement_id`
- Non utilisé dans les RLS

**Recommandation :** **DÉPRÉCIER ce champ**

**Justifications :**
1. **Source de vérité unique :** `locataires.logement_id` est la référence
2. **Pas de benefit RLS :** Les policies utilisent déjà `locataires.logement_id`
3. **Complexité inutile :** Trigger de sync ajoute risque récursion
4. **Violation SSOT :** (Single Source of Truth) - 2 colonnes pour même info

**Approche recommandée :**
- **Court terme :** Garder mais ne plus utiliser (dépréciation douce)
- **Moyen terme :** Supprimer colonne + trigger après validation workflow

---

### Table `logements` - État actuel (OK)

**Fichier :** `/supabase/schema/07_logements.sql`

#### Aucune modification nécessaire

```sql
create table logements (
  id uuid primary key,
  numero text not null,
  immeuble_id uuid not null references immeubles(id) on delete cascade,  -- ✅ OK
  statut text default 'vacant' check (statut in ('vacant', 'occupé', 'en_travaux')),
  loyer_mensuel numeric(10,2),
  ...
);
```

**✅ État actuel : BON**
- FK `immeuble_id` obligatoire ✅
- Cascade DELETE cohérente ✅
- Pas de modification requise

**Note métier :** Le champ `statut` devra être synchronisé avec la présence d'un locataire (automatisation future possible).

---

## 🔐 RLS CIBLES - ANALYSE DES POLICIES

### Principe de sécurité

**Règle d'or :**
> Un locataire authentifié ne doit voir QUE ses propres données et son logement.  
> Une régie ne doit voir QUE les locataires de SES logements.

### Policy 1 : Locataire peut voir ses propres données

**Policy actuelle (BONNE) :**
```sql
create policy "Locataire can view own data"
on locataires for select
using (profile_id = auth.uid());
```

**Analyse :**
- ✅ **CORRECTE** : Comparaison directe profile_id
- ✅ **PERFORMANTE** : Index sur `locataires.profile_id`
- ✅ **SÉCURISÉE** : Aucune fuite possible
- ✅ **PAS DE RÉCURSION** : Pas de sous-requête

**Action ÉTAPE 3 :** **CONSERVER** cette policy (déjà optimale)

---

### Policy 2 : Locataire peut modifier ses données

**Policy actuelle (BONNE) :**
```sql
create policy "Locataire can update own data"
on locataires for update
using (profile_id = auth.uid());
```

**Analyse :**
- ✅ **CORRECTE** : Isolation stricte
- ✅ **SÉCURISÉE** : Locataire modifie uniquement ses infos (nom, téléphone, contact urgence)

**Périmètre de modification autorisé :**
- ✅ Nom, prénom, téléphone, date naissance
- ✅ Contact urgence
- ❌ `logement_id` : NE DOIT PAS être modifiable par locataire (gestion régie uniquement)
- ❌ `profile_id` : Immuable (clé technique)

**Action ÉTAPE 3 :** **CONSERVER** avec restriction colonnes modifiables

**Proposition amélioration (optionnelle) :**
```sql
create policy "Locataire can update own personal data"
on locataires for update
using (profile_id = auth.uid())
with check (
  -- Empêcher modification des colonnes critiques
  profile_id = auth.uid()  -- Même locataire
  and logement_id = (select logement_id from locataires where id = locataires.id)  -- logement_id inchangé
);
```

---

### Policy 3 : Régie peut voir ses locataires ⚠️

**Policy actuelle (PROBLÉMATIQUE si logement_id NULL) :**
```sql
create policy "Regie can view own locataires"
on locataires for select
using (
  exists (
    select 1
    from logements
    join immeubles on immeubles.id = logements.immeuble_id
    where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
  )
);
```

**Analyse avec `logement_id NOT NULL` :**

**✅ DEVIENT CORRECTE** une fois `logement_id` obligatoire :
- ✅ Logique claire : Régie → Immeubles → Logements → Locataires
- ✅ Isolation garantie : Pas de fuite cross-régies
- ✅ Performante : Index sur `logements.immeuble_id` et `immeubles.regie_id`

**✅ PAS DE RÉCURSION :**
- `get_user_regie_id()` est `SECURITY DEFINER` → bypass RLS
- SELECT sur `logements` et `immeubles` (tables sans récursion)

**Action ÉTAPE 3 :** **CONSERVER** cette policy (devient sûre avec NOT NULL)

---

### Policy 4 : Régie peut gérer ses locataires ⚠️

**Policy actuelle (PROBLÉMATIQUE) :**
```sql
create policy "Regie can manage own locataires"
on locataires for all
using (
  exists (
    select 1
    from logements
    join immeubles on immeubles.id = logements.immeuble_id
    where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
  )
);
```

**Problème identifié :**
- Policy `FOR ALL` inclut INSERT
- **Lors d'un INSERT, `locataires.logement_id` n'existe pas encore dans la row**
- La sous-requête compare `locataires.logement_id` (NEW row) avec table logements

**Comportement PostgreSQL :**
```sql
-- Lors d'un INSERT, le EXISTS référence NEW.logement_id
INSERT INTO locataires (nom, prenom, email, profile_id, logement_id) 
VALUES ('Dupont', 'Jean', 'jean@test.ch', '<uuid>', '<logement_uuid>');

-- RLS vérifie si <logement_uuid> appartient à la régie
-- ✅ Fonctionne SEULEMENT si logement_id fourni est valide
```

**Analyse :**
- ✅ **SELECT/UPDATE/DELETE** : Fonctionnent correctement
- ⚠️ **INSERT** : Fonctionne MAIS avec logique complexe
  - RLS vérifie que le `logement_id` fourni appartient à la régie
  - Si `logement_id` invalide → RLS bloque
  - Si `logement_id` d'une autre régie → RLS bloque ✅

**Risque identifié :**
> La policy `FOR ALL` mélange INSERT et UPDATE avec des besoins différents.

**Action ÉTAPE 3 :** **SÉPARER** en 3 policies distinctes

**Recommandation :**
```sql
-- SELECT : Régie voit ses locataires
create policy "Regie can view own locataires"
on locataires for select
using (
  exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

-- INSERT : Régie crée locataire sur SES logements uniquement
create policy "Regie can insert locataire in own logements"
on locataires for insert
with check (
  exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

-- UPDATE : Régie modifie SES locataires
create policy "Regie can update own locataires"
on locataires for update
using (
  exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
)
with check (
  exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);

-- DELETE : Régie peut supprimer SES locataires (avec prudence)
create policy "Regie can delete own locataires"
on locataires for delete
using (
  exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id
      and i.regie_id = get_user_regie_id()
  )
);
```

**Bénéfices :**
- Logique claire par opération
- Possibilité d'ajouter contraintes spécifiques (ex: empêcher DELETE si tickets ouverts)
- Meilleure traçabilité debug

---

### Policy 5 : Admin JTEC peut voir tous les locataires (OK)

**Policy actuelle (BONNE) :**
```sql
create policy "Admin JTEC can view all locataires"
on locataires for select
using (public.is_admin_jtec());
```

**Analyse :**
- ✅ **CORRECTE** : Utilise `is_admin_jtec()` (SECURITY DEFINER)
- ✅ **PAS DE RÉCURSION** : Bypass RLS via SECURITY DEFINER
- ✅ **SÉCURISÉE** : Admin JTEC = super-admin système

**Action ÉTAPE 3 :** **CONSERVER** sans modification

---

### Fonction helper : `get_user_regie_id()` ⚠️

**Fichier :** `/supabase/schema/09b_helper_functions.sql`

**Fonction actuelle :**
```sql
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    -- Pour le rôle 'regie'
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Pour le rôle 'locataire' ⚠️
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;
```

**Analyse AVEC locataire authentifié :**

**✅ Points positifs :**
- ✅ `SECURITY DEFINER` : Bypass RLS (pas de récursion)
- ✅ `STABLE` : Cache le résultat dans la transaction
- ✅ UNION gère rôle 'regie' ET 'locataire'

**✅ FONCTIONNE CORRECTEMENT** avec `logement_id NOT NULL` :
- Locataire authentifié → `l.profile_id = auth.uid()` match
- JOIN `logements` → réussit car `logement_id NOT NULL`
- JOIN `immeubles` → remonte `regie_id`
- **→ Locataire connaît sa régie** ✅

**Cas d'usage locataire :**
```sql
-- Locataire connecté veut voir son immeuble
SELECT * FROM immeubles WHERE regie_id = get_user_regie_id();

-- ❌ PROBLÈME : Locataire voit TOUS les immeubles de SA régie
-- ✅ SOLUTION : Policy supplémentaire pour limiter aux immeubles contenant SON logement
```

**⚠️ ATTENTION : Sécurité accidentelle**

**Scénario problématique :**
```sql
-- Locataire essaie de voir TOUS les logements de sa régie
SELECT * FROM logements 
WHERE immeuble_id IN (
  SELECT id FROM immeubles WHERE regie_id = get_user_regie_id()
);

-- Sans RLS sur logements pour locataire → 
-- Locataire verrait TOUS les logements de l'immeuble ❌
```

**Action ÉTAPE 3 :** **VÉRIFIER** policies sur tables adjacentes (immeubles, logements)

**Recommandation sécurité :**
```sql
-- Policy STRICTE pour locataire sur logements
create policy "Locataire can view only own logement"
on logements for select
using (
  id = (
    select logement_id 
    from locataires 
    where profile_id = auth.uid()
  )
);

-- Policy STRICTE pour locataire sur immeubles
create policy "Locataire can view own immeuble"
on immeubles for select
using (
  id = (
    select l.immeuble_id
    from locataires loc
    join logements l on l.id = loc.logement_id
    where loc.profile_id = auth.uid()
  )
);
```

**Action ÉTAPE 3 :** **CONSERVER** `get_user_regie_id()` mais **AJOUTER** policies restrictives

---

## 📊 ANALYSE DES IMPACTS

### Impact 1 : `logement_id` devient NOT NULL

#### Scénario de migration

**État avant migration :**
```sql
SELECT id, nom, prenom, logement_id 
FROM locataires 
WHERE logement_id IS NULL;
```

**Cas possibles :**
1. **Aucun locataire avec logement_id NULL** → Migration simple ✅
2. **Locataires orphelins existants** → Nécessite traitement manuel ⚠️

**Stratégie migration :**

**Option A : Blocage strict (recommandée)**
```sql
-- Vérifier absence de NULL avant migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM locataires WHERE logement_id IS NULL) THEN
    RAISE EXCEPTION 'Migration impossible : % locataires sans logement', 
      (SELECT COUNT(*) FROM locataires WHERE logement_id IS NULL);
  END IF;
END $$;

-- Si OK, appliquer NOT NULL
ALTER TABLE locataires ALTER COLUMN logement_id SET NOT NULL;
```

**Option B : Nettoyage automatique (risqué)**
```sql
-- Supprimer locataires orphelins (PERTE DE DONNÉES)
DELETE FROM locataires WHERE logement_id IS NULL;

-- Puis appliquer NOT NULL
ALTER TABLE locataires ALTER COLUMN logement_id SET NOT NULL;
```

**Option C : Assigner logement temporaire (complexe)**
```sql
-- Créer logement "EN ATTENTE" par régie
-- Nécessite déterminer quelle régie possède le locataire orphelin
-- → IMPOSSIBLE si logement_id NULL (pas de lien régie)

-- ❌ Option non viable
```

**Recommandation :** **Option A** (blocage si orphelins détectés)

---

#### Impact sur INSERT

**Avant NOT NULL :**
```sql
-- INSERT sans logement_id → ACCEPTÉ (mauvais)
INSERT INTO locataires (nom, prenom, email, profile_id) 
VALUES ('Dupont', 'Jean', 'jean@test.ch', '<uuid>');
```

**Après NOT NULL :**
```sql
-- INSERT sans logement_id → ERREUR PostgreSQL
INSERT INTO locataires (nom, prenom, email, profile_id) 
VALUES ('Dupont', 'Jean', 'jean@test.ch', '<uuid>');
-- ERROR: null value in column "logement_id" violates not-null constraint

-- INSERT correct requis
INSERT INTO locataires (nom, prenom, email, profile_id, logement_id, date_entree) 
VALUES ('Dupont', 'Jean', 'jean@test.ch', '<uuid>', '<logement_uuid>', '2025-01-15');
```

**Impact frontend :**
- ✅ Formulaire DOIT inclure select logement (déjà prévu ÉTAPE 4)
- ✅ Validation côté client avant soumission
- ✅ Erreur explicite si logement_id manquant

---

### Impact 2 : `profile_id` devient NOT NULL

#### Workflow de création locataire par régie

**Étapes requises :**
1. Régie crée profil Supabase Auth (`auth.users`)
2. Régie crée enregistrement `profiles` (role='locataire')
3. Régie crée enregistrement `locataires` avec `profile_id`

**⚠️ PROBLÈME : Ordre de création critique**

**Scénario problématique :**
```sql
-- 1. Créer locataire (AVANT profile)
INSERT INTO locataires (..., profile_id) VALUES (..., '<uuid>');
-- ERROR: Foreign key violation (profile_id n'existe pas encore)

-- 2. Créer profile (APRÈS locataire)
INSERT INTO profiles (...) VALUES (...);
-- ❌ Impossible à cause de l'erreur précédente
```

**Solution : Transaction atomique obligatoire**

**Côté backend (API) :**
```javascript
// /api/regie/creer-locataire.js
async function creerLocataire(req, res) {
  const { nom, prenom, email, mot_de_passe, logement_id, date_entree } = req.body;
  
  // Transaction atomique
  const { data, error } = await supabase.rpc('creer_locataire_complet', {
    p_nom: nom,
    p_prenom: prenom,
    p_email: email,
    p_mot_de_passe: mot_de_passe,
    p_logement_id: logement_id,
    p_date_entree: date_entree,
    p_regie_id: await getUserRegieId(req)
  });
  
  if (error) return res.status(400).json({ error });
  return res.status(201).json({ success: true, locataire: data });
}
```

**Côté SQL (RPC) :**
```sql
-- Fonction RPC pour création atomique
create or replace function creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_mot_de_passe text,
  p_logement_id uuid,
  p_date_entree date,
  p_regie_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_auth_user_id uuid;
  v_locataire_id uuid;
begin
  -- 1. Vérifier que logement appartient à la régie
  if not exists (
    select 1 from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = p_logement_id and i.regie_id = p_regie_id
  ) then
    raise exception 'Logement non trouvé ou appartient à une autre régie';
  end if;
  
  -- 2. Créer utilisateur Supabase Auth
  v_auth_user_id := extensions.uuid_generate_v4();  -- Simplifié (appel admin SDK requis)
  
  -- 3. Créer profile
  insert into profiles (id, email, role)
  values (v_auth_user_id, p_email, 'locataire');
  
  -- 4. Créer locataire
  insert into locataires (nom, prenom, email, profile_id, logement_id, date_entree)
  values (p_nom, p_prenom, p_email, v_auth_user_id, p_logement_id, p_date_entree)
  returning id into v_locataire_id;
  
  -- 5. Retourner résultat
  return json_build_object(
    'locataire_id', v_locataire_id,
    'profile_id', v_auth_user_id,
    'email', p_email
  );
end;
$$;
```

**Action ÉTAPE 4 (Frontend) :** Créer endpoint API avec transaction atomique

---

### Impact 3 : Cascade DELETE `ON DELETE RESTRICT`

**Modification proposée :**
```sql
-- AVANT
logement_id uuid references logements(id) on delete set null

-- APRÈS
logement_id uuid not null references logements(id) on delete restrict
```

#### Comportement avec `ON DELETE RESTRICT`

**Scénario :**
```sql
-- Régie tente de supprimer logement avec locataire actif
DELETE FROM logements WHERE id = '<logement_uuid>';

-- PostgreSQL BLOQUE avec erreur :
-- ERROR: update or delete on table "logements" violates foreign key constraint
-- DETAIL: Key (id)=(...) is still referenced from table "locataires"
```

**Workflow requis :**
1. Régie doit d'abord "libérer" le logement :
   - Option A : Supprimer locataire (avec confirmation)
   - Option B : Changer `date_sortie` du locataire (historique)
2. Puis supprimer logement

**Impact UX :**
```javascript
// Frontend : Tentative suppression logement
async function supprimerLogement(logementId) {
  const { error } = await supabase
    .from('logements')
    .delete()
    .eq('id', logementId);
  
  if (error && error.code === '23503') {  // FK violation
    alert('Impossible de supprimer ce logement : un locataire y est encore affilié.\n\n' +
          'Veuillez d\'abord libérer le logement (déménagement locataire).');
    return;
  }
}
```

**Bénéfice :**
- ✅ Protection contre suppression accidentelle
- ✅ Intégrité référentielle garantie
- ✅ Historique locataire préservé

---

### Impact 4 : Locataire change de logement

#### Scénario métier

**Cas d'usage :**
- Locataire déménage d'un logement A → logement B (dans même immeuble OU immeuble différent)
- Régie transfère locataire entre logements

**Workflow SQL :**
```sql
-- Avant transfert : Locataire dans logement A
SELECT * FROM locataires WHERE id = '<locataire_uuid>';
-- logement_id = '<logement_A_uuid>'

-- Transfert par régie
UPDATE locataires 
SET logement_id = '<logement_B_uuid>',
    date_sortie = '2025-03-31',  -- Ancienne date sortie logement A
    date_entree = '2025-04-01'   -- Nouvelle date entrée logement B
WHERE id = '<locataire_uuid>';
```

**⚠️ PROBLÈME IDENTIFIÉ : Perte historique**

**Problème :**
- Un locataire a UN SEUL `logement_id` à la fois
- Si transfert → historique perdu (impossible de savoir logement précédent)

**Solution recommandée : Table d'historique (future amélioration)**

```sql
-- Table future (pas dans scope actuel)
create table locataires_historique_logements (
  id uuid primary key,
  locataire_id uuid not null references locataires(id),
  logement_id uuid not null references logements(id),
  date_entree date not null,
  date_sortie date,
  created_at timestamptz default now()
);
```

**Pour l'instant (scope ÉTAPE 2) :**
- ✅ Accepter que transfert = mise à jour simple
- ✅ Documenter limitation (historique non préservé)
- ✅ Prévoir évolution future (hors scope)

**Action ÉTAPE 4 :** Documenter limitation (pas d'historique multi-logements)

---

## 🧪 TESTS THÉORIQUES À PRÉVOIR

### Scénario 1 : Création locataire par régie

**Préconditions :**
- Régie A possède Immeuble IM1 avec Logement L1 (vacant)
- Admin régie connecté (role='regie')

**Actions :**
1. Régie remplit formulaire "Créer locataire"
   - Nom : Dupont
   - Prénom : Jean
   - Email : jean.dupont@test.ch
   - Mot de passe : Test1234!
   - Logement : L1 (select filtré par régie)
   - Date entrée : 2025-01-15
2. Clic "Créer"
3. Backend appelle RPC `creer_locataire_complet()`

**Résultats attendus :**
- ✅ `auth.users` : Nouvel utilisateur créé
- ✅ `profiles` : role='locataire', email=jean.dupont@test.ch
- ✅ `locataires` : profile_id + logement_id NOT NULL
- ✅ RLS vérifie que L1 appartient à régie A
- ✅ Email envoi (mot de passe temporaire OU lien activation)

**Résultats refusés :**
- ❌ Création locataire sans logement_id
- ❌ Création locataire sur logement d'une autre régie
- ❌ Création avec profile_id NULL

---

### Scénario 2 : Connexion locataire

**Préconditions :**
- Locataire créé (profile_id existe, logement_id existe)
- Mot de passe défini

**Actions :**
1. Locataire va sur `/login.html`
2. Saisit email + mot de passe
3. Supabase Auth valide credentials
4. Redirect vers `/locataire/dashboard.html`

**Résultats attendus :**
- ✅ Authentification réussie
- ✅ Token JWT contient `role=locataire`
- ✅ Dashboard locataire charge :
  - Nom/prénom locataire
  - Adresse logement
  - Nom régie (via immeuble)
  - Bouton "Créer un ticket"

**Vérifications RLS :**
```sql
-- Locataire voit SES données uniquement
SELECT * FROM locataires WHERE profile_id = auth.uid();
-- Retourne 1 row ✅

-- Locataire voit SON logement uniquement
SELECT * FROM logements WHERE id = (
  SELECT logement_id FROM locataires WHERE profile_id = auth.uid()
);
-- Retourne 1 row ✅

-- Locataire NE VOIT PAS autres logements
SELECT * FROM logements WHERE immeuble_id = (
  SELECT l.immeuble_id 
  FROM locataires loc 
  JOIN logements l ON l.id = loc.logement_id 
  WHERE loc.profile_id = auth.uid()
);
-- Retourne SEULEMENT son logement (RLS bloque les autres) ✅
```

---

### Scénario 3 : Création ticket par locataire

**Préconditions :**
- Locataire authentifié (profile_id, logement_id valides)

**Actions :**
1. Locataire clique "Créer un ticket"
2. Remplit formulaire :
   - Titre : "Fuite d'eau salle de bain"
   - Description : "..."
   - Urgence : Haute
3. Clic "Envoyer"
4. Backend INSERT ticket avec :
   - `locataire_id` : ID du locataire connecté
   - `logement_id` : Déduit depuis locataire
   - `statut` : 'ouvert'

**Résultats attendus :**
- ✅ Ticket créé
- ✅ RLS vérifie que locataire crée ticket pour SON logement uniquement
- ✅ Régie reçoit notification (workflow futur)

**Vérifications RLS :**
```sql
-- Policy ticket INSERT pour locataire (à créer ÉTAPE 3)
create policy "Locataire can create ticket for own logement"
on tickets for insert
with check (
  locataire_id = (
    select id from locataires where profile_id = auth.uid()
  )
);
```

---

### Scénario 4 : Accès interdit hors périmètre régie

**Préconditions :**
- Régie A possède Locataire LA1
- Régie B possède Locataire LB1

**Actions :**
1. Régie A connectée
2. Tente de voir locataire LB1 (via API directe)

**Résultats attendus :**
- ✅ RLS bloque accès
- ✅ Requête retourne 0 résultat (pas d'erreur explicite pour éviter info leaking)

**Test SQL :**
```sql
-- Simuler Régie A (profile_id = '<uuid_regie_A>')
SET SESSION "request.jwt.claim.sub" = '<uuid_regie_A>';

-- Tenter de voir locataire de Régie B
SELECT * FROM locataires WHERE id = '<uuid_locataire_B>';
-- Retourne 0 rows ✅ (RLS bloque)

-- Vérifier que Régie A voit SES locataires
SELECT * FROM locataires;
-- Retourne SEULEMENT locataires de Régie A ✅
```

---

### Scénario 5 : Locataire tente de voir autres locataires

**Préconditions :**
- Locataire LA1 et LA2 dans même immeuble IM1

**Actions :**
1. Locataire LA1 connecté
2. Tente requête :
   ```sql
   SELECT * FROM locataires WHERE logement_id IN (
     SELECT id FROM logements WHERE immeuble_id = (
       SELECT immeuble_id FROM logements WHERE id = (
         SELECT logement_id FROM locataires WHERE profile_id = auth.uid()
       )
     )
   );
   ```

**Résultats attendus :**
- ✅ RLS bloque
- ✅ Retourne SEULEMENT LA1 (pas LA2)

**Vérification :**
```sql
-- Policy locataire sur locataires
-- DOIT limiter à profile_id = auth.uid()
-- Même si logements dans même immeuble → isolation stricte
```

---

## 🚨 ANALYSE DES RISQUES RLS

### Risque 1 : Récursion RLS avec `get_user_regie_id()`

**Scénario problématique :**
```sql
-- Policy sur locataires utilise get_user_regie_id()
-- get_user_regie_id() fait SELECT sur locataires
-- → Récursion potentielle ?
```

**Analyse :**
- ✅ **PAS DE RÉCURSION** car `get_user_regie_id()` est `SECURITY DEFINER`
- `SECURITY DEFINER` = Fonction exécutée avec privilèges du propriétaire (bypass RLS)
- La requête interne ne déclenche PAS les policies RLS

**Confirmation :**
```sql
-- get_user_regie_id() fait :
select i.regie_id
from locataires l  -- ← SELECT sans RLS (SECURITY DEFINER)
join logements lg on lg.id = l.logement_id
join immeubles i on i.id = lg.immeuble_id
where l.profile_id = auth.uid();
```

**Conclusion :** ✅ **Pas de risque récursion**

---

### Risque 2 : Accès indirect via tables adjacentes

**Scénario :**
```sql
-- Locataire connecté
-- Tente de voir TOUS les logements de son immeuble
SELECT * FROM logements WHERE immeuble_id = (
  SELECT immeuble_id FROM logements WHERE id = (
    SELECT logement_id FROM locataires WHERE profile_id = auth.uid()
  )
);
```

**Risque identifié :**
- Si policy sur `logements` utilise `get_user_regie_id()`
- Locataire verrait TOUS les logements de SA régie ❌

**Solution : Policy stricte pour locataire**
```sql
-- Policy STRICTE (à créer ÉTAPE 3)
create policy "Locataire can view only own logement"
on logements for select
using (
  -- Si rôle locataire, voir UNIQUEMENT son logement
  (select role from profiles where id = auth.uid()) = 'locataire'
  and id = (select logement_id from locataires where profile_id = auth.uid())
  
  -- OU si rôle régie, voir ses logements
  or exists (
    select 1 from immeubles i
    where i.id = logements.immeuble_id
      and i.regie_id = get_user_regie_id()
      and (select role from profiles where id = auth.uid()) = 'regie'
  )
);
```

**Action ÉTAPE 3 :** **VÉRIFIER et RENFORCER** policies sur tables adjacentes

---

### Risque 3 : Fuite information via comptages

**Scénario :**
```sql
-- Locataire tente de compter locataires de son immeuble
SELECT COUNT(*) FROM locataires WHERE logement_id IN (
  SELECT id FROM logements WHERE immeuble_id = (...)
);
```

**Analyse :**
- RLS appliquée sur SELECT → COUNT retourne SEULEMENT lignes autorisées
- Si policy bloque → COUNT = 1 (uniquement lui-même)

**Conclusion :** ✅ **Pas de fuite** (RLS appliquée avant agrégation)

---

### Risque 4 : Performance avec `EXISTS` imbriqués

**Scénario :**
```sql
-- Policy régie avec double JOIN
create policy "Regie can view own locataires"
using (
  exists (
    select 1
    from logements
    join immeubles on immeubles.id = logements.immeuble_id
    where logements.id = locataires.logement_id
      and immeubles.regie_id = get_user_regie_id()
  )
);
```

**Analyse performance :**
- EXISTS est optimisé par PostgreSQL (arrêt dès première row trouvée)
- Index requis :
  - ✅ `locataires.logement_id` (déjà existant)
  - ✅ `logements.immeuble_id` (déjà existant)
  - ✅ `immeubles.regie_id` (déjà existant)

**Test EXPLAIN :**
```sql
EXPLAIN ANALYZE
SELECT * FROM locataires WHERE profile_id = '<uuid_regie>';
-- Vérifier que EXISTS utilise Index Scan (pas Seq Scan)
```

**Action ÉTAPE 3 :** **TESTER** performance avec jeu de données conséquent

**Recommandation :** Si performance insuffisante → créer vue matérialisée

---

## 📋 RÉCAPITULATIF DES MODIFICATIONS REQUISES

### Étape 3 - Modifications SQL (à appliquer)

| Table | Colonne | Modification | Priorité |
|-------|---------|--------------|----------|
| `locataires` | `profile_id` | `ALTER COLUMN ... SET NOT NULL` | 🔴 Haute |
| `locataires` | `logement_id` | `ALTER COLUMN ... SET NOT NULL` | 🔴 Haute |
| `locataires` | `logement_id` | Changer cascade `ON DELETE RESTRICT` | 🟡 Moyenne |
| `locataires` | `date_entree` | `ALTER COLUMN ... SET NOT NULL` | 🟡 Moyenne |
| `locataires` | Trigger | `DROP TRIGGER sync_profile_on_locataire_update` | 🟢 Basse |
| `locataires` | Fonction | `DROP FUNCTION sync_profile_logement_id()` | 🟢 Basse |

### Étape 3 - Policies RLS (à modifier/créer)

| Table | Policy | Action | Priorité |
|-------|--------|--------|----------|
| `locataires` | "Locataire can view own data" | **CONSERVER** | ✅ OK |
| `locataires` | "Locataire can update own data" | **CONSERVER** + restreindre colonnes | 🟡 Moyenne |
| `locataires` | "Regie can manage own locataires" | **SÉPARER** en 4 policies (SELECT/INSERT/UPDATE/DELETE) | 🔴 Haute |
| `logements` | Policy locataire | **CRÉER** policy stricte (uniquement son logement) | 🔴 Haute |
| `immeubles` | Policy locataire | **CRÉER** policy stricte (uniquement son immeuble) | 🔴 Haute |

### Étape 4 - Backend API (à créer)

| Endpoint | Description | Priorité |
|----------|-------------|----------|
| `POST /api/regie/creer-locataire` | Création atomique locataire + profile | 🔴 Haute |
| `GET /api/regie/locataires` | Liste locataires de la régie | 🔴 Haute |
| `PUT /api/regie/locataires/:id` | Modification locataire (admin régie) | 🟡 Moyenne |
| `DELETE /api/regie/locataires/:id` | Suppression locataire (avec confirmation) | 🟢 Basse |

### Étape 4 - Frontend pages (à créer)

| Page | Description | Priorité |
|------|-------------|----------|
| `/regie/locataires.html` | Gestion locataires (liste + formulaire) | 🔴 Haute |
| `/locataire/dashboard.html` | Dashboard locataire (existant à vérifier) | 🟡 Moyenne |

---

## ✅ CONFIRMATION MÉTIER

**CONFIRMATION EXPLICITE :**

> **LE LOCATAIRE EST UN UTILISATEUR AUTHENTIFIÉ ET ACTEUR CENTRAL DU SYSTÈME.**

**Caractéristiques validées :**
- ✅ Locataire possède `profile_id` (obligatoire)
- ✅ Locataire peut se connecter (auth.users + profiles)
- ✅ Locataire crée les tickets (workflow central)
- ✅ Locataire est toujours affilié à un logement (`logement_id NOT NULL`)
- ✅ Locataire hérite de la régie via `logement → immeuble → régie`

**Architecture validée :**
```
Locataire (authentifié) → Crée Ticket → Régie valide/assigne → Entreprise exécute
```

---

## 📋 CHECKLIST VALIDATION ÉTAPE 2

- [x] Modèle de données cible défini
- [x] Contraintes SQL documentées
- [x] RLS analysées (risques identifiés)
- [x] Impacts migration évalués
- [x] Tests théoriques spécifiés
- [x] Confirmation métier explicite
- [ ] **VALIDATION HUMAINE REQUISE** avant passage ÉTAPE 3

---

**Statut :** ⏸️ EN ATTENTE VALIDATION  
**Prochaine étape :** ÉTAPE 3 - Application des modifications SQL + RLS (après validation)  
**Fichiers impactés (ÉTAPE 3) :**
- `/supabase/schema/08_locataires.sql` (ALTER TABLE)
- `/supabase/schema/18_rls.sql` (policies)
- `/supabase/schema/20_admin.sql` (RPC création locataire - nouveau)

