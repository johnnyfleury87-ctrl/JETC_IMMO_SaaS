# 🔍 AUDIT PRE-MIGRATION - LOGEMENTS & IMMEUBLES

**Date** : 24 décembre 2025  
**Auditeur** : GitHub Copilot  
**Statut** : ⚠️ **CORRECTIONS CRITIQUES NÉCESSAIRES**

---

## 🎯 OBJECTIF

Valider les 2 migrations SQL avant exécution en production :
1. `20251224000001_logements_adresse_caracteristiques.sql`
2. `20251224000002_immeubles_npa_suisse_caracteristiques.sql`

---

## 📊 ÉTAPE 1 : AUDIT STRUCTURE ACTUELLE

### Table `logements` - État actuel

**Fichier** : `/supabase/schema/07_logements.sql`

```sql
CREATE TABLE logements (
  id uuid PRIMARY KEY,
  numero text NOT NULL,
  etage int,
  superficie numeric(6,2),
  nombre_pieces int,
  type_logement text,
  
  -- ⚠️ ATTENTION : Migration 20251223000100 a déjà modifié
  immeuble_id uuid REFERENCES immeubles(id),  -- NULLABLE maintenant
  regie_id uuid NOT NULL REFERENCES regies(id),  -- AJOUTÉ récemment
  
  statut text DEFAULT 'vacant',
  loyer_mensuel numeric(10,2),
  charges_mensuelles numeric(10,2),
  depot_garantie numeric(10,2),
  
  balcon boolean DEFAULT false,
  parking boolean DEFAULT false,
  cave boolean DEFAULT false,
  meuble boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes actuelles** :
```sql
CONSTRAINT check_statut CHECK (statut IN ('vacant', 'occupé', 'en_travaux'))
CONSTRAINT check_superficie CHECK (superficie > 0 OR superficie IS NULL)
CONSTRAINT check_nombre_pieces CHECK (nombre_pieces > 0 OR nombre_pieces IS NULL)
CONSTRAINT check_loyer CHECK (loyer_mensuel >= 0 OR loyer_mensuel IS NULL)
CONSTRAINT check_charges CHECK (charges_mensuelles >= 0 OR charges_mensuelles IS NULL)
CONSTRAINT unique_logement_numero_immeuble UNIQUE(numero, immeuble_id)
```

**Index actuels** :
```sql
idx_logements_immeuble_id
idx_logements_statut
idx_logements_numero
idx_logements_regie_id  -- AJOUTÉ récemment par migration 20251223000100
```

### Table `immeubles` - État actuel

**Fichier** : `/supabase/schema/06_immeubles.sql`

```sql
CREATE TABLE immeubles (
  id uuid PRIMARY KEY,
  nom text NOT NULL,
  adresse text NOT NULL,
  code_postal text NOT NULL,  -- ⚠️ 5 CHIFFRES ACTUELLEMENT
  ville text NOT NULL,
  nombre_etages int DEFAULT 0,
  annee_construction int,
  
  regie_id uuid NOT NULL REFERENCES regies(id) ON DELETE CASCADE,
  
  type_chauffage text,
  ascenseur boolean DEFAULT false,
  digicode text,
  interphone boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes actuelles** :
```sql
CONSTRAINT check_nombre_etages CHECK (nombre_etages >= 0)
CONSTRAINT check_annee_construction CHECK (annee_construction >= 1800 AND annee_construction <= EXTRACT(year FROM now()) OR annee_construction IS NULL)
CONSTRAINT check_code_postal CHECK (code_postal ~ '^[0-9]{5}$')  -- ⚠️ FORMAT FRANÇAIS
```

**Index actuels** :
```sql
idx_immeubles_regie_id
idx_immeubles_ville
idx_immeubles_code_postal  -- ⚠️ À RENOMMER
idx_immeubles_nom
```

---

## ⚠️ ÉTAPE 2 : PROBLÈMES CRITIQUES IDENTIFIÉS

### 🔴 MIGRATION LOGEMENTS - Problèmes

#### 1. Conflit avec contrainte `unique_logement_numero_immeuble`

**Problème** :
```sql
-- Migration actuelle essaie :
UPDATE logements
SET adresse = 'À renseigner', npa = '0000', ville = 'À renseigner'
WHERE immeuble_id IS NULL AND adresse IS NULL;
```

**Risque** :
- La contrainte `UNIQUE(numero, immeuble_id)` existe
- Pour maisons individuelles (`immeuble_id` NULL), **plusieurs logements peuvent avoir le même `numero`** si `immeuble_id` est NULL
- PostgreSQL traite NULL comme valeur distincte dans UNIQUE
- **AUCUN PROBLÈME ICI** ✅

#### 2. Migration données : `immeubles.code_postal` utilisé

**Problème** :
```sql
UPDATE logements l
SET npa = i.code_postal  -- ⚠️ code_postal n'existe plus après migration immeubles
FROM immeubles i
WHERE l.immeuble_id = i.id;
```

**Risque** :
- Si migration **immeubles** exécutée **AVANT** logements → colonne `code_postal` n'existe plus
- Si migration **logements** exécutée **AVANT** immeubles → colonne `npa` pas encore remplie dans logements mais OK pour immeubles

**❌ ORDRE CRITIQUE : Logements AVANT Immeubles**

#### 3. Valeur par défaut '0000' dangereuse

**Problème** :
```sql
UPDATE logements SET npa = '0000' WHERE immeuble_id IS NULL;
```

**Risque** :
- Contrainte : `CHECK (npa ~ '^[0-9]{4}$')` → '0000' est valide ✅
- **MAIS** : NPA 0000 n'existe pas en Suisse
- **RECOMMANDATION** : Mettre NULL ou forcer saisie manuelle

### 🔴 MIGRATION IMMEUBLES - Problèmes

#### 1. Renommage colonne avec contraintes

**Problème** :
```sql
ALTER TABLE immeubles RENAME COLUMN code_postal TO npa;
DROP CONSTRAINT IF EXISTS check_code_postal;
ADD CONSTRAINT check_npa_format CHECK (npa ~ '^[0-9]{4}$');
```

**Risque** :
- ✅ Renommage : SAFE (PostgreSQL renomme aussi dans FK, index, vues)
- ⚠️ **Contrainte** : L'ancienne contrainte `check_code_postal` référence la colonne
- PostgreSQL **ne met PAS à jour** automatiquement le nom dans la contrainte
- Il faut `DROP` puis `ADD` → **OK dans migration** ✅

#### 2. Conversion NPA 5 → 4 chiffres DESTRUCTIVE

**Problème** :
```sql
UPDATE immeubles
SET npa = LPAD(LEFT(npa, 4), 4, '0')
WHERE LENGTH(npa) = 5;
```

**Risque MAJEUR** :
- Code postal français : `75001` (Paris)
- Après conversion : `7500`
- **PERTE DE DONNÉE IRRÉVERSIBLE** ❌

**Solution** :
- Si données françaises en production → **backup obligatoire**
- Si données test → acceptable
- Recommandation : Vérifier données existantes **AVANT** migration

#### 3. Index `idx_immeubles_code_postal` supprimé/recréé

**Problème** :
```sql
DROP INDEX IF EXISTS idx_immeubles_code_postal;
CREATE INDEX IF NOT EXISTS idx_immeubles_npa ON immeubles(npa);
```

**Risque** :
- Pendant DROP/CREATE → **lock table temporaire**
- Si table volumineuse → impact performance
- **SOLUTION** : Utiliser `CREATE INDEX CONCURRENTLY` (mais pas dans transaction)

---

## ✅ ÉTAPE 3 : VALIDATION SÉCURITÉ MIGRATIONS

### Migration LOGEMENTS - Sécurité

| Critère | Statut | Détail |
|---------|--------|--------|
| IF NOT EXISTS | ✅ | Toutes les colonnes utilisent `IF NOT EXISTS` |
| Contraintes CHECK | ✅ | Formats validés (NPA 4 chiffres, années 1800-2100) |
| Données existantes | ⚠️ | Copie depuis `immeubles.code_postal` → nécessite ordre |
| Valeurs par défaut | ⚠️ | '0000' invalide en Suisse → préférer NULL |
| Nullable | ✅ | `proprietaire_id` nullable, autres appropriés |
| RLS impact | ✅ | Aucun impact (colonnes simples) |

### Migration IMMEUBLES - Sécurité

| Critère | Statut | Détail |
|---------|--------|--------|
| Renommage colonne | ✅ | PostgreSQL renomme automatiquement les FK |
| IF NOT EXISTS | ✅ | Nouvelles colonnes protégées |
| Contraintes CHECK | ✅ | DROP ancienne, ADD nouvelle |
| Données existantes | 🔴 | **Conversion 5→4 DESTRUCTIVE** |
| Index renommage | ⚠️ | DROP/CREATE cause lock temporaire |
| RLS impact | ✅ | Aucun impact |

---

## 🛠️ ÉTAPE 4 : ORDRE D'EXÉCUTION SÉCURISÉ

### ✅ ORDRE RECOMMANDÉ

```
1️⃣ Migration LOGEMENTS (20251224000001)
   → Copie code_postal depuis immeubles (colonne existe encore)
   → Ajoute colonnes adresse/npa/ville/caractéristiques

2️⃣ Migration IMMEUBLES (20251224000002)
   → Renomme code_postal → npa
   → Adapte contraintes format suisse
   → Ajoute colonnes type/description/pays
```

### ❌ ORDRE INVERSE (DANGEREUX)

Si immeubles **avant** logements :
```
1️⃣ Migration IMMEUBLES
   → Renomme code_postal → npa
   
2️⃣ Migration LOGEMENTS
   → ❌ ERREUR : immeubles.code_postal n'existe plus
   → Requête UPDATE échoue
```

### 🔍 JUSTIFICATION

**Pourquoi logements AVANT immeubles ?**

1. Migration logements utilise `immeubles.code_postal` pour copier données
2. Migration immeubles **renomme** `code_postal` → `npa`
3. Si immeubles exécuté en premier, logements ne trouve plus la colonne
4. **Dépendance de lecture** : logements lit immeubles.code_postal

**Graphe de dépendances** :
```
logements (lecture) → immeubles.code_postal (doit exister)
immeubles (modification) → renomme code_postal → npa
```

---

## 📋 ÉTAPE 5 : MIGRATIONS CORRIGÉES FINALES

### Option A : Migrations sécurisées avec backup

Si données production existantes :

```sql
-- AVANT migration immeubles
CREATE TABLE IF NOT EXISTS immeubles_backup_npa AS 
SELECT id, code_postal FROM immeubles;
```

### Option B : Migration logements corrigée (valeurs NULL)

Remplacer :
```sql
-- ❌ ANCIEN
UPDATE logements
SET npa = '0000', ville = 'À renseigner'
WHERE immeuble_id IS NULL AND adresse IS NULL;
```

Par :
```sql
-- ✅ NOUVEAU
UPDATE logements
SET adresse = 'Non renseigné', 
    npa = NULL,  -- NULL plutôt que '0000' invalide
    ville = 'Non renseigné',
    pays = 'Suisse'
WHERE immeuble_id IS NULL AND adresse IS NULL;
```

---

## ⚙️ ÉTAPE 6 : INSTRUCTIONS D'EXÉCUTION

### Pré-requis

1. **Backup obligatoire** :
```sql
-- Sauvegarder tables avant migration
pg_dump --table=logements --table=immeubles > backup_pre_migration.sql
```

2. **Vérifier données existantes** :
```sql
-- Compter logements/immeubles
SELECT COUNT(*) FROM logements;
SELECT COUNT(*) FROM immeubles;

-- Vérifier codes postaux français (5 chiffres)
SELECT COUNT(*), LENGTH(code_postal) 
FROM immeubles 
GROUP BY LENGTH(code_postal);
```

### Exécution via Supabase SQL Editor

**Méthode 1 : Copier-coller SQL**

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard)
2. Aller dans **SQL Editor**
3. Créer nouvelle requête
4. Copier contenu de `20251224000001_logements_adresse_caracteristiques.sql` (CORRIGÉ)
5. Exécuter
6. Vérifier résultat
7. Répéter pour `20251224000002_immeubles_npa_suisse_caracteristiques.sql`

**Méthode 2 : Via CLI Supabase**

```bash
# Depuis workspace
cd /workspaces/JETC_IMMO_SaaS

# Exécuter migration 1
supabase db push --file supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql

# Vérifier succès avant migration 2
supabase db execute "SELECT column_name FROM information_schema.columns WHERE table_name='logements' AND column_name IN ('adresse','npa','ville');"

# Exécuter migration 2
supabase db push --file supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql
```

---

## ✅ ÉTAPE 7 : VALIDATION POST-MIGRATION

### 1. Vérifier colonnes ajoutées

```sql
-- LOGEMENTS : Vérifier nouvelles colonnes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'logements'
  AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                      'annee_construction', 'annee_renovation', 'type_chauffage', 
                      'description', 'proprietaire_id')
ORDER BY ordinal_position;
```

**Résultat attendu** :
```
column_name         | data_type | is_nullable | column_default
--------------------|-----------|-------------|---------------
adresse             | text      | YES         | NULL
npa                 | text      | YES         | NULL
ville               | text      | YES         | NULL
pays                | text      | YES         | 'Suisse'
orientation         | text      | YES         | NULL
annee_construction  | integer   | YES         | NULL
annee_renovation    | integer   | YES         | NULL
type_chauffage      | text      | YES         | NULL
description         | text      | YES         | NULL
proprietaire_id     | uuid      | YES         | NULL
```

```sql
-- IMMEUBLES : Vérifier renommage + nouvelles colonnes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('npa', 'pays', 'type_immeuble', 'description', 'proprietaire_id')
ORDER BY ordinal_position;
```

**Résultat attendu** :
```
column_name      | data_type | is_nullable | column_default
-----------------|-----------|-------------|---------------
npa              | text      | NO          | NULL
pays             | text      | YES         | 'Suisse'
type_immeuble    | text      | YES         | NULL
description      | text      | YES         | NULL
proprietaire_id  | uuid      | YES         | NULL
```

### 2. Vérifier contraintes

```sql
-- LOGEMENTS : Contraintes CHECK
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'logements'::regclass
  AND conname IN ('check_npa_format', 'check_annee_construction', 'check_annee_renovation');
```

**Résultat attendu** :
```
conname                  | pg_get_constraintdef
-------------------------|---------------------------------------------
check_npa_format         | CHECK (npa IS NULL OR npa ~ '^[0-9]{4}$')
check_annee_construction | CHECK (annee_construction IS NULL OR ...)
check_annee_renovation   | CHECK (annee_renovation IS NULL OR ...)
```

```sql
-- IMMEUBLES : Contrainte NPA
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'immeubles'::regclass
  AND conname = 'check_npa_format';
```

**Résultat attendu** :
```
conname           | pg_get_constraintdef
------------------|------------------------------------
check_npa_format  | CHECK (npa ~ '^[0-9]{4}$')
```

### 3. Vérifier index

```sql
-- LOGEMENTS : Index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'logements'
  AND indexname IN ('idx_logements_npa', 'idx_logements_ville', 'idx_logements_proprietaire_id');
```

**Résultat attendu** :
```
indexname                      | indexdef
-------------------------------|-------------------------------------
idx_logements_npa              | CREATE INDEX ... ON logements(npa)
idx_logements_ville            | CREATE INDEX ... ON logements(ville)
idx_logements_proprietaire_id  | CREATE INDEX ... ON logements(proprietaire_id)
```

```sql
-- IMMEUBLES : Index renommé
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'immeubles'
  AND indexname IN ('idx_immeubles_npa', 'idx_immeubles_proprietaire_id');
```

**Résultat attendu** :
```
indexname                       | indexdef
--------------------------------|--------------------------------------
idx_immeubles_npa               | CREATE INDEX ... ON immeubles(npa)
idx_immeubles_proprietaire_id   | CREATE INDEX ... ON immeubles(proprietaire_id)
```

### 4. Vérifier migration_logs

```sql
SELECT migration_name, description, executed_at
FROM migration_logs
WHERE migration_name LIKE '20251224%'
ORDER BY executed_at DESC;
```

**Résultat attendu** :
```
migration_name                                 | description                          | executed_at
-----------------------------------------------|--------------------------------------|------------------------
20251224000002_immeubles_npa_suisse_...        | Adaptation format NPA suisse...      | 2025-12-24 14:30:00
20251224000001_logements_adresse_caract...     | Ajout colonnes adresse + caract...   | 2025-12-24 14:29:00
```

### 5. Vérifier données migrées

```sql
-- Logements : Compter adresses renseignées
SELECT 
  COUNT(*) AS total_logements,
  COUNT(adresse) AS logements_avec_adresse,
  COUNT(npa) AS logements_avec_npa,
  COUNT(CASE WHEN immeuble_id IS NULL THEN 1 END) AS maisons_individuelles
FROM logements;
```

```sql
-- Immeubles : Vérifier NPA format suisse
SELECT 
  COUNT(*) AS total_immeubles,
  COUNT(CASE WHEN npa ~ '^[0-9]{4}$' THEN 1 END) AS npa_format_suisse,
  COUNT(CASE WHEN LENGTH(npa) = 5 THEN 1 END) AS npa_format_francais
FROM immeubles;
```

**Résultat attendu** :
- `npa_format_francais` = 0 (tous convertis)

---

## 🧪 ÉTAPE 8 : TESTS FONCTIONNELS

### Test 1 : Créer logement avec adresse complète

```javascript
// Depuis /regie/logements.html
const logementData = {
  numero: 'Test Migration',
  type_logement: 'T3',
  adresse: '12 rue du Test',
  npa: '1003',
  ville: 'Lausanne',
  pays: 'Suisse',
  statut: 'vacant',
  regie_id: '<VOTRE_REGIE_ID>'
};

// Créer via formulaire ou Supabase
const { data, error } = await supabase
  .from('logements')
  .insert(logementData)
  .select();
```

**✅ Succès attendu** : Logement créé avec adresse complète

### Test 2 : Créer immeuble avec NPA 4 chiffres

```javascript
// Depuis /regie/immeubles.html
const immeubleData = {
  nom: 'Test NPA Migration',
  adresse: '50 avenue Test',
  npa: '1000',
  ville: 'Lausanne',
  pays: 'Suisse',
  nombre_etages: 5,
  regie_id: '<VOTRE_REGIE_ID>'
};

const { data, error } = await supabase
  .from('immeubles')
  .insert(immeubleData)
  .select();
```

**✅ Succès attendu** : Immeuble créé avec NPA suisse

### Test 3 : Créer immeuble + logements automatiques

1. Ouvrir `/regie/immeubles.html`
2. Remplir formulaire complet
3. ✅ Cocher "Créer les logements maintenant"
4. Spécifier : 5 logements
5. Créer

**✅ Succès attendu** :
- Immeuble créé
- 5 logements créés avec adresse copiée
- NPA format suisse (4 chiffres)

---

## 📊 CHECKLIST VALIDATION FINALE

### ✅ Avant migration

- [ ] Backup tables `logements` et `immeubles` effectué
- [ ] Comptage données existantes documenté
- [ ] Vérification codes postaux (5 vs 4 chiffres)
- [ ] Migrations corrigées (NULL au lieu '0000')
- [ ] Ordre confirmé : LOGEMENTS → IMMEUBLES

### ✅ Pendant migration

- [ ] Migration logements exécutée sans erreur
- [ ] Messages NOTICE validés dans console
- [ ] Migration immeubles exécutée sans erreur
- [ ] Aucun lock prolongé détecté

### ✅ Après migration

- [ ] Colonnes `logements` : adresse, npa, ville, pays, orientation, annee_construction, annee_renovation, type_chauffage, description, proprietaire_id
- [ ] Colonne `immeubles` : npa (renommé), pays, type_immeuble, description, proprietaire_id
- [ ] Contraintes CHECK actives (NPA 4 chiffres)
- [ ] Index créés (npa, ville, proprietaire_id)
- [ ] `migration_logs` contient les 2 migrations
- [ ] Données migrées (adresses copiées depuis immeubles)
- [ ] Format NPA : 100% à 4 chiffres

### ✅ Tests fonctionnels

- [ ] Création logement avec adresse OK
- [ ] Création immeuble avec NPA OK
- [ ] Création immeuble + logements automatiques OK
- [ ] Affichage formulaires OK (champs visibles)
- [ ] Validation NPA 4 chiffres fonctionne

---

## 🎯 DÉCISION FINALE

### ⚠️ CORRECTIONS REQUISES AVANT EXÉCUTION

**Fichier** : `20251224000001_logements_adresse_caracteristiques.sql`

**Ligne 120-125** : Remplacer
```sql
UPDATE logements
SET 
  adresse = 'À renseigner',
  npa = '0000',  -- ❌ INVALIDE
  ville = 'À renseigner',
  pays = 'Suisse'
WHERE immeuble_id IS NULL
  AND adresse IS NULL;
```

Par :
```sql
UPDATE logements
SET 
  adresse = 'Non renseigné',
  npa = NULL,  -- ✅ NULL plutôt que '0000'
  ville = 'Non renseigné',
  pays = 'Suisse'
WHERE immeuble_id IS NULL
  AND adresse IS NULL;
```

### ✅ MIGRATION IMMEUBLES : OK SANS MODIFICATION

Aucune correction nécessaire si :
- Données test uniquement
- Backup effectué
- Conversion 5→4 chiffres acceptable

---

**🚀 APRÈS CORRECTIONS : MIGRATIONS PRÊTES À EXÉCUTER**

**Ordre** : LOGEMENTS → IMMEUBLES  
**Méthode** : Supabase SQL Editor ou CLI  
**Durée estimée** : < 1 minute (si tables < 1000 lignes)
