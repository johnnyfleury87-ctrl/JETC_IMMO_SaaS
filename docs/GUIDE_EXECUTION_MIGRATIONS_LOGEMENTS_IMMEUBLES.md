# 🚀 GUIDE D'EXÉCUTION MIGRATIONS - LOGEMENTS & IMMEUBLES

**Date** : 24 décembre 2025  
**Migrations** : 2 fichiers SQL  
**Impact** : Tables `logements` et `immeubles`  
**Durée estimée** : < 2 minutes

---

## 📋 RÉSUMÉ EXÉCUTIF

### Migrations à exécuter

1. **20251224000001** - Logements (adresse + caractéristiques)
2. **20251224000002** - Immeubles (NPA suisse + métadonnées)

### ✅ Validations effectuées

- ✅ Colonnes protégées (`IF NOT EXISTS`)
- ✅ Contraintes compatibles avec données existantes
- ✅ Ordre d'exécution validé (LOGEMENTS → IMMEUBLES)
- ✅ NPA format suisse (4 chiffres)
- ✅ Gestion maisons individuelles (NULL au lieu '0000')

### ⚠️ Points d'attention

- Migration immeubles **renomme** `code_postal` → `npa`
- Conversion 5 chiffres → 4 chiffres **destructive**
- Backup recommandé si données production

---

## 🎯 ÉTAPE 1 : PRÉ-REQUIS

### 1.1 Vérifier état actuel

```sql
-- Connexion : Supabase SQL Editor
-- URL : https://supabase.com/dashboard/project/<PROJECT_ID>/sql

-- Compter données existantes
SELECT 
  (SELECT COUNT(*) FROM logements) AS total_logements,
  (SELECT COUNT(*) FROM immeubles) AS total_immeubles;
```

**Résultat attendu** :
```
total_logements | total_immeubles
----------------|----------------
0               | 0
```

Si tables non vides → Passer à étape 1.2 (Backup)

### 1.2 Backup (si données existantes)

```sql
-- Créer tables de sauvegarde
CREATE TABLE IF NOT EXISTS logements_backup_20251224 AS 
SELECT * FROM logements;

CREATE TABLE IF NOT EXISTS immeubles_backup_20251224 AS 
SELECT * FROM immeubles;

-- Vérifier backup
SELECT 
  (SELECT COUNT(*) FROM logements_backup_20251224) AS backup_logements,
  (SELECT COUNT(*) FROM immeubles_backup_20251224) AS backup_immeubles;
```

### 1.3 Vérifier colonnes actuelles

```sql
-- Logements : colonnes existantes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'logements'
ORDER BY ordinal_position;

-- Immeubles : vérifier code_postal existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('code_postal', 'npa');
```

**Résultat attendu immeubles** :
- `code_postal` : TEXT (existe)
- `npa` : (n'existe pas encore)

---

## 🚀 ÉTAPE 2 : EXÉCUTION MIGRATION 1 - LOGEMENTS

### Méthode A : Supabase SQL Editor (RECOMMANDÉ)

1. Ouvrir **SQL Editor** dans dashboard Supabase
2. Créer **New Query**
3. Copier le contenu complet de :
   ```
   /workspaces/JETC_IMMO_SaaS/supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql
   ```
4. Coller dans l'éditeur
5. Cliquer **Run** (ou `Ctrl+Enter`)
6. Vérifier message succès

**Console attendue** :
```
✅ MIGRATION LOGEMENTS COMPLÈTE

Total logements : 0
Logements avec adresse : 0

Nouvelles colonnes ajoutées :
  - adresse, npa, ville, pays
  - orientation, annee_construction, annee_renovation
  - type_chauffage, description
  - proprietaire_id (optionnel)
```

### Méthode B : CLI Supabase (Alternatif)

```bash
cd /workspaces/JETC_IMMO_SaaS

# Exécuter migration
supabase db execute -f supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql

# Ou via psql
psql $DATABASE_URL -f supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql
```

### 2.1 Validation Migration 1

```sql
-- Vérifier colonnes ajoutées
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'logements'
  AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                      'annee_construction', 'annee_renovation', 'type_chauffage', 
                      'description', 'proprietaire_id')
ORDER BY column_name;
```

**Résultat attendu** : 10 lignes (toutes les nouvelles colonnes)

```sql
-- Vérifier contrainte NPA
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'logements'::regclass
  AND conname = 'check_npa_format';
```

**Résultat attendu** :
```
conname           | pg_get_constraintdef
------------------|------------------------------------
check_npa_format  | CHECK ((npa IS NULL) OR (npa ~ '^[0-9]{4}$'::text))
```

```sql
-- Vérifier index
SELECT indexname 
FROM pg_indexes
WHERE tablename = 'logements'
  AND indexname IN ('idx_logements_npa', 'idx_logements_ville', 'idx_logements_proprietaire_id');
```

**Résultat attendu** : 3 lignes

### 2.2 Si erreur

**Erreur : "column already exists"**
```
→ Colonne déjà ajoutée précédemment
→ SAFE : IF NOT EXISTS protège
→ Continuer
```

**Erreur : "constraint already exists"**
```
→ Contrainte déjà créée
→ SAFE : IF NOT EXISTS protège
→ Continuer
```

**Erreur : "column code_postal does not exist"**
```
→ Migration immeubles déjà exécutée (code_postal renommé)
→ ❌ ORDRE INCORRECT
→ Restaurer backup immeubles
→ Réexécuter dans bon ordre
```

---

## 🚀 ÉTAPE 3 : EXÉCUTION MIGRATION 2 - IMMEUBLES

**⚠️ N'EXÉCUTER QU'APRÈS SUCCÈS MIGRATION 1**

### Méthode A : Supabase SQL Editor (RECOMMANDÉ)

1. **Nouvelle Query** dans SQL Editor
2. Copier le contenu complet de :
   ```
   /workspaces/JETC_IMMO_SaaS/supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql
   ```
3. Coller dans l'éditeur
4. Cliquer **Run**
5. Vérifier message succès

**Console attendue** :
```
✅ MIGRATION IMMEUBLES COMPLÈTE

Total immeubles : 0
Immeubles NPA valide (4 chiffres) : 0

Modifications :
  - code_postal → npa (format suisse 4 chiffres)
  - Ajout colonnes : pays, type_immeuble, description
  - Ajout colonne : proprietaire_id (optionnel)
```

### Méthode B : CLI Supabase (Alternatif)

```bash
cd /workspaces/JETC_IMMO_SaaS

supabase db execute -f supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql
```

### 3.1 Validation Migration 2

```sql
-- Vérifier renommage code_postal → npa
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('code_postal', 'npa');
```

**Résultat attendu** :
```
column_name
-----------
npa
```
(code_postal ne doit plus exister)

```sql
-- Vérifier nouvelles colonnes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('npa', 'pays', 'type_immeuble', 'description', 'proprietaire_id')
ORDER BY column_name;
```

**Résultat attendu** : 5 lignes

```sql
-- Vérifier contrainte NPA (4 chiffres)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'immeubles'::regclass
  AND conname = 'check_npa_format';
```

**Résultat attendu** :
```
conname           | pg_get_constraintdef
------------------|------------------------------------
check_npa_format  | CHECK (npa ~ '^[0-9]{4}$'::text)
```

```sql
-- Vérifier index renommé
SELECT indexname 
FROM pg_indexes
WHERE tablename = 'immeubles'
  AND indexname IN ('idx_immeubles_code_postal', 'idx_immeubles_npa', 'idx_immeubles_proprietaire_id');
```

**Résultat attendu** :
```
indexname
-------------------------
idx_immeubles_npa
idx_immeubles_proprietaire_id
```
(idx_immeubles_code_postal ne doit plus exister)

### 3.2 Si erreur

**Erreur : "column code_postal does not exist"**
```
→ Colonne déjà renommée
→ Vérifier si migration déjà exécutée
→ SELECT * FROM migration_logs WHERE migration_name LIKE '20251224000002%';
```

**Erreur : "constraint check_code_postal does not exist"**
```
→ SAFE : DROP IF EXISTS protège
→ Continuer
```

---

## ✅ ÉTAPE 4 : VALIDATION COMPLÈTE

### 4.1 Vérifier migration_logs

```sql
SELECT migration_name, description, executed_at
FROM migration_logs
WHERE migration_name LIKE '20251224%'
ORDER BY executed_at;
```

**Résultat attendu** :
```
migration_name                                        | description                                  | executed_at
------------------------------------------------------|----------------------------------------------|------------------------
20251224000001_logements_adresse_caracteristiques     | Ajout colonnes adresse + caractéristiques... | 2025-12-24 14:30:00
20251224000002_immeubles_npa_suisse_caracteristiques  | Adaptation format NPA suisse...              | 2025-12-24 14:31:00
```

### 4.2 Compter colonnes totales

```sql
-- Logements : doit avoir 10 nouvelles colonnes
SELECT COUNT(*) AS nouvelles_colonnes_logements
FROM information_schema.columns
WHERE table_name = 'logements'
  AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                      'annee_construction', 'annee_renovation', 'type_chauffage', 
                      'description', 'proprietaire_id');

-- Immeubles : doit avoir 5 colonnes (dont npa renommé)
SELECT COUNT(*) AS nouvelles_colonnes_immeubles
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('npa', 'pays', 'type_immeuble', 'description', 'proprietaire_id');
```

**Résultat attendu** :
```
nouvelles_colonnes_logements | nouvelles_colonnes_immeubles
-----------------------------|-----------------------------
10                           | 5
```

### 4.3 Vérifier contraintes actives

```sql
-- Compter contraintes CHECK ajoutées
SELECT COUNT(*) AS contraintes_check
FROM pg_constraint
WHERE conrelid IN ('logements'::regclass, 'immeubles'::regclass)
  AND conname IN ('check_npa_format', 'check_annee_construction', 'check_annee_renovation');
```

**Résultat attendu** : 4 (1 pour immeubles, 3 pour logements)

### 4.4 Vérifier index créés

```sql
-- Index logements
SELECT COUNT(*) AS index_logements
FROM pg_indexes
WHERE tablename = 'logements'
  AND indexname IN ('idx_logements_npa', 'idx_logements_ville', 'idx_logements_proprietaire_id');

-- Index immeubles
SELECT COUNT(*) AS index_immeubles
FROM pg_indexes
WHERE tablename = 'immeubles'
  AND indexname IN ('idx_immeubles_npa', 'idx_immeubles_proprietaire_id');
```

**Résultat attendu** :
```
index_logements | index_immeubles
----------------|----------------
3               | 2
```

---

## 🧪 ÉTAPE 5 : TESTS FONCTIONNELS

### Test 1 : Créer logement avec nouvelles colonnes

```sql
-- Test insertion logement avec adresse
INSERT INTO logements (
  numero, type_logement, 
  adresse, npa, ville, pays,
  orientation, annee_construction, type_chauffage,
  statut, regie_id
) VALUES (
  'Test Migration',
  'T3',
  '12 rue du Test',
  '1003',
  'Lausanne',
  'Suisse',
  'Sud',
  2020,
  'Pompe à chaleur',
  'vacant',
  '<VOTRE_REGIE_ID>'
)
RETURNING id, numero, adresse, npa, ville;
```

**✅ Succès attendu** : Logement créé, ID retourné

**❌ Si erreur NPA** :
```
ERROR: new row violates check constraint "check_npa_format"
→ Vérifier format : doit être exactement 4 chiffres
→ Exemple valide : '1003', '1000', '8000'
→ Exemple invalide : '75001', '100', 'ABCD'
```

### Test 2 : Créer immeuble avec NPA suisse

```sql
-- Test insertion immeuble avec NPA 4 chiffres
INSERT INTO immeubles (
  nom, adresse, npa, ville, pays,
  type_immeuble, nombre_etages,
  regie_id
) VALUES (
  'Test NPA Migration',
  '50 avenue Test',
  '1000',
  'Lausanne',
  'Suisse',
  'Résidentiel',
  5,
  '<VOTRE_REGIE_ID>'
)
RETURNING id, nom, npa, ville, pays;
```

**✅ Succès attendu** : Immeuble créé avec NPA suisse

### Test 3 : Vérifier rejet NPA français (5 chiffres)

```sql
-- Test contrainte : doit rejeter 5 chiffres
INSERT INTO immeubles (
  nom, adresse, npa, ville, nombre_etages, regie_id
) VALUES (
  'Test NPA Invalide',
  '1 rue Test',
  '75001',  -- ❌ 5 chiffres français
  'Paris',
  3,
  '<VOTRE_REGIE_ID>'
);
```

**✅ Erreur ATTENDUE** :
```
ERROR: new row violates check constraint "check_npa_format"
DETAIL: Failing row contains (..., 75001, ...)
```

### Test 4 : Interface web - Formulaire logement

1. Ouvrir `http://localhost:5000/regie/logements.html`
2. Cliquer "➕ Nouveau logement"
3. Remplir tous les champs (adresse, NPA, ville)
4. **NPA** : Taper "1003"
5. Créer

**✅ Succès attendu** :
- Modal se ferme
- Logement apparaît dans liste
- Console logs : `[LOGEMENTS][DATA] Table cible : logements`

### Test 5 : Interface web - Formulaire immeuble + logements auto

1. Ouvrir `http://localhost:5000/regie/immeubles.html`
2. Cliquer "➕ Nouvel immeuble"
3. Remplir formulaire :
   - Nom : "Immeuble Test Migration"
   - Adresse : "10 rue Test"
   - NPA : "1004"
   - Ville : "Lausanne"
   - Nombre d'étages : 3
4. ✅ Cocher "Créer les logements maintenant"
5. Nombre logements : 6
6. Créer

**✅ Succès attendu** :
```
Message : "Immeuble créé avec 6 logements"
Console logs :
  [IMMEUBLES][DATA] Table cible : immeubles
  [IMMEUBLES][LOGEMENTS] Création de 6 logements
  [IMMEUBLES][LOGEMENTS] Table cible : logements
```

Vérifier en BDD :
```sql
SELECT i.nom, i.npa, COUNT(l.id) AS logements_crees
FROM immeubles i
LEFT JOIN logements l ON l.immeuble_id = i.id
WHERE i.nom = 'Immeuble Test Migration'
GROUP BY i.id, i.nom, i.npa;
```

**Résultat attendu** :
```
nom                      | npa  | logements_crees
-------------------------|------|----------------
Immeuble Test Migration  | 1004 | 6
```

---

## 📊 CHECKLIST FINALE

### ✅ Migrations exécutées

- [ ] Migration 1 (logements) : succès
- [ ] Migration 2 (immeubles) : succès
- [ ] Ordre respecté : LOGEMENTS → IMMEUBLES
- [ ] Aucune erreur SQL
- [ ] Messages NOTICE validés

### ✅ Structure BDD

- [ ] Logements : 10 nouvelles colonnes
- [ ] Immeubles : `code_postal` renommé en `npa`
- [ ] Immeubles : 4 nouvelles colonnes (pays, type, description, proprietaire_id)
- [ ] Contraintes CHECK actives (NPA 4 chiffres)
- [ ] Index créés (npa, ville, proprietaire_id)
- [ ] `migration_logs` : 2 entrées

### ✅ Tests fonctionnels

- [ ] Création logement avec adresse : OK
- [ ] Création immeuble avec NPA suisse : OK
- [ ] Rejet NPA français (5 chiffres) : OK
- [ ] Formulaire web logement : OK
- [ ] Formulaire web immeuble + logements auto : OK
- [ ] Console logs traçables

### ✅ Nettoyage

- [ ] Supprimer tables backup (si tout OK)
```sql
DROP TABLE IF EXISTS logements_backup_20251224;
DROP TABLE IF EXISTS immeubles_backup_20251224;
```

---

## 🎉 SUCCÈS

**✅ MIGRATIONS COMPLÈTES ET VALIDÉES**

### Résumé des changements

**Logements** :
- ✅ Adresse complète (adresse, NPA, ville, pays)
- ✅ Caractéristiques (orientation, années, chauffage, description)
- ✅ Propriétaire (preparé, nullable)
- ✅ Validation NPA suisse (4 chiffres)

**Immeubles** :
- ✅ NPA format suisse (code_postal renommé)
- ✅ Métadonnées (pays, type, description)
- ✅ Propriétaire (préparé, nullable)
- ✅ Validation NPA suisse (4 chiffres)

### Prochaines étapes

1. **Créer données de test**
   - Quelques immeubles avec NPA suisses
   - Quelques logements (appartements + maisons)
   - Vérifier cascade et relations

2. **Tester flux complet**
   - Immeuble → Logements automatiques
   - Logement seul (maison individuelle)
   - Locataire → Logement (à venir)

3. **Suite projet**
   - Module Locataires (déjà fait)
   - Module Tickets (à venir)
   - Module Missions techniciens (à venir)

---

**📄 DOCUMENT COMPLÉMENTAIRE**

Voir détails techniques : [AUDIT_PRE_MIGRATION_LOGEMENTS_IMMEUBLES.md](./AUDIT_PRE_MIGRATION_LOGEMENTS_IMMEUBLES.md)
