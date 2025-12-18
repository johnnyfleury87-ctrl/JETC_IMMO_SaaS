# AUDIT SYSTÉMIQUE - Fonctions SQL Transverses

**Date** : 2025-12-17  
**Erreur déclenchante** : `ERROR: 42883: function update_updated_at() does not exist`  
**Fichier** : 15_facturation.sql ligne 71

---

## 🚨 PROBLÈME SYSTÉMIQUE

### Cause Racine

**Fonctions helper définies de manière dispersée**, sans anticipation globale :
- ❌ `handle_updated_at()` définie dans 04 ET 05 (doublons)
- ❌ `update_updated_at()` utilisée dans 15 mais **JAMAIS définie**
- ✅ `get_user_regie_id()` correctement définie dans 09b

**Conséquence** : Erreurs "function does not exist" lors de la migration.

---

## 📊 INVENTAIRE COMPLET - Fonctions Transverses

### 1. Fonctions Trigger `updated_at`

#### handle_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition #1 | **04_users.sql** | 49 | 04 |
| Définition #2 ⚠️ DOUBLON | **05_regies.sql** | 70 | 05 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger profiles | 04_users.sql | 62 | 04 | ✅ Après définition (04) |
| Trigger regies | 05_regies.sql | 83 | 05 | ✅ Après définition (05) |
| Trigger immeubles | 06_immeubles.sql | 60 | 06 | ✅ Après définition (04/05) |
| Trigger logements | 07_logements.sql | 67 | 07 | ✅ Après définition |
| Trigger locataires | 08_locataires.sql | 64 | 08 | ✅ Après définition |
| Trigger entreprises | 10_entreprises.sql | 59 | 10 | ✅ Après définition |
| Trigger regies_entreprises | 10_entreprises.sql | 96 | 10 | ✅ Après définition |
| Trigger tickets | 12_tickets.sql | 81 | 12 | ✅ Après définition |

**Problème** : 2 définitions identiques (04 et 05) → Confusion, redondance

---

#### update_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| ❌ **AUCUNE** | - | - | - |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger factures | **15_facturation.sql** | 71 | 15 | ❌ **FONCTION MANQUANTE** |

**Problème** : Fonction utilisée mais **jamais définie** → **ERREUR BLOQUANTE**

---

#### update_techniciens_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 11_techniciens.sql | 61 | 11 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger techniciens | 11_techniciens.sql | 74 | 11 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

#### update_missions_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 13_missions.sql | 167 | 13 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger missions | 13_missions.sql | 180 | 13 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

#### update_plan_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 21_abonnements.sql | 585 | 21 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger plans | 21_abonnements.sql | 598 | 21 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

#### update_abonnement_updated_at()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 21_abonnements.sql | 603 | 21 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger abonnements | 21_abonnements.sql | 616 | 21 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

### 2. Fonctions Métier Helper

#### get_user_regie_id()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | **09b_helper_functions.sql** | 31 | 09b |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Policy techniciens | 11_techniciens.sql | 225 | 11 | ✅ Après définition (09b < 11) |
| Policy missions view | 13_missions.sql | 198 | 13 | ✅ Après définition (09b < 13) |
| Policy missions update | 13_missions.sql | 247 | 13 | ✅ Après définition (09b < 13) |
| Policy immeubles | 18_rls.sql | 119, 124 | 18 | ✅ Après définition (09b < 18) |
| + ~15 autres policies | 18_rls.sql | divers | 18 | ✅ Après définition |

**Statut** : ✅ OK (correctement définie en 09b, utilisée après)

---

#### get_user_technicien_id()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 11_techniciens.sql | 80 | 11 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Aucune utilisation détectée | - | - | - | ✅ OK (locale) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

#### set_ticket_regie_id()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 12_tickets.sql | 84 | 12 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Trigger tickets | 12_tickets.sql | 110 | 12 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

### 3. Autres Fonctions Transverses

#### is_admin_jtec()

| Définition | Fichier | Ligne | Position |
|-----------|---------|-------|----------|
| Définition | 20_admin.sql | 205 | 20 |

| Utilisation | Fichier | Ligne | Position | Statut |
|-------------|---------|-------|----------|--------|
| Policies admin | 20_admin.sql | divers | 20 | ✅ Après définition (même fichier) |

**Statut** : ✅ OK (fonction spécifique, utilisée localement)

---

## 🔍 ANALYSE ORDRE D'EXÉCUTION

### Fonctions Problématiques

| Fonction | Définie en | Utilisée en | Ordre OK ? | Impact |
|----------|-----------|-------------|------------|--------|
| **handle_updated_at** | 04, 05 ⚠️ | 04-12 | ⚠️ DOUBLON | Confusion |
| **update_updated_at** | ❌ JAMAIS | 15 | ❌ **NON** | **ERREUR BLOQUANTE** |
| update_techniciens_updated_at | 11 | 11 | ✅ OUI | OK |
| update_missions_updated_at | 13 | 13 | ✅ OUI | OK |
| get_user_regie_id | 09b | 11, 13, 18 | ✅ OUI | OK |
| get_user_technicien_id | 11 | 11 | ✅ OUI | OK |
| set_ticket_regie_id | 12 | 12 | ✅ OUI | OK |

### Diagnostic

#### ❌ Erreur Immédiate
```sql
-- 15_facturation.sql ligne 71
execute function update_updated_at();
```

**Problème** : `update_updated_at()` n'est **JAMAIS définie**

**Solution** : Doit être `handle_updated_at()` (fonction standard)

---

#### ⚠️ Doublons Inutiles

**handle_updated_at()** définie 2 fois :
1. `04_users.sql` ligne 49
2. `05_regies.sql` ligne 70

**Conséquence** : 
- Redéfinition inutile (CREATE OR REPLACE écrase)
- Confusion dans la maintenance
- Pas d'erreur mais mauvaise architecture

---

## ✅ ARCHITECTURE PROPOSÉE

### Option 1 : Consolidation dans 09b_helper_functions.sql ⭐ RECOMMANDÉ

**Principe** : Toutes les fonctions transverses dans UN fichier centralisé

#### Structure Proposée

```
09b_helper_functions.sql
├─ Section 1: Triggers génériques
│  └─ handle_updated_at()          ← UNIQUE définition
│
├─ Section 2: Fonctions métier helper
│  ├─ get_user_regie_id()          ← Déjà présent ✅
│  └─ (autres si nécessaires)
│
└─ Section 3: Documentation
   └─ Commentaires + exemples usage
```

#### Contenu Complet

```sql
/**
 * FONCTIONS HELPER TRANSVERSES
 * 
 * Fonctions réutilisables dans plusieurs fichiers
 * À exécuter APRÈS les tables de base (01-08)
 * 
 * Ordre d'exécution : 09b
 */

-- =====================================================
-- Section 1 : TRIGGERS GÉNÉRIQUES
-- =====================================================

/**
 * handle_updated_at()
 * 
 * Fonction trigger pour mettre à jour automatiquement
 * la colonne updated_at lors d'un UPDATE.
 * 
 * Usage : CREATE TRIGGER nom_table_updated_at
 *         BEFORE UPDATE ON nom_table
 *         FOR EACH ROW
 *         EXECUTE FUNCTION handle_updated_at();
 */
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function handle_updated_at is 'Trigger générique pour mettre à jour updated_at automatiquement';

-- =====================================================
-- Section 2 : FONCTIONS MÉTIER HELPER
-- =====================================================

/**
 * get_user_regie_id()
 * 
 * Retourne la regie_id de l'utilisateur connecté.
 * Fonctionne pour les rôles 'regie' et 'locataire'.
 */
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;

comment on function get_user_regie_id is 'Retourne la regie_id de l''utilisateur connecté (pour rôles regie et locataire)';
```

---

### Option 2 : Fichier 03_helper_functions.sql (Position Précoce)

**Principe** : Définir `handle_updated_at()` très tôt (avant 04)

**Avantages** :
- ✅ Disponible pour tous les fichiers suivants
- ✅ Pas de dépendance (juste `now()`)

**Inconvénients** :
- ⚠️ `get_user_regie_id()` nécessite tables 05-08 → Doit rester en 09b

**Structure** :
```
03_helper_functions.sql       → handle_updated_at()
09b_helper_functions.sql      → get_user_regie_id() (garde)
```

**Problème** : 2 fichiers helper → Moins propre

---

### Option 3 : Inliner dans Chaque Fichier (Status Quo)

**Principe** : Définir `handle_updated_at()` dans chaque fichier qui l'utilise

**Avantages** :
- ✅ Autonomie (pas de dépendance externe)

**Inconvénients** :
- ❌ Duplication massive (10+ fichiers)
- ❌ Maintenance difficile
- ❌ Incohérence potentielle

**Non recommandé**

---

## 🎯 SOLUTION RETENUE : Option 1 (Consolidation dans 09b)

### Justification

| Critère | Option 1 (09b consolidé) | Option 2 (03 + 09b) | Option 3 (Inline) |
|---------|--------------------------|---------------------|-------------------|
| **Centralisation** | ✅ Un seul fichier | ⚠️ Deux fichiers | ❌ Dispersé |
| **Maintenabilité** | ✅ Facile | ⚠️ Moyen | ❌ Difficile |
| **Clarté** | ✅ Toutes fonctions helper ensemble | ⚠️ Séparé | ❌ Redondant |
| **Ordre** | ✅ Après tables base | ✅ Avant tout | ⚠️ Partout |
| **Simplicité** | ✅ Un fichier à retenir | ⚠️ Deux fichiers | ❌ Complexe |

**Recommandation** : **Option 1**

### Modifications Requises

#### 1. Consolider 09b_helper_functions.sql

**Ajouter** `handle_updated_at()` au début du fichier :
```sql
-- Section 1: Triggers génériques
create or replace function handle_updated_at() ...

-- Section 2: Fonctions métier helper
create or replace function get_user_regie_id() ...
```

#### 2. Supprimer Définitions Redondantes

**Fichiers à modifier** :
- ❌ **04_users.sql ligne 49-58** : Supprimer définition `handle_updated_at()`
- ❌ **05_regies.sql ligne 70-78** : Supprimer définition `handle_updated_at()`

**Garder** : Les triggers (ligne 62, 83) → OK car fonction définie en 09b

#### 3. Corriger 15_facturation.sql

**Ligne 71** :
```sql
-- ❌ AVANT
execute function update_updated_at();

-- ✅ APRÈS
execute function handle_updated_at();
```

---

## 📋 PLAN DE CORRECTION

### Étape 1 : Enrichir 09b_helper_functions.sql

1. Ajouter `handle_updated_at()` en début de fichier
2. Documenter usage (exemples triggers)
3. Garder `get_user_regie_id()` existante

### Étape 2 : Nettoyer Définitions Redondantes

1. Supprimer `handle_updated_at()` de 04_users.sql (lignes 49-58)
2. Supprimer `handle_updated_at()` de 05_regies.sql (lignes 70-78)
3. Garder les triggers (utilisent fonction de 09b)

### Étape 3 : Corriger Appel Erroné

1. Modifier 15_facturation.sql ligne 71 : `update_updated_at()` → `handle_updated_at()`

### Étape 4 : Vérification Ordre Théorique

**Validation** :
```
09b_helper_functions.sql (position 09b)
  ├─ handle_updated_at() définie
  └─ get_user_regie_id() définie

Utilisations handle_updated_at() :
  ├─ 04_users.sql (ligne 62)         ❌ AVANT 09b → PROBLÈME
  ├─ 05_regies.sql (ligne 83)        ❌ AVANT 09b → PROBLÈME
  ├─ 06_immeubles.sql (ligne 60)     ❌ AVANT 09b → PROBLÈME
  ├─ 07_logements.sql (ligne 67)     ❌ AVANT 09b → PROBLÈME
  ├─ 08_locataires.sql (ligne 64)    ❌ AVANT 09b → PROBLÈME
  ├─ 10_entreprises.sql (lignes 59, 96)  ✅ APRÈS 09b
  ├─ 12_tickets.sql (ligne 81)       ✅ APRÈS 09b
  └─ 15_facturation.sql (ligne 71)   ✅ APRÈS 09b
```

⚠️ **PROBLÈME DÉTECTÉ** : Les fichiers 04-08 utilisent `handle_updated_at()` **AVANT** sa définition en 09b

---

## 🚨 PROBLÈME ARCHITECTURAL RÉVÉLÉ

### Cause Racine #2 : Ordre Impossible

**Dilemme** :
- `handle_updated_at()` est utilisée dès le fichier 04
- Mais `get_user_regie_id()` nécessite tables 05-08
- Impossible de tout mettre dans un seul fichier helper

### Solution Correcte : Option 2 (Deux Fichiers Helper)

#### Architecture Finale Valide

```
03_helper_functions.sql (position 03)
  └─ handle_updated_at()         ← DISPONIBLE pour 04-23

09b_helper_functions.sql (position 09b)
  └─ get_user_regie_id()         ← DISPONIBLE pour 11-23 (après tables 05-08)
```

#### Ordre Final

```
01  extensions.sql
02  enums.sql
03  helper_functions.sql         ← NOUVEAU (handle_updated_at)
04  users.sql                    ← Utilise handle_updated_at() de 03 ✅
05  regies.sql                   ← Utilise handle_updated_at() de 03 ✅
06  immeubles.sql                ← Utilise handle_updated_at() de 03 ✅
07  logements.sql                ← Utilise handle_updated_at() de 03 ✅
08  locataires.sql               ← Utilise handle_updated_at() de 03 ✅
09b helper_functions_metier.sql ← Garde get_user_regie_id()
10  entreprises.sql              ← Utilise handle_updated_at() de 03 ✅
...
15  facturation.sql              ← Utilise handle_updated_at() de 03 ✅
```

---

## ✅ ARCHITECTURE FINALE RECOMMANDÉE

### Structure en 2 Fichiers Helper

#### 03_helper_functions.sql (Triggers Génériques)

**Contenu** :
- `handle_updated_at()` → Utilisée par 04-15

**Position** : 03 (après enums, avant users)

**Dépendances** : Aucune (juste `now()`)

---

#### 09b_helper_functions_metier.sql (Fonctions Métier)

**Contenu** :
- `get_user_regie_id()` → Utilisée par 11, 13, 18

**Position** : 09b (après locataires)

**Dépendances** : regies (05), immeubles (06), logements (07), locataires (08)

---

## 📝 CHECKLIST CORRECTION

- [ ] Créer `03_helper_functions.sql` avec `handle_updated_at()`
- [ ] Renommer `09b_helper_functions.sql` → `09b_helper_functions_metier.sql` (clarté)
- [ ] Supprimer `handle_updated_at()` de 04_users.sql (lignes 49-58)
- [ ] Supprimer `handle_updated_at()` de 05_regies.sql (lignes 70-78)
- [ ] Corriger 15_facturation.sql ligne 71 : `update_updated_at` → `handle_updated_at`
- [ ] Tester migration 01→23 théoriquement (ordre dépendances)
- [ ] Commit avec message descriptif

---

**PROCHAINE ACTION** : Valider architecture avant correction
