# 🔍 ANALYSE CROISÉE - État réel BDD vs Migrations proposées

**Date** : 24 décembre 2025  
**Statut** : ⚠️ **INCOHÉRENCES DÉTECTÉES**

---

## 📋 ÉTAPE 1 : ANALYSE MIGRATION EXISTANTE

### Migration : `20251224000000_fix_logement_id_nullable.sql`

**Table modifiée** : `locataires`  
**Colonne modifiée** : `logement_id`  
**Action** : `ALTER COLUMN logement_id DROP NOT NULL`

**Objectif** :
> Permettre création de locataires SANS logement assigné immédiatement

**Impact sur le projet** :
- ✅ Concerne uniquement table `locataires`
- ✅ Aucun lien direct avec `logements` ou `immeubles`
- ✅ Ne modifie PAS `logements.immeuble_id` ni `logements.regie_id`

**Conclusion ÉTAPE 1** :
> ✅ Cette migration est **INDÉPENDANTE** des migrations proposées (logements/immeubles)

---

## 📊 ÉTAPE 2 : ÉTAT RÉEL DE LA BASE (Audit Supabase)

### Table `logements` - Colonnes actuelles

D'après `AUDIT_DB_COLUMNS.csv` (dernière extraction) :

| Colonne | Type | Nullable | Dans migration ? |
|---------|------|----------|------------------|
| id | uuid | NO | - |
| numero | text | NO | - |
| etage | integer | YES | - |
| superficie | numeric | YES | - |
| nombre_pieces | integer | YES | - |
| type_logement | text | YES | - |
| immeuble_id | uuid | **YES** | - |
| statut | text | YES | - |
| loyer_mensuel | numeric | YES | - |
| charges_mensuelles | numeric | YES | - |
| depot_garantie | numeric | YES | - |
| balcon | boolean | YES | - |
| parking | boolean | YES | - |
| cave | boolean | YES | - |
| meuble | boolean | YES | - |
| created_at | timestamp | YES | - |
| updated_at | timestamp | YES | - |
| photo_url | text | YES | - |
| regie_id | uuid | **NO** | - |
| **adresse** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **npa** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **ville** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **pays** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **orientation** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **annee_construction** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **annee_renovation** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **type_chauffage** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **description** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **proprietaire_id** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |

**Points importants** :
- ✅ `regie_id` **existe déjà** (NOT NULL) → ajouté par migration `20251223000100_logements_regie_id.sql`
- ✅ `immeuble_id` est **NULLABLE** → OK pour maisons individuelles
- ❌ **AUCUNE des 10 nouvelles colonnes n'existe encore**

### Table `immeubles` - Colonnes actuelles

D'après `AUDIT_DB_COLUMNS.csv` :

| Colonne | Type | Nullable | Dans migration ? |
|---------|------|----------|------------------|
| id | uuid | NO | - |
| nom | text | NO | - |
| adresse | text | NO | - |
| **code_postal** | **text** | **NO** | ⚠️ **À RENOMMER** |
| ville | text | NO | - |
| nombre_etages | integer | YES | - |
| annee_construction | integer | YES | - |
| regie_id | uuid | NO | - |
| type_chauffage | text | YES | - |
| ascenseur | boolean | YES | - |
| digicode | text | YES | - |
| interphone | boolean | YES | - |
| created_at | timestamp | YES | - |
| updated_at | timestamp | YES | - |
| photo_url | text | YES | - |
| **npa** | **N'EXISTE PAS** | - | ✅ **À CRÉER** (renommage) |
| **pays** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **type_immeuble** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **description** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |
| **proprietaire_id** | **N'EXISTE PAS** | - | ✅ **À AJOUTER** |

**Points importants** :
- ⚠️ `code_postal` **existe** (NOT NULL) → sera renommé en `npa`
- ❌ **AUCUNE des 4 nouvelles colonnes n'existe encore**

### Table `locataires` - Colonnes actuelles

| Colonne | Type | Nullable | Remarque |
|---------|------|----------|----------|
| logement_id | uuid | **NO** | ⚠️ Migration fix pas encore appliquée ? |
| regie_id | uuid | **NO** | ✅ Déjà présent |

**⚠️ INCOHÉRENCE DÉTECTÉE** :
- L'audit montre `logement_id` NOT NULL
- Mais migration `20251224000000_fix_logement_id_nullable.sql` doit le rendre NULLABLE
- **Hypothèse** : L'audit a été fait AVANT l'exécution de cette migration

---

## ✅ ÉTAPE 3 : VÉRIFICATION DOUBLONS

### Migration 1 : `20251224000001_logements_adresse_caracteristiques.sql`

**Colonnes à ajouter** : 10

| Colonne | Existe dans audit ? | Doublon ? | Action |
|---------|---------------------|-----------|--------|
| adresse | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| npa | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| ville | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| pays | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| orientation | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| annee_construction | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| annee_renovation | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| type_chauffage | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| description | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| proprietaire_id | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |

**Résultat** : ✅ **AUCUN DOUBLON**

### Migration 2 : `20251224000002_immeubles_npa_suisse_caracteristiques.sql`

**Colonnes à modifier/ajouter** : 5

| Colonne | Existe dans audit ? | Doublon ? | Action |
|---------|---------------------|-----------|--------|
| npa (renommage) | ✅ `code_postal` existe | ✅ Safe | RENAME COLUMN |
| pays | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| type_immeuble | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| description | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |
| proprietaire_id | ❌ | ✅ Safe | ADD COLUMN IF NOT EXISTS |

**Résultat** : ✅ **AUCUN DOUBLON**

---

## ⚠️ ÉTAPE 4 : ANALYSE CONFLITS

### Conflit 1 : AUCUN (tables différentes)

- Migration `20251224000000` → table `locataires`
- Migrations proposées → tables `logements` et `immeubles`
- **Conclusion** : ✅ Aucun conflit direct

### Conflit 2 : ORDRE D'EXÉCUTION (critique)

**Migration logements lit `immeubles.code_postal`** :

```sql
-- Ligne 97-103 de 20251224000001
UPDATE logements l
SET npa = i.code_postal  -- ⚠️ Utilise code_postal
FROM immeubles i
WHERE l.immeuble_id = i.id
  AND l.adresse IS NULL;
```

**Migration immeubles renomme `code_postal` → `npa`** :

```sql
-- Ligne 13 de 20251224000002
ALTER TABLE immeubles 
RENAME COLUMN code_postal TO npa;
```

**⚠️ DÉPENDANCE CRITIQUE** :
- Si immeubles exécuté EN PREMIER → `code_postal` n'existe plus
- Migration logements cherche `code_postal` → **ERREUR**

**Résultat** : 🔴 **ORDRE OBLIGATOIRE : LOGEMENTS → IMMEUBLES**

### Conflit 3 : Contrainte NPA (validé)

**Contrainte actuelle** (immeubles) :
```sql
CHECK (code_postal ~ '^[0-9]{5}$')  -- 5 chiffres français
```

**Nouvelle contrainte** (immeubles) :
```sql
CHECK (npa ~ '^[0-9]{4}$')  -- 4 chiffres suisse
```

**Action migration** :
```sql
DROP CONSTRAINT IF EXISTS check_code_postal;
ADD CONSTRAINT check_npa_format CHECK (npa ~ '^[0-9]{4}$');
```

**Résultat** : ✅ **Safe** (DROP avant ADD)

### Conflit 4 : Conversion destructive (documenté)

**Code dans migration immeubles** :
```sql
UPDATE immeubles
SET npa = LPAD(LEFT(npa, 4), 4, '0')
WHERE LENGTH(npa) = 5;
```

**Impact** :
- Codes postaux 5 chiffres → tronqués à 4 chiffres
- Exemple : `75001` → `7500`

**Résultat** : ⚠️ **Destructif mais documenté** (backup requis)

---

## 🎯 ÉTAPE 5 : DÉCISION FINALE

### ✅ OPTION A - OK TEL QUEL

**Décision** : 🟢 **MIGRATIONS VALIDÉES SANS MODIFICATION**

**Justification** :

1. ✅ **Aucun doublon détecté**
   - Toutes les colonnes à ajouter n'existent pas encore
   - `IF NOT EXISTS` protège de toute façon

2. ✅ **Aucun conflit avec migration existante**
   - `20251224000000` concerne `locataires` uniquement
   - Migrations proposées concernent `logements` et `immeubles`
   - Tables complètement différentes

3. ✅ **Ordre d'exécution validé**
   - LOGEMENTS → IMMEUBLES (obligatoire)
   - Dépendance `code_postal` gérée
   - Documenté dans guide

4. ✅ **Contraintes sécurisées**
   - DROP before ADD (safe)
   - IF NOT EXISTS partout
   - Conversion destructive documentée

5. ✅ **Migrations déjà corrigées**
   - NPA = NULL (au lieu '0000')
   - Appliqué dans `20251224000001`

**Conclusion** : **AUCUNE MODIFICATION NÉCESSAIRE**

---

## 📋 ÉTAPE 6 : ORDRE D'EXÉCUTION SÉCURISÉ

### 🔢 ORDRE OBLIGATOIRE

```
ÉTAPE 0 (Optionnel si pas déjà fait)
└─ 20251224000000_fix_logement_id_nullable.sql
   └─ Table : locataires
   └─ Action : logement_id NULLABLE

↓

ÉTAPE 1 (OBLIGATOIRE EN PREMIER)
└─ 20251224000001_logements_adresse_caracteristiques.sql
   ├─ Table : logements
   ├─ Action : +10 colonnes
   └─ ⚠️ LIT immeubles.code_postal (doit exister)

↓

ÉTAPE 2 (OBLIGATOIRE EN SECOND)
└─ 20251224000002_immeubles_npa_suisse_caracteristiques.sql
   ├─ Table : immeubles
   ├─ Action : code_postal → npa + 4 colonnes
   └─ ⚠️ RENOMME code_postal (doit être lu avant par étape 1)
```

### 🔍 JUSTIFICATION ORDRE

**Pourquoi LOGEMENTS avant IMMEUBLES ?**

1. **Dépendance de lecture** :
   ```sql
   -- Migration logements (ligne 97)
   UPDATE logements l
   SET npa = i.code_postal  -- ⚠️ Lecture ici
   FROM immeubles i
   ```

2. **Modification colonne** :
   ```sql
   -- Migration immeubles (ligne 13)
   RENAME COLUMN code_postal TO npa  -- ⚠️ Destruction ici
   ```

3. **Graphe de dépendances** :
   ```
   logements.UPDATE (lit) → immeubles.code_postal (existe)
   immeubles.RENAME → code_postal (détruit)
   
   Si ordre inversé:
   immeubles.RENAME → code_postal n'existe plus
   logements.UPDATE → ERROR: column "code_postal" does not exist
   ```

**Conclusion** : Ordre **CRITIQUE** et **NON INVERSIBLE**

---

## ✅ VÉRIFICATIONS POST-MIGRATION

### Après ÉTAPE 1 (Logements)

```sql
-- Vérifier 10 nouvelles colonnes
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'logements' 
AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                    'annee_construction', 'annee_renovation', 'type_chauffage', 
                    'description', 'proprietaire_id');
-- Résultat attendu : 10
```

### Après ÉTAPE 2 (Immeubles)

```sql
-- Vérifier renommage
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'immeubles' 
AND column_name IN ('code_postal', 'npa');
-- Résultat attendu : 1 ligne (npa uniquement)

-- Vérifier 4 nouvelles colonnes
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'immeubles' 
AND column_name IN ('pays', 'type_immeuble', 'description', 'proprietaire_id');
-- Résultat attendu : 4
```

### Vérification cohérence totale

```sql
-- Migration logs
SELECT COUNT(*) 
FROM migration_logs 
WHERE migration_name LIKE '20251224%';
-- Résultat attendu : 3 (fix_logement_id + logements + immeubles)

-- Contraintes NPA
SELECT COUNT(*) 
FROM pg_constraint 
WHERE conname = 'check_npa_format';
-- Résultat attendu : 2 (logements + immeubles)
```

---

## 🎉 CONCLUSION FINALE

### ✅ VALIDATION COMPLÈTE

**Décision** : 🟢 **OPTION A - OK TEL QUEL**

**Résumé** :
- ✅ Migration existante analysée : `locataires.logement_id` NULLABLE
- ✅ Audit Supabase croisé : aucun doublon détecté
- ✅ Nouvelles migrations validées : 0 conflit
- ✅ Ordre d'exécution critique : LOGEMENTS → IMMEUBLES
- ✅ Vérifications automatisées : requêtes SQL fournies

**État de la base après migrations** :

```
Table logements :
  - Colonnes existantes : 19
  - Nouvelles colonnes : +10
  - Total : 29 colonnes
  - Format suisse : NPA 4 chiffres

Table immeubles :
  - Colonnes existantes : 15
  - Renommage : code_postal → npa
  - Nouvelles colonnes : +4
  - Total : 19 colonnes
  - Format suisse : NPA 4 chiffres

Table locataires :
  - logement_id : NULLABLE (migration 20251224000000)
  - Aucun impact des nouvelles migrations
```

### 🚀 PRÊT POUR EXÉCUTION

**Documents à suivre** :
1. [MIGRATIONS_QUICK_START.md](../MIGRATIONS_QUICK_START.md) - 2 min chrono
2. [GUIDE_EXECUTION_MIGRATIONS.md](./GUIDE_EXECUTION_MIGRATIONS_LOGEMENTS_IMMEUBLES.md) - Pas à pas
3. [VALIDATION_POST_MIGRATION.sql](../supabase/migrations/VALIDATION_POST_MIGRATION.sql) - Requêtes SQL

**Commandes** :
```bash
# Backup
CREATE TABLE logements_backup_20251224 AS SELECT * FROM logements;
CREATE TABLE immeubles_backup_20251224 AS SELECT * FROM immeubles;

# Migration 1
# Copier-coller : supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql

# Migration 2
# Copier-coller : supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql
```

---

**✅ AUCUNE MODIFICATION NÉCESSAIRE - EXÉCUTION SÉCURISÉE**
