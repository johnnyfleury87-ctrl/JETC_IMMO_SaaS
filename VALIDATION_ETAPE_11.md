# ✅ VALIDATION ÉTAPE 11 - Techniciens & planning

## 📋 Résumé

**Statut** : ✅ VALIDÉE  
**Tests** : 50/50 ✅  
**Date** : Décembre 2024

L'ÉTAPE 11 implémente le système de gestion des techniciens avec assignation aux missions et planning. Les techniciens voient uniquement leurs missions assignées, garantissant l'isolation des données.

---

## 🎯 Objectifs de l'ÉTAPE 11

### Spécifications JETCv1.pdf

**ÉTAPE 11 – Techniciens & planning**

- **Objectif** : Organiser l'exécution terrain
- **Contenu** :
  - Gestion techniciens
  - Assignation mission
  - Dates d'intervention

- **Critères de validation** :
  - ✅ Technicien voit uniquement ses missions

---

## 🗂️ Structure créée

### 1. Table `techniciens` (`supabase/schema/15_techniciens.sql`)

**Structure complète** :

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | uuid | PRIMARY KEY | Identifiant unique |
| `profile_id` | uuid | UNIQUE, NOT NULL, FK → auth.users | Profil utilisateur (role = technicien) |
| `entreprise_id` | uuid | NOT NULL, FK → entreprises | Entreprise du technicien |
| `nom` | text | NOT NULL | Nom du technicien |
| `prenom` | text | NOT NULL | Prénom du technicien |
| `telephone` | text | NULL | Téléphone |
| `email` | text | NULL | Email |
| `specialites` | text[] | Array | Liste des spécialités (plomberie, électricité, etc.) |
| `actif` | boolean | NOT NULL, default true | Technicien actif/désactivé |
| `created_at` | timestamptz | NOT NULL | Date de création |
| `updated_at` | timestamptz | NOT NULL | Dernière mise à jour |

**Index de performance** :
```sql
idx_techniciens_profile_id      -- Recherche par profil
idx_techniciens_entreprise_id   -- Recherche par entreprise
idx_techniciens_actif           -- Filtres actifs/inactifs
```

**Contraintes importantes** :
- ✅ `profile_id` UNIQUE : Un profil = un technicien
- ✅ FK vers `entreprises` : Un technicien appartient à une entreprise
- ✅ FK vers `auth.users` : Lien avec l'authentification

---

### 2. Colonnes ajoutées à `missions`

**3 nouvelles colonnes** :

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `technicien_id` | uuid | NULL, FK → techniciens | Technicien assigné (optionnel) |
| `date_intervention_prevue` | timestamptz | NULL | Date prévue de l'intervention |
| `date_intervention_realisee` | timestamptz | NULL | Date réelle de l'intervention |

**Index de performance** :
```sql
idx_missions_technicien_id              -- Recherche missions d'un technicien
idx_missions_date_intervention_prevue   -- Tri par date prévue (planning)
```

**Logique** :
- Mission sans technicien → À dispatcher
- Mission avec technicien → Assignée, apparaît dans le planning

---

### 3. Fonction helper `get_user_technicien_id()`

**Signature** :
```sql
create or replace function get_user_technicien_id()
returns uuid
language sql
security definer
stable
```

**Utilité** :
- Retourne l'ID du technicien pour l'utilisateur connecté
- Utilisé dans les policies RLS
- `security definer` pour éviter la récursion RLS

---

### 4. Fonction `assign_technicien_to_mission()`

**Signature** :
```sql
create or replace function assign_technicien_to_mission(
  p_mission_id uuid,
  p_technicien_id uuid,
  p_date_intervention_prevue timestamptz default null
)
returns jsonb
```

**Sécurité** : `security definer`

**Logique** :

1. ✅ **Vérifie que la mission existe**
   - Récupère `missions.entreprise_id`
   - Retour erreur si mission non trouvée

2. ✅ **Vérifie que le technicien existe et est actif**
   - Récupère `techniciens.entreprise_id`
   - Vérifie `techniciens.actif = true`
   - Retour erreur si technicien non trouvé ou inactif

3. ✅ **Vérifie que technicien et mission appartiennent à la même entreprise**
   - Compare `mission.entreprise_id` et `technicien.entreprise_id`
   - Retour erreur si entreprises différentes

4. ✅ **Assigne le technicien à la mission**
   - `UPDATE missions SET technicien_id = p_technicien_id`
   - Met à jour `date_intervention_prevue` si fournie

5. ✅ **Retourne le résultat**
   - `{ success: true }` ou `{ success: false, error: "message" }`

---

### 5. Row Level Security (RLS)

#### Table `techniciens` (8 policies)

**SELECT (4 policies)** :

1. ✅ **`Entreprise can view own techniciens`**
   - Entreprise voit SES techniciens
   - Filtre : `techniciens.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())`

2. ✅ **`Technicien can view own profile`**
   - Technicien voit SON profil
   - Filtre : `techniciens.profile_id = auth.uid()`

3. ✅ **`Regie can view techniciens of authorized entreprises`**
   - Régie voit les techniciens des entreprises AUTORISÉES
   - Vérifie via `regies_entreprises`

4. ✅ **`Admin JTEC can view all techniciens`**
   - Admin JTEC voit TOUS les techniciens

**INSERT (1 policy)** :

5. ✅ **`Entreprise can insert own techniciens`**
   - Entreprise peut créer SES techniciens
   - Check : `techniciens.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())`

**UPDATE (2 policies)** :

6. ✅ **`Entreprise can update own techniciens`**
   - Entreprise peut modifier SES techniciens

7. ✅ **`Technicien can update own profile`**
   - Technicien peut modifier SON profil

#### Table `missions` (2 nouvelles policies)

8. ✅ **`Technicien can view assigned missions`**
   - Technicien voit uniquement SES missions assignées
   - Filtre : `missions.technicien_id = get_user_technicien_id()`
   - **CRITÈRE CLÉ DE L'ÉTAPE 11** 🔒

9. ✅ **`Technicien can update assigned missions`**
   - Technicien peut mettre à jour SES missions
   - Exemple : marquer mission terminée, ajouter `date_intervention_realisee`

---

### 6. Vue `planning_technicien`

**Vue complète** avec jointures :

```sql
create or replace view planning_technicien as
select
  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.date_intervention_prevue,
  m.date_intervention_realisee,
  
  -- Technicien
  t.id as technicien_id,
  t.nom as technicien_nom,
  t.prenom as technicien_prenom,
  
  -- Ticket
  tk.titre as ticket_titre,
  tk.description as ticket_description,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,
  
  -- Entreprise
  e.nom as entreprise_nom,
  
  -- Logement & Immeuble
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  imm.ville as immeuble_ville,
  
  -- Locataire
  loc.nom as locataire_nom,
  loc.telephone as locataire_telephone
  
from missions m
left join techniciens t on m.technicien_id = t.id
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is not null;
```

**Usage** :
- Afficher le planning d'un technicien avec toutes les infos nécessaires
- Inclut adresse, contact locataire, catégorie ticket
- Filtre : missions assignées uniquement

---

### 7. Vue `missions_non_assignees`

**Vue pour le dispatch** :

```sql
create or replace view missions_non_assignees as
select
  m.id as mission_id,
  m.statut as mission_statut,
  tk.titre as ticket_titre,
  tk.categorie as ticket_categorie,
  tk.priorite as ticket_priorite,
  e.nom as entreprise_nom,
  imm.adresse as immeuble_adresse,
  loc.nom as locataire_nom
from missions m
join tickets tk on m.ticket_id = tk.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on tk.locataire_id = loc.id
join logements log on tk.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
where m.technicien_id is null
and m.statut in ('en_attente', 'en_cours');
```

**Usage** :
- Lister les missions à dispatcher
- Entreprise peut voir les missions non encore assignées
- Aide au dispatch des interventions

---

## 🔌 APIs créées

### 1. `GET /api/techniciens` (List)

**Fichier** : `api/techniciens/list.js`

**Sécurité** :
- ✅ Authentification JWT requise
- ✅ Vérifie `role = 'entreprise'`
- ✅ Retourne 403 si non entreprise

**Logique** :
1. Récupère l'ID de l'entreprise via `profile_id`
2. Liste tous les techniciens de l'entreprise
3. Tri par nom

**Réponse** :
```json
{
  "techniciens": [
    {
      "id": "uuid",
      "nom": "Dupont",
      "prenom": "Jean",
      "telephone": "0601020304",
      "email": "jean@example.com",
      "specialites": ["plomberie", "chauffage"],
      "actif": true
    }
  ]
}
```

---

### 2. `POST /api/missions/assign-technicien` (Assign)

**Fichier** : `api/missions/assign-technicien.js`

**Sécurité** :
- ✅ Authentification JWT requise
- ✅ Vérifie `role = 'entreprise'`
- ✅ Appelle fonction SQL avec vérifications

**Body** :
```json
{
  "mission_id": "uuid",
  "technicien_id": "uuid",
  "date_intervention_prevue": "2024-12-25T10:00:00Z"  // optionnel
}
```

**Réponse (succès)** :
```json
{
  "success": true,
  "message": "Technicien assigné avec succès"
}
```

**Réponse (erreur)** :
```json
{
  "error": "Le technicien n'appartient pas à l'entreprise de la mission"
}
```

---

### 3. `GET /api/techniciens/planning` (Planning)

**Fichier** : `api/techniciens/planning.js`

**Sécurité** :
- ✅ Authentification JWT requise
- ✅ Vérifie `role = 'technicien'`
- ✅ Retourne uniquement les missions du technicien connecté
- **CRITÈRE CLÉ : Technicien voit uniquement SES missions** 🔒

**Logique** :
1. Récupère l'ID du technicien via `profile_id`
2. Interroge la vue `planning_technicien` avec filtre `technicien_id`
3. Tri par `date_intervention_prevue`

**Réponse** :
```json
{
  "planning": [
    {
      "mission_id": "uuid",
      "mission_statut": "en_cours",
      "date_intervention_prevue": "2024-12-20T14:00:00Z",
      "ticket_titre": "Fuite robinet",
      "ticket_categorie": "Plomberie",
      "ticket_priorite": "haute",
      "immeuble_adresse": "10 rue de la Paix, 75001 Paris",
      "logement_numero": "3A",
      "locataire_nom": "Martin",
      "locataire_telephone": "0612345678"
    }
  ]
}
```

---

## 🔒 Garanties de sécurité

### 1. Technicien voit UNIQUEMENT ses missions

✅ **Policy RLS sur `missions`** :
```sql
create policy "Technicien can view assigned missions"
on missions
for select
using (
  technicien_id = get_user_technicien_id()
);
```

✅ **API `/api/techniciens/planning`** :
- Vérifie `role = 'technicien'`
- Filtre par `technicien_id` du profil connecté
- Impossible de voir les missions d'autres techniciens

### 2. Isolation par entreprise

✅ **Fonction `assign_technicien_to_mission()`** :
- Vérifie que technicien et mission appartiennent à la MÊME entreprise
- Retour erreur si entreprises différentes

✅ **Policies RLS sur `techniciens`** :
- Entreprise voit SES techniciens uniquement
- Régie voit techniciens des entreprises AUTORISÉES
- Technicien voit SON profil uniquement

### 3. Contrôle des rôles

| Rôle | Peut voir | Peut assigner | Peut modifier |
|------|-----------|---------------|---------------|
| **Entreprise** | Ses techniciens + missions | Techniciens à missions | Ses techniciens |
| **Technicien** | Son profil + ses missions | ❌ | Son profil + ses missions |
| **Régie** | Techniciens des entreprises autorisées | ❌ | ❌ |
| **Admin JTEC** | Tous les techniciens | ❌ (via SQL) | ✅ (via SQL) |

---

## 🧪 Tests de validation

**Fichier** : `tests/techniciens.test.js`

### Résultats

✅ **50/50 tests réussis**

### Catégories testées

#### Structure SQL (12 tests)
```
✓ Fichier 15_techniciens.sql existe
✓ Table techniciens créée
✓ Colonne profile_id référence auth.users
✓ Colonne profile_id est unique
✓ Colonne entreprise_id référence entreprises
✓ Colonnes nom, prenom, telephone, email créées
✓ Colonne specialites (array) créée
✓ Colonne actif (boolean) créée
✓ Colonne technicien_id ajoutée à missions
✓ Colonne technicien_id référence techniciens
✓ Colonne date_intervention_prevue ajoutée à missions
✓ Colonne date_intervention_realisee ajoutée à missions
```

#### Fonctions SQL (9 tests)
```
✓ Fonction get_user_technicien_id() créée
✓ Fonction get_user_technicien_id() est security definer
✓ Fonction assign_technicien_to_mission créée
✓ Fonction est security definer
✓ Fonction vérifie que la mission existe
✓ Fonction vérifie que le technicien est actif
✓ Fonction vérifie que technicien appartient à même entreprise
✓ Fonction met à jour missions.technicien_id
✓ Fonction retourne un jsonb avec success
```

#### RLS (10 tests)
```
✓ RLS activé sur table techniciens
✓ Policy : Entreprise peut voir ses techniciens
✓ Policy : Entreprise peut créer ses techniciens
✓ Policy : Entreprise peut mettre à jour ses techniciens
✓ Policy : Technicien voit son profil
✓ Policy : Technicien peut mettre à jour son profil
✓ Policy : Régie voit techniciens des entreprises autorisées
✓ Policy : Admin JTEC voit tous les techniciens
✓ Policy : Technicien peut voir SES missions assignées
✓ Policy : Technicien peut mettre à jour SES missions
```

#### Vues (4 tests)
```
✓ Vue planning_technicien créée
✓ Vue planning_technicien joint toutes les tables nécessaires
✓ Vue missions_non_assignees créée
✓ Vue missions_non_assignees filtre technicien_id IS NULL
```

#### APIs (10 tests)
```
✓ API list techniciens existe
✓ API list vérifie que l'utilisateur est une entreprise
✓ API list récupère techniciens de l'entreprise
✓ API assign-technicien existe
✓ API assign vérifie que l'utilisateur est une entreprise
✓ API assign appelle assign_technicien_to_mission
✓ API assign passe mission_id, technicien_id et date
✓ API planning existe
✓ API planning vérifie que l'utilisateur est un technicien
✓ API planning récupère uniquement les missions du technicien
```

#### Performance (5 tests)
```
✓ Index sur techniciens.profile_id
✓ Index sur techniciens.entreprise_id
✓ Index sur missions.technicien_id
✓ Index sur missions.date_intervention_prevue
✓ Trigger pour updated_at sur techniciens
```

---

## 📊 Flux de données

### Scénario : Entreprise assigne un technicien

```
1. Entreprise crée un ticket (mission créée à l'ÉTAPE 10)
   └─> missions (statut = 'en_attente', technicien_id = NULL)

2. Entreprise liste ses techniciens
   └─> GET /api/techniciens
       └─> Retourne liste des techniciens actifs

3. Entreprise assigne un technicien à la mission
   └─> POST /api/missions/assign-technicien
       {
         mission_id: "uuid",
         technicien_id: "uuid",
         date_intervention_prevue: "2024-12-20T14:00:00Z"
       }
       └─> Appelle assign_technicien_to_mission()
           ├─> Vérifie mission existe
           ├─> Vérifie technicien actif
           ├─> Vérifie même entreprise
           ├─> UPDATE missions SET technicien_id = ...
           └─> RETURN { success: true }

4. Technicien voit sa mission dans son planning
   └─> GET /api/techniciens/planning
       └─> Filtre : technicien_id = auth.uid()
       └─> Retourne planning avec adresses, contacts

5. Technicien réalise l'intervention
   └─> UPDATE missions SET date_intervention_realisee = now()
```

---

## 🎯 Critères de validation ÉTAPE 11

| Critère | Statut | Détails |
|---------|--------|---------|
| **Table techniciens créée** | ✅ | Avec FK entreprise_id et profile_id unique |
| **Colonnes missions ajoutées** | ✅ | technicien_id, date_intervention_prevue, date_intervention_realisee |
| **Fonction assignation créée** | ✅ | assign_technicien_to_mission() avec vérifications |
| **Technicien voit uniquement SES missions** | ✅ | Policy RLS + API planning |
| **RLS techniciens configuré** | ✅ | 8 policies (SELECT, INSERT, UPDATE) |
| **RLS missions étendu** | ✅ | 2 policies pour techniciens |
| **APIs créées** | ✅ | List, assign, planning |
| **Vues planning créées** | ✅ | planning_technicien, missions_non_assignees |
| **Tests automatisés** | ✅ | 50 tests passés |

---

## 🚀 Prochaine étape

**ÉTAPE 12** : À déterminer selon JETCv1.pdf

---

## 📝 Commandes de test

```bash
# Lancer les tests ÉTAPE 11
node tests/techniciens.test.js

# Résultat attendu
✅ 50/50 tests réussis
ÉTAPE 11 VALIDÉE
```

---

## 💡 Usage des APIs

### Exemple : Lister les techniciens (Entreprise)

```javascript
const response = await fetch('/api/techniciens', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer JWT_TOKEN_ENTREPRISE'
  }
});

const result = await response.json();
// { techniciens: [...] }
```

### Exemple : Assigner un technicien (Entreprise)

```javascript
const response = await fetch('/api/missions/assign-technicien', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer JWT_TOKEN_ENTREPRISE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mission_id: 'uuid-mission',
    technicien_id: 'uuid-technicien',
    date_intervention_prevue: '2024-12-20T14:00:00Z'
  })
});

const result = await response.json();
// { success: true, message: "Technicien assigné avec succès" }
```

### Exemple : Voir son planning (Technicien)

```javascript
const response = await fetch('/api/techniciens/planning', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer JWT_TOKEN_TECHNICIEN'
  }
});

const result = await response.json();
// { planning: [...] }
```

---

## 📅 Historique

- **ÉTAPE 0** : ✅ Initialisation
- **ÉTAPE 1** : ✅ Landing page
- **ÉTAPE 2** : ✅ Authentification
- **ÉTAPE 3** : ✅ Profiles
- **ÉTAPE 4** : ✅ Structure immobilière
- **ÉTAPE 5** : ✅ Création de tickets
- **ÉTAPE 6** : ✅ Diffusion des tickets
- **ÉTAPE 7** : ✅ Row Level Security
- **ÉTAPE 8** : ✅ Storage & fichiers
- **ÉTAPE 9** : ✅ Administration JTEC
- **ÉTAPE 10** : ✅ Acceptation ticket & création mission
- **ÉTAPE 11** : ✅ **Techniciens & planning** ⬅ ACTUEL
- **ÉTAPE 12** : 🔜 À venir

---

**✅ ÉTAPE 11 COMPLÈTE ET VALIDÉE**

**SYSTÈME DE TECHNICIENS ET PLANNING ACTIVÉ** 👷‍♂️📅
