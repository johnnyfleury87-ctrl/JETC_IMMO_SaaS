# 📐 SPECIFICATION FONCTIONNELLE - TICKETS JETC_IMMO

**Version** : 2.0  
**Date** : 26 décembre 2025  
**Statut** : Document de référence "Source of Truth"  
**Périmètre** : Flux Locataire → Régie → Entreprise

---

## 🎯 OBJECTIF

Ce document définit **EXACTEMENT** comment doit fonctionner le système de tickets dans JETC_IMMO, avec toutes les contraintes techniques et métier.

**Ce document prévaut sur toute implémentation existante.**

---

## 1️⃣ CYCLE DE VIE D'UN TICKET

### Diagramme

```
LOCATAIRE                RÉGIE                    ENTREPRISE
    |                       |                           |
    |--CREATE TICKET------->|                           |
    |   (nouveau)           |                           |
    |                       |                           |
    |                       |--VALIDER----------------->|
    |                       |   (ouvert)                |
    |                       |                           |
    |                       |--DIFFUSER--------------->|
    |                       |   (en_attente)            |
    |                       |                           |
    |                       |                  ACCEPTER |
    |                       |<----------(en_cours)------|
    |                       |                           |
    |                       |                  TERMINER |
    |                       |<----------(termine)-------|
    |                       |                           |
    |                       |--VALIDER / CLORE--------->|
    |                       |   (clos)                  |
    |                       |                           |
```

### Statuts ENUM `ticket_status`

| Valeur | Acteur | Signification | Visible par |
|--------|--------|---------------|-------------|
| **nouveau** | Locataire | Ticket créé, en attente validation régie | Locataire, Régie, Admin |
| **ouvert** | Régie | Ticket validé par régie, prêt pour diffusion | Locataire, Régie, Admin |
| **en_attente** | Régie | Ticket diffusé aux entreprises | Locataire, Régie, **Entreprises autorisées**, Admin |
| **en_cours** | Entreprise | Mission acceptée, intervention en cours | Locataire, Régie, Entreprise assignée, Admin |
| **termine** | Entreprise | Intervention terminée, attente validation régie | Locataire, Régie, Entreprise assignée, Admin |
| **clos** | Régie | Ticket validé et clôturé | Tous |
| **annule** | Régie ou Locataire | Ticket annulé | Tous |

### Transitions autorisées

| De | Vers | Qui peut | Condition |
|----|------|----------|-----------|
| `nouveau` | `ouvert` | Régie | Validation du besoin |
| `nouveau` | `annule` | Locataire, Régie | Demande erronée |
| `ouvert` | `en_attente` | Régie | Diffusion aux entreprises |
| `ouvert` | `annule` | Régie | Finalement non valable |
| `en_attente` | `en_cours` | Entreprise | Acceptation via RPC |
| `en_attente` | `annule` | Régie | Aucune entreprise ne prend |
| `en_cours` | `termine` | Entreprise/Technicien | Fin intervention |
| `en_cours` | `annule` | Régie | Annulation exceptionnelle |
| `termine` | `clos` | Régie | Validation travaux |
| `termine` | `en_cours` | Régie | Travaux non conformes, reprise |
| `clos` | - | Aucun | Statut terminal |
| `annule` | - | Aucun | Statut terminal |

---

## 2️⃣ STRUCTURE DES TICKETS

### TABLE `tickets` - Colonnes obligatoires

#### Groupe 1 : Identification

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| `id` | uuid | NO | uuid_generate_v4() | PK |
| `titre` | text | NO | - | Max 255 caractères |
| `description` | text | NO | - | Markdown autorisé |
| `created_at` | timestamptz | NO | now() | Tracabilité |
| `updated_at` | timestamptz | NO | now() | Tracabilité |

#### Groupe 2 : Classification **[NOUVELLE SPEC]**

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| `categorie` | text | NO | - | Valeur ENUM (voir liste) |
| **`sous_categorie`** | text | **NO** | - | **NOUVELLE** - Valeur ENUM dépendante de categorie |
| **`piece`** | text | **NO** | - | **NOUVELLE** - ENUM : 'cuisine', 'sdb', 'salon', 'chambre', 'couloir', 'cave', 'autre' |
| `priorite` | text | NO | 'normale' | ENUM : 'faible', 'normale', 'haute', 'urgente' |
| `urgence` | boolean | NO | false | Si true → priorite automatique 'urgente' |

#### Groupe 3 : Statut et workflow

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| `statut` | ticket_status | NO | **'nouveau'** | ENUM (7 valeurs) |
| `mode_diffusion` | text | YES | NULL | **NOUVELLE** - 'public' ou 'assigné' (NULL = pas encore diffusé) |
| `date_limite` | timestamptz | YES | NULL | Calculé : created_at + délai priorité |
| `date_cloture` | timestamptz | YES | NULL | Rempli au passage 'clos' |
| `locked_at` | timestamptz | YES | NULL | Verrouillage anti-doublon mission |

#### Groupe 4 : Relations

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| `locataire_id` | uuid | NO | - | FK → locataires ON DELETE CASCADE |
| `logement_id` | uuid | NO | - | FK → logements ON DELETE CASCADE |
| `regie_id` | uuid | NO | - | **Calculé automatiquement** via trigger |
| `entreprise_id` | uuid | YES | NULL | FK → entreprises ON DELETE SET NULL (rempli à l'acceptation) |
| `technicien_id` | uuid | YES | NULL | FK → techniciens ON DELETE SET NULL |

#### Groupe 5 : Budget **[NOUVELLE SPEC]**

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| **`plafond_intervention_chf`** | numeric(10,2) | **NO** | **0** | **NOUVELLE** - Montant max autorisé |
| **`devise`** | text | **NO** | **'CHF'** | **NOUVELLE** - Toujours CHF (contrainte CHECK) |

#### Groupe 6 : Médias

| Colonne | Type | Nullable | Default | Notes |
|---------|------|----------|---------|-------|
| `photos` | text[] | YES | NULL | URLs Supabase Storage |

---

### TABLE `tickets_disponibilites` **[NOUVELLE TABLE]**

**Objectif** : Stocker les 3 créneaux de disponibilité du locataire pour l'intervention.

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | uuid_generate_v4() | PK |
| `ticket_id` | uuid | NO | - | FK → tickets ON DELETE CASCADE |
| `date_debut` | timestamptz | NO | - | - |
| `date_fin` | timestamptz | NO | - | CHECK (date_fin > date_debut) |
| `preference` | int | NO | - | CHECK (preference IN (1, 2, 3)) |
| `created_at` | timestamptz | NO | now() | - |

#### Contraintes

```sql
-- Un ticket a exactement 3 disponibilités (1, 2, 3)
UNIQUE (ticket_id, preference)

-- Les créneaux ne se chevauchent pas
EXCLUDE USING gist (ticket_id WITH =, tstzrange(date_debut, date_fin) WITH &&)
```

#### Règles métier

- ✅ **Obligatoire** : Lors création ticket, locataire doit fournir 3 créneaux
- ✅ Préférence 1 = premier choix, 2 = second choix, 3 = dernier recours
- ✅ Durée minimale créneau : 2h
- ✅ Créneaux doivent être dans le futur (> now())

---

## 3️⃣ CATÉGORIES & SOUS-CATÉGORIES

### Structure hiérarchique

#### 1. Plomberie

- Fuite d'eau
- WC bouché
- Robinetterie défectueuse
- Chauffe-eau
- Autre plomberie

#### 2. Électricité

- Panne de courant
- Disjoncteur qui saute
- Prise défectueuse
- Interrupteur cassé
- Luminaire
- Autre électricité

#### 3. Chauffage

- Radiateur ne chauffe pas
- Fuite radiateur
- Thermostat défectueux
- Chaudière
- Autre chauffage

#### 4. Serrurerie

- Clé cassée
- Serrure bloquée
- Porte claquée
- Autre serrurerie

#### 5. Vitrerie

- Vitre cassée
- Fenêtre bloquée
- Double vitrage
- Autre vitrerie

#### 6. Menuiserie

- Porte abîmée
- Placard
- Parquet
- Autre menuiserie

#### 7. Peinture

- Mur abîmé
- Plafond
- Boiserie
- Autre peinture

#### 8. Autre

- Divers
- À définir

### Validation

**Règle** : `sous_categorie` doit appartenir à la liste de `categorie`

**Implémentation** :
- CHECK constraint (liste exhaustive)
- OU table de référence `categories_sous_categories`

---

## 4️⃣ MODES DE DIFFUSION

### Principes

Lorsqu'une régie diffuse un ticket, elle choisit :

| Mode | Signification | Qui voit le ticket |
|------|---------------|-------------------|
| **public** | Diffusion large | **Toutes** les entreprises autorisées par la régie (mode_diffusion='general') |
| **assigné** | Diffusion ciblée | **Une seule** entreprise spécifiée (rempli entreprise_id immédiatement) |

### Règles métier

#### Mode PUBLIC

```
Conditions :
- ticket.mode_diffusion = 'public'
- ticket.entreprise_id = NULL (pas d'assignation)
- ticket.statut = 'en_attente'

Qui voit :
- SELECT * FROM regies_entreprises
  WHERE regie_id = <regie_du_ticket>
  AND mode_diffusion = 'general'

Acceptation :
- N'importe quelle entreprise autorisée peut accepter
- Premier arrivé, premier servi
- Verrouillage via locked_at
```

#### Mode ASSIGNÉ

```
Conditions :
- ticket.mode_diffusion = 'assigné'
- ticket.entreprise_id = <entreprise_choisie>
- ticket.statut = 'en_attente'

Qui voit :
- UNIQUEMENT l'entreprise assignée

Acceptation :
- Seule l'entreprise assignée peut accepter
```

### Modification après diffusion

🔴 **Règle stricte** : Une fois diffusé, `mode_diffusion` ne peut plus changer.

---

## 5️⃣ BUDGET & PLAFOND

### Principe

Chaque ticket a un **plafond d'intervention** en CHF défini par la régie lors de la validation.

### Règles

| Champ | Type | Obligatoire | Default | Contrainte |
|-------|------|-------------|---------|------------|
| `plafond_intervention_chf` | numeric(10,2) | ✅ OUI | 0 | CHECK >= 0 |
| `devise` | text | ✅ OUI | 'CHF' | CHECK = 'CHF' |

### Workflow

1. **Locataire crée ticket** → `plafond_intervention_chf = 0` (non défini encore)
2. **Régie valide ticket** → Régie remplit `plafond_intervention_chf` (ex: 500.00)
3. **Entreprise accepte** → Voit le plafond dans mission
4. **Entreprise termine** → Remplit `montant_reel` dans mission
5. **Régie valide** → Compare montant_reel vs plafond

### Alertes

- 🟡 Si `montant_reel > plafond * 0.9` : Alerte "proche du plafond"
- 🔴 Si `montant_reel > plafond` : Blocage validation + demande explicite accord régie

---

## 6️⃣ MISSIONS

### TABLE `missions` - Modifications

#### Colonnes existantes OK

| Colonne | Type | Notes |
|---------|------|-------|
| `id`, `ticket_id` (UNIQUE), `entreprise_id`, `technicien_id` | uuid | ✅ OK |
| `statut`, `created_at`, `started_at`, `completed_at`, `validated_at` | - | ✅ OK |
| `date_intervention_prevue`, `date_intervention_realisee` | timestamptz | ✅ OK |
| `notes`, `devis_url`, `facture_url` | text | ✅ OK |

#### Colonnes à modifier

| Colonne actuelle | Nouveau | Type | Notes |
|------------------|---------|------|-------|
| `montant` | **`montant_reel_chf`** | numeric(10,2) | Renommage pour clarté |
| - | **`devise`** | text | **NOUVELLE** - Toujours 'CHF' |

#### Règles métier missions

- ✅ Contrainte UNIQUE sur `ticket_id` : 1 mission max par ticket
- ✅ Statut mission synchronisé avec ticket :
  - Mission 'en_attente' → ticket 'en_cours'
  - Mission 'terminee' → ticket 'termine'
  - Mission 'validee' → ticket 'clos'

---

## 7️⃣ ROW LEVEL SECURITY (RLS)

### Règles par rôle

#### LOCATAIRE

```sql
-- SELECT tickets
WHERE tickets.locataire_id IN (
  SELECT id FROM locataires
  WHERE profile_id = auth.uid()
)

-- INSERT tickets
AVEC locataire.logement_id NOT NULL

-- UPDATE tickets
UNIQUEMENT si statut = 'nouveau' (avant validation régie)
```

#### RÉGIE

```sql
-- SELECT tickets
WHERE tickets.regie_id = get_user_regie_id()

-- UPDATE tickets
WHERE tickets.regie_id = get_user_regie_id()
-- Peut modifier : statut, plafond_intervention_chf, mode_diffusion, entreprise_id

-- ⚠️ DELETE tickets
🟡 INTERDIT si mission existe
```

#### ENTREPRISE

```sql
-- SELECT tickets
WHERE (
  -- Mode PUBLIC
  (
    tickets.mode_diffusion = 'public'
    AND tickets.statut IN ('en_attente', 'en_cours', 'termine')
    AND EXISTS (
      SELECT 1 FROM regies_entreprises re
      WHERE re.regie_id = tickets.regie_id
      AND re.entreprise_id = <current_entreprise_id>
      AND re.mode_diffusion = 'general'
    )
  )
  OR
  -- Mode ASSIGNÉ
  (
    tickets.mode_diffusion = 'assigné'
    AND tickets.entreprise_id = <current_entreprise_id>
  )
  OR
  -- Déjà accepté
  (
    tickets.entreprise_id = <current_entreprise_id>
    AND tickets.statut IN ('en_cours', 'termine', 'clos')
  )
)

-- UPDATE tickets
🔴 INTERDIT (passage par RPC uniquement)
```

---

## 8️⃣ FONCTIONS RPC

### 1. `accept_ticket_and_create_mission()`

**Signature existante OK**

```sql
accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
) RETURNS jsonb
```

**Logique corrigée** :

```sql
BEGIN
  -- 1. Récupère infos ticket
  SELECT regie_id, statut, locked_at, mode_diffusion, entreprise_id
  INTO v_regie_id, v_statut, v_locked_at, v_mode_diffusion, v_entreprise_assignee
  FROM tickets
  WHERE id = p_ticket_id;

  -- 2. Vérifications
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé';
  END IF;

  IF v_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket pas en statut en_attente';
  END IF;

  -- 3. Vérif mode diffusion
  IF v_mode_diffusion = 'public' THEN
    -- Vérifie entreprise autorisée mode general
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_regie_id
      AND entreprise_id = p_entreprise_id
      AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise non autorisée';
    END IF;
  ELSIF v_mode_diffusion = 'assigné' THEN
    -- Vérifie c'est bien l'entreprise assignée
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise';
    END IF;
  END IF;

  -- 4. Crée mission
  INSERT INTO missions (ticket_id, entreprise_id, statut)
  VALUES (p_ticket_id, p_entreprise_id, 'en_attente')
  RETURNING id INTO v_mission_id;

  -- 5. Verrouille + assigne ticket
  UPDATE tickets
  SET
    locked_at = now(),
    entreprise_id = p_entreprise_id,
    statut = 'en_cours',
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'mission_id', v_mission_id);
END;
```

### 2. `update_ticket_statut()` **[À CRÉER]**

**Signature** :

```sql
update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status,
  p_user_role text
) RETURNS void
```

**Logique** :

```sql
BEGIN
  -- Récupère statut actuel
  SELECT statut INTO v_statut_actuel
  FROM tickets
  WHERE id = p_ticket_id;

  -- Valide transition (table transitions_autorisees)
  IF NOT is_transition_autorisee(v_statut_actuel, p_nouveau_statut, p_user_role) THEN
    RAISE EXCEPTION 'Transition interdite';
  END IF;

  -- Update
  UPDATE tickets
  SET statut = p_nouveau_statut, updated_at = now()
  WHERE id = p_ticket_id;
END;
```

### 3. `diffuser_ticket()` **[À CRÉER]**

**Signature** :

```sql
diffuser_ticket(
  p_ticket_id uuid,
  p_mode_diffusion text, -- 'public' ou 'assigné'
  p_entreprise_id uuid DEFAULT NULL -- obligatoire si mode='assigné'
) RETURNS void
```

**Logique** :

```sql
BEGIN
  -- Vérifie rôle régie
  IF NOT get_user_role() = 'regie' THEN
    RAISE EXCEPTION 'Seule la régie peut diffuser';
  END IF;

  -- Vérifie statut = 'ouvert'
  IF (SELECT statut FROM tickets WHERE id = p_ticket_id) != 'ouvert' THEN
    RAISE EXCEPTION 'Ticket doit être ouvert';
  END IF;

  -- Si assigné, vérifie entreprise_id fourni
  IF p_mode_diffusion = 'assigné' AND p_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Mode assigné nécessite entreprise_id';
  END IF;

  -- Update
  UPDATE tickets
  SET
    statut = 'en_attente',
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE WHEN p_mode_diffusion = 'assigné' THEN p_entreprise_id ELSE NULL END,
    updated_at = now()
  WHERE id = p_ticket_id;
END;
```

---

## 9️⃣ VUES

### VUE `tickets_visibles_entreprise` - Logique corrigée

```sql
CREATE OR REPLACE VIEW tickets_visibles_entreprise AS
SELECT
  t.*,
  re.entreprise_id,
  re.mode_diffusion AS autorisation_mode
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE
  (
    -- Mode PUBLIC : tickets diffusés en public, statut en_attente
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  (
    -- Mode ASSIGNÉ : ticket assigné à cette entreprise
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  (
    -- Tickets déjà acceptés par cette entreprise
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );
```

---

## 🔟 VALIDATIONS & CONTRAINTES

### Contraintes CHECK à ajouter

```sql
-- Sur tickets
ALTER TABLE tickets
ADD CONSTRAINT check_plafond_positif
CHECK (plafond_intervention_chf >= 0);

ALTER TABLE tickets
ADD CONSTRAINT check_devise_chf
CHECK (devise = 'CHF');

ALTER TABLE tickets
ADD CONSTRAINT check_mode_diffusion
CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('public', 'assigné'));

ALTER TABLE tickets
ADD CONSTRAINT check_categorie_valide
CHECK (categorie IN ('plomberie', 'électricité', 'chauffage', 'serrurerie', 'vitrerie', 'menuiserie', 'peinture', 'autre'));

ALTER TABLE tickets
ADD CONSTRAINT check_piece_valide
CHECK (piece IN ('cuisine', 'sdb', 'salon', 'chambre', 'couloir', 'cave', 'autre'));

-- Sur missions
ALTER TABLE missions
ADD CONSTRAINT check_montant_positif
CHECK (montant_reel_chf IS NULL OR montant_reel_chf >= 0);

ALTER TABLE missions
ADD CONSTRAINT check_devise_mission_chf
CHECK (devise = 'CHF');
```

### Triggers à créer/modifier

#### 1. Trigger `set_ticket_regie_id`

**Existant** : ✅ OK

#### 2. Trigger `validate_disponibilites`

**Nouveau** : Vérifie qu'un ticket a bien 3 disponibilités

```sql
CREATE OR REPLACE FUNCTION validate_ticket_disponibilites()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tickets_disponibilites WHERE ticket_id = NEW.id) < 3 THEN
    RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_disponibilites_before_diffusion
BEFORE UPDATE OF statut ON tickets
FOR EACH ROW
WHEN (OLD.statut = 'ouvert' AND NEW.statut = 'en_attente')
EXECUTE FUNCTION validate_ticket_disponibilites();
```

#### 3. Trigger `sync_mission_ticket_statut`

**Nouveau** : Synchronise statuts mission ↔ ticket

```sql
CREATE OR REPLACE FUNCTION sync_mission_statut_to_ticket()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'terminee' THEN
    UPDATE tickets SET statut = 'termine' WHERE id = NEW.ticket_id;
  ELSIF NEW.statut = 'validee' THEN
    UPDATE tickets SET statut = 'clos', date_cloture = now() WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_mission_to_ticket
AFTER UPDATE OF statut ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_statut_to_ticket();
```

---

## 📊 RÉSUMÉ DES CHANGEMENTS

### Nouvelles colonnes tickets

| Colonne | Type | Obligatoire | Default |
|---------|------|-------------|---------|
| `sous_categorie` | text | ✅ | - |
| `piece` | text | ✅ | - |
| `plafond_intervention_chf` | numeric(10,2) | ✅ | 0 |
| `devise` | text | ✅ | 'CHF' |
| `mode_diffusion` | text | ❌ | NULL |

### Nouvelle table

- `tickets_disponibilites` (3 créneaux par ticket)

### Nouvelles fonctions RPC

- `diffuser_ticket()` : Remplace appel direct UPDATE
- `update_ticket_statut()` : Validation transitions

### Modifications existantes

- ✅ Vue `tickets_visibles_entreprise` : Logique corrigée (statuts + mode diffusion)
- ✅ RPC `accept_ticket_and_create_mission()` : Vérif mode diffusion
- ✅ RLS entreprise : Ajout logique modes diffusion

---

## ✅ CHECKLIST CONFORMITÉ

Un ticket conforme à cette spec doit :

- [ ] Avoir catégorie + sous_categorie valides
- [ ] Avoir pièce renseignée
- [ ] Avoir 3 disponibilités (table dédiée)
- [ ] Avoir plafond_intervention_chf > 0 (rempli par régie)
- [ ] Avoir mode_diffusion ('public' ou 'assigné') une fois diffusé
- [ ] Respecter cycle statuts (nouveau → ouvert → en_attente → en_cours → termine → clos)
- [ ] Être visible uniquement par entreprises autorisées selon mode diffusion
- [ ] Avoir 1 mission max (contrainte UNIQUE)
- [ ] Avoir montants en CHF explicite

---

**FIN DE LA SPÉCIFICATION FONCTIONNELLE**

**Ce document est la référence absolue. Toute implémentation doit s'y conformer.**
