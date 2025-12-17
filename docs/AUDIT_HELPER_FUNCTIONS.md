# AUDIT GLOBAL - Fonction get_user_regie_id() Manquante

**Date** : 2025-12-17  
**Erreur** : `ERROR: 42883: function get_user_regie_id() does not exist`  
**Contexte** : Exécution des migrations SQL dans Supabase

---

## 🚨 CAUSE RACINE

### Problème Identifié

**Fonction utilisée AVANT sa définition** :

```
10_techniciens.sql (ligne 224)
  └─ Policy: "Regie can view techniciens"
     └─ USING: regies_entreprises.regie_id = get_user_regie_id()  ❌

12_missions.sql (lignes 197, 246)
  └─ Policy: "Regie can view missions"
     └─ USING: i.regie_id = get_user_regie_id()                   ❌

17_rls.sql (ligne 113)
  └─ CREATE FUNCTION get_user_regie_id()                          ✅ Définie ICI
```

**Ordre d'exécution** :
1. `10_techniciens.sql` → Tente d'utiliser `get_user_regie_id()` → ❌ **ERREUR**
2. `12_missions.sql` → Tente d'utiliser `get_user_regie_id()` → ❌ **ERREUR**
3. `17_rls.sql` → Définit `get_user_regie_id()` → ✅ (trop tard)

---

## 📊 INVENTAIRE COMPLET

### Utilisations de `get_user_regie_id()`

| Fichier | Ligne | Type | Contexte | Statut |
|---------|-------|------|----------|--------|
| `10_techniciens.sql` | 224 | POLICY | `Regie can view techniciens` | ❌ Fonction non définie |
| `12_missions.sql` | 197 | POLICY | `Regie can view missions for own tickets` | ❌ Fonction non définie |
| `12_missions.sql` | 246 | POLICY | `Regie can update missions for own tickets` | ❌ Fonction non définie |
| **`17_rls.sql`** | **113** | **FONCTION** | **Définition** | ✅ Créé ici |
| `17_rls.sql` | 141 | POLICY | `Regie can view own immeubles` | ✅ Après définition |
| `17_rls.sql` | 146 | POLICY | `Regie can manage own immeubles` | ✅ Après définition |
| `17_rls.sql` | 170, 181, 229, 241 | POLICY | Logements | ✅ Après définition |
| `17_rls.sql` | 285, 290 | POLICY | Locataires | ✅ Après définition |
| `17_rls.sql` | 354 | POLICY | Entreprises | ✅ Après définition |
| `17_rls.sql` | 381, 386, 391, 396 | POLICY | Tickets | ✅ Après définition |

**Total** : 18 utilisations  
**Problématiques** : 3 utilisations (positions 10, 12) AVANT définition (position 17)

---

## 🔍 DÉFINITION DE LA FONCTION

### Localisation

**Fichier** : `17_rls.sql` (ligne 113)  
**Ordre d'exécution** : Position 17

### Code Actuel

```sql
create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    -- Pour le rôle 'regie', prendre directement depuis regies
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Pour le rôle 'locataire', remonter via logements → immeubles
    select i.regie_id
    from locataires l
    join logements lg on lg.id = l.logement_id
    join immeubles i on i.id = lg.immeuble_id
    where l.profile_id = auth.uid()
    
    limit 1
  ) as user_regie;
$$;
```

### Dépendances de la Fonction

| Table | Utilisée Pour | Créée en |
|-------|---------------|----------|
| `regies` | Récupérer ID pour rôle 'regie' | 05 |
| `locataires` | Récupérer ID pour rôle 'locataire' | 08 |
| `logements` | Navigation locataire → immeuble | 07 |
| `immeubles` | Navigation logement → régie | 06 |
| `auth.uid()` | Utilisateur connecté | Supabase |

✅ **Toutes les dépendances sont créées AVANT 17** → La fonction peut être définie plus tôt.

---

## ✅ SOLUTIONS POSSIBLES

### Option 1 : Déplacer la Fonction en Position 5 ⭐ RECOMMANDÉ

**Principe** : Créer la fonction immédiatement après les tables de base.

**Nouveau fichier** : `05b_helper_functions.sql` (ou intégrer dans `05_regies.sql`)

**Avantages** :
- ✅ Fonction disponible pour toutes les policies ultérieures
- ✅ Ordre logique : Tables → Helpers → Policies
- ✅ Pas besoin de dupliquer la logique

**Inconvénients** :
- ⚠️ Nécessite un nouveau fichier ou modification de 05

---

### Option 2 : Remplacer par Sous-Requêtes Inline

**Principe** : Ne pas utiliser de fonction helper, dupliquer la logique partout.

**Exemple dans 10_techniciens.sql** :
```sql
-- Au lieu de :
using (
  exists (
    select 1 from regies_entreprises
    where regies_entreprises.regie_id = get_user_regie_id()
  )
)

-- Utiliser :
using (
  exists (
    select 1 from regies_entreprises
    where regies_entreprises.regie_id = (
      select id from regies where profile_id = auth.uid()
      union
      select i.regie_id
      from locataires l
      join logements lg on lg.id = l.logement_id
      join immeubles i on i.id = lg.immeuble_id
      where l.profile_id = auth.uid()
      limit 1
    )
  )
)
```

**Avantages** :
- ✅ Pas de dépendance fonction
- ✅ Chaque policy autonome

**Inconvénients** :
- ❌ Code dupliqué (18 fois)
- ❌ Difficile à maintenir
- ❌ Risque d'incohérence

---

### Option 3 : Créer la Fonction dans Chaque Fichier Concerné

**Principe** : Définir `get_user_regie_id()` dans 10, 12, et 17.

**Avantages** :
- ✅ Fonction toujours disponible

**Inconvénients** :
- ❌ Redondance (3 fois)
- ❌ Risque de divergence
- ❌ Pas idiomatique SQL

---

## 🎯 SOLUTION RETENUE : Option 1

### Justification

- ✅ **Maintenabilité** : Une seule définition
- ✅ **Réutilisabilité** : Disponible partout
- ✅ **Ordre logique** : Fonction créée après ses dépendances (regies, immeubles, logements, locataires)
- ✅ **Performance** : Fonction `STABLE` + `SECURITY DEFINER` optimale

### Plan d'Exécution

#### Étape 1 : Créer `06_helper_functions.sql`

Nouveau fichier inséré **AVANT** les premières policies.

**Contenu** :
```sql
/**
 * FONCTIONS HELPER
 * 
 * Fonctions utilitaires utilisées par les policies RLS
 * À exécuter APRÈS la création des tables de base (01-05)
 * 
 * Ordre d'exécution : 6
 */

-- =====================================================
-- Fonction : Récupérer la regie_id de l'utilisateur
-- =====================================================

create or replace function get_user_regie_id()
returns uuid
language sql
security definer
stable
as $$
  select regie_id from (
    -- Pour le rôle 'regie', prendre directement depuis regies
    select r.id as regie_id
    from regies r
    where r.profile_id = auth.uid()
    
    union
    
    -- Pour le rôle 'locataire', remonter via logements → immeubles
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

#### Étape 2 : Renommer les Fichiers 06-22 → 07-23

Pour faire de la place à `06_helper_functions.sql` :

| Ancien | Nouveau |
|--------|---------|
| `06_immeubles.sql` | `07_immeubles.sql` |
| `07_logements.sql` | `08_logements.sql` |
| `08_locataires.sql` | `09_locataires.sql` |
| `09_entreprises.sql` | `10_entreprises.sql` |
| `10_techniciens.sql` | `11_techniciens.sql` |
| `11_tickets.sql` | `12_tickets.sql` |
| `12_missions.sql` | `13_missions.sql` |
| `13_intervention.sql` | `14_intervention.sql` |
| `14_facturation.sql` | `15_facturation.sql` |
| `15_messagerie.sql` | `16_messagerie.sql` |
| `16_views.sql` | `17_views.sql` |
| `17_rls.sql` | `18_rls.sql` |
| `18_storage.sql` | `19_storage.sql` |
| `19_admin.sql` | `20_admin.sql` |
| `20_abonnements.sql` | `21_abonnements.sql` |
| `21_statuts_realignement.sql` | `22_statuts_realignement.sql` |
| `22_trigger_prevent_escalation.sql` | `23_trigger_prevent_escalation.sql` |

#### Étape 3 : Supprimer `get_user_regie_id()` de 18_rls.sql

Dans le nouveau `18_rls.sql` (ancien 17), supprimer les lignes 113-135 (définition de la fonction).

**Garder** :
- ✅ Toutes les policies utilisant la fonction (lignes 141+)

**Supprimer** :
- ❌ La définition `create or replace function get_user_regie_id()` (lignes 113-135)
- ❌ Le commentaire `comment on function get_user_regie_id` (ligne 440)

**Ajouter** :
- ✅ Note : "La fonction get_user_regie_id() est définie dans 06_helper_functions.sql"

#### Étape 4 : Mettre à Jour les Commentaires "Ordre d'exécution"

Mettre à jour le numéro dans chaque fichier renommé :
- `07_immeubles.sql` : `Ordre d'exécution : 7` (était 6)
- `08_logements.sql` : `Ordre d'exécution : 8` (était 7)
- ...
- `23_trigger_prevent_escalation.sql` : `Ordre d'exécution : 23` (était 22)

---

## 📋 ORDRE FINAL CORRECT

### Tables & Fonctions (01-09)

```
✅ 01_extensions.sql           → Extensions PostgreSQL
✅ 02_enums.sql                → Types ENUM
✅ 04_users.sql                → Table profiles
✅ 05_regies.sql               → Table regies
🆕 06_helper_functions.sql     → Fonction get_user_regie_id() ← NOUVEAU
🔄 07_immeubles.sql            → Table immeubles (était 06)
🔄 08_logements.sql            → Table logements (était 07)
🔄 09_locataires.sql           → Table locataires (était 08)
```

### Tables Métier (10-16)

```
🔄 10_entreprises.sql          → Tables entreprises (était 09)
🔄 11_techniciens.sql          → Table techniciens (était 10)
🔄 12_tickets.sql              → Table tickets (était 11)
🔄 13_missions.sql             → Table missions (était 12)
🔄 14_intervention.sql         → Interventions (était 13)
🔄 15_facturation.sql          → Factures (était 14)
🔄 16_messagerie.sql           → Messages (était 15)
```

### Vues & Configuration (17-23)

```
🔄 17_views.sql                → Vues métier (était 16)
🔄 18_rls.sql                  → Row Level Security (était 17, SANS get_user_regie_id)
🔄 19_storage.sql              → Storage (était 18)
🔄 20_admin.sql                → Fonctions admin (était 19)
🔄 21_abonnements.sql          → Abonnements (était 20)
🔄 22_statuts_realignement.sql → Statuts (était 21)
🔄 23_trigger_prevent_escalation.sql → Triggers (était 22)
```

---

## 🔍 VÉRIFICATION DES DÉPENDANCES

### Dépendances de `get_user_regie_id()` (position 6)

| Dépendance | Table | Position | Statut |
|------------|-------|----------|--------|
| `regies.profile_id` | regies | 05 | ✅ Créé AVANT (05) |
| `locataires.profile_id` | locataires | 09 | ❌ Créé APRÈS (09) |
| `logements.id` | logements | 08 | ❌ Créé APRÈS (08) |
| `immeubles.regie_id` | immeubles | 07 | ❌ Créé APRÈS (07) |
| `auth.uid()` | Supabase | - | ✅ Toujours disponible |

⚠️ **PROBLÈME** : La fonction nécessite `locataires`, `logements`, `immeubles` qui sont créées APRÈS.

### 🚨 RÉVISION : Déplacer en Position 9b

La fonction **NE PEUT PAS** être créée en position 6 car elle dépend de tables créées en 07, 08, 09.

**Nouvelle position** : `09b_helper_functions.sql` (après locataires)

---

## 🎯 SOLUTION CORRIGÉE : Position 9b

### Nouveau Plan

#### Créer `09b_helper_functions.sql`

Inséré **APRÈS** `09_locataires.sql` (ancien 08).

**Dépendances satisfaites** :
- ✅ `regies` (05)
- ✅ `immeubles` (07)
- ✅ `logements` (08)
- ✅ `locataires` (09)

#### Renommer 09-22 → 10-23

| Ancien | Nouveau |
|--------|---------|
| `09_entreprises.sql` | `10_entreprises.sql` |
| `10_techniciens.sql` | `11_techniciens.sql` |
| `11_tickets.sql` | `12_tickets.sql` |
| `12_missions.sql` | `13_missions.sql` |
| ... | ... |
| `22_trigger_prevent_escalation.sql` | `23_trigger_prevent_escalation.sql` |

---

## 📊 VÉRIFICATION FINALE

### get_user_regie_id() Position 09b

| Utilisation | Fichier | Position | get_user_regie_id() Position | Statut |
|-------------|---------|----------|------------------------------|--------|
| Définition | `09b_helper_functions.sql` | **09b** | **09b** | ✅ Créé ici |
| Policy techniciens | `11_techniciens.sql` | 11 | 09b | ✅ Créé AVANT (09b) |
| Policy missions | `13_missions.sql` | 13 | 09b | ✅ Créé AVANT (09b) |
| Policies RLS | `18_rls.sql` | 18 | 09b | ✅ Créé AVANT (09b) |

✅ **Toutes les utilisations sont APRÈS la définition**

---

## 🔎 AUTRES FONCTIONS HELPER

### Inventaire Complet

| Fonction | Fichier | Position | Utilisations |
|----------|---------|----------|--------------|
| `get_user_technicien_id()` | `11_techniciens.sql` | 11 | Aucune avant 11 ✅ |
| `set_ticket_regie_id()` | `12_tickets.sql` | 12 | Trigger dans 12 ✅ |
| `get_user_regie_id()` | `09b_helper_functions.sql` | **09b** | **Utilisée en 11, 13, 18** ✅ |

✅ **Toutes les fonctions sont définies AVANT leur utilisation** (après correction)

---

## ✅ CHECKLIST DE VALIDATION

- [ ] Créer `09b_helper_functions.sql` avec `get_user_regie_id()`
- [ ] Renommer `09_entreprises.sql` → `10_entreprises.sql`
- [ ] Renommer `10_techniciens.sql` → `11_techniciens.sql`
- [ ] Renommer `11_tickets.sql` → `12_tickets.sql`
- [ ] Renommer `12_missions.sql` → `13_missions.sql`
- [ ] Renommer `13-22` → `14-23` (10 fichiers)
- [ ] Supprimer définition `get_user_regie_id` de `18_rls.sql` (lignes 113-135, 440)
- [ ] Ajouter note dans `18_rls.sql` : "Fonction définie dans 09b"
- [ ] Mettre à jour "Ordre d'exécution" dans tous les fichiers renommés
- [ ] Vérifier `grep "get_user_regie_id()" 01-09` → Aucun résultat
- [ ] Vérifier `grep "create.*function get_user_regie_id" 09b` → 1 résultat
- [ ] Vérifier `grep "create.*function get_user_regie_id" 18` → 0 résultat
- [ ] Commit Git avec message descriptif
- [ ] Test exécution : 01-23 sans erreur

---

## 📝 GARANTIES FINALES

Après correction :

- ✅ **Toutes les fonctions définies AVANT utilisation**
- ✅ **Ordre logique** : Tables → Helpers → Policies
- ✅ **Une seule définition** : Pas de duplication
- ✅ **Dépendances satisfaites** : regies, immeubles, logements, locataires créés AVANT 09b
- ✅ **Exécution A→Z sans erreur** : 23 migrations testables

---

**PROCHAINE ACTION** : Appliquer les corrections (création 09b + renommages)
