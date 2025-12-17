# AUDIT COMPLET - Dépendances Circulaires SQL

**Date** : 2025-12-17  
**Erreur** : `ERROR: 42P01: relation "tickets" does not exist` dans `09_entreprises.sql` ligne 113

---

## 🚨 CAUSE RACINE

### Problème Principal

**Dépendance circulaire** créée par les **VUES** :

```
09_entreprises.sql (ligne 102-127)
  └─ Vue: tickets_visibles_entreprise
     └─ FROM tickets t  ❌ ERROR (tickets n'existe pas encore)
     
10_techniciens.sql (ligne 280-327, 333-365)
  └─ Vue: planning_technicien
     └─ JOIN tickets tk  ❌ ERROR
  └─ Vue: missions_non_assignees  
     └─ JOIN tickets tk  ❌ ERROR

11_tickets.sql
  └─ CREATE TABLE tickets  ← Créé ICI seulement
```

### Architecture du Problème

```
TABLES :
  09_entreprises.sql → CREATE TABLE entreprises ✅
  10_techniciens.sql → CREATE TABLE techniciens ✅
  11_tickets.sql     → CREATE TABLE tickets     ✅
  
VUES (dépendent de tickets) :
  09_entreprises.sql → tickets_visibles_entreprise ❌ (AVANT tickets)
  10_techniciens.sql → planning_technicien         ❌ (AVANT tickets)
  10_techniciens.sql → missions_non_assignees      ❌ (AVANT tickets)
```

---

## 📊 INVENTAIRE COMPLET DES RÉFÉRENCES À `tickets`

### Références AVANT la création de tickets (09-10)

| Fichier | Ligne | Type | Élément | Statut |
|---------|-------|------|---------|--------|
| `09_entreprises.sql` | 102 | VUE | `tickets_visibles_entreprise` | ❌ CASSÉ |
| `10_techniciens.sql` | 280 | VUE | `planning_technicien` | ❌ CASSÉ |
| `10_techniciens.sql` | 333 | VUE | `missions_non_assignees` | ❌ CASSÉ |

### Références APRÈS la création de tickets (11+)

| Fichier | Ligne | Type | Élément | Statut |
|---------|-------|------|---------|--------|
| `11_tickets.sql` | 16 | TABLE | `CREATE TABLE tickets` | ✅ OK |
| `11_tickets.sql` | 115 | VUE | `tickets_complets` | ✅ OK |
| `12_missions.sql` | 27 | FK | `ticket_id` | ✅ OK |
| `14_facturation.sql` | 151 | SELECT | Fonction | ✅ OK |
| `15_messagerie.sql` | 104 | JOIN | Vue | ✅ OK |
| `18_admin.sql` | 74+ | VUE | Statistiques | ✅ OK |
| `20_statuts_realignement.sql` | 104+ | VUE | Vues métier | ✅ OK |

---

## ✅ SOLUTION : Séparer Tables et Vues

### Principe

1. **Créer TOUTES les tables d'abord** (sans vues)
2. **Créer les vues APRÈS** dans des fichiers dédiés

### Nouveau Découpage

```
PHASE 1 : TABLES (01-11)
  01_extensions.sql
  02_enums.sql
  04_users.sql           → profiles
  05_regies.sql          → regies (table uniquement)
  06_immeubles.sql       → immeubles
  07_logements.sql       → logements
  08_locataires.sql      → locataires
  09_entreprises.sql     → entreprises + regies_entreprises (tables uniquement)
  10_techniciens.sql     → techniciens (table uniquement)
  11_tickets.sql         → tickets (table uniquement)
  
PHASE 2 : RELATIONS (12-15)
  12_missions.sql        → missions
  13_intervention.sql    → interventions
  14_facturation.sql     → factures
  15_messagerie.sql      → messages + notifications
  
PHASE 3 : VUES & METADATA (16-22)
  16_views.sql           → TOUTES les vues métier ← NOUVEAU
  17_rls.sql             → Row Level Security
  18_storage.sql         → Storage buckets
  19_admin.sql           → Fonctions admin + vues admin
  20_abonnements.sql     → Abonnements
  21_statuts_realignement.sql → Statuts + vues
  22_trigger_prevent_escalation.sql → Triggers
```

---

## 🔧 CORRECTIONS À APPLIQUER

### Correction 1 : 09_entreprises.sql

**Supprimer la vue `tickets_visibles_entreprise` (lignes 96-127)**

```sql
-- ❌ À SUPPRIMER (lignes 96-127)
-- ============================================================
-- VUE : Tickets visibles par entreprise
-- ============================================================

create or replace view tickets_visibles_entreprise as
select 
  t.*,
  re.entreprise_id,
  ...
from tickets t  -- ❌ tickets n'existe pas encore
...
```

**Nouveau contenu** : S'arrêter après le trigger `set_updated_at_regies_entreprises` (ligne 95)

---

### Correction 2 : 10_techniciens.sql

**Supprimer les vues dépendant de tickets (lignes 280-365)**

```sql
-- ❌ À SUPPRIMER (lignes 280-327)
create or replace view planning_technicien as
...
join tickets tk on m.ticket_id = tk.id  -- ❌

-- ❌ À SUPPRIMER (lignes 333-365)
create or replace view missions_non_assignees as
...
join tickets tk on m.ticket_id = tk.id  -- ❌
```

**Nouveau contenu** : S'arrêter après la section RLS (ligne ~270)

---

### Correction 3 : 11_tickets.sql

**Conserver uniquement la table (lignes 1-95)**

```sql
-- ✅ CONSERVER
create table if not exists tickets (...);
-- Contraintes
-- Index
-- Triggers

-- ❌ SUPPRIMER la vue tickets_complets (lignes 115-133)
create or replace view tickets_complets as
...
```

---

### Correction 4 : Créer 16_views.sql (NOUVEAU)

**Regrouper toutes les vues métier**

```sql
/**
 * VUES MÉTIER
 * 
 * Toutes les vues dépendant de plusieurs tables
 * À exécuter APRÈS la création de toutes les tables (01-15)
 * 
 * Ordre d'exécution : 16
 */

-- ============================================================
-- VUE : Tickets complets
-- ============================================================

create or replace view tickets_complets as
select 
  t.*,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.email as locataire_email,
  log.numero as logement_numero,
  log.etage as logement_etage,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id;

comment on view tickets_complets is 'Vue enrichie des tickets avec toutes les informations liées';

-- ============================================================
-- VUE : Tickets visibles par entreprise
-- ============================================================

create or replace view tickets_visibles_entreprise as
select 
  t.*,
  re.entreprise_id,
  re.mode_diffusion,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
from tickets t
join regies_entreprises re on t.regie_id = re.regie_id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies reg on t.regie_id = reg.id
where 
  (re.mode_diffusion = 'general' and t.statut = 'ouvert')
  or
  (re.mode_diffusion = 'restreint' and t.entreprise_id = re.entreprise_id);

comment on view tickets_visibles_entreprise is 'Tickets visibles par chaque entreprise selon les autorisations';

-- ============================================================
-- VUE : Planning technicien
-- ============================================================

create or replace view planning_technicien as
select 
  m.*,
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  e.nom as entreprise_nom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.code_postal as immeuble_code_postal,
  imm.ville as immeuble_ville,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone
from missions m
left join techniciens t on m.technicien_id = t.id
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is not null;

comment on view planning_technicien is 'Planning des techniciens avec toutes les informations nécessaires';

-- ============================================================
-- VUE : Missions non assignées
-- ============================================================

create or replace view missions_non_assignees as
select 
  m.*,
  e.nom as entreprise_nom,
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  loc.telephone as locataire_telephone
from missions m
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is null;

comment on view missions_non_assignees is 'Missions en attente d affectation à un technicien';
```

---

### Correction 5 : Renommer fichiers suivants

| Ancien | Nouveau | Raison |
|--------|---------|--------|
| `16_rls.sql` | `17_rls.sql` | Décalage pour 16_views.sql |
| `17_storage.sql` | `18_storage.sql` | Décalage |
| `18_admin.sql` | `19_admin.sql` | Décalage |
| `19_abonnements.sql` | `20_abonnements.sql` | Décalage |
| `20_statuts_realignement.sql` | `21_statuts_realignement.sql` | Décalage |
| `21_trigger_prevent_escalation.sql` | `22_trigger_prevent_escalation.sql` | Décalage |

---

## 📋 ORDRE FINAL CORRECT

```
✅ 01_extensions.sql
✅ 02_enums.sql
✅ 04_users.sql
✅ 05_regies.sql
✅ 06_immeubles.sql
✅ 07_logements.sql
✅ 08_locataires.sql
🔄 09_entreprises.sql (CORRIGER : supprimer vue)
🔄 10_techniciens.sql (CORRIGER : supprimer vues)
🔄 11_tickets.sql (CORRIGER : supprimer vue)
✅ 12_missions.sql
✅ 13_intervention.sql
✅ 14_facturation.sql
✅ 15_messagerie.sql
🆕 16_views.sql (CRÉER : regrouper toutes les vues)
🔄 17_rls.sql (ancien 16)
🔄 18_storage.sql (ancien 17)
🔄 19_admin.sql (ancien 18)
🔄 20_abonnements.sql (ancien 19)
🔄 21_statuts_realignement.sql (ancien 20)
🔄 22_trigger_prevent_escalation.sql (ancien 21)
```

---

## 🎯 PLAN D'EXÉCUTION

### Étape 1 : Nettoyer les vues anticipées

- [x] Identifier toutes les vues dans 09, 10, 11
- [ ] Supprimer les vues de 09_entreprises.sql (lignes 96-127)
- [ ] Supprimer les vues de 10_techniciens.sql (lignes 280-365)
- [ ] Supprimer la vue de 11_tickets.sql (lignes 115-133)

### Étape 2 : Créer fichier vues

- [ ] Créer 16_views.sql avec toutes les vues métier
- [ ] Ajouter tickets_complets (depuis 11)
- [ ] Ajouter tickets_visibles_entreprise (depuis 09)
- [ ] Ajouter planning_technicien (depuis 10)
- [ ] Ajouter missions_non_assignees (depuis 10)

### Étape 3 : Renommer fichiers

- [ ] Renommer 16→17, 17→18, 18→19, 19→20, 20→21, 21→22
- [ ] Mettre à jour commentaires "Ordre d'exécution"

### Étape 4 : Vérification

- [ ] Grep : aucune référence à tickets avant 11
- [ ] Grep : toutes les vues sont dans 16+
- [ ] Test exécution : 01-22 sans erreur

---

## 🔍 VÉRIFICATIONS DE COHÉRENCE

### Checkpoint 1 : Tables pures (01-11)

```bash
# Vérifier qu'il n'y a QUE des CREATE TABLE dans 01-11
for file in supabase/schema/{01..11}_*.sql; do
  if grep -q "create.*view" "$file"; then
    echo "❌ VUE trouvée dans $file"
  fi
done
```

### Checkpoint 2 : Vues après tables (16+)

```bash
# Vérifier que toutes les vues sont dans 16+
grep -l "create.*view" supabase/schema/*.sql | sort
# Résultat attendu : 16_views.sql, 19_admin.sql, 21_statuts_realignement.sql
```

### Checkpoint 3 : Ordre des FK

```bash
# Vérifier que toutes les FK pointent vers des tables créées AVANT
grep -h "references" supabase/schema/*.sql | sort | uniq
```

---

## ✅ GARANTIES FINALES

Après corrections :

- ✅ **Zéro vue anticipée** : Toutes les vues créées APRÈS leurs dépendances
- ✅ **Tables d'abord** : 01-15 = tables uniquement
- ✅ **Vues ensuite** : 16+ = vues + config
- ✅ **Ordre idempotent** : Exécution A→Z sans erreur
- ✅ **Structure claire** : Séparation logique tables/vues

---

**PROCHAINE ACTION** : Appliquer les corrections 1-5
