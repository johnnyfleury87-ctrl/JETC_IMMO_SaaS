# AUDIT - Colonne GENERATED Non-IMMUTABLE

**Date** : 2025-12-17  
**Erreur** : `ERROR: 42P17: generation expression is not immutable`  
**Contexte** : Exécution migration 14_intervention.sql

---

## 🚨 CAUSE RACINE IDENTIFIÉE

### Localisation Exacte

**Fichier** : `14_intervention.sql`  
**Lignes** : 27-32  
**Table** : `missions`  
**Colonne** : `en_retard`

### Code Problématique

```sql
alter table missions
add column if not exists en_retard boolean generated always as (
  date_intervention_prevue is not null 
  and date_intervention_prevue < now()  -- ⚠️ PROBLÈME ICI
  and date_intervention_realisee is null
  and statut in ('en_attente', 'en_cours')
) stored;
```

### Expression Exacte

```sql
date_intervention_prevue is not null 
and date_intervention_prevue < now()
and date_intervention_realisee is null
and statut in ('en_attente', 'en_cours')
```

---

## 🔍 POURQUOI NON-IMMUTABLE ?

### Règles PostgreSQL sur GENERATED COLUMNS

Une colonne `GENERATED ALWAYS AS ... STORED` **doit** utiliser une expression **IMMUTABLE**.

#### Définition Immutabilité

| Catégorie | Comportement | Exemple | GENERATED OK ? |
|-----------|--------------|---------|----------------|
| **IMMUTABLE** | Résultat identique pour mêmes entrées, jamais ne change | `montant_ht * 1.20` | ✅ OUI |
| **STABLE** | Résultat identique **dans la même transaction** | `now()`, `current_timestamp` | ❌ NON |
| **VOLATILE** | Résultat peut changer à chaque appel | `random()`, `uuid_generate_v4()` | ❌ NON |

#### Fonctions NON-IMMUTABLE Courantes

| Fonction | Catégorie | Raison |
|----------|-----------|--------|
| `now()` | STABLE | Change entre transactions |
| `current_timestamp` | STABLE | Change entre transactions |
| `current_date` | STABLE | Change chaque jour |
| `auth.uid()` | STABLE | Dépend du contexte utilisateur |
| `random()` | VOLATILE | Change à chaque appel |
| `uuid_generate_v4()` | VOLATILE | Génère un UUID différent |

### Cas Précis : `now()`

```sql
date_intervention_prevue < now()
```

**Problème** :
- `now()` retourne l'heure actuelle de la transaction
- Le résultat change au fil du temps
- Deux évaluations à des moments différents donnent des résultats différents
- ❌ **Pas IMMUTABLE**

**Exemple** :
```sql
-- Transaction 1 (2025-12-17 10:00)
SELECT now();  -- 2025-12-17 10:00:00

-- Transaction 2 (2025-12-17 11:00)
SELECT now();  -- 2025-12-17 11:00:00
```

Même si les données (`date_intervention_prevue`) n'ont pas changé, le résultat de la comparaison change.

---

## 📊 AUDIT GLOBAL - Toutes Colonnes GENERATED

### Résultat Audit

| Fichier | Table | Colonne | Expression | Statut |
|---------|-------|---------|------------|--------|
| **14_intervention.sql** | **missions** | **en_retard** | `date < now() and ...` | ❌ **NON-IMMUTABLE** |
| 15_facturation.sql | factures | montant_tva | `montant_ht * taux_tva / 100` | ✅ IMMUTABLE |
| 15_facturation.sql | factures | montant_ttc | `montant_ht + (...)` | ✅ IMMUTABLE |
| 15_facturation.sql | factures | montant_commission | `montant_ht * taux_commission / 100` | ✅ IMMUTABLE |

### Détails

#### ❌ 14_intervention.sql - missions.en_retard

```sql
generated always as (
  date_intervention_prevue is not null 
  and date_intervention_prevue < now()  -- ❌ now() = STABLE
  and date_intervention_realisee is null
  and statut in ('en_attente', 'en_cours')
) stored
```

**Utilise** : `now()` → STABLE → ❌ **REJETÉ PAR POSTGRESQL**

#### ✅ 15_facturation.sql - factures.montant_tva

```sql
generated always as (montant_ht * taux_tva / 100) stored
```

**Utilise** : Multiplication, division (opérateurs arithmétiques) → IMMUTABLE → ✅ **VALIDE**

#### ✅ 15_facturation.sql - factures.montant_ttc

```sql
generated always as (montant_ht + (montant_ht * taux_tva / 100)) stored
```

**Utilise** : Addition, multiplication, division → IMMUTABLE → ✅ **VALIDE**

#### ✅ 15_facturation.sql - factures.montant_commission

```sql
generated always as (montant_ht * taux_commission / 100) stored
```

**Utilise** : Multiplication, division → IMMUTABLE → ✅ **VALIDE**

---

## ✅ SOLUTIONS ALTERNATIVES

### Option 1 : Vue Matérialisée ou Simple ⭐ RECOMMANDÉ

**Principe** : Déplacer le calcul dans une vue au lieu d'une colonne

**Avantages** :
- ✅ Pas de contrainte IMMUTABLE
- ✅ Peut utiliser `now()`, `auth.uid()`, etc.
- ✅ Logique centralisée
- ✅ Facile à maintenir
- ✅ Pas de trigger supplémentaire

**Inconvénients** :
- ⚠️ Calcul à chaque requête (performance)
- ⚠️ Pas de colonne réelle (pas d'index direct)

**Implémentation** :

```sql
-- Supprimer la colonne GENERATED
alter table missions drop column if exists en_retard;

-- Créer une vue avec le calcul
create or replace view missions_avec_status as
select
  m.*,
  (
    m.date_intervention_prevue is not null 
    and m.date_intervention_prevue < now()
    and m.date_intervention_realisee is null
    and m.statut in ('en_attente', 'en_cours')
  ) as en_retard
from missions m;

-- Utiliser la vue au lieu de la table
-- SELECT * FROM missions_avec_status WHERE en_retard = true;
```

**Impact** :
- Code métier : Utiliser `missions_avec_status` au lieu de `missions`
- Performances : Calcul dynamique (généralement acceptable)
- Index : Impossible d'indexer `en_retard` directement

---

### Option 2 : Trigger + Colonne Classique

**Principe** : Colonne booléenne normale + trigger pour mise à jour

**Avantages** :
- ✅ Colonne réelle (indexable)
- ✅ Pas de calcul à chaque SELECT
- ✅ Compatible avec les contraintes

**Inconvénients** :
- ⚠️ Calcul basé sur l'heure du dernier UPDATE
- ⚠️ Pas automatiquement mis à jour si le temps passe
- ⚠️ Nécessite un CRON ou job périodique

**Implémentation** :

```sql
-- Supprimer la colonne GENERATED
alter table missions drop column if exists en_retard;

-- Créer colonne classique
alter table missions add column en_retard boolean default false;

-- Créer index
create index idx_missions_en_retard on missions(en_retard) where en_retard = true;

-- Trigger pour calculer au moment de l'INSERT/UPDATE
create or replace function update_missions_en_retard()
returns trigger
language plpgsql
as $$
begin
  new.en_retard := (
    new.date_intervention_prevue is not null 
    and new.date_intervention_prevue < now()
    and new.date_intervention_realisee is null
    and new.statut in ('en_attente', 'en_cours')
  );
  return new;
end;
$$;

create trigger trigger_update_missions_en_retard
before insert or update on missions
for each row
execute function update_missions_en_retard();

-- Job périodique pour recalculer (toutes les 5 minutes)
-- Via pg_cron ou scheduled function Supabase
create or replace function refresh_missions_en_retard()
returns void
language sql
as $$
  update missions
  set en_retard = (
    date_intervention_prevue is not null 
    and date_intervention_prevue < now()
    and date_intervention_realisee is null
    and statut in ('en_attente', 'en_cours')
  )
  where 
    -- Optimisation : ne recalculer que les missions potentiellement en retard
    statut in ('en_attente', 'en_cours')
    and date_intervention_prevue is not null;
$$;
```

**Impact** :
- Performances : Bon (colonne indexée)
- Précision : Dépend de la fréquence du job
- Complexité : Moyenne (trigger + job)

---

### Option 3 : Calcul Côté Application (Code Métier)

**Principe** : Pas de colonne `en_retard`, calcul dans le code TypeScript/JavaScript

**Avantages** :
- ✅ Simplicité SQL (pas de trigger, pas de vue)
- ✅ Flexibilité maximale
- ✅ Pas de contrainte PostgreSQL

**Inconvénients** :
- ❌ Calcul répété à chaque utilisation
- ❌ Pas de filtrage SQL efficace
- ❌ Logique métier dispersée

**Implémentation** :

```typescript
// Côté application (TypeScript)
interface Mission {
  id: string;
  date_intervention_prevue: Date | null;
  date_intervention_realisee: Date | null;
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'validee' | 'annulee';
}

function isEnRetard(mission: Mission): boolean {
  return (
    mission.date_intervention_prevue !== null &&
    mission.date_intervention_prevue < new Date() &&
    mission.date_intervention_realisee === null &&
    ['en_attente', 'en_cours'].includes(mission.statut)
  );
}

// Utilisation
const missions = await supabase.from('missions').select('*');
const missionsEnRetard = missions.data?.filter(isEnRetard);
```

**Impact** :
- Performances : Mauvais (charge toutes les missions)
- Requêtes complexes : Difficile (pas de WHERE en_retard = true)
- Cohérence : Risque de divergence entre frontend/backend

---

## 🎯 SOLUTION RETENUE : Option 1 (Vue)

### Justification

| Critère | Option 1 (Vue) | Option 2 (Trigger) | Option 3 (Code) |
|---------|----------------|-------------------|-----------------|
| **Simplicité** | ✅ Très simple | ⚠️ Moyen (trigger + job) | ✅ Simple |
| **Précision** | ✅ Temps réel | ⚠️ Dépend du job | ✅ Temps réel |
| **Performances SELECT** | ⚠️ Calcul dynamique | ✅ Très bon (index) | ❌ Mauvais |
| **Filtrage SQL** | ✅ Possible | ✅ Possible | ❌ Difficile |
| **Maintenance** | ✅ Facile | ⚠️ Moyen | ⚠️ Code dispersé |
| **Compatibilité** | ✅ PostgreSQL natif | ✅ PostgreSQL natif | ⚠️ Dépend du langage |

**Recommandation** : **Option 1 (Vue)**

**Raisons** :
1. ✅ **Précision temps réel** : Le calcul reflète toujours l'heure actuelle
2. ✅ **Simplicité** : Pas de trigger, pas de job CRON
3. ✅ **Maintenabilité** : Logique centralisée en SQL
4. ✅ **Compatible** : Standard PostgreSQL
5. ⚠️ **Performances** : Acceptable pour volume de données JETC_IMMO (quelques milliers de missions max)

**Alternative si performances critiques** : Option 2 (Trigger + Job)

---

## 📝 PLAN DE CORRECTION

### Étape 1 : Modifier 14_intervention.sql

**Supprimer** :
```sql
alter table missions
add column if not exists en_retard boolean generated always as (
  date_intervention_prevue is not null 
  and date_intervention_prevue < now()
  and date_intervention_realisee is null
  and statut in ('en_attente', 'en_cours')
) stored;

comment on column missions.en_retard is 'Indicateur de retard (calculé automatiquement)';
```

**Ajouter** (après la section vues) :
```sql
-- =====================================================
-- Vue : Missions avec indicateur de retard
-- =====================================================

create or replace view missions_avec_status as
select
  m.*,
  (
    m.date_intervention_prevue is not null 
    and m.date_intervention_prevue < now()
    and m.date_intervention_realisee is null
    and m.statut in ('en_attente', 'en_cours')
  ) as en_retard,
  case
    when m.date_intervention_prevue is not null 
         and m.date_intervention_prevue < now()
         and m.date_intervention_realisee is null
         and m.statut in ('en_attente', 'en_cours')
    then extract(epoch from (now() - m.date_intervention_prevue))/3600
    else 0
  end as heures_retard
from missions m;

comment on view missions_avec_status is 'Missions avec calcul dynamique du retard';
```

### Étape 2 : Adapter missions_en_retard (vue existante)

**Modifier la ligne** :
```sql
-- Avant
where m.en_retard = true

-- Après
where m.date_intervention_prevue is not null 
  and m.date_intervention_prevue < now()
  and m.date_intervention_realisee is null
  and m.statut in ('en_attente', 'en_cours')
```

### Étape 3 : Supprimer l'index inutile

**Supprimer** :
```sql
create index if not exists idx_missions_en_retard on missions(en_retard) where en_retard = true;
```

**Remplacer par** :
```sql
-- Index pour optimiser les requêtes sur missions en retard
create index if not exists idx_missions_retard_lookup 
  on missions(statut, date_intervention_prevue, date_intervention_realisee)
  where statut in ('en_attente', 'en_cours') 
    and date_intervention_prevue is not null
    and date_intervention_realisee is null;
```

---

## ⚠️ IMPACT SUR LE CODE MÉTIER

### Code à Adapter

#### Requêtes SQL

**Avant** :
```sql
SELECT * FROM missions WHERE en_retard = true;
```

**Après (Option A - Vue)** :
```sql
SELECT * FROM missions_avec_status WHERE en_retard = true;
```

**Après (Option B - Inline)** :
```sql
SELECT * FROM missions 
WHERE date_intervention_prevue is not null 
  and date_intervention_prevue < now()
  and date_intervention_realisee is null
  and statut in ('en_attente', 'en_cours');
```

#### API Supabase (TypeScript)

**Avant** :
```typescript
const { data } = await supabase
  .from('missions')
  .select('*')
  .eq('en_retard', true);
```

**Après** :
```typescript
const { data } = await supabase
  .from('missions_avec_status')  // ← Vue
  .select('*')
  .eq('en_retard', true);
```

---

## ✅ GARANTIES FINALES

### Après Correction

- ✅ **Aucune colonne GENERATED non-IMMUTABLE**
- ✅ **Migration 01→23 exécutable sans erreur**
- ✅ **Calcul en_retard toujours précis (temps réel)**
- ✅ **Logique centralisée en SQL**
- ✅ **Performances acceptables (calcul optimisé)**
- ✅ **Code métier à adapter (vue au lieu de table)**

### Validation PostgreSQL

#### Colonnes GENERATED Restantes

| Table | Colonne | Expression | Immutable ? |
|-------|---------|------------|-------------|
| factures | montant_tva | `montant_ht * taux_tva / 100` | ✅ OUI |
| factures | montant_ttc | `montant_ht + (...)` | ✅ OUI |
| factures | montant_commission | `montant_ht * taux_commission / 100` | ✅ OUI |

✅ **Toutes valides** (opérateurs arithmétiques = IMMUTABLE)

---

## 📊 CHECKLIST CORRECTION

- [ ] Supprimer colonne GENERATED `missions.en_retard` de 14_intervention.sql
- [ ] Créer vue `missions_avec_status` avec calcul dynamique
- [ ] Adapter vue `missions_en_retard` (ne plus utiliser colonne en_retard)
- [ ] Supprimer index `idx_missions_en_retard`
- [ ] Créer index composite optimisé pour filtrage retards
- [ ] Supprimer commentaire colonne `en_retard`
- [ ] Ajouter commentaire vue `missions_avec_status`
- [ ] Tester migration 01→23 sur base vide
- [ ] Adapter code API (utiliser vue au lieu de table)
- [ ] Documenter changement dans README/CHANGELOG

---

**PROCHAINE ACTION** : Appliquer la correction dans 14_intervention.sql
