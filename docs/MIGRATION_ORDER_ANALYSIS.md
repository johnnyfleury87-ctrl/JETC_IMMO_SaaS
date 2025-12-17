# Analyse Ordre des Migrations SQL - Résolution Dépendances

**Date** : 2025-12-17  
**Contexte** : Erreur `ERROR: 42P01: relation "entreprises" does not exist` lors de l'exécution de `09_tickets.sql`

---

## 🚨 Problème Identifié

### Erreur Rencontrée

```
Fichier : 09_tickets.sql (ligne 31)
Erreur  : ERROR: 42P01: relation "entreprises" does not exist
Code    : entreprise_id uuid references entreprises(id) on delete set null,
```

### Cause Racine

**Ordre d'exécution incorrect** : `09_tickets.sql` est exécuté **AVANT** `10_entreprises.sql`, alors qu'il référence la table `entreprises` via une clé étrangère.

---

## 📊 Graphe de Dépendances Actuel

### Structure Hiérarchique des Tables

```
01_extensions.sql
02_enums.sql
04_users.sql → profiles
05_regies.sql → profiles
06_immeubles.sql → regies
07_logements.sql → immeubles
08_locataires.sql → logements
09_tickets.sql → logements, locataires, ❌ entreprises, ❌ techniciens
10_entreprises.sql → profiles
11_rls.sql
12_storage.sql
13_admin.sql
14_missions.sql → tickets, entreprises
15_techniciens.sql → entreprises
16_intervention.sql
17_facturation.sql → missions, entreprises, regies
18_messagerie.sql → missions, tickets
19_abonnements.sql
20_statuts_realignement.sql
21_trigger_prevent_escalation.sql
```

### Problèmes Détectés

| Table Source | Ligne | Référence | Table Cible | Statut |
|--------------|-------|-----------|-------------|--------|
| **tickets** (09) | 31 | `entreprise_id` | `entreprises` (10) | ❌ **CASSÉ** |
| **tickets** (09) | 32 | `technicien_id` | `techniciens` (15) | ❌ **CASSÉ** |
| **missions** (14) | 27 | `ticket_id` | `tickets` (09) | ✅ OK |
| **missions** (14) | 28 | `entreprise_id` | `entreprises` (10) | ✅ OK |
| **techniciens** (15) | 22 | `entreprise_id` | `entreprises` (10) | ✅ OK |
| **facturation** (17) | 25 | `mission_id` | `missions` (14) | ✅ OK |
| **messagerie** (18) | 22 | `mission_id` | `missions` (14) | ✅ OK |
| **messagerie** (18) | 69 | `related_ticket_id` | `tickets` (09) | ✅ OK |

---

## 🔍 Analyse des Références

### Fichier `09_tickets.sql`

```sql
-- Ligne 26-32 : Déclaration de la table
create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text not null,
  
  -- Relations
  logement_id uuid not null references logements(id) on delete cascade,     ✅ OK (07)
  locataire_id uuid not null references locataires(id) on delete cascade,   ✅ OK (08)
  regie_id uuid not null,                                                    ✅ OK (calculé)
  
  -- Assignation (nullable tant que pas assigné)
  entreprise_id uuid references entreprises(id) on delete set null,         ❌ ERREUR (10)
  technicien_id uuid references techniciens(id) on delete set null,         ❌ ERREUR (15)
  ...
);
```

### Nature des Colonnes Problématiques

- **`entreprise_id`** : `NULL` par défaut, assigné quand un ticket est accepté par une entreprise
- **`technicien_id`** : `NULL` par défaut, assigné quand un technicien prend en charge le ticket

**Constat** : Ces colonnes sont **optionnelles** (nullable) et ne sont pas utilisées lors de la création du ticket.

---

## ✅ Solutions Possibles

### Option 1 : Réorganiser l'Ordre des Migrations ⭐ RECOMMANDÉ

**Principe** : Créer `entreprises` et `techniciens` **AVANT** `tickets`.

#### Nouvel Ordre Proposé

```
01_extensions.sql      ✅ Extensions PostgreSQL
02_enums.sql           ✅ Types ENUM
04_users.sql           ✅ Table profiles
05_regies.sql          ✅ Table regies
06_immeubles.sql       ✅ Table immeubles
07_logements.sql       ✅ Table logements
08_locataires.sql      ✅ Table locataires
10_entreprises.sql     🔄 DÉPLACÉ AVANT tickets (table entreprises + regies_entreprises)
15_techniciens.sql     🔄 DÉPLACÉ AVANT tickets (table techniciens)
09_tickets.sql         🔄 DÉPLACÉ APRÈS entreprises/techniciens
14_missions.sql        ✅ Table missions (dépend de tickets + entreprises)
16_intervention.sql    ✅ Interventions
17_facturation.sql     ✅ Facturation
18_messagerie.sql      ✅ Messagerie
11_rls.sql             ✅ Row Level Security policies
12_storage.sql         ✅ Storage buckets
13_admin.sql           ✅ Fonctions admin
19_abonnements.sql     ✅ Abonnements
20_statuts_realignement.sql ✅ Statuts
21_trigger_prevent_escalation.sql ✅ Trigger escalation
```

#### Renommage Nécessaire

| Ancien Nom | Nouveau Nom | Contenu |
|------------|-------------|---------|
| `09_tickets.sql` | `11_tickets.sql` | Table tickets |
| `10_entreprises.sql` | `09_entreprises.sql` | Table entreprises + regies_entreprises |
| `11_rls.sql` | `16_rls.sql` | Row Level Security |
| `12_storage.sql` | `17_storage.sql` | Storage buckets |
| `13_admin.sql` | `18_admin.sql` | Fonctions admin |
| `14_missions.sql` | `12_missions.sql` | Table missions |
| `15_techniciens.sql` | `10_techniciens.sql` | Table techniciens |
| `16_intervention.sql` | `13_intervention.sql` | Interventions |
| `17_facturation.sql` | `14_facturation.sql` | Facturation |
| `18_messagerie.sql` | `15_messagerie.sql` | Messagerie |
| `19_abonnements.sql` | `19_abonnements.sql` | Identique |
| `20_statuts_realignement.sql` | `20_statuts_realignement.sql` | Identique |
| `21_trigger_prevent_escalation.sql` | `21_trigger_prevent_escalation.sql` | Identique |

---

### Option 2 : Contraintes Différées (Alternative)

**Principe** : Créer d'abord les tables sans FK, puis ajouter les contraintes après.

#### Étapes

1. **09_tickets.sql** : Créer table sans `entreprise_id` et `technicien_id`
2. **10_entreprises.sql** : Créer table `entreprises`
3. **15_techniciens.sql** : Créer table `techniciens`
4. **22_tickets_fk.sql** : Ajouter les colonnes + FK manquantes

```sql
-- 22_tickets_fk.sql
alter table tickets 
  add column if not exists entreprise_id uuid references entreprises(id) on delete set null;

alter table tickets 
  add column if not exists technicien_id uuid references techniciens(id) on delete set null;

create index if not exists idx_tickets_entreprise_id on tickets(entreprise_id);
create index if not exists idx_tickets_technicien_id on tickets(technicien_id);
```

**Inconvénients** :
- ❌ Structure fragmentée sur 2 fichiers
- ❌ Confusion dans la documentation
- ❌ Ordre artificiel

---

### Option 3 : Rendre les FK Optionnelles (Non Recommandé)

**Principe** : Supprimer les FK et gérer l'intégrité côté application.

**Raison du rejet** : Perte de l'intégrité référentielle garantie par PostgreSQL.

---

## 🎯 Solution Retenue : Option 1

### Justification

✅ **Ordre logique** : Respecte les dépendances métier  
✅ **Lisibilité** : Chaque fichier contient une structure complète  
✅ **Maintenabilité** : Ordre chronologique clair  
✅ **Performance** : Création des index en même temps que les FK  
✅ **Intégrité** : Contraintes référentielles garanties dès la création

### Plan de Migration

#### Phase 1 : Renommage des Fichiers

```bash
# Sauvegarder l'ordre actuel
ls -1 supabase/schema/*.sql > migration_order_backup.txt

# Renommer dans l'ordre inverse (pour éviter les collisions)
mv supabase/schema/21_trigger_prevent_escalation.sql supabase/schema/21_trigger_prevent_escalation.sql.bak
mv supabase/schema/20_statuts_realignement.sql supabase/schema/20_statuts_realignement.sql.bak
mv supabase/schema/19_abonnements.sql supabase/schema/19_abonnements.sql.bak
mv supabase/schema/18_messagerie.sql supabase/schema/15_messagerie.sql
mv supabase/schema/17_facturation.sql supabase/schema/14_facturation.sql
mv supabase/schema/16_intervention.sql supabase/schema/13_intervention.sql
mv supabase/schema/15_techniciens.sql supabase/schema/10_techniciens.sql
mv supabase/schema/14_missions.sql supabase/schema/12_missions.sql
mv supabase/schema/13_admin.sql supabase/schema/18_admin.sql
mv supabase/schema/12_storage.sql supabase/schema/17_storage.sql
mv supabase/schema/11_rls.sql supabase/schema/16_rls.sql
mv supabase/schema/10_entreprises.sql supabase/schema/09_entreprises.sql
mv supabase/schema/09_tickets.sql supabase/schema/11_tickets.sql

# Restaurer les .bak
mv supabase/schema/21_trigger_prevent_escalation.sql.bak supabase/schema/21_trigger_prevent_escalation.sql
mv supabase/schema/20_statuts_realignement.sql.bak supabase/schema/20_statuts_realignement.sql
mv supabase/schema/19_abonnements.sql.bak supabase/schema/19_abonnements.sql
```

#### Phase 2 : Mise à Jour des Commentaires

Chaque fichier renommé doit mettre à jour son commentaire `Ordre d'exécution :`.

**Exemple** :

```sql
-- 09_entreprises.sql (ancien 10)
/**
 * Ordre d'exécution : 9 (modifié depuis 10)
 */

-- 11_tickets.sql (ancien 09)
/**
 * Ordre d'exécution : 11 (modifié depuis 09)
 */
```

#### Phase 3 : Vérification des Dépendances

Exécuter un script de validation :

```bash
#!/bin/bash
# validate-dependencies.sh

echo "🔍 Vérification des dépendances SQL..."

# Extraire toutes les FK
grep -h "references" supabase/schema/*.sql | sort | uniq

# Vérifier l'ordre
for file in supabase/schema/*.sql; do
  echo "📄 $(basename $file)"
  grep -o "references [a-z_]*(" "$file" | sort | uniq
done
```

---

## 📋 Ordre Final Recommandé

### Dépendances Hiérarchiques

```
Niveau 0 : Fondations
├─ 01_extensions.sql
├─ 02_enums.sql
└─ 04_users.sql (profiles)

Niveau 1 : Entités Principales
├─ 05_regies.sql (→ profiles)
└─ 06_immeubles.sql (→ regies)

Niveau 2 : Entités Logement
├─ 07_logements.sql (→ immeubles)
└─ 08_locataires.sql (→ logements)

Niveau 3 : Entreprises & Techniciens
├─ 09_entreprises.sql (→ profiles, regies)
└─ 10_techniciens.sql (→ entreprises)

Niveau 4 : Tickets & Missions
├─ 11_tickets.sql (→ logements, locataires, entreprises, techniciens)
└─ 12_missions.sql (→ tickets, entreprises)

Niveau 5 : Modules Métier
├─ 13_intervention.sql
├─ 14_facturation.sql (→ missions, entreprises, regies)
└─ 15_messagerie.sql (→ missions, tickets)

Niveau 6 : Sécurité & Configuration
├─ 16_rls.sql
├─ 17_storage.sql
├─ 18_admin.sql
├─ 19_abonnements.sql
├─ 20_statuts_realignement.sql
└─ 21_trigger_prevent_escalation.sql
```

---

## 🔧 Script de Renommage Automatique

```bash
#!/bin/bash
# rename-migrations.sh

set -e

echo "🔄 Renommage des migrations SQL..."

# Tableau associatif : ancien_nom → nouveau_nom
declare -A RENAMES=(
  ["09_tickets.sql"]="11_tickets.sql"
  ["10_entreprises.sql"]="09_entreprises.sql"
  ["11_rls.sql"]="16_rls.sql"
  ["12_storage.sql"]="17_storage.sql"
  ["13_admin.sql"]="18_admin.sql"
  ["14_missions.sql"]="12_missions.sql"
  ["15_techniciens.sql"]="10_techniciens.sql"
  ["16_intervention.sql"]="13_intervention.sql"
  ["17_facturation.sql"]="14_facturation.sql"
  ["18_messagerie.sql"]="15_messagerie.sql"
)

# Créer répertoire temporaire
TEMP_DIR="supabase/schema/temp_rename"
mkdir -p "$TEMP_DIR"

# Phase 1 : Copier dans temp avec nouveaux noms
for old_name in "${!RENAMES[@]}"; do
  new_name="${RENAMES[$old_name]}"
  echo "  $old_name → $new_name"
  cp "supabase/schema/$old_name" "$TEMP_DIR/$new_name"
done

# Phase 2 : Supprimer anciens fichiers
for old_name in "${!RENAMES[@]}"; do
  rm "supabase/schema/$old_name"
done

# Phase 3 : Déplacer depuis temp
mv "$TEMP_DIR"/* supabase/schema/
rmdir "$TEMP_DIR"

echo "✅ Renommage terminé"
echo ""
echo "📋 Nouvel ordre :"
ls -1 supabase/schema/*.sql
```

---

## 🧪 Tests de Validation

### Test 1 : Ordre des Dépendances

```bash
# Extraire l'ordre des CREATE TABLE
grep -h "create table" supabase/schema/*.sql | grep -v "if not exists" | sort

# Extraire l'ordre des REFERENCES
grep -h "references" supabase/schema/*.sql | awk '{print $NF}' | sort | uniq
```

### Test 2 : Simulation Exécution

```bash
# Exécuter dans un ordre différent (pour tester)
for file in supabase/schema/{01..21}_*.sql; do
  echo "🔧 Exécution : $(basename $file)"
  # psql -f "$file" (en mode dry-run)
done
```

### Test 3 : Vérification Intégrité

```sql
-- Après exécution de toutes les migrations
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;
```

---

## 📊 Impact de la Correction

### Avant (❌ Ordre Cassé)

```
05_regies     ✅ OK
06_immeubles  ✅ OK
07_logements  ✅ OK
08_locataires ✅ OK
09_tickets    ❌ ERROR: relation "entreprises" does not exist
10_entreprises (jamais exécuté)
...
```

### Après (✅ Ordre Correct)

```
05_regies          ✅ OK
06_immeubles       ✅ OK
07_logements       ✅ OK
08_locataires      ✅ OK
09_entreprises     ✅ OK (nouveau)
10_techniciens     ✅ OK (nouveau)
11_tickets         ✅ OK (ancien 09, maintenant avec toutes les FK)
12_missions        ✅ OK
...
```

---

## 🎯 Prochaines Étapes

1. ✅ **Valider l'analyse** : Relire ce document
2. 🔄 **Exécuter le script** : `./rename-migrations.sh`
3. 📝 **Mettre à jour les commentaires** : Modifier `Ordre d'exécution :` dans chaque fichier
4. 🧪 **Tester** : Exécuter les migrations dans le nouvel ordre
5. 📚 **Documenter** : Mettre à jour `MIGRATION_ARCHITECTURE_OPTION1.md`
6. 🚀 **Déployer** : Exécuter dans Supabase SQL Editor

---

## 📝 Checklist de Migration

- [ ] Backup des fichiers actuels (`cp -r supabase/schema supabase/schema_backup`)
- [ ] Exécution du script de renommage
- [ ] Mise à jour des commentaires `Ordre d'exécution :`
- [ ] Vérification `grep "Ordre d'exécution" supabase/schema/*.sql`
- [ ] Test de validation des dépendances
- [ ] Exécution des migrations dans Supabase (01 → 21)
- [ ] Vérification finale `SELECT * FROM information_schema.tables`
- [ ] Commit Git avec message descriptif

---

**Auteur** : GitHub Copilot  
**Date** : 2025-12-17  
**Statut** : ✅ Analyse terminée - En attente d'exécution
