# ✅ AMÉLIORATION COMPLÈTE - Formulaires LOGEMENT & IMMEUBLE

**Date** : 24 décembre 2025  
**Statut** : ✅ **COMPLET**  
**Devise** : CHF uniquement

---

## 📋 Objectifs atteints

✅ Formulaires complets et cohérents  
✅ Données traçables dans BDD  
✅ Devise CHF partout (fini l'€)  
✅ Création fiable et validée  
✅ Base saine pour la suite (Immeuble → Logements → Locataires → Tickets)

---

## 🏠 FORMULAIRE LOGEMENT - Améliorations

### 1. Nouveaux champs ajoutés

#### 📍 Adresse du logement (OBLIGATOIRE)
- **Adresse** (rue + numéro) *
- **NPA** (format suisse : 4 chiffres) *
- **Ville** *
- **Pays** (défaut: Suisse, non modifiable)

→ **Stockés dans table `logements`** même si le logement est dans un immeuble

#### 🏠 Caractéristiques du logement
- **Orientation** (Nord, Sud, Est, Ouest, combinaisons)
- **Année de construction** (optionnel)
- **Rénové en** (année, optionnel)
- **Type de chauffage** (liste complète)
- **Description / Spécifications** (textarea)

#### 💰 Prix & Finances (CHF)
- ✅ **Loyer mensuel (CHF)** - anciennement en €
- ✅ **Charges mensuelles (CHF)** - anciennement en €
- ✅ **Dépôt de garantie (CHF)** - anciennement en €

#### 👤 Propriétaire
- Champ préparé (optionnel, désactivé)
- UI : "Fonctionnalité à venir"
- Colonne `proprietaire_id` ajoutée (nullable)

### 2. Logique de création améliorée

#### Validation stricte
```javascript
✅ Vérification champs obligatoires
✅ Validation NPA (4 chiffres suisse)
✅ Messages d'erreur clairs et contextuels
✅ Blocage création si données manquantes
```

#### Tra çabilité complète
```javascript
console.log('[LOGEMENTS][DATA] Table cible : logements');
console.log('[LOGEMENTS][DATA] regie_id :', currentRegieId);  // TOUJOURS renseigné
console.log('[LOGEMENTS][DATA] immeuble_id :', immeuble_id || 'NULL (maison)');
```

#### UX optimisée
- Messages de succès non bloquants
- Fermeture automatique du modal
- Rafraîchissement immédiat de la liste
- Logs console exploitables pour debug

### 3. Structure BDD

**Migration** : `20251224000001_logements_adresse_caracteristiques.sql`

```sql
ALTER TABLE logements ADD COLUMN:
- adresse TEXT
- npa TEXT  -- 4 chiffres suisse
- ville TEXT
- pays TEXT DEFAULT 'Suisse'
- orientation TEXT
- annee_construction INTEGER
- annee_renovation INTEGER
- type_chauffage TEXT
- description TEXT
- proprietaire_id UUID  -- optionnel, pour future
```

**Contraintes** :
```sql
CHECK (npa ~ '^[0-9]{4}$')  -- Format suisse uniquement
CHECK (annee_construction BETWEEN 1800 AND 2100)
CHECK (annee_renovation BETWEEN 1800 AND 2100)
```

---

## 🏢 FORMULAIRE IMMEUBLE - Améliorations

### 1. Nouveaux champs ajoutés

#### 📍 Localisation complète
- **Nom / Référence immeuble** *
- **Adresse** *
- **NPA** (format suisse : 4 chiffres) *
- **Ville** *
- **Pays** (Suisse par défaut, non modifiable)

#### 🏢 Informations bâtiment
- **Type d'immeuble** (Résidentiel / Mixte / Commercial)
- **Nombre d'étages** * (obligatoire)
- **Année de construction** (optionnel)
- **Description / Remarques** (textarea)

#### 👤 Propriétaire
- Champ préparé (optionnel, désactivé)
- UI : "Fonctionnalité à venir"
- Colonne `proprietaire_id` ajoutée (nullable)

### 2. Paramétrage des logements (NOUVEAU !)

#### Option A : Créer les logements maintenant
```
✅ Checkbox "Créer les logements maintenant"
→ Affiche champ "Nombre total de logements"
→ Génération automatique à la création
```

**Génération automatique** :
- Numéros : `Log 1`, `Log 2`, `Log 3`, ...
- Statut par défaut : `vacant`
- Répartition sur étages calculée automatiquement
- Adresse copiée depuis l'immeuble
- `regie_id` et `immeuble_id` renseignés

#### Option B : Créer les logements plus tard
```
❌ Checkbox non cochée
→ Seul l'immeuble est créé
→ Logements à créer manuellement plus tard
```

### 3. Logique de création améliorée

#### Validation stricte
```javascript
✅ Champs obligatoires vérifiés
✅ NPA format suisse (4 chiffres)
✅ Nombre d'étages obligatoire
✅ Si "Créer logements" : nombre > 0
```

#### Traçabilité complète
```javascript
console.log('[IMMEUBLES][DATA] Table cible : immeubles');
console.log('[IMMEUBLES][DATA] regie_id :', currentRegieId);

if (creerLogements) {
  console.log('[IMMEUBLES][LOGEMENTS] Création de N logements');
  console.log('[IMMEUBLES][LOGEMENTS] Table cible : logements');
}
```

#### Transaction logique (non atomique SQL mais séquentielle)
```javascript
1. Créer immeuble → récupérer immeuble.id
2. SI option cochée :
   - Générer N logements
   - Insérer dans table logements
   - Lier à immeuble.id + regie.id
3. Message succès contextuel
```

### 4. Structure BDD

**Migration** : `20251224000002_immeubles_npa_suisse_caracteristiques.sql`

```sql
-- Renommer colonne
ALTER TABLE immeubles RENAME COLUMN code_postal TO npa;

-- Nouvelles colonnes
ALTER TABLE immeubles ADD COLUMN:
- pays TEXT DEFAULT 'Suisse'
- type_immeuble TEXT
- description TEXT
- proprietaire_id UUID

-- Nouvelle contrainte
CHECK (npa ~ '^[0-9]{4}$')  -- Format suisse
```

---

## 📊 Récapitulatif des données

### Table `logements`

| Champ | Type | Obligatoire | Stocké dans |
|-------|------|-------------|-------------|
| numero | TEXT | ✅ | logements |
| type_logement | TEXT | ✅ | logements |
| **adresse** | **TEXT** | ✅ | **logements** |
| **npa** | **TEXT** | ✅ | **logements** |
| **ville** | **TEXT** | ✅ | **logements** |
| pays | TEXT | ❌ (défaut: Suisse) | logements |
| superficie | NUMERIC | ❌ | logements |
| nombre_pieces | INTEGER | ❌ | logements |
| etage | INTEGER | ❌ | logements |
| **orientation** | **TEXT** | ❌ | **logements** |
| **annee_construction** | **INTEGER** | ❌ | **logements** |
| **annee_renovation** | **INTEGER** | ❌ | **logements** |
| **type_chauffage** | **TEXT** | ❌ | **logements** |
| **description** | **TEXT** | ❌ | **logements** |
| statut | TEXT | ✅ | logements |
| loyer_mensuel | NUMERIC | ❌ (CHF) | logements |
| charges_mensuelles | NUMERIC | ❌ (CHF) | logements |
| depot_garantie | NUMERIC | ❌ (CHF) | logements |
| balcon, parking, cave, meuble | BOOLEAN | ❌ | logements |
| **proprietaire_id** | **UUID** | ❌ | **logements** |
| **regie_id** | **UUID** | ✅ | **logements** |
| immeuble_id | UUID | ❌ (NULL si maison) | logements |

### Table `immeubles`

| Champ | Type | Obligatoire | Stocké dans |
|-------|------|-------------|-------------|
| nom | TEXT | ✅ | immeubles |
| adresse | TEXT | ✅ | immeubles |
| **npa** | **TEXT** | ✅ | **immeubles** |
| ville | TEXT | ✅ | immeubles |
| **pays** | **TEXT** | ❌ (défaut: Suisse) | **immeubles** |
| **type_immeuble** | **TEXT** | ❌ | **immeubles** |
| nombre_etages | INTEGER | ✅ | immeubles |
| annee_construction | INTEGER | ❌ | immeubles |
| **description** | **TEXT** | ❌ | **immeubles** |
| type_chauffage | TEXT | ❌ | immeubles |
| ascenseur, interphone | BOOLEAN | ❌ | immeubles |
| digicode | TEXT | ❌ | immeubles |
| **proprietaire_id** | **UUID** | ❌ | **immeubles** |
| **regie_id** | **UUID** | ✅ | **immeubles** |

---

## 🔄 Flux de création

### Flux LOGEMENT
```
1. Utilisateur ouvre modal "Créer logement"
2. Remplit formulaire complet (adresse, caractéristiques, prix CHF)
3. Validation frontend :
   - Champs obligatoires
   - Format NPA (4 chiffres)
4. Insertion BDD :
   - Table : logements
   - regie_id : TOUJOURS renseigné
   - immeuble_id : NULL si maison, UUID si appartement
5. Message succès + rafraîchissement liste
6. Logement apparaît immédiatement
```

### Flux IMMEUBLE (Option A : Créer logements maintenant)
```
1. Utilisateur ouvre modal "Créer immeuble"
2. Remplit formulaire immeuble
3. Coche "Créer les logements maintenant"
4. Spécifie nombre de logements (ex: 20)
5. Validation frontend
6. Insertion BDD :
   a) INSERT INTO immeubles → récupère immeuble.id
   b) Génération 20 logements :
      - numero : Log 1, Log 2, ...
      - statut : vacant
      - adresse : copiée depuis immeuble
      - immeuble_id : lié
      - regie_id : lié
   c) INSERT INTO logements (batch)
7. Message succès : "Immeuble créé avec 20 logements"
8. Rafraîchissement liste
```

### Flux IMMEUBLE (Option B : Créer logements plus tard)
```
1. Utilisateur ouvre modal "Créer immeuble"
2. Remplit formulaire immeuble
3. Laisse checkbox "Créer logements" décochée
4. Validation frontend
5. Insertion BDD :
   - Table : immeubles uniquement
   - regie_id : renseigné
6. Message succès : "Immeuble créé, logements à créer plus tard"
7. Utilisateur peut ensuite :
   → Aller dans "Logements"
   → Créer manuellement chaque logement
   → Lier à l'immeuble via select
```

---

## ✅ Contrôles & Conformité

### ✅ Aucun champ inutile
- Tous les champs servent la logique métier
- Propriétaire préparé mais désactivé (futur)

### ✅ Logique claire
- Traçabilité complète via console.log
- Tables cibles explicites
- Relations `regie_id` / `immeuble_id` documentées

### ✅ Pas de SQL bricolé
- Migrations propres
- Contraintes CHECK
- Indexes performants

### ✅ Devise CHF uniquement
- Tous les labels
- Tous les placeholders
- Validation métier suisse (NPA 4 chiffres)

### ✅ Base saine pour la suite
```
Immeuble (créé) 
  → Logements (créés automatiquement ou manuellement)
    → Locataires (à venir)
      → Tickets (à venir)
        → Missions techniciens (à venir)
```

---

## 📁 Fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| [logements.html](../public/regie/logements.html) | Formulaire complet + validation + logique CHF |
| [immeubles.html](../public/regie/immeubles.html) | Formulaire complet + création logements auto |
| [20251224000001_logements_adresse_caracteristiques.sql](../supabase/migrations/20251224000001_logements_adresse_caracteristiques.sql) | Migration table logements |
| [20251224000002_immeubles_npa_suisse_caracteristiques.sql](../supabase/migrations/20251224000002_immeubles_npa_suisse_caracteristiques.sql) | Migration table immeubles |

---

## 🎯 Tests de validation

### Test LOGEMENT
1. Ouvrir `/regie/logements.html`
2. Cliquer "➕ Nouveau logement"
3. Remplir formulaire complet
4. Vérifier validation NPA (4 chiffres)
5. Créer → Console logs OK
6. Vérifier BDD : `SELECT * FROM logements ORDER BY created_at DESC LIMIT 1;`

### Test IMMEUBLE (Option A)
1. Ouvrir `/regie/immeubles.html`
2. Cliquer "➕ Nouvel immeuble"
3. Remplir formulaire
4. ✅ Cocher "Créer les logements maintenant"
5. Spécifier nombre : 10
6. Créer → Console logs OK
7. Vérifier BDD :
```sql
SELECT * FROM immeubles ORDER BY created_at DESC LIMIT 1;
SELECT * FROM logements WHERE immeuble_id = '<ID>' ORDER BY numero;
```

### Test IMMEUBLE (Option B)
1. Même process
2. ❌ Laisser checkbox décochée
3. Créer → Seul immeuble créé
4. Vérifier BDD : aucun logement lié

---

**✅ FORMULAIRES COMPLETS ET PRÊTS POUR PRODUCTION**  
**📊 Base de données cohérente et traçable**  
**🇨🇭 Devise CHF - Format suisse respecté**  
**🏗️ Architecture prête pour la suite (Locataires → Tickets → Missions)**
