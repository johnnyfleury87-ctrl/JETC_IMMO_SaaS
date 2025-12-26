# 🔍 GAP ANALYSIS - TICKETS JETC_IMMO

**Date** : 26 décembre 2025  
**Objectif** : Comparaison "ATTENDU vs EXISTANT"  
**Sources** :
- ATTENDU : [SPEC_FONCTIONNELLE_TICKETS.md](SPEC_FONCTIONNELLE_TICKETS.md)
- EXISTANT : [AUDIT_TICKETS_CURRENT_STATE.md](AUDIT_TICKETS_CURRENT_STATE.md)

---

## 📊 MÉTHODOLOGIE

Pour chaque élément, classification en :

| Symbole | Signification | Action requise |
|---------|---------------|----------------|
| 🔴 | **BLOQUANT** | Empêche workflow, à corriger en priorité |
| 🟡 | **RISQUE** | Fonctionne mais incohérent, peut casser |
| 🟢 | **AMÉLIORATION** | Facultatif, optimisation |
| ✅ | **CONFORME** | Aucune action |
| 🗑️ | **À SUPPRIMER** | Code mort, obsolète |

---

## 1️⃣ TABLE `tickets` - COLONNES

### Comparaison exhaustive

| Colonne | EXISTANT | ATTENDU | État | Impact |
|---------|----------|---------|------|--------|
| **Groupe 1 : Identification** | | | | |
| `id` | ✅ uuid PK | ✅ uuid PK | ✅ | - |
| `titre` | ✅ text NOT NULL | ✅ text NOT NULL (max 255) | 🟢 | Ajouter contrainte longueur |
| `description` | ✅ text NOT NULL | ✅ text NOT NULL | ✅ | - |
| `created_at` | ✅ timestamptz | ✅ timestamptz | ✅ | - |
| `updated_at` | ✅ timestamptz | ✅ timestamptz | ✅ | - |
| **Groupe 2 : Classification** | | | | |
| `categorie` | ✅ text NOT NULL CHECK (8 valeurs) | ✅ text NOT NULL CHECK (8 valeurs) | ✅ | - |
| `sous_categorie` | 🔴 **N'EXISTE PAS** | ✅ text NOT NULL | 🔴 BLOQUANT | **Colonne à créer + contrainte CHECK** |
| `piece` | 🔴 **N'EXISTE PAS** | ✅ text NOT NULL (ENUM 7 valeurs) | 🔴 BLOQUANT | **Colonne à créer + CHECK** |
| `priorite` | ✅ text CHECK (4 valeurs) | ✅ text CHECK (4 valeurs) | ✅ | - |
| `urgence` | ✅ boolean DEFAULT false | ✅ boolean DEFAULT false | ✅ | - |
| **Groupe 3 : Statut et workflow** | | | | |
| `statut` | ✅ ticket_status ENUM | ✅ ticket_status ENUM | 🟡 | Default 'nouveau' mais API utilise 'ouvert' |
| `mode_diffusion` | 🔴 **N'EXISTE PAS** | ✅ text NULL ('public'/'assigné') | 🔴 BLOQUANT | **Colonne à créer + CHECK** |
| `date_limite` | ✅ timestamptz NULL | ✅ timestamptz NULL | ✅ | - |
| `date_cloture` | ✅ timestamptz NULL | ✅ timestamptz NULL | ✅ | - |
| `locked_at` | ✅ timestamptz NULL | ✅ timestamptz NULL | ✅ | - |
| **Groupe 4 : Relations** | | | | |
| `locataire_id` | ✅ uuid NOT NULL FK | ✅ uuid NOT NULL FK | ✅ | - |
| `logement_id` | ✅ uuid NOT NULL FK | ✅ uuid NOT NULL FK | ✅ | - |
| `regie_id` | ✅ uuid NOT NULL (auto) | ✅ uuid NOT NULL (auto) | ✅ | - |
| `entreprise_id` | ✅ uuid NULL FK | ✅ uuid NULL FK | ✅ | - |
| `technicien_id` | ✅ uuid NULL FK | ✅ uuid NULL FK | ✅ | - |
| **Groupe 5 : Budget** | | | | |
| `plafond_intervention_chf` | 🔴 **N'EXISTE PAS** | ✅ numeric(10,2) NOT NULL DEFAULT 0 | 🔴 BLOQUANT | **Colonne à créer + CHECK >= 0** |
| `devise` | 🔴 **N'EXISTE PAS** | ✅ text NOT NULL DEFAULT 'CHF' | 🔴 BLOQUANT | **Colonne à créer + CHECK = 'CHF'** |
| **Groupe 6 : Médias** | | | | |
| `photos` | ✅ text[] NULL | ✅ text[] NULL | ✅ | - |

### Bilan colonnes tickets

| État | Nombre | Liste |
|------|--------|-------|
| ✅ Conforme | 16/20 | id, titre, description, dates, categorie, priorite, urgence, statut, relations, photos |
| 🟡 Risque | 1/20 | statut (default incohérent) |
| 🔴 Bloquant | 4/20 | **sous_categorie, piece, plafond_intervention_chf, devise, mode_diffusion** |

---

## 2️⃣ TABLE `tickets_disponibilites` - NOUVELLE TABLE

### État actuel

🔴 **TABLE N'EXISTE PAS**

### Attendu

```sql
CREATE TABLE tickets_disponibilites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  date_debut timestamptz NOT NULL,
  date_fin timestamptz NOT NULL CHECK (date_fin > date_debut),
  preference int NOT NULL CHECK (preference IN (1, 2, 3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, preference)
);
```

### Impact

🔴 **BLOQUANT** : Sans cette table, impossible de stocker les 3 créneaux de disponibilité du locataire.

### Migration requise

1. Créer table
2. Créer contrainte EXCLUDE pour éviter chevauchements
3. Créer trigger validation 3 créneaux avant diffusion

---

## 3️⃣ TABLE `missions` - COLONNES

### Comparaison

| Colonne | EXISTANT | ATTENDU | État | Impact |
|---------|----------|---------|------|--------|
| `id` | ✅ uuid PK | ✅ uuid PK | ✅ | - |
| `ticket_id` | ✅ uuid UNIQUE FK | ✅ uuid UNIQUE FK | ✅ | - |
| `entreprise_id` | ✅ uuid FK | ✅ uuid FK | ✅ | - |
| `technicien_id` | ✅ uuid NULL FK | ✅ uuid NULL FK | ✅ | - |
| `statut` | ✅ text CHECK | ✅ text CHECK | 🟢 | ENUM `mission_status` existe mais inutilisé |
| `dates` | ✅ OK | ✅ OK | ✅ | - |
| `notes`, `devis_url`, `facture_url` | ✅ OK | ✅ OK | ✅ | - |
| `montant` | ✅ decimal(10,2) | ❌ Renommer `montant_reel_chf` | 🟡 RISQUE | **Renommage colonne pour clarté** |
| `devise` | 🔴 **N'EXISTE PAS** | ✅ text NOT NULL DEFAULT 'CHF' | 🔴 BLOQUANT | **Colonne à créer** |

### Bilan missions

| État | Nombre | Action |
|------|--------|--------|
| ✅ Conforme | 11/13 | - |
| 🟡 Risque | 1/13 | Renommer `montant` → `montant_reel_chf` |
| 🔴 Bloquant | 1/13 | Ajouter colonne `devise` |

---

## 4️⃣ TABLE `regies_entreprises` - COLONNES

### Comparaison

| Colonne | EXISTANT | ATTENDU | État | Impact |
|---------|----------|---------|------|--------|
| `id`, `regie_id`, `entreprise_id` | ✅ OK | ✅ OK | ✅ | - |
| `mode_diffusion` | ✅ text CHECK ('general', 'restreint') | ✅ text CHECK ('general', 'restreint') | ✅ | - |
| `date_autorisation` | ✅ OK | ✅ OK | ✅ | - |
| `autorise` | 🔴 **N'EXISTE PAS** | ❌ Pas dans spec | 🔴 BLOQUANT | **MAIS utilisé dans RPC accept_ticket_and_create_mission() ligne 127** |

### Problème spécifique

**RPC `accept_ticket_and_create_mission()` contient** :

```sql
-- Ligne 127
WHERE regie_id = v_regie_id
  AND entreprise_id = p_entreprise_id
  AND autorise = true  -- ❌ COLONNE N'EXISTE PAS
```

### Décision à prendre

**Option 1** : Ajouter colonne `autorise boolean NOT NULL DEFAULT true`

**Option 2** : Supprimer ce check de la RPC (suffisant de vérifier `mode_diffusion`)

### Recommandation

✅ **Option 2** : Le check `mode_diffusion = 'general'` suffit. La colonne `autorise` est redondante.

**Action** : Corriger RPC, ne PAS ajouter colonne.

---

## 5️⃣ ENUMS

### ENUM `ticket_status`

| Valeur | EXISTANT | ATTENDU | État |
|--------|----------|---------|------|
| `nouveau` | ✅ | ✅ | ✅ |
| `ouvert` | ✅ | ✅ | ✅ |
| `en_attente` | ✅ | ✅ | ✅ |
| `en_cours` | ✅ | ✅ | ✅ |
| `termine` | ✅ | ✅ | ✅ |
| `clos` | ✅ | ✅ | ✅ |
| `annule` | ✅ | ✅ | ✅ |

**Bilan** : ✅ Conforme

**Problème lié** : 🟡 API `/create` hardcode `statut: 'ouvert'` au lieu de laisser default `'nouveau'`

---

## 6️⃣ VUES

### VUE `tickets_visibles_entreprise`

#### Logique actuelle

```sql
WHERE
  (
    re.mode_diffusion = 'general'
    AND t.statut = 'ouvert'  -- ❌ PROBLÈME
  )
  OR
  (
    re.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  )
```

#### Logique attendue

```sql
WHERE
  (
    -- Mode PUBLIC
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'       -- ✅ Nouveau champ
    AND t.statut = 'en_attente'           -- ✅ Corrigé
    AND t.locked_at IS NULL
  )
  OR
  (
    -- Mode ASSIGNÉ
    t.mode_diffusion = 'assigné'          -- ✅ Nouveau champ
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  (
    -- Déjà accepté
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  )
```

#### État

🔴 **BLOQUANT** : Vue actuelle rend tickets invisibles aux entreprises après diffusion.

**Problèmes** :
1. Filtre `statut = 'ouvert'` alors que diffusion met `'en_attente'`
2. Ne gère pas distinction public/assigné (colonne `mode_diffusion` manquante)
3. Ne filtre pas `locked_at` pour éviter double-affichage

---

## 7️⃣ FONCTIONS RPC

### 1. `accept_ticket_and_create_mission()`

#### Comparaison

| Check | EXISTANT | ATTENDU | État |
|-------|----------|---------|------|
| Vérifie ticket non verrouillé | ✅ `locked_at IS NULL` | ✅ | ✅ |
| Vérifie statut = 'en_attente' | ❌ Non vérifié | ✅ | 🟡 RISQUE |
| Vérifie autorisation entreprise | 🔴 `autorise = true` (colonne inexistante) | ✅ Check `mode_diffusion` | 🔴 BLOQUANT |
| Vérifie mode public/assigné | ❌ Non | ✅ Logique différenciée | 🔴 BLOQUANT |
| Crée mission | ✅ | ✅ | ✅ |
| Verrouille ticket | ✅ `locked_at = now()` | ✅ | ✅ |
| Change statut → 'en_cours' | ✅ | ✅ | ✅ |

#### État

🔴 **BLOQUANT** : Fonction va crash sur `autorise` inexistant.

**Action** : Réécrire vérifications (voir spec section 8).

---

### 2. `update_ticket_statut()`

#### État actuel

🔴 **FONCTION N'EXISTE PAS**

#### Appelée par

- API `/api/tickets/diffuser` (ligne inconnue)

#### État

🔴 **BLOQUANT** : Erreur SQL lors appel.

**Action** : Créer fonction avec validation transitions (voir spec section 8).

---

### 3. `diffuser_ticket()`

#### État actuel

🔴 **FONCTION N'EXISTE PAS**

#### Attendue

```sql
diffuser_ticket(
  p_ticket_id uuid,
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
) RETURNS void
```

#### État

🔴 **BLOQUANT** : Actuellement, diffusion se fait via UPDATE direct dans API, sans validation.

**Action** : Créer RPC avec logique métier (spec section 8).

---

## 8️⃣ ROW LEVEL SECURITY

### Policy `Entreprise can view authorized tickets`

#### Logique actuelle

```sql
WHERE
  tickets.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
  OR
  (
    tickets.statut = 'ouvert'  -- ❌ PROBLÈME
    AND EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = tickets.regie_id
      AND entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
    )
  )
```

#### Logique attendue

```sql
WHERE
  (
    -- Mode PUBLIC
    tickets.mode_diffusion = 'public'
    AND tickets.statut = 'en_attente'
    AND tickets.locked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM regies_entreprises re
      WHERE re.regie_id = tickets.regie_id
      AND re.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      AND re.mode_diffusion = 'general'
    )
  )
  OR
  (
    -- Mode ASSIGNÉ
    tickets.mode_diffusion = 'assigné'
    AND tickets.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
  )
  OR
  (
    -- Déjà accepté
    tickets.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
    AND tickets.statut IN ('en_cours', 'termine', 'clos')
  )
```

#### État

🔴 **BLOQUANT** : Tickets diffusés invisibles.

**Action** : Recréer policy avec nouvelle logique.

---

### Policy `Regie can manage own tickets` (FOR ALL)

#### Problème

Policy `FOR ALL` permet DELETE sans vérification.

**Risque** : Régie peut supprimer ticket avec mission en cours.

#### État

🟡 **RISQUE**

**Action** : Restreindre à `FOR SELECT, INSERT, UPDATE` et créer policy DELETE séparée avec check :

```sql
-- Nouvelle policy
CREATE POLICY "Regie can delete tickets without missions"
ON tickets FOR DELETE
TO authenticated
USING (
  regie_id = get_user_regie_id()
  AND NOT EXISTS (SELECT 1 FROM missions WHERE ticket_id = tickets.id)
);
```

---

## 9️⃣ API BACKEND

### 1. `POST /api/tickets/create`

#### Problème

```javascript
// Ligne 143
const { data, error } = await supabaseAdmin
  .from('tickets')
  .insert({
    statut: 'ouvert',  // ❌ DEVRAIT ÊTRE 'nouveau'
    // ...
  });
```

#### État

🟡 **RISQUE** : Bypass validation régie, ticket directement ouvert.

**Action** : Utiliser default SQL (`'nouveau'`) ou supprimer ce champ du INSERT.

---

### 2. `POST /api/tickets/diffuser`

#### Problèmes

1. Appelle RPC `update_ticket_statut()` inexistante
2. Met statut `'en_attente'` invisible pour entreprises

#### État

🔴 **BLOQUANT**

**Action** : Appeler nouvelle RPC `diffuser_ticket()` avec mode_diffusion.

---

### 3. `POST /api/tickets/accept`

#### Problème

Appelle RPC `accept_ticket_and_create_mission()` qui crashe sur colonne `autorise`.

#### État

🔴 **BLOQUANT**

**Action** : Corriger RPC (voir section 7.1).

---

### 4. `GET /api/tickets/entreprise`

#### Problème

```javascript
const { data, error } = await supabaseClient
  .from('tickets_visibles_entreprise')  // ❌ Vue filtre mal
  .select('*');
```

#### État

🔴 **BLOQUANT** : Liste vide alors que tickets diffusés.

**Action** : Corriger vue (voir section 6).

---

## 🔟 TRIGGERS

### Existants

| Trigger | Table | État | Notes |
|---------|-------|------|-------|
| `set_ticket_regie_id_trigger` | tickets | ✅ OK | Calcule regie_id automatiquement |
| `missions_updated_at` | missions | ✅ OK | Met à jour updated_at |

### Manquants

| Trigger | Table | État | Action |
|---------|-------|------|--------|
| `validate_disponibilites` | tickets | 🔴 MANQUANT | **À créer** - Vérifie 3 créneaux avant diffusion |
| `sync_mission_statut_to_ticket` | missions | 🔴 MANQUANT | **À créer** - Synchronise statut mission → ticket |

#### État

🔴 **BLOQUANT** pour `validate_disponibilites` (spec exige 3 créneaux).

🟢 **AMÉLIORATION** pour `sync_mission_statut_to_ticket` (peut être géré en API).

---

## 📊 TABLEAU RÉCAPITULATIF - TOUTES LES GAPS

### Classement par priorité

#### 🔴 BLOQUANTS (10)

| # | Gap | Localisation | Impact | Migration requise |
|---|-----|--------------|--------|-------------------|
| **1** | Colonne `sous_categorie` manquante | TABLE tickets | Impossible classifier finement | ALTER TABLE ADD COLUMN + CHECK |
| **2** | Colonne `piece` manquante | TABLE tickets | Impossible localiser intervention | ALTER TABLE ADD COLUMN + CHECK |
| **3** | Colonne `plafond_intervention_chf` manquante | TABLE tickets | Pas de contrôle budget | ALTER TABLE ADD COLUMN |
| **4** | Colonne `devise` manquante (tickets) | TABLE tickets | Ambiguïté montants | ALTER TABLE ADD COLUMN CHECK |
| **5** | Colonne `mode_diffusion` manquante | TABLE tickets | Impossible gérer public/assigné | ALTER TABLE ADD COLUMN CHECK |
| **6** | Table `tickets_disponibilites` manquante | NOUVELLE TABLE | Pas de créneaux locataire | CREATE TABLE + trigger |
| **7** | Colonne `devise` manquante (missions) | TABLE missions | Ambiguïté montants mission | ALTER TABLE ADD COLUMN CHECK |
| **8** | Vue `tickets_visibles_entreprise` filtre mal | VUE | Tickets invisibles entreprises | DROP + CREATE OR REPLACE |
| **9** | RPC `accept_ticket_and_create_mission()` utilise colonne inexistante | FONCTION | Crash acceptation ticket | CREATE OR REPLACE |
| **10** | RPC `update_ticket_statut()` n'existe pas | FONCTION | Crash diffusion | CREATE FUNCTION |
| **11** | RPC `diffuser_ticket()` n'existe pas | FONCTION | Pas de validation diffusion | CREATE FUNCTION |
| **12** | RLS Policy entreprise filtre statut 'ouvert' | POLICY | Tickets invisibles | DROP + CREATE |

#### 🟡 RISQUES (4)

| # | Gap | Localisation | Impact | Migration requise |
|---|-----|--------------|--------|-------------------|
| **1** | Statut initial incohérent (API vs SQL) | API create | Bypass validation régie | Modifier API create.js |
| **2** | Colonne `montant` ambiguë | TABLE missions | Clarté | ALTER TABLE RENAME COLUMN |
| **3** | Policy FOR ALL permet DELETE | RLS tickets | Suppression tickets avec missions | DROP + CREATE 2 policies |
| **4** | RPC accept ne vérifie pas statut | FONCTION | Acceptation ticket déjà pris | Modifier RPC |

#### 🟢 AMÉLIORATIONS (3)

| # | Gap | Localisation | Impact | Migration requise |
|---|-----|--------------|--------|-------------------|
| **1** | ENUM `mission_status` inutilisé | TABLE missions | Incohérence type | ALTER TABLE ALTER COLUMN |
| **2** | Trigger sync mission ↔ ticket manquant | TRIGGER | Synchronisation manuelle | CREATE TRIGGER |
| **3** | Contrainte longueur `titre` manquante | TABLE tickets | Validation | ALTER TABLE ADD CONSTRAINT |

---

## 📈 RÉSUMÉ QUANTITATIF

| Catégorie | Nombre | % du total |
|-----------|--------|-----------|
| 🔴 Bloquants | 12 | 63% |
| 🟡 Risques | 4 | 21% |
| 🟢 Améliorations | 3 | 16% |
| **TOTAL** | **19** | **100%** |

---

## 🎯 RECOMMANDATION ORDRE DE CORRECTION

### Phase 1 - Fondations (BLOQUANTS critiques)

**Objectif** : Débloquer workflow actuel

1. ✅ Ajouter colonnes budget : `plafond_intervention_chf`, `devise`
2. ✅ Corriger RPC `accept_ticket_and_create_mission()` (supprimer check `autorise`)
3. ✅ Créer RPC `update_ticket_statut()` (validation transitions)
4. ✅ Créer RPC `diffuser_ticket()` (logique métier)
5. ✅ Ajouter colonne `mode_diffusion` sur tickets
6. ✅ Corriger vue `tickets_visibles_entreprise` (statut + mode)
7. ✅ Corriger policy RLS entreprise (statut + mode)

**Test** : Workflow Locataire crée → Régie diffuse → Entreprise accepte doit passer.

---

### Phase 2 - Enrichissement (BLOQUANTS fonctionnels)

**Objectif** : Ajouter fonctionnalités spec

1. ✅ Ajouter colonnes classification : `sous_categorie`, `piece`
2. ✅ Créer table `tickets_disponibilites` + trigger validation
3. ✅ Créer trigger sync mission ↔ ticket
4. ✅ Renommer colonne missions `montant` → `montant_reel_chf`

**Test** : Création ticket avec tous champs obligatoires doit passer.

---

### Phase 3 - Sécurisation (RISQUES)

**Objectif** : Éliminer risques

1. ✅ Corriger API `/create` : Utiliser default 'nouveau'
2. ✅ Restreindre policy régie DELETE
3. ✅ Ajouter vérif statut dans RPC accept

**Test** : Tests sécurité (tentative doublon, suppression mission active, etc.)

---

### Phase 4 - Polissage (AMÉLIORATIONS)

**Objectif** : Cohérence

1. ✅ Utiliser ENUM `mission_status` au lieu de text + CHECK
2. ✅ Ajouter contrainte longueur titre

**Test** : Audit conformité finale.

---

## ✅ CRITÈRES DE VALIDATION

Un ticket est **CONFORME à la spec** si :

- [ ] Possède colonnes : sous_categorie, piece, plafond_chf, devise, mode_diffusion
- [ ] A 3 disponibilités dans table dédiée
- [ ] Workflow complet fonctionne (créer → diffuser → accepter → terminer → clore)
- [ ] Entreprises voient tickets selon mode diffusion
- [ ] RLS empêche accès non autorisés
- [ ] Pas d'erreur SQL dans logs
- [ ] Tests E2E passent

---

**FIN DE LA GAP ANALYSIS**

**Prochaine étape** : [MIGRATION_PLAN_TICKETS.md](MIGRATION_PLAN_TICKETS.md) - Plan de migration séquentiel et safe
