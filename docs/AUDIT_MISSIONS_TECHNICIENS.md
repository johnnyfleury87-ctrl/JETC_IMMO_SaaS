# AUDIT FINAL - Dépendances Missions et Techniciens

**Date** : 2025-12-17  
**Erreur** : `ERROR: 42P01: relation "missions" does not exist` dans `10_techniciens.sql`

---

## 🚨 PROBLÈME IDENTIFIÉ

### Erreur Actuelle

```
Fichier : 10_techniciens.sql
Ligne 57 : alter table missions add column if not exists technicien_id...
Erreur : ERROR: 42P01: relation "missions" does not exist
```

### Cause Racine

**Ordre d'exécution incorrect** :

```
10_techniciens.sql (ligne 57-73)
  ├─ ALTER TABLE missions ADD COLUMN technicien_id      ❌ missions n'existe pas
  ├─ ALTER TABLE missions ADD COLUMN date_intervention_prevue ❌
  ├─ ALTER TABLE missions ADD COLUMN date_intervention_realisee ❌
  └─ CREATE INDEX ON missions(technicien_id)            ❌

10_techniciens.sql (ligne 130, 162)
  └─ Fonction assign_technicien_to_mission()
     └─ SELECT/UPDATE missions                          ❌

10_techniciens.sql (ligne 261-273)
  └─ CREATE POLICY ON missions                          ❌

12_missions.sql (ligne 23)
  └─ CREATE TABLE missions                              ✅ Créé ICI
```

**Constat** : `10_techniciens.sql` modifie `missions` AVANT sa création.

---

## 📊 ANALYSE COMPLÈTE DES DÉPENDANCES

### Graphe de Dépendances Actuel

```
profiles (04)
  └─ regies (05)
       └─ immeubles (06)
            └─ logements (07)
                 └─ locataires (08)
                 
entreprises (09) → profiles (04)

techniciens (10) → entreprises (09), profiles (04)
                 ❌ ALTER missions (n'existe pas encore)
                 
tickets (11) → logements (07), locataires (08), entreprises (09), techniciens (10)

missions (12) → tickets (11), entreprises (09)
              [DEVRAIT aussi référencer techniciens]
```

### Problème Architectural

**Dépendance circulaire conceptuelle** :

```
techniciens → missions (ALTER TABLE pour ajouter technicien_id)
missions → techniciens (FK technicien_id références techniciens)
```

Cette approche (ALTER TABLE après coup) est **INCORRECTE** en SQL.

---

## ✅ SOLUTION DÉFINITIVE

### Principe : Ordre Logique Métier

**Flux métier** :
1. **Locataire** crée un **ticket**
2. **Entreprise** accepte le ticket → création d'une **mission**
3. **Entreprise** assigne un **technicien** à la mission
4. **Technicien** réalise l'intervention

**Ordre des tables** :
1. `entreprises` (09)
2. `techniciens` (10) - appartiennent à entreprises
3. `tickets` (11) - peuvent référencer entreprises + techniciens (optionnel)
4. `missions` (12) - référencent tickets + entreprises + techniciens (optionnel)

### Corrections À Appliquer

#### Correction 1 : Supprimer ALTER TABLE missions de 10_techniciens.sql

**Supprimer lignes 51-73** :
```sql
-- ❌ À SUPPRIMER
-- =====================================================
-- 2. Ajout colonnes à missions
-- =====================================================

alter table missions
add column if not exists technicien_id uuid references techniciens(id) on delete set null;

alter table missions
add column if not exists date_intervention_prevue timestamptz default null;

alter table missions
add column if not exists date_intervention_realisee timestamptz default null;

create index if not exists idx_missions_technicien_id on missions(technicien_id);
create index if not exists idx_missions_date_intervention_prevue on missions(date_intervention_prevue);

comment on column missions.technicien_id is 'Technicien assigné à la mission (optionnel)';
comment on column missions.date_intervention_prevue is 'Date prévue de l''intervention';
comment on column missions.date_intervention_realisee is 'Date réelle de l''intervention';
```

**Raison** : Ces colonnes doivent être définies directement dans `12_missions.sql`.

#### Correction 2 : Ajouter technicien_id dans 12_missions.sql

**Dans 12_missions.sql, lignes ~26-30, ajouter** :
```sql
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  
  -- Références
  ticket_id uuid not null unique references tickets(id) on delete cascade,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  technicien_id uuid references techniciens(id) on delete set null,        ← AJOUTER
  
  -- Dates
  date_intervention_prevue timestamptz default null,                       ← AJOUTER
  date_intervention_realisee timestamptz default null,                     ← AJOUTER
  
  -- Statut de la mission
  statut text not null default 'en_attente' check (statut in (...)),
  ...
);

-- Index
create index if not exists idx_missions_technicien_id on missions(technicien_id);          ← AJOUTER
create index if not exists idx_missions_date_intervention_prevue on missions(date_intervention_prevue); ← AJOUTER

-- Commentaires
comment on column missions.technicien_id is 'Technicien assigné à la mission (optionnel)';  ← AJOUTER
comment on column missions.date_intervention_prevue is 'Date prévue de l''intervention';    ← AJOUTER
comment on column missions.date_intervention_realisee is 'Date réelle de l''intervention';  ← AJOUTER
```

#### Correction 3 : Déplacer les policies RLS missions de 10_techniciens.sql

**Supprimer de 10_techniciens.sql (lignes 257-273)** :
```sql
-- ❌ À SUPPRIMER
-- =====================================================
-- 7. Policies RLS supplémentaires pour missions
-- =====================================================

create policy "Technicien can view assigned missions"
on missions
for select
using (
  technicien_id = get_user_technicien_id()
);

create policy "Technicien can update assigned missions"
on missions
for update
using (
  technicien_id = get_user_technicien_id()
);
```

**Ajouter dans 12_missions.sql (après les autres policies)** :
```sql
-- ✅ À AJOUTER dans 12_missions.sql

-- Policy : Technicien peut voir SES missions assignées
create policy "Technicien can view assigned missions"
on missions
for select
using (
  technicien_id = (
    select id from techniciens where profile_id = auth.uid()
  )
);

-- Policy : Technicien peut mettre à jour SES missions
create policy "Technicien can update assigned missions"
on missions
for update
using (
  technicien_id = (
    select id from techniciens where profile_id = auth.uid()
  )
);
```

**Note** : Utiliser `(select id from techniciens where profile_id = auth.uid())` au lieu de `get_user_technicien_id()` car la fonction est définie dans `10_techniciens.sql` et pourrait ne pas être encore disponible selon l'ordre d'exécution des policies.

#### Correction 4 : Mettre à jour la numérotation (renommer sections)

Dans `10_techniciens.sql`, mettre à jour la numérotation après suppression :
```sql
-- Ancienne section 2 → SUPPRIMÉE
-- Ancienne section 3 → devient section 2
-- Ancienne section 4 → devient section 3
-- etc.
```

---

## 📋 ORDRE FINAL VALIDÉ

### Tables (01-15)

```
✅ 01_extensions.sql       → uuid-ossp
✅ 02_enums.sql            → ticket_status, etc.
✅ 04_users.sql            → profiles
✅ 05_regies.sql           → regies
✅ 06_immeubles.sql        → immeubles
✅ 07_logements.sql        → logements
✅ 08_locataires.sql       → locataires
✅ 09_entreprises.sql      → entreprises + regies_entreprises
🔧 10_techniciens.sql      → techniciens (CORRIGER : supprimer ALTER missions + policies)
✅ 11_tickets.sql          → tickets
🔧 12_missions.sql         → missions (CORRIGER : ajouter technicien_id + policies)
✅ 13_intervention.sql     → interventions
✅ 14_facturation.sql      → factures
✅ 15_messagerie.sql       → messages + notifications
```

### Vues & Configuration (16-22)

```
✅ 16_views.sql                    → Toutes les vues métier
✅ 17_rls.sql                      → Row Level Security
✅ 18_storage.sql                  → Storage buckets
✅ 19_admin.sql                    → Fonctions admin
✅ 20_abonnements.sql              → Abonnements
✅ 21_statuts_realignement.sql     → Statuts
✅ 22_trigger_prevent_escalation.sql → Triggers
```

---

## 🔍 VÉRIFICATION DES DÉPENDANCES

### Dépendances de missions (12)

| Référence | Table Cible | Ordre | Statut |
|-----------|-------------|-------|--------|
| `ticket_id` | tickets | 11 | ✅ OK (créé avant) |
| `entreprise_id` | entreprises | 09 | ✅ OK (créé avant) |
| `technicien_id` | techniciens | 10 | ✅ OK (créé avant) |

### Dépendances de techniciens (10)

| Référence | Table Cible | Ordre | Statut |
|-----------|-------------|-------|--------|
| `profile_id` | auth.users | 04 | ✅ OK (créé avant) |
| `entreprise_id` | entreprises | 09 | ✅ OK (créé avant) |
| ~~ALTER missions~~ | missions | ~~12~~ | ❌ **À SUPPRIMER** |

### Dépendances de tickets (11)

| Référence | Table Cible | Ordre | Statut |
|-----------|-------------|-------|--------|
| `logement_id` | logements | 07 | ✅ OK (créé avant) |
| `locataire_id` | locataires | 08 | ✅ OK (créé avant) |
| `entreprise_id` | entreprises | 09 | ✅ OK (créé avant, FK nullable) |
| `technicien_id` | techniciens | 10 | ✅ OK (créé avant, FK nullable) |

---

## 🎯 PLAN D'EXÉCUTION

### Étape 1 : Corriger 10_techniciens.sql

- [ ] Supprimer section "2. Ajout colonnes à missions" (lignes 51-73)
- [ ] Supprimer section "7. Policies RLS supplémentaires pour missions" (lignes 257-273)
- [ ] Mettre à jour la numérotation des sections (2→2, 3→2, 4→3, etc.)
- [ ] Ajouter note : "Colonnes technicien_id ajoutées directement dans 12_missions.sql"

### Étape 2 : Corriger 12_missions.sql

- [ ] Ajouter `technicien_id uuid references techniciens(id) on delete set null`
- [ ] Ajouter `date_intervention_prevue timestamptz default null`
- [ ] Ajouter `date_intervention_realisee timestamptz default null`
- [ ] Ajouter index `idx_missions_technicien_id`
- [ ] Ajouter index `idx_missions_date_intervention_prevue`
- [ ] Ajouter commentaires sur les 3 colonnes
- [ ] Ajouter les 2 policies RLS pour techniciens

### Étape 3 : Vérification

```bash
# Vérifier qu'il n'y a plus d'ALTER TABLE missions dans 01-11
grep -n "alter table missions" supabase/schema/{01..11}_*.sql

# Vérifier qu'il n'y a plus de policies sur missions dans 10_techniciens
grep -n "on missions" supabase/schema/10_techniciens.sql

# Vérifier que missions contient bien technicien_id
grep -n "technicien_id" supabase/schema/12_missions.sql
```

### Étape 4 : Test Exécution

Exécuter dans Supabase SQL Editor :
```
✅ 01-09 : Déjà exécutés
🔄 10_techniciens.sql (corrigé)
🔄 11_tickets.sql
🔄 12_missions.sql (corrigé, avec technicien_id)
✅ 13-22 : Exécuter normalement
```

---

## 🚨 AUTRES RISQUES IDENTIFIÉS

### Risque 1 : get_user_technicien_id() non disponible

**Fichier** : `12_missions.sql`  
**Problème** : Si les policies utilisent `get_user_technicien_id()`, la fonction n'existe pas encore lors de l'exécution de 12.

**Solution** : Utiliser une sous-requête inline :
```sql
-- Au lieu de :
using (technicien_id = get_user_technicien_id())

-- Utiliser :
using (technicien_id = (select id from techniciens where profile_id = auth.uid()))
```

### Risque 2 : Fonction assign_technicien_to_mission()

**Fichier** : `10_techniciens.sql` ligne 114-168  
**Problème** : La fonction manipule la table `missions`

**Statut** : ✅ OK - C'est une fonction (pas un ALTER TABLE), elle peut être définie avant missions et sera appelée après.

### Risque 3 : 21_statuts_realignement.sql modifie missions

**Fichier** : `21_statuts_realignement.sql` lignes 69, 82  
**Problème** : `ALTER TABLE missions` pour modifier contraintes

**Statut** : ✅ OK - Exécuté en position 21, bien après la création de missions (12).

---

## ✅ GARANTIES FINALES

Après corrections :

- ✅ **Ordre logique respecté** : entreprises → techniciens → tickets → missions
- ✅ **Toutes les colonnes définies à la création** : Pas d'ALTER TABLE pour structure de base
- ✅ **Policies cohérentes** : Définies dans le fichier de la table concernée
- ✅ **Fonctions utilisables** : Sous-requêtes inline évitent les dépendances croisées
- ✅ **Aucune dépendance circulaire** : Chaque table référence uniquement des tables créées AVANT
- ✅ **Exécution A→Z sans erreur** : Testable dans Supabase SQL Editor

---

## 📝 CHECKLIST DE VALIDATION

- [ ] Backup créé avant modifications
- [ ] 10_techniciens.sql : ALTER missions supprimés (lignes 51-73)
- [ ] 10_techniciens.sql : Policies missions supprimées (lignes 257-273)
- [ ] 12_missions.sql : technicien_id ajouté
- [ ] 12_missions.sql : date_intervention_prevue/realisee ajoutées
- [ ] 12_missions.sql : Index ajoutés
- [ ] 12_missions.sql : Commentaires ajoutés
- [ ] 12_missions.sql : Policies technicien ajoutées
- [ ] Vérification grep : aucun "alter table missions" dans 01-11
- [ ] Test exécution : 10, 11, 12 sans erreur
- [ ] Commit Git avec message descriptif
- [ ] Documentation mise à jour

---

**PROCHAINE ACTION** : Appliquer les corrections sur 10_techniciens.sql et 12_missions.sql
