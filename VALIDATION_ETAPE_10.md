# ✅ VALIDATION ÉTAPE 10 - Acceptation ticket & création mission

## 📋 Résumé

**Statut** : ✅ VALIDÉE  
**Tests** : 37/37 ✅  
**Date** : Décembre 2024

L'ÉTAPE 10 implémente le système d'acceptation de tickets par les entreprises avec création automatique de missions. Une seule mission par ticket est garantie, et seules les entreprises autorisées peuvent accepter des tickets.

---

## 🎯 Objectifs de l'ÉTAPE 10

### Spécifications JETCv1.pdf

**ÉTAPE 10 – Acceptation ticket & création mission**

- **Objectif** : Transformer un ticket en mission
- **Contenu** :
  - Acceptation par entreprise
  - Création de mission
  - Verrouillage du ticket

- **Critères de validation** :
  - ✅ Une seule mission par ticket
  - ✅ Entreprise autorisée uniquement

---

## 🗂️ Structure créée

### 1. Verrouillage des tickets (`supabase/schema/14_missions.sql`)

**Colonne ajoutée à `tickets`** :

```sql
alter table tickets
add column if not exists locked_at timestamptz default null;
```

**Usage** :
- `locked_at = NULL` : Ticket non verrouillé, peut être accepté
- `locked_at = timestamptz` : Ticket verrouillé, mission créée

---

### 2. Table `missions`

**Structure complète** :

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | uuid | PRIMARY KEY | Identifiant unique |
| `ticket_id` | uuid | UNIQUE, NOT NULL, FK → tickets | Un ticket = une mission max |
| `entreprise_id` | uuid | NOT NULL, FK → entreprises | Entreprise qui réalise |
| `statut` | text | CHECK | en_attente, en_cours, terminee, validee, annulee |
| `created_at` | timestamptz | NOT NULL | Date de création |
| `started_at` | timestamptz | NULL | Date de démarrage |
| `completed_at` | timestamptz | NULL | Date de complétion |
| `validated_at` | timestamptz | NULL | Date de validation régie |
| `notes` | text | NULL | Notes libres |
| `devis_url` | text | NULL | URL du devis (Storage) |
| `facture_url` | text | NULL | URL de la facture (Storage) |
| `montant` | decimal(10,2) | NULL | Montant en euros |
| `updated_at` | timestamptz | NOT NULL | Dernière mise à jour |

**Index de performance** :
```sql
idx_missions_ticket_id       -- Recherche par ticket
idx_missions_entreprise_id   -- Recherche par entreprise
idx_missions_statut          -- Filtres par statut
idx_missions_created_at      -- Tri chronologique
```

---

### 3. Fonction SQL `accept_ticket_and_create_mission()`

**Signature** :
```sql
create or replace function accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
)
returns jsonb
```

**Sécurité** : `security definer`

**Logique** :

1. ✅ **Vérifie que le ticket existe**
   - Récupère `regie_id` via `tickets → logements → immeubles`
   - Retour erreur si ticket non trouvé

2. ✅ **Vérifie que le ticket n'est pas déjà verrouillé**
   - Teste `tickets.locked_at IS NULL`
   - Retour erreur si déjà verrouillé (mission existante)

3. ✅ **Vérifie que l'entreprise est autorisée**
   - Requête sur `regies_entreprises`
   - Vérifie `autorise = true` pour la régie du ticket
   - Retour erreur si non autorisée

4. ✅ **Crée la mission**
   - `INSERT INTO missions (ticket_id, entreprise_id, statut)`
   - Statut initial : `en_attente`

5. ✅ **Verrouille le ticket**
   - `UPDATE tickets SET locked_at = now()`

6. ✅ **Met à jour le statut du ticket**
   - `UPDATE tickets SET statut = 'en_cours'`

7. ✅ **Retourne le résultat**
   - `{ success: true, mission_id: uuid }`
   - Ou `{ success: false, error: "message" }`

---

### 4. API `POST /api/tickets/accept`

**Endpoint** : `/api/tickets/accept`

**Body** :
```json
{
  "ticket_id": "uuid"
}
```

**Sécurité** :

1. ✅ **Authentification JWT requise**
   - Appel à `authenticateUser(req)`
   - Retour 401 si non authentifié

2. ✅ **Vérification du rôle**
   - Lecture du profil : `profiles.role`
   - Retour 403 si `role !== 'entreprise'`

3. ✅ **Récupération de l'entreprise**
   - Requête : `SELECT id FROM entreprises WHERE profile_id = user.id`
   - Retour 404 si entreprise non trouvée

4. ✅ **Appel de la fonction SQL**
   - `supabase.rpc('accept_ticket_and_create_mission', { p_ticket_id, p_entreprise_id })`

5. ✅ **Gestion du résultat**
   - Si `result.success = false` → 400 avec message d'erreur
   - Si `result.success = true` → 201 avec `mission_id`

**Réponse (succès)** :
```json
{
  "success": true,
  "mission_id": "uuid",
  "message": "Mission créée avec succès"
}
```

**Réponse (erreur)** :
```json
{
  "error": "Ticket déjà verrouillé (mission existante)"
}
```

---

### 5. Row Level Security (RLS)

**Activation** :
```sql
alter table missions enable row level security;
```

#### Policies SELECT (6 policies)

1. ✅ **`Regie can view missions for own tickets`**
   - Régie voit les missions de SES tickets
   - Vérifie via `tickets → logements → immeubles.regie_id = get_user_regie_id()`

2. ✅ **`Entreprise can view own missions`**
   - Entreprise voit SES missions
   - Filtre : `missions.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())`

3. ✅ **`Locataire can view missions for own tickets`**
   - Locataire voit les missions de SES tickets
   - Vérifie via `tickets.locataire_id → locataires.profile_id = auth.uid()`

4. ✅ **`Admin JTEC can view all missions`**
   - Admin JTEC voit TOUTES les missions
   - Vérifie : `profiles.role = 'admin_jtec'`

#### Policies UPDATE (2 policies)

5. ✅ **`Entreprise can update own missions`**
   - Entreprise peut mettre à jour SES missions
   - Exemple : changer statut, ajouter devis_url, montant

6. ✅ **`Regie can update missions for own tickets`**
   - Régie peut mettre à jour missions de SES tickets
   - Exemple : valider la mission (`statut = 'validee'`)

---

### 6. Vue `missions_details`

**Vue complète** avec jointures :

```sql
create or replace view missions_details as
select
  -- Mission
  m.id as mission_id,
  m.statut as mission_statut,
  m.created_at as mission_created_at,
  m.montant,
  
  -- Ticket
  t.titre as ticket_titre,
  t.categorie as ticket_categorie,
  t.priorite as ticket_priorite,
  
  -- Entreprise
  e.nom as entreprise_nom,
  e.siret as entreprise_siret,
  
  -- Locataire
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  
  -- Logement
  log.numero as logement_numero,
  
  -- Immeuble
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  
  -- Régie
  r.nom as regie_nom
  
from missions m
join tickets t on m.ticket_id = t.id
join entreprises e on m.entreprise_id = e.id
join locataires loc on t.locataire_id = loc.id
join logements log on t.logement_id = log.id
join immeubles imm on log.immeuble_id = imm.id
join regies r on imm.regie_id = r.id;
```

**Usage** : Facilite l'affichage des missions avec toutes les informations contextuelles

---

## 🔒 Garanties de sécurité

### 1. Une seule mission par ticket

✅ **Contrainte UNIQUE sur `missions.ticket_id`**
- Impossible de créer 2 missions pour le même ticket
- Erreur PostgreSQL si tentative

✅ **Vérification du verrouillage dans la fonction**
- Teste `tickets.locked_at IS NOT NULL`
- Retour d'erreur explicite

### 2. Entreprise autorisée uniquement

✅ **Vérification dans `accept_ticket_and_create_mission()`**
```sql
select exists (
  select 1 from regies_entreprises
  where regie_id = v_ticket_regie_id
  and entreprise_id = p_entreprise_id
  and autorise = true
)
```

✅ **Retour d'erreur si non autorisée**
```json
{ "success": false, "error": "Entreprise non autorisée pour cette régie" }
```

### 3. Isolation par rôle (RLS)

| Rôle | Peut voir | Peut modifier |
|------|-----------|---------------|
| **Régie** | Missions de SES tickets | Missions de SES tickets (validation) |
| **Entreprise** | SES missions | SES missions (statut, devis, facture) |
| **Locataire** | Missions de SES tickets | ❌ (lecture seule) |
| **Admin JTEC** | TOUTES | ✅ (via SQL direct) |

### 4. Verrouillage du ticket

✅ **Ticket verrouillé après acceptation**
- `tickets.locked_at` mis à jour
- Empêche modifications du ticket
- Visible dans les interfaces

---

## 🧪 Tests de validation

**Fichier** : `tests/missions.test.js`

### Résultats

✅ **37/37 tests réussis**

### Catégories testées

#### Structure SQL (8 tests)
```
✓ Fichier 14_missions.sql existe
✓ Colonne locked_at ajoutée à tickets
✓ Table missions créée
✓ Colonne ticket_id est unique dans missions
✓ Colonne entreprise_id référence entreprises
✓ Colonne statut avec valeurs contrôlées
✓ Colonnes temporelles créées (created_at, started_at, completed_at, validated_at)
✓ Colonnes optionnelles (devis_url, facture_url, montant)
```

#### Fonction SQL (9 tests)
```
✓ Fonction accept_ticket_and_create_mission créée
✓ Fonction est security definer
✓ Fonction vérifie que le ticket existe
✓ Fonction vérifie que le ticket n'est pas verrouillé
✓ Fonction vérifie que l'entreprise est autorisée
✓ Fonction crée la mission
✓ Fonction verrouille le ticket (update locked_at)
✓ Fonction met à jour le statut du ticket
✓ Fonction retourne un jsonb avec success et mission_id
```

#### RLS (6 tests)
```
✓ RLS activé sur table missions
✓ Policy : Régie peut voir missions de ses tickets
✓ Policy : Entreprise peut voir ses missions
✓ Policy : Locataire peut voir missions de ses tickets
✓ Policy : Entreprise peut mettre à jour ses missions
✓ Policy : Régie peut mettre à jour missions de ses tickets
✓ Policy : Admin JTEC peut voir toutes les missions
```

#### Vue (2 tests)
```
✓ Vue missions_details créée
✓ Vue missions_details joint toutes les tables nécessaires
```

#### API (7 tests)
```
✓ API accept existe
✓ API vérifie que l'utilisateur est une entreprise
✓ API récupère l'ID de l'entreprise
✓ API appelle la fonction accept_ticket_and_create_mission
✓ API passe ticket_id et entreprise_id à la fonction
✓ API gère les erreurs de la fonction SQL
✓ API retourne le mission_id en cas de succès
```

#### Performance (4 tests)
```
✓ Index sur missions.ticket_id pour performance
✓ Index sur missions.entreprise_id pour performance
✓ Index sur missions.statut pour filtres
✓ Trigger pour updated_at sur missions
```

---

## 📊 Flux de données

### Scénario : Entreprise accepte un ticket

```
1. Locataire crée un ticket
   └─> tickets (statut = 'nouveau')

2. Régie diffuse le ticket aux entreprises autorisées
   └─> tickets visibles via regies_entreprises

3. Entreprise accepte le ticket
   └─> POST /api/tickets/accept
       ├─> Vérifie authentification (JWT)
       ├─> Vérifie rôle = 'entreprise'
       ├─> Récupère entreprise.id
       └─> Appelle accept_ticket_and_create_mission()
           ├─> Vérifie ticket existe
           ├─> Vérifie ticket non verrouillé
           ├─> Vérifie entreprise autorisée (regies_entreprises)
           ├─> INSERT INTO missions
           ├─> UPDATE tickets SET locked_at = now()
           ├─> UPDATE tickets SET statut = 'en_cours'
           └─> RETURN { success: true, mission_id }

4. Mission créée
   └─> missions (statut = 'en_attente')
       ├─> Visible par régie
       ├─> Visible par entreprise
       ├─> Visible par locataire
       └─> Modifiable par entreprise et régie
```

---

## 🎯 Critères de validation ÉTAPE 10

| Critère | Statut | Détails |
|---------|--------|---------|
| **Table missions créée** | ✅ | Avec toutes les colonnes requises |
| **Contrainte unique ticket_id** | ✅ | Une seule mission par ticket |
| **Colonne locked_at ajoutée** | ✅ | Verrouillage des tickets |
| **Fonction SQL créée** | ✅ | accept_ticket_and_create_mission() |
| **Vérification entreprise autorisée** | ✅ | Via regies_entreprises |
| **RLS configuré** | ✅ | 6 policies (SELECT + UPDATE) |
| **API acceptation créée** | ✅ | POST /api/tickets/accept |
| **Vue missions_details** | ✅ | Jointure complète |
| **Tests automatisés** | ✅ | 37 tests passés |

---

## 🚀 Prochaine étape

**ÉTAPE 11** : À déterminer selon JETCv1.pdf

---

## 📝 Commandes de test

```bash
# Lancer les tests ÉTAPE 10
node tests/missions.test.js

# Résultat attendu
✅ 37/37 tests réussis
ÉTAPE 10 VALIDÉE
```

---

## 💡 Usage de l'API

### Exemple : Entreprise accepte un ticket

**Requête** :
```javascript
const response = await fetch('/api/tickets/accept', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer JWT_TOKEN_ENTREPRISE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ticket_id: 'uuid-du-ticket'
  })
});

const result = await response.json();
```

**Réponse (succès)** :
```json
{
  "success": true,
  "mission_id": "uuid-de-la-mission",
  "message": "Mission créée avec succès"
}
```

**Réponse (erreur - ticket verrouillé)** :
```json
{
  "error": "Ticket déjà verrouillé (mission existante)"
}
```

**Réponse (erreur - entreprise non autorisée)** :
```json
{
  "error": "Entreprise non autorisée pour cette régie"
}
```

---

## 📅 Cycle de vie d'une mission

```
1. en_attente    → Mission créée, entreprise doit démarrer
2. en_cours      → Entreprise démarre les travaux (started_at)
3. terminee      → Entreprise termine les travaux (completed_at)
4. validee       → Régie valide la mission (validated_at)
5. annulee       → Mission annulée (cas exceptionnel)
```

**Transitions possibles** :

| De | Vers | Qui peut |
|----|------|----------|
| en_attente | en_cours | Entreprise |
| en_cours | terminee | Entreprise |
| terminee | validee | Régie |
| * | annulee | Régie ou Entreprise |

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
- **ÉTAPE 10** : ✅ **Acceptation ticket & création mission** ⬅ ACTUEL
- **ÉTAPE 11** : 🔜 À venir

---

**✅ ÉTAPE 10 COMPLÈTE ET VALIDÉE**

**SYSTÈME DE MISSIONS ACTIVÉ** 🎯✅
