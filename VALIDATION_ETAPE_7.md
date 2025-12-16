# ✅ VALIDATION ÉTAPE 7 - Row Level Security (RLS)

**Date** : 2025  
**Statut** : ✅ **VALIDÉE** (41/41 tests réussis)

---

## 📋 Objectifs de l'ÉTAPE 7

Sécuriser **définitivement** toutes les données avec Row Level Security (RLS) :
- Activer RLS sur toutes les tables
- Créer des policies par rôle
- Garantir l'**isolation DEMO / PRO** (par regie_id)
- Bloquer tout accès anonyme
- Éviter la récursion RLS

---

## 🔐 Principes de sécurité

### 1. Row Level Security (RLS)

Chaque table est protégée par des **policies** qui contrôlent :
- **Qui** peut accéder aux données (authentification via `auth.uid()`)
- **Quoi** : quelles lignes sont visibles (filtrage par `regie_id`, `profile_id`, etc.)
- **Comment** : lecture, écriture, modification, suppression

### 2. Isolation par régie

Principe fondamental : **un utilisateur ne voit que les données de SA régie**.

```
Régie A                    Régie B
  ├─ Immeubles A             ├─ Immeubles B
  ├─ Logements A             ├─ Logements B
  ├─ Locataires A            ├─ Locataires B
  └─ Tickets A               └─ Tickets B
  
  ❌ Aucune fuite entre A et B
```

### 3. Rôles gérés

| Rôle | Accès |
|------|-------|
| **admin_jtec** | Accès global à toutes les données (super-admin) |
| **regie** | Accès à SA régie uniquement |
| **locataire** | Accès à SON logement et SES tickets |
| **entreprise** | Accès aux tickets selon autorisations (mode général/restreint) |
| **proprietaire** | Accès à SES biens |
| **technicien** | Accès aux tickets assignés |

---

## 🗂️ Structure créée

### Fichier : `supabase/schema/11_rls.sql`

Ce fichier contient **toutes les policies RLS** du système.

---

## 🛡️ Sécurisation table par table

### 1. Table `profiles`

**RLS activé** : ✅

**Policies** :
- ✅ `Users can view own profile` : user voit son propre profil
- ✅ `Users can update own profile` : user peut modifier son profil
- ✅ `Admin JTEC can manage all profiles` : admin_jtec voit tout

**Garanties** :
- ❌ Un user ne peut pas voir les profils des autres
- ❌ Aucun accès anonyme

---

### 2. Table `regies`

**RLS activé** : ✅

**Policies** :
- ✅ `Regie can view own regie` : régie voit sa propre fiche
- ✅ `Regie can update own regie` : régie peut modifier sa fiche
- ✅ `Regie can insert own regie` : régie peut s'inscrire
- ✅ `Admin JTEC can manage all regies` : admin_jtec voit toutes les régies

**Garanties** :
- ❌ Une régie ne peut pas voir les autres régies
- ✅ Isolation totale DEMO / PRO

---

### 3. Table `immeubles`

**RLS activé** : ✅

**Policies** :
- ✅ `Regie can view own immeubles` : filtre par `regie_id = get_user_regie_id()`
- ✅ `Regie can manage own immeubles` : CRUD complet
- ✅ `Admin JTEC can view all immeubles` : admin_jtec voit tout

**Fonction helper** :
```sql
get_user_regie_id()
```
Retourne la `regie_id` de l'utilisateur connecté, **sans récursion RLS** (`security definer`).

**Garanties** :
- ❌ Régie A ne voit pas les immeubles de Régie B
- ✅ Isolation stricte par `regie_id`

---

### 4. Table `logements`

**RLS activé** : ✅

**Policies** :
- ✅ `Regie can view own logements` : via `immeubles.regie_id`
- ✅ `Regie can manage own logements` : CRUD complet
- ✅ `Locataire can view own logement` : via `locataires.logement_id`
- ✅ `Admin JTEC can view all logements` : admin_jtec voit tout

**Garanties** :
- ❌ Locataire ne voit que SON logement
- ❌ Régie ne voit que SES logements

---

### 5. Table `locataires`

**RLS activé** : ✅

**Policies** :
- ✅ `Locataire can view own data` : filtre par `profile_id = auth.uid()`
- ✅ `Locataire can update own data` : mise à jour de ses propres données
- ✅ `Regie can view own locataires` : via `logements → immeubles.regie_id`
- ✅ `Regie can manage own locataires` : CRUD complet
- ✅ `Admin JTEC can view all locataires` : admin_jtec voit tout

**Garanties** :
- ❌ Locataire A ne voit pas les données de Locataire B
- ❌ Régie A ne voit pas les locataires de Régie B

---

### 6. Table `tickets`

**RLS activé** : ✅

**Policies** :
- ✅ `Locataire can view own tickets` : via `locataire_id`
- ✅ `Locataire can create own tickets` : insertion avec vérification `locataire_id`
- ✅ `Regie can view own tickets` : filtre par `regie_id = get_user_regie_id()`
- ✅ `Regie can manage own tickets` : CRUD complet
- ✅ `Entreprise can view assigned tickets` : selon **mode de diffusion** (général/restreint)
- ✅ `Admin JTEC can view all tickets` : admin_jtec voit tout

**Mode de diffusion entreprise** :
```sql
-- Mode général : tous les tickets ouverts
mode_diffusion = 'general' AND statut = 'ouvert'

-- Mode restreint : uniquement tickets assignés
mode_diffusion = 'restreint' AND entreprise_assignee_id = entreprise.id
```

**Garanties** :
- ❌ Locataire ne voit que SES tickets
- ❌ Régie ne voit que les tickets de SA régie
- ❌ Entreprise ne voit que les tickets autorisés

---

### 7. Table `entreprises`

**RLS activé** : ✅

**Policies** :
- ✅ `Entreprise can view own profile` : filtre par `profile_id = auth.uid()`
- ✅ `Entreprise can update own profile` : modification de son profil
- ✅ `Entreprise can insert own profile` : inscription
- ✅ `Regie can view authorized entreprises` : via `regies_entreprises`
- ✅ `Admin JTEC can view all entreprises` : admin_jtec voit tout

**Garanties** :
- ❌ Entreprise A ne voit pas le profil d'Entreprise B
- ✅ Régie voit uniquement les entreprises qu'elle a autorisées

---

### 8. Table `regies_entreprises`

**RLS activé** : ✅

**Policies** :
- ✅ `Regie can view own authorizations` : filtre par `regie_id = get_user_regie_id()`
- ✅ `Regie can create authorizations` : insertion avec vérification `regie_id`
- ✅ `Regie can update authorizations` : modification de ses autorisations
- ✅ `Regie can delete authorizations` : suppression de ses autorisations
- ✅ `Entreprise can view own authorizations` : via `entreprise_id`
- ✅ `Admin JTEC can view all authorizations` : admin_jtec voit tout

**Garanties** :
- ❌ Régie A ne peut pas modifier les autorisations de Régie B
- ✅ Entreprise voit les régies qui l'ont autorisée

---

## ⚙️ Fonction helper : `get_user_regie_id()`

### Pourquoi ?

Éviter la **récursion RLS** : les policies qui interrogent d'autres tables avec RLS activé peuvent créer des boucles infinies.

### Solution

Créer une fonction **`security definer`** qui exécute les requêtes avec les privilèges du créateur de la fonction (sans RLS).

### Code

```sql
create or replace function get_user_regie_id()
returns uuid
language sql
security definer  -- ← Évite récursion RLS
stable
as $$
  select regie_id from (
    -- Pour le rôle 'regie'
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Pour le rôle 'locataire'
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;
```

### Gère

- ✅ Rôle `regie` : retourne directement `regies.id`
- ✅ Rôle `locataire` : remonte via `locataires → logements → immeubles.regie_id`

---

## 🧪 Tests de validation

**Fichier** : `tests/rls.test.js`

### Résultats

✅ **41/41 tests réussis**

### Catégories testées

#### Activation RLS (8 tests)
1. ✅ RLS activé sur table profiles
2. ✅ RLS activé sur table regies
3. ✅ RLS activé sur table immeubles
4. ✅ RLS activé sur table logements
5. ✅ RLS activé sur table locataires
6. ✅ RLS activé sur table tickets
7. ✅ RLS activé sur table entreprises
8. ✅ RLS activé sur table regies_entreprises

#### Policies profiles (3 tests)
9. ✅ Policy : user peut voir son propre profile
10. ✅ Policy : user peut modifier son propre profile
11. ✅ Policy : admin_jtec peut tout sur profiles

#### Policies regies (3 tests)
12. ✅ Policy : regie peut voir sa propre régie
13. ✅ Policy : regie peut modifier sa propre régie
14. ✅ Policy : regie peut créer sa régie

#### Fonction helper (5 tests)
15. ✅ Fonction get_user_regie_id() existe
16. ✅ Fonction get_user_regie_id() retourne uuid
17. ✅ Fonction get_user_regie_id() est security definer
18. ✅ Fonction get_user_regie_id() gère le rôle regie
19. ✅ Fonction get_user_regie_id() gère le rôle locataire

#### Policies immeubles (2 tests)
20. ✅ Policy : regie voit ses immeubles
21. ✅ Policy : regie peut gérer ses immeubles

#### Policies logements (2 tests)
22. ✅ Policy : regie voit ses logements
23. ✅ Policy : locataire peut voir son logement

#### Policies locataires (2 tests)
24. ✅ Policy : locataire voit ses propres données
25. ✅ Policy : regie voit ses locataires

#### Policies tickets (4 tests)
26. ✅ Policy : locataire voit ses tickets
27. ✅ Policy : locataire peut créer des tickets
28. ✅ Policy : regie voit tous ses tickets
29. ✅ Policy : entreprise voit tickets selon mode diffusion

#### Policies entreprises (2 tests)
30. ✅ Policy : entreprise voit son propre profil
31. ✅ Policy : regie voit entreprises autorisées

#### Policies regies_entreprises (3 tests)
32. ✅ Policy : regie voit ses autorisations
33. ✅ Policy : regie peut créer des autorisations
34. ✅ Policy : entreprise voit régies qui l'ont autorisée

#### Admin JTEC (1 test)
35. ✅ Admin JTEC peut tout voir sur profiles

#### Performance (3 tests)
36. ✅ Index sur profiles.role pour performance
37. ✅ Index sur tickets.regie_id pour performance
38. ✅ Index sur locataires.profile_id pour performance

#### Sécurité globale (3 tests)
39. ✅ Pas d'accès anonyme : toutes les policies utilisent auth.uid()
40. ✅ Pas de récursion RLS : fonction helper est security definer
41. ✅ Admin JTEC peut tout voir sur toutes les tables

---

## 🎯 Critères de validation ÉTAPE 7

| Critère | Statut | Détails |
|---------|--------|---------|
| **RLS activé sur toutes les tables** | ✅ | 8 tables protégées |
| **Isolation DEMO / PRO** | ✅ | Filtre par `regie_id` |
| **Restrictions par rôle** | ✅ | Policies par rôle (admin, regie, locataire, entreprise) |
| **Aucun accès anonyme** | ✅ | Toutes les policies utilisent `auth.uid()` |
| **Aucun accès hors périmètre** | ✅ | Filtre strict par `regie_id`, `profile_id`, etc. |
| **Pas de récursion RLS** | ✅ | Fonction `get_user_regie_id()` avec `security definer` |
| **Admin JTEC : accès global** | ✅ | Policies admin sur toutes les tables |
| **Index de performance** | ✅ | Index sur colonnes clés (role, regie_id, profile_id) |
| **Tests automatisés** | ✅ | 41 tests passés |

---

## 🔒 Garanties de sécurité

### 1. Aucun accès anonyme

✅ **Toutes les policies** utilisent `auth.uid()`  
❌ Impossible d'accéder aux données sans authentification

### 2. Isolation stricte par régie

✅ Filtre systématique par `regie_id = get_user_regie_id()`  
❌ Régie A ne voit jamais les données de Régie B

### 3. Principe du moindre privilège

Chaque rôle a **exactement** les droits nécessaires :
- **Locataire** : son logement, ses tickets
- **Régie** : sa régie, ses immeubles, ses logements, ses locataires, ses tickets
- **Entreprise** : tickets autorisés (selon mode diffusion)
- **Admin JTEC** : tout

### 4. Pas de récursion RLS

✅ Fonction `get_user_regie_id()` avec `security definer`  
✅ Évite les boucles infinies dans les policies

### 5. Performance

✅ Index sur toutes les colonnes clés  
✅ Fonction `get_user_regie_id()` marquée `stable` (cache le résultat)

---

## 📊 Schéma des policies

```
UTILISATEUR ANONYME
  └─ ❌ Aucun accès (toutes les policies bloquent)

LOCATAIRE
  ├─ profiles : SON profil
  ├─ logements : SON logement
  ├─ locataires : SES données
  └─ tickets : SES tickets

RÉGIE
  ├─ profiles : SON profil
  ├─ regies : SA régie
  ├─ immeubles : SES immeubles
  ├─ logements : SES logements
  ├─ locataires : SES locataires
  ├─ tickets : SES tickets
  ├─ entreprises : entreprises AUTORISÉES
  └─ regies_entreprises : SES autorisations

ENTREPRISE
  ├─ profiles : SON profil
  ├─ entreprises : SON profil entreprise
  ├─ tickets : tickets AUTORISÉS (mode général/restreint)
  └─ regies_entreprises : régies qui l'ont AUTORISÉE

ADMIN JTEC
  └─ TOUT (super-admin)
```

---

## 🚀 Prochaine étape

**ÉTAPE 8** : Interface complète (dashboards, gestion, statistiques)

---

## 📝 Commandes de test

```bash
# Lancer les tests ÉTAPE 7
node tests/rls.test.js

# Résultat attendu
✅ 41/41 tests réussis
ÉTAPE 7 VALIDÉE
```

---

## 📅 Historique

- **ÉTAPE 0** : ✅ Initialisation (healthcheck, Supabase)
- **ÉTAPE 1** : ✅ Landing page multilingue
- **ÉTAPE 2** : ✅ Authentification (register, login, me)
- **ÉTAPE 3** : ✅ Profiles avec trigger automatique
- **ÉTAPE 4** : ✅ Structure immobilière (régies, immeubles, logements, locataires)
- **ÉTAPE 5** : ✅ Création de tickets par les locataires
- **ÉTAPE 6** : ✅ Diffusion des tickets aux entreprises
- **ÉTAPE 7** : ✅ **Row Level Security (RLS)** ⬅ ACTUEL
- **ÉTAPE 8** : 🔜 À venir

---

**✅ ÉTAPE 7 COMPLÈTE ET VALIDÉE**

**SÉCURITÉ MAXIMALE ACTIVÉE** 🔐
