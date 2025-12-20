# 🔍 ÉTAPE 1 - ANALYSE DE L'EXISTANT

**Date :** 20 décembre 2025  
**Objectif :** Analyser l'architecture actuelle des locataires avant toute modification  
**Scope :** Tables regies, immeubles, logements, locataires, profiles + RLS

---

## 📊 ARCHITECTURE ACTUELLE

### 1. Modèle relationnel existant

```
profiles (auth.users)
    ↓ profile_id
regies ──────────→ regie_id → immeubles ──────→ immeuble_id → logements
                                                                    ↓ logement_id
                                                              locataires
                                                                    ↑ profile_id
                                                              profiles (OPTIONNEL)
```

### 2. Hiérarchie des données

```
Régie (profile_id)
  └── Immeubles (regie_id) [FK OBLIGATOIRE]
       └── Logements (immeuble_id) [FK OBLIGATOIRE]
            └── Locataires (logement_id) [FK OPTIONNEL ⚠️]
```

---

## 🗄️ ANALYSE PAR TABLE

### Table `regies`

**Fichier :** `/supabase/schema/05_regies.sql`

**Structure :**
```sql
create table regies (
  id uuid primary key,
  nom text not null,
  profile_id uuid references profiles(id) on delete cascade,  -- Admin principal
  statut_validation text check (...),
  ...
);
```

**Clés étrangères :**
- `profile_id → profiles(id)` : Référence l'admin principal de la régie
- Cascade : `ON DELETE CASCADE` (si profil supprimé → régie supprimée)

**Index :**
- `idx_regies_profile_id` ✅
- `idx_regies_nom` ✅
- `idx_regies_ville` ✅

**✅ État actuel : BON**
- FK correcte
- Contraintes validées
- Index performants

---

### Table `immeubles`

**Fichier :** `/supabase/schema/06_immeubles.sql`

**Structure :**
```sql
create table immeubles (
  id uuid primary key,
  nom text not null,
  regie_id uuid not null references regies(id) on delete cascade,  -- ✅ OBLIGATOIRE
  ...
);
```

**Clés étrangères :**
- `regie_id → regies(id)` : **OBLIGATOIRE** (NOT NULL)
- Cascade : `ON DELETE CASCADE` (si régie supprimée → immeubles supprimés)

**Index :**
- `idx_immeubles_regie_id` ✅
- `idx_immeubles_ville` ✅
- `idx_immeubles_nom` ✅

**✅ État actuel : BON**
- Relation 1-N correcte (1 régie → N immeubles)
- FK obligatoire empêche orphelins
- Cascade protège l'intégrité

---

### Table `logements`

**Fichier :** `/supabase/schema/07_logements.sql`

**Structure :**
```sql
create table logements (
  id uuid primary key,
  numero text not null,
  immeuble_id uuid not null references immeubles(id) on delete cascade,  -- ✅ OBLIGATOIRE
  statut text default 'vacant' check (statut in ('vacant', 'occupé', 'en_travaux')),
  ...
);
```

**Clés étrangères :**
- `immeuble_id → immeubles(id)` : **OBLIGATOIRE** (NOT NULL)
- Cascade : `ON DELETE CASCADE` (si immeuble supprimé → logements supprimés)

**Index :**
- `idx_logements_immeuble_id` ✅
- `idx_logements_statut` ✅
- `idx_logements_numero` ✅

**Contraintes métier :**
- `unique_logement_numero_immeuble(numero, immeuble_id)` ✅

**✅ État actuel : BON**
- Relation 1-N correcte (1 immeuble → N logements)
- FK obligatoire empêche orphelins
- Cascade protège l'intégrité

---

### Table `locataires`

**Fichier :** `/supabase/schema/08_locataires.sql`

**Structure :**
```sql
create table locataires (
  id uuid primary key,
  nom text not null,
  prenom text not null,
  email text not null,
  
  -- ⚠️ PROBLÈME 1 : FK OPTIONNELLE
  profile_id uuid unique references profiles(id) on delete cascade,  -- NULLABLE
  
  -- ⚠️ PROBLÈME 2 : FK OPTIONNELLE
  logement_id uuid references logements(id) on delete set null,  -- NULLABLE
  
  date_entree date,
  date_sortie date,
  ...
);
```

**Clés étrangères :**
- `profile_id → profiles(id)` : **OPTIONNEL** (NULL autorisé) ⚠️
- `logement_id → logements(id)` : **OPTIONNEL** (NULL autorisé) ⚠️
- Cascade profile : `ON DELETE CASCADE`
- Cascade logement : `ON DELETE SET NULL`

**Index :**
- `idx_locataires_profile_id` ✅
- `idx_locataires_logement_id` ✅
- `idx_locataires_email` ✅

**Trigger existant :**
```sql
create trigger sync_profile_on_locataire_update
  after insert or update of logement_id, profile_id on locataires
  for each row execute function sync_profile_logement_id();
```

**Fonction trigger :**
```sql
create or replace function sync_profile_logement_id()
as $$
begin
  if new.profile_id is not null then
    update profiles
    set logement_id = new.logement_id
    where id = new.profile_id;
  end if;
  return new;
end;
$$;
```

**⚠️ PROBLÈMES IDENTIFIÉS :**

#### 1. `logement_id` NULLABLE → Violation règle métier

**Règle métier attendue :** "Un locataire est TOUJOURS affilié à un logement"

**État actuel :**
```sql
logement_id uuid references logements(id)  -- Pas de NOT NULL
```

**Conséquence :**
- Un locataire peut exister sans logement (orphelin)
- Impossible de tracer la régie propriétaire
- RLS potentiellement contournable

**Niveau de risque :** 🔴 **CRITIQUE**

---

#### 2. `profile_id` NULLABLE → Ambiguïté authentification

**Règle métier attendue :** "Le locataire n'est pas un utilisateur authentifié"

**État actuel :**
```sql
profile_id uuid unique references profiles(id)  -- NULLABLE mais UNIQUE
```

**Conséquence :**
- Ambiguïté : le locataire peut-il se connecter ?
- Si `profile_id` existe → locataire authentifié (accès dashboard)
- Si `profile_id` NULL → locataire non authentifié (données seulement)

**Architecture incohérente avec RLS existantes :**

Ligne 145-150 (`18_rls.sql`) :
```sql
create policy "Locataire can view own data"
on locataires for select
using (profile_id = auth.uid());
```

**→ Cette policy suppose que le locataire a un `profile_id` (utilisateur authentifié)**

**Niveau de risque :** 🟡 **MOYEN** (ambiguïté architecturale)

---

#### 3. Trigger `sync_profile_logement_id()` → Complexité inutile

**Objectif du trigger :** Synchroniser `profiles.logement_id` avec `locataires.logement_id`

**Problème :**
- Si locataire non authentifié → `profile_id = NULL` → trigger ne fait rien
- Crée une dépendance bidirectionnelle (locataires ↔ profiles)
- Augmente risque de récursion RLS

**Niveau de risque :** 🟠 **FAIBLE** (complexité technique, pas de bug actuel)

---

### Table `profiles`

**Fichier :** `/supabase/schema/04_users.sql`

**Structure :**
```sql
create table profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  role user_role not null default 'regie',  -- ENUM: admin_jtec, regie, entreprise, locataire
  
  -- Rattachements optionnels
  regie_id uuid,              -- ⚠️ Pas de FK définie
  entreprise_id uuid,
  logement_id uuid,           -- ⚠️ Synchronisé par trigger locataires
  ...
);
```

**⚠️ PROBLÈME 4 : `profiles.regie_id` sans FK**

**État actuel :**
```sql
regie_id uuid,  -- Pas de REFERENCES regies(id)
```

**Conséquence :**
- Aucune garantie d'intégrité référentielle
- `regie_id` peut pointer vers un UUID inexistant
- Impossible de faire JOIN fiable

**Utilisation actuelle :**
- Champ non utilisé dans le code existant
- Aucune policy RLS n'y fait référence
- Probablement un reliquat ou préparation future

**Niveau de risque :** 🟡 **MOYEN** (intégrité non garantie)

---

## 🔐 ANALYSE RLS EXISTANTE

**Fichier :** `/supabase/schema/18_rls.sql`

### Policies pour `locataires`

#### Policy 1 : "Locataire can view own data"
```sql
create policy "Locataire can view own data"
on locataires for select
using (profile_id = auth.uid());
```

**Analyse :**
- ✅ Correcte si locataire authentifié
- ❌ Ne fonctionne PAS si `profile_id = NULL` (locataire non authentifié)
- **Incohérence avec règle métier "locataire non authentifié"**

---

#### Policy 2 : "Locataire can update own data"
```sql
create policy "Locataire can update own data"
on locataires for update
using (profile_id = auth.uid());
```

**Analyse :**
- ✅ Correcte si locataire authentifié
- ❌ Ne fonctionne PAS si `profile_id = NULL`
- **Même incohérence que Policy 1**

---

#### Policy 3 : "Regie can view own locataires" ⚠️

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

**Analyse :**

**✅ Points positifs :**
- Logique correcte : Régie → Immeubles → Logements → Locataires
- Utilise `get_user_regie_id()` (helper function optimisée)
- Pas de récursion RLS (SELECT sur logements/immeubles)

**❌ PROBLÈME CRITIQUE :**
- Si `locataires.logement_id = NULL` → EXISTS retourne FALSE
- **→ Régie ne peut PAS voir ses locataires sans logement !**

**Scénario problématique :**
```sql
-- Locataire créé mais logement_id = NULL (temporaire)
INSERT INTO locataires (nom, prenom, email, logement_id) 
VALUES ('Dupont', 'Jean', 'jean@exemple.ch', NULL);

-- RLS bloque l'accès car EXISTS ne match pas
SELECT * FROM locataires WHERE nom = 'Dupont';  -- 0 résultat ❌
```

**Niveau de risque :** 🔴 **CRITIQUE** (bloquant si `logement_id` NULL autorisé)

---

#### Policy 4 : "Regie can manage own locataires" ⚠️

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

**Analyse :**
- **MÊME PROBLÈME que Policy 3**
- Régie ne peut pas INSERT/UPDATE/DELETE si `logement_id = NULL`
- Bloquant pour workflow de création

---

#### Policy 5 : "Admin JTEC can view all locataires"
```sql
create policy "Admin JTEC can view all locataires"
on locataires for select
using (public.is_admin_jtec());
```

**Analyse :**
- ✅ Correcte
- Utilise `is_admin_jtec()` (SECURITY DEFINER → bypass RLS)
- Pas de récursion

---

### Fonction helper : `get_user_regie_id()`

**Fichier :** `/supabase/schema/09b_helper_functions.sql`

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

**Analyse :**

**✅ Points positifs :**
- `SECURITY DEFINER` → bypass RLS (pas de récursion)
- `STABLE` → optimisé pour usage répété dans requête
- Union gère rôle 'regie' ET 'locataire'

**⚠️ PROBLÈME si `logement_id = NULL` :**
```sql
select i.regie_id
from locataires l
join logements lg on lg.id = l.logement_id  -- ❌ NULL → JOIN échoue
```

**→ Si locataire sans logement → `get_user_regie_id()` retourne NULL**

**Impact :**
- Locataire authentifié mais sans logement → perd accès à tout
- Policy RLS avec `regie_id = get_user_regie_id()` → FALSE

**Niveau de risque :** 🔴 **CRITIQUE** (si locataire authentifié attendu)

---

## 🚨 SYNTHÈSE DES PROBLÈMES

### 🔴 CRITIQUES (bloquants métier)

| # | Problème | Impact | Fichier concerné |
|---|----------|--------|------------------|
| 1 | `locataires.logement_id` NULLABLE | Violation règle "toujours affilié" | `08_locataires.sql` |
| 2 | RLS "Regie can view" échoue si `logement_id = NULL` | Régie ne voit pas locataires | `18_rls.sql:157-165` |
| 3 | RLS "Regie can manage" échoue si `logement_id = NULL` | Régie ne peut pas créer locataire | `18_rls.sql:167-177` |

### 🟡 MOYENS (ambiguïtés architecturales)

| # | Problème | Impact | Fichier concerné |
|---|----------|--------|------------------|
| 4 | `locataires.profile_id` NULLABLE | Incohérence règle "non authentifié" | `08_locataires.sql` |
| 5 | Policies "Locataire can view/update" supposent authentification | Incompatible avec règle métier | `18_rls.sql:145-153` |
| 6 | `profiles.regie_id` sans FK | Intégrité référentielle non garantie | `04_users.sql` |

### 🟠 FAIBLES (complexité technique)

| # | Problème | Impact | Fichier concerné |
|---|----------|--------|------------------|
| 7 | Trigger `sync_profile_logement_id()` | Complexité inutile si locataire non authentifié | `08_locataires.sql:71-86` |
| 8 | `get_user_regie_id()` échoue si `logement_id = NULL` | Locataire authentifié perd accès | `09b_helper_functions.sql:43-50` |

---

## ✅ CE QUI EST DÉJÀ BON

1. **Architecture hiérarchique claire :** Régie → Immeubles → Logements ✅
2. **FK obligatoires sur immeubles/logements :** Pas d'orphelins ✅
3. **Index performants :** Toutes les FK indexées ✅
4. **Cascade DELETE cohérente :** Suppression régie → cascade complète ✅
5. **Policy Admin JTEC :** Accès global sécurisé ✅
6. **Fonction `is_admin_jtec()` :** Pas de récursion RLS ✅

---

## 🎯 RECOMMANDATIONS POUR ÉTAPE 2

### 1. Clarifier règle métier `profile_id`

**Décision requise :**
- **Option A :** Locataire TOUJOURS non authentifié → `profile_id = NULL` OBLIGATOIRE
- **Option B :** Locataire PEUT être authentifié → `profile_id` OPTIONNEL (garder)

**Impact sur RLS :**
- Option A → Supprimer policies "Locataire can view/update"
- Option B → Adapter `get_user_regie_id()` pour gérer NULL

**Recommandation :** **Option A** (cohérence avec demande utilisateur)

---

### 2. Rendre `logement_id` OBLIGATOIRE

**Modification SQL :**
```sql
ALTER TABLE locataires 
ALTER COLUMN logement_id SET NOT NULL;
```

**Pré-requis :**
- Vérifier aucun locataire existant avec `logement_id = NULL`
- Si orphelins → les supprimer OU leur assigner un logement

---

### 3. Simplifier RLS régie

**Policy cible :**
```sql
-- Régie peut voir locataires via logements → immeubles (TOUJOURS valide si logement_id NOT NULL)
create policy "Regie can view own locataires"
on locataires for select
using (
  exists (
    select 1
    from logements l
    join immeubles i on i.id = l.immeuble_id
    where l.id = locataires.logement_id  -- Garanti NOT NULL
      and i.regie_id = get_user_regie_id()
  )
);
```

**Bénéfice :** Plus simple, plus sûr, pas de cas NULL à gérer

---

### 4. Supprimer trigger inutile

**Si locataire non authentifié (Option A) :**
```sql
DROP TRIGGER sync_profile_on_locataire_update ON locataires;
DROP FUNCTION sync_profile_logement_id();
```

**Bénéfice :** Moins de complexité, moins de risque récursion

---

### 5. Ajouter FK `profiles.regie_id` (optionnel)

**Si besoin futur (multi-utilisateurs régie) :**
```sql
ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_regie_id 
FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE SET NULL;
```

**Bénéfice :** Intégrité référentielle garantie

---

## 📋 CHECKLIST VALIDATION ÉTAPE 1

- [x] Tables existantes analysées
- [x] FK et relations documentées
- [x] RLS existantes décortiquées
- [x] Problèmes identifiés et priorisés
- [x] Recommandations formulées
- [ ] **VALIDATION HUMAINE REQUISE** avant passage ÉTAPE 2

---

**Statut :** ⏸️ EN ATTENTE VALIDATION  
**Prochaine étape :** ÉTAPE 2 - Modèle de données cible (après validation)

