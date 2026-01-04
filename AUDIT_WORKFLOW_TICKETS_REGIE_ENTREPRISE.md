# 🎫 AUDIT & ALIGNEMENT "SUITE LOGIQUE TICKETS" - JETC_IMMO

**Date** : 2026-01-04  
**Objectif** : Auditer et aligner le workflow complet de gestion des tickets depuis la création par le locataire jusqu'à la diffusion/assignation aux entreprises  
**Méthodologie** : Ne rien supposer, tout vérifier dans la DB, RLS, code et conventions

---

## 📊 PARTIE 1 : AUDIT DB - STRUCTURE & RELATIONS

### 1.1 Table `tickets` - État actuel

#### Colonnes existantes

| Colonne | Type | Nullable | Default | Commentaire |
|---------|------|----------|---------|-------------|
| `id` | uuid | NO | `uuid_generate_v4()` | PK |
| `titre` | text | NO | - | Titre court |
| `description` | text | NO | - | Description détaillée |
| `categorie` | text | NO | - | plomberie, électricité, chauffage, etc. |
| `priorite` | text | NO | `'normale'` | faible, normale, haute, urgente |
| `statut` | ticket_status (ENUM) | NO | `'nouveau'` | nouveau, en_attente, en_cours, termine, clos, annule |
| `logement_id` | uuid | NO | - | FK → logements (CASCADE) |
| `locataire_id` | uuid | NO | - | FK → locataires (CASCADE) |
| `regie_id` | uuid | NO | - | Calculé via trigger set_ticket_regie_id() |
| `entreprise_id` | uuid | YES | NULL | FK → entreprises (SET NULL) |
| `technicien_id` | uuid | YES | NULL | FK → techniciens (SET NULL) |
| `date_creation` | timestamptz | NO | now() | Date création |
| `date_cloture` | timestamptz | YES | NULL | Date clôture |
| `date_limite` | timestamptz | YES | NULL | Deadline |
| `photos` | text[] | YES | NULL | URLs photos |
| `urgence` | boolean | NO | false | Flag urgence |
| `locked_at` | timestamptz | YES | NULL | Verrouillage mission (M13) |
| `created_at` | timestamptz | NO | now() | Metadata |
| `updated_at` | timestamptz | NO | now() | Metadata |

#### Colonnes ajoutées par migrations

**M01** (`20251226170000_m01_add_budget_columns.sql`) :
- ✅ `plafond_intervention_chf` : numeric(10,2), NULL
- ✅ `devise` : text, DEFAULT 'CHF'

**M02** (`20251226170100_m02_add_mode_diffusion.sql`) :
- ✅ `mode_diffusion` : text, DEFAULT 'general', CHECK IN ('general', 'restreint')

**M08** (`20251226170700_m08_add_classification_columns.sql`) :
- ✅ `sous_categorie` : text, NULL
- ✅ `piece` : text, NULL

#### ⚠️ CHAMPS MANQUANTS IDENTIFIÉS

| Champ manquant | Type recommandé | Objectif | Table cible |
|----------------|-----------------|----------|-------------|
| **`plafond_valide_par`** | uuid (FK → profiles) | Tracer QUI a validé le plafond | `tickets` |
| **`plafond_valide_at`** | timestamptz | Tracer QUAND le plafond a été validé | `tickets` |
| **`diffuse_at`** | timestamptz | Date de diffusion aux entreprises | `tickets` |
| **`diffuse_par`** | uuid (FK → profiles) | QUI a diffusé/assigné | `tickets` |

**Justification** :  
- Actuellement, aucun traçage de l'action "valider/diffuser" côté régie
- Le `mode_diffusion` est sur `tickets` mais devrait logiquement être sur `regies_entreprises`
- Le plafond est stocké mais sans validation métier

---

### 1.2 Table `locataires` - Infos disponibles

#### Colonnes nécessaires pour affichage régie

| Colonne | Type | Disponible | Notes |
|---------|------|------------|-------|
| `nom` | text | ✅ | OK |
| `prenom` | text | ✅ | OK |
| `email` | text | ✅ | OK |
| `telephone` | text | ✅ | OK (nullable) |
| `logement_id` | uuid | ✅ | FK vers logements |
| `profile_id` | uuid | ✅ | Lien auth.users |

**✅ Pas de champ manquant** - Toutes les infos locataire sont disponibles via jointure `tickets → locataires`

---

### 1.3 Table `logements` - Infos adresse

#### Colonnes nécessaires

| Colonne | Type | Disponible | Notes |
|---------|------|------------|-------|
| `numero` | text | ✅ | Numéro logement (ex: "A12") |
| `adresse` | text | ✅ | **Ajouté M24** (`20251224000001_logements_adresse_caracteristiques.sql`) |
| `npa` | text | ✅ | Code postal (M24) |
| `localite` | text | ✅ | Ville (M24) |
| `etage` | int | ✅ | Étage |
| `immeuble_id` | uuid | ✅ | FK vers immeubles |

**✅ Pas de champ manquant** - L'adresse complète est disponible via `logements.adresse` + `logements.npa` + `logements.localite`

---

### 1.4 Table `immeubles` - Infos complémentaires

#### Colonnes disponibles

| Colonne | Type | Disponible | Notes |
|---------|------|------------|-------|
| `nom` | text | ✅ | Nom immeuble |
| `adresse` | text | ✅ | Adresse immeuble |
| `npa` | text | ✅ | Code postal (M02) |
| `localite` | text | ✅ | Ville (M02) |
| `regie_id` | uuid | ✅ | FK vers regies |

**✅ Pas de champ manquant** - Adresse immeuble complète disponible

---

### 1.5 Table `regies_entreprises` - Lien autorisation

#### Structure actuelle

| Colonne | Type | Nullable | Default | Contrainte |
|---------|------|----------|---------|------------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `regie_id` | uuid | NO | - | FK → regies (CASCADE) |
| `entreprise_id` | uuid | NO | - | FK → entreprises (CASCADE) |
| `autorise` | boolean | NO | true | Entreprise autorisée ? |
| `mode_diffusion` | text | NO | 'restreint' | CHECK IN ('general', 'restreint') |
| `date_autorisation` | timestamptz | NO | now() | Date création lien |
| `created_at` | timestamptz | NO | now() | Metadata |

**✅ Convention respectée** : `mode_diffusion = ('general', 'restreint')` - Confirmé par M30

#### ⚠️ INCOHÉRENCE DÉTECTÉE

**Problème** : Le champ `tickets.mode_diffusion` duplique `regies_entreprises.mode_diffusion`

**Analyse** :
- `tickets.mode_diffusion` : Défini au moment de la validation du ticket (choix ponctuel régie)
- `regies_entreprises.mode_diffusion` : Paramètre général de la relation rég ie-entreprise

**Comportement attendu** :
1. Régie valide un ticket
2. Régie choisit :
   - **A) Diffusion générale** → Toutes les entreprises avec `mode_diffusion='general'` voient le ticket
   - **B) Assignation directe** → UNE entreprise spécifique (ticket.entreprise_id assigné)

**Recommandation** :
- **GARDER** `tickets.mode_diffusion` pour tracer le choix de diffusion PAR TICKET
- **GARDER** `regies_entreprises.mode_diffusion` comme paramètre par défaut de la relation
- **Logique métier** : 
  ```sql
  -- Diffusion general
  UPDATE tickets SET mode_diffusion = 'general', statut = 'en_attente' WHERE id = p_ticket_id;
  
  -- Assignation restreint
  UPDATE tickets 
  SET mode_diffusion = 'restreint', 
      entreprise_id = p_entreprise_id,
      statut = 'en_attente' 
  WHERE id = p_ticket_id;
  ```

---

### 1.6 Table `missions` - Relation ticket/entreprise

#### Structure

| Colonne | Type | Nullable | Contrainte |
|---------|------|----------|------------|
| `id` | uuid | NO | PK |
| `ticket_id` | uuid | NO | FK → tickets (UNIQUE - 1 mission max/ticket) |
| `entreprise_id` | uuid | NO | FK → entreprises |
| `technicien_id` | uuid | YES | FK → techniciens |
| `statut` | text | NO | en_attente, en_cours, terminee, validee, annulee |
| `montant` | numeric(10,2) | YES | Montant réel intervention |
| `devis_url` | text | YES | URL devis Storage |
| `facture_url` | text | YES | URL facture Storage |
| `created_at` | timestamptz | NO | Date création mission |

**✅ Structure correcte** pour stocker les missions après acceptation ticket

**Question plafond** : Où stocker le plafond validé par la régie ?

**Option 1** : Sur `tickets.plafond_intervention_chf` (ACTUEL)
- ✅ Avantage : Disponible dès validation ticket, avant mission
- ✅ Visible par entreprises lors diffusion
- ✅ Un seul plafond par ticket (logique métier)

**Option 2** : Sur `missions.montant_plafond_chf` (NOUVEAU champ)
- ❌ Inconvénient : Plafond disponible APRÈS création mission uniquement
- ❌ Dépendance circulaire : régie doit valider plafond AVANT diffusion

**✅ RECOMMANDATION** : **GARDER sur `tickets`** avec ajout colonnes traçabilité (`plafond_valide_par`, `plafond_valide_at`)

---

## 🔐 PARTIE 2 : AUDIT RLS POLICIES

### 2.1 Policy Régie SELECT tickets

#### Policy actuelle (CSV audit système)

```sql
CREATE POLICY "Regie can view own tickets"
ON tickets FOR SELECT
USING (regie_id = get_user_regie_id());
```

#### Fonction `get_user_regie_id()`

```sql
CREATE FUNCTION get_user_regie_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT regie_id FROM (
    -- Pour rôle 'regie'
    SELECT r.id as regie_id
    FROM regies r
    WHERE r.profile_id = auth.uid()
    
    UNION
    
    -- Pour rôle 'locataire'
    SELECT i.regie_id
    FROM locataires l
    JOIN logements lg ON lg.id = l.logement_id
    JOIN immeubles i ON i.id = lg.immeuble_id
    WHERE l.profile_id = auth.uid()
    
    LIMIT 1
  ) AS user_regie;
$$;
```

**✅ Analyse** :
- `SECURITY DEFINER` → Bypass RLS sur regies/locataires/logements/immeubles
- `STABLE` → Résultat cachable pendant transaction
- Policy simple : `regie_id = get_user_regie_id()` → Pas de récursion

**✅ Verdict** : Policy correcte pour SELECT

---

### 2.2 Jointures locataire/logement - Vérification RLS

#### RPC actuel : `get_tickets_list_regie()`

**Fichier** : `M22.5_rpc_tickets_liste_detail_regie.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_tickets_list_regie(p_statut ticket_status)
RETURNS TABLE(...) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  SELECT r.id INTO v_regie_id
  FROM public.regies r
  WHERE r.profile_id = auth.uid();

  RETURN QUERY
  SELECT
    t.id, t.titre, t.description, t.statut, t.priorite,
    t.categorie, t.sous_categorie, t.piece, t.created_at,
    t.plafond_intervention_chf,
    l.nom AS locataire_nom,
    l.prenom AS locataire_prenom,
    lg.numero AS logement_numero
  FROM public.tickets t
  INNER JOIN public.locataires l ON l.id = t.locataire_id
  INNER JOIN public.logements lg ON lg.id = t.logement_id
  WHERE t.regie_id = v_regie_id
    AND t.statut = p_statut
  ORDER BY t.created_at DESC;
END;
$$;
```

**✅ Analyse** :
- `SECURITY DEFINER` → **Bypass RLS complet** sur tickets/locataires/logements
- Jointures `INNER JOIN` → Toutes les données disponibles
- Filtrage manuel sur `t.regie_id = v_regie_id` → Sécurité garantie

**✅ Verdict** : RPC correcte, la régie peut bien récupérer locataire + logement

---

### 2.3 Policy Entreprise SELECT tickets

#### Logique attendue

**Mode general** :
```sql
-- Entreprise voit tous les tickets diffusés en 'general' de ses régies autorisées
SELECT t.*
FROM tickets t
JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE re.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
  AND re.autorise = true
  AND t.mode_diffusion = 'general'
  AND t.statut = 'en_attente'  -- Tickets disponibles uniquement
  AND t.locked_at IS NULL;      -- Pas encore pris
```

**Mode restreint** :
```sql
-- Entreprise voit UNIQUEMENT les tickets où elle est explicitement assignée
SELECT t.*
FROM tickets t
WHERE t.entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
  AND t.statut IN ('en_attente', 'en_cours', 'termine');  -- Tous statuts de sa mission
```

#### Policy actuelle à vérifier

**TODO** : Vérifier dans les migrations RLS si cette logique est implémentée

**Risque détecté** : Si policy trop permissive → Entreprise voit tickets d'autres régies

---

### 2.4 Récursion RLS - Points de vigilance

#### Chaînes de dépendances RLS

```
tickets (policy regie)
  → get_user_regie_id()  [SECURITY DEFINER ✅]
      → regies [RLS enabled ⚠️]
      → locataires [RLS enabled ⚠️]
          → logements [RLS enabled ⚠️]
              → immeubles [RLS enabled ⚠️]
                  → regies [🔄 RÉCURSION POSSIBLE]
```

**✅ Pas de récursion** grâce à `SECURITY DEFINER` qui bypass tout RLS

**Mais** :
- Si front appelle `.from('tickets').select()` **SANS** passer par RPC
- RLS tickets déclenche → Récursion possible

**✅ Solution actuelle** : Frontend utilise RPC `get_tickets_list_regie()` → Pas de récursion

---

## 🎨 PARTIE 3 : AUDIT FRONTEND - UI RÉGIE

### 3.1 Page `/regie/tickets.html` - État actuel

#### Affichage liste tickets

**Ligne 1-100** (structure HTML) :
- ✅ Sidebar avec menu
- ✅ Zone principale avec liste tickets
- ✅ Appel RPC `get_tickets_list_regie(p_statut)` pour charger données

#### Données affichées actuellement

**Colonnes visibles** :
1. Titre ticket
2. Statut
3. Priorité
4. Catégorie
5. Locataire (nom/prénom)
6. Logement (numéro)
7. Date création

**✅ Infos locataire/logement** : Disponibles via RPC

---

### 3.2 Champs manquants dans UI régie

#### Modal "Détail ticket" - Infos à ajouter

**Section 1 : Infos ticket** (déjà présent)
- ✅ Titre, description, catégorie, sous-catégorie, pièce
- ✅ Priorité, urgence
- ✅ Date création, date limite

**Section 2 : Infos locataire** (à vérifier/compléter)
- ✅ Nom, prénom
- ⚠️ **Email** : Disponible en DB mais pas affiché ?
- ⚠️ **Téléphone** : Disponible en DB mais pas affiché ?

**Section 3 : Infos logement** (à vérifier/compléter)
- ✅ Numéro logement
- ⚠️ **Adresse complète** : `logements.adresse + npa + localite` ou `immeubles.adresse` ?
- ⚠️ **Immeuble nom** : Disponible via `immeubles.nom`
- ⚠️ **Référence interne** : Quel champ ? `logements.reference` n'existe pas

**Section 4 : Pièces jointes**
- ⚠️ `tickets.photos` (text[]) : URLs photos uploadées par locataire
- ⚠️ Affichage galerie d'images ?

---

### 3.3 Actions régie - À implémenter

#### Action 1 : Valider le ticket

**Bouton** : "Valider ce ticket"

**Formulaire modal** :
```html
<form id="form-valider-ticket">
  <!-- Plafond d'intervention -->
  <div class="form-group">
    <label>Plafond d'intervention (CHF) <span class="required">*</span></label>
    <input type="number" step="0.01" min="0" name="plafond" required>
    <small>Montant maximum autorisé pour l'intervention</small>
  </div>
  
  <!-- Mode de diffusion -->
  <div class="form-group">
    <label>Mode de diffusion <span class="required">*</span></label>
    <select name="mode_diffusion" required onchange="toggleEntrepriseSelect(this.value)">
      <option value="">Choisir...</option>
      <option value="general">📢 Diffuser à toutes les entreprises autorisées</option>
      <option value="restreint">🎯 Assigner à une entreprise spécifique</option>
    </select>
  </div>
  
  <!-- Dropdown entreprises (visible uniquement si restreint) -->
  <div class="form-group" id="groupe-entreprise" style="display: none;">
    <label>Entreprise assignée <span class="required">*</span></label>
    <select name="entreprise_id" required>
      <option value="">Sélectionner une entreprise...</option>
      <!-- Chargé dynamiquement via RPC get_entreprises_autorisees(regie_id) -->
    </select>
    <small>Uniquement les entreprises autorisées pour votre régie</small>
  </div>
  
  <button type="submit" class="btn-primary">Valider et diffuser</button>
</form>
```

**Comportement** :
1. Si `mode_diffusion = 'general'` :
   - `entreprise_id = NULL`
   - Ticket devient visible par TOUTES les entreprises avec `regies_entreprises.autorise = true` ET `mode_diffusion = 'general'`

2. Si `mode_diffusion = 'restreint'` :
   - `entreprise_id = <selected>`
   - Ticket visible UNIQUEMENT par cette entreprise

**API call** :
```javascript
const { data, error } = await supabase.rpc('valider_ticket_regie', {
  p_ticket_id: ticketId,
  p_plafond_chf: parseFloat(formData.plafond),
  p_mode_diffusion: formData.mode_diffusion,
  p_entreprise_id: formData.mode_diffusion === 'restreint' ? formData.entreprise_id : null
});
```

---

#### Action 2 : Modifier le ticket (après validation)

**Bouton** : "Modifier la diffusion"

**Cas d'usage** :
- Régie a validé en "general" mais veut changer pour "restreint" avec une entreprise spécifique
- Ou inversement

**Restriction** : Uniquement si `tickets.locked_at IS NULL` (pas de mission créée)

---

## ⚙️ PARTIE 4 : AUDIT API/RPC - ROUTES GESTION TICKETS

### 4.1 RPC à créer : `valider_ticket_regie()`

#### Signature

```sql
CREATE OR REPLACE FUNCTION public.valider_ticket_regie(
  p_ticket_id uuid,
  p_plafond_chf numeric(10,2),
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_ticket_statut ticket_status;
  v_ticket_regie_id uuid;
BEGIN
  -- STEP 1: Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non autorisé');
  END IF;
  
  -- STEP 2: Vérifier que le ticket appartient à cette régie
  SELECT statut, regie_id INTO v_ticket_statut, v_ticket_regie_id
  FROM tickets
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket introuvable');
  END IF;
  
  IF v_ticket_regie_id != v_regie_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket appartient à une autre régie');
  END IF;
  
  -- STEP 3: Vérifier statut (doit être 'nouveau')
  IF v_ticket_statut != 'nouveau' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket déjà validé (statut: ' || v_ticket_statut || ')');
  END IF;
  
  -- STEP 4: Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RETURN jsonb_build_object('success', false, 'error', 'mode_diffusion invalide (attendu: general ou restreint)');
  END IF;
  
  -- STEP 5: Si restreint, vérifier entreprise_id fournie ET autorisée
  IF p_mode_diffusion = 'restreint' THEN
    IF p_entreprise_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'entreprise_id obligatoire en mode restreint');
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_regie_id
        AND entreprise_id = p_entreprise_id
        AND autorise = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Entreprise non autorisée pour cette régie');
    END IF;
  END IF;
  
  -- STEP 6: Valider plafond (doit être positif)
  IF p_plafond_chf IS NULL OR p_plafond_chf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plafond invalide (doit être > 0)');
  END IF;
  
  -- STEP 7: UPDATE ticket
  UPDATE tickets
  SET 
    statut = 'en_attente',
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    plafond_intervention_chf = p_plafond_chf,
    plafond_valide_par = auth.uid(),
    plafond_valide_at = NOW(),
    diffuse_at = NOW(),
    diffuse_par = auth.uid(),
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  -- STEP 8: Log action (optionnel - table audit_logs)
  -- INSERT INTO audit_logs (action, table_name, record_id, user_id, details) ...
  
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'statut', 'en_attente',
    'mode_diffusion', p_mode_diffusion,
    'entreprise_id', CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    'plafond_chf', p_plafond_chf
  );
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.valider_ticket_regie IS 
'Valide un ticket (statut nouveau → en_attente) avec plafond et mode de diffusion.
Mode general : diffuse à toutes entreprises autorisées.
Mode restreint : assigne à une entreprise spécifique.
SECURITY DEFINER pour bypass RLS.';
```

---

### 4.2 RPC helper : `get_entreprises_autorisees()`

#### Signature

```sql
CREATE OR REPLACE FUNCTION public.get_entreprises_autorisees()
RETURNS TABLE(
  id uuid,
  nom text,
  email text,
  siret text,
  mode_diffusion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Retourner entreprises autorisées
  RETURN QUERY
  SELECT
    e.id,
    e.nom,
    e.email,
    e.siret,
    re.mode_diffusion
  FROM entreprises e
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  WHERE re.regie_id = v_regie_id
    AND re.autorise = true
  ORDER BY e.nom ASC;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_entreprises_autorisees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entreprises_autorisees() TO authenticated;

COMMENT ON FUNCTION public.get_entreprises_autorisees IS 
'Retourne liste des entreprises autorisées pour la régie connectée.
Utilisé pour peupler dropdown assignation entreprise.';
```

---

### 4.3 RPC optionnel : `modifier_diffusion_ticket()`

**Si besoin de changer le mode APRÈS validation** (avant création mission)

```sql
CREATE OR REPLACE FUNCTION public.modifier_diffusion_ticket(
  p_ticket_id uuid,
  p_nouveau_mode_diffusion text,
  p_nouvelle_entreprise_id uuid DEFAULT NULL
)
RETURNS jsonb
-- ... logique similaire à valider_ticket_regie
-- Vérification: tickets.locked_at IS NULL (pas de mission)
```

---

## 🧪 PARTIE 5 : TESTS SQL - VALIDATION WORKFLOW

### Fichier : `validation_ticket_workflow.sql`

```sql
-- ============================================================
-- TESTS WORKFLOW TICKETS - VALIDATION COMPLÈTE
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Valider le workflow complet tickets
-- Usage: Copier/coller dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TEST 1: Régie voit ticket + locataire + logement (SELECT)
-- ============================================================

-- Créer un ticket test (via RPC locataire ou INSERT direct)
DO $$
DECLARE
  v_ticket_id uuid;
  v_locataire_id uuid;
  v_logement_id uuid;
  v_regie_id uuid;
BEGIN
  -- Récupérer un locataire existant
  SELECT id, logement_id INTO v_locataire_id, v_logement_id
  FROM locataires
  LIMIT 1;
  
  -- Récupérer regie_id via logement
  SELECT i.regie_id INTO v_regie_id
  FROM logements lg
  JOIN immeubles i ON i.id = lg.immeuble_id
  WHERE lg.id = v_logement_id;
  
  -- Créer ticket
  INSERT INTO tickets (titre, description, categorie, priorite, locataire_id, logement_id, regie_id, statut)
  VALUES ('Test workflow', 'Description test', 'plomberie', 'normale', v_locataire_id, v_logement_id, v_regie_id, 'nouveau')
  RETURNING id INTO v_ticket_id;
  
  RAISE NOTICE 'Ticket test créé: %', v_ticket_id;
END $$;

-- Vérifier SELECT régie via RPC
SELECT * FROM public.get_tickets_list_regie('nouveau'::ticket_status);
-- Attendu: 1 ligne avec locataire_nom, locataire_prenom, logement_numero

-- Vérifier détail via RPC
SELECT * FROM public.get_ticket_detail_regie('<ticket_id>');
-- Attendu: locataire_email, logement_adresse présents

-- ============================================================
-- TEST 2: Régie valide ticket (UPDATE statut)
-- ============================================================

-- Appeler RPC valider_ticket_regie
SELECT public.valider_ticket_regie(
  p_ticket_id := '<ticket_id>'::uuid,
  p_plafond_chf := 500.00,
  p_mode_diffusion := 'general',
  p_entreprise_id := NULL
);

-- Attendu: {"success": true, "ticket_id": "...", "statut": "en_attente"}

-- Vérifier UPDATE en DB
SELECT 
  id, statut, mode_diffusion, entreprise_id, 
  plafond_intervention_chf, plafond_valide_at, diffuse_at
FROM tickets
WHERE id = '<ticket_id>';
-- Attendu:
-- - statut = 'en_attente'
-- - mode_diffusion = 'general'
-- - entreprise_id = NULL
-- - plafond_intervention_chf = 500.00
-- - plafond_valide_at NOT NULL
-- - diffuse_at NOT NULL

-- ============================================================
-- TEST 3: Régie diffuse en "general" → entreprise autorisée voit
-- ============================================================

-- Vérifier policy SELECT entreprise
-- (Simuler connexion entreprise via SET auth.uid)
SET LOCAL auth.uid = '<entreprise_profile_id>';

-- Entreprise appelle son RPC liste tickets
SELECT * FROM public.get_tickets_disponibles_entreprise();
-- Attendu: Ticket '<ticket_id>' visible avec mode_diffusion='general'

RESET auth.uid;

-- ============================================================
-- TEST 4: Régie assigne en "restreint" → seule entreprise assignée voit
-- ============================================================

-- Créer nouveau ticket
-- ... (même logique TEST 1)

-- Valider en mode restreint
SELECT public.valider_ticket_regie(
  p_ticket_id := '<ticket_id_2>'::uuid,
  p_plafond_chf := 300.00,
  p_mode_diffusion := 'restreint',
  p_entreprise_id := '<entreprise_A_id>'::uuid
);

-- Vérifier DB
SELECT 
  id, statut, mode_diffusion, entreprise_id
FROM tickets
WHERE id = '<ticket_id_2>';
-- Attendu:
-- - mode_diffusion = 'restreint'
-- - entreprise_id = '<entreprise_A_id>'

-- Vérifier visibilité entreprise A
SET LOCAL auth.uid = '<entreprise_A_profile_id>';
SELECT * FROM public.get_tickets_disponibles_entreprise();
-- Attendu: Ticket visible

RESET auth.uid;

-- Vérifier invisibilité entreprise B
SET LOCAL auth.uid = '<entreprise_B_profile_id>';
SELECT * FROM public.get_tickets_disponibles_entreprise();
-- Attendu: Ticket NON visible (mode_diffusion='restreint' ET entreprise_id != entreprise_B)

RESET auth.uid;

-- ============================================================
-- TEST 5: Plafond est stocké correctement
-- ============================================================

-- Vérifier présence colonnes
SELECT 
  column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tickets'
  AND column_name IN ('plafond_intervention_chf', 'plafond_valide_par', 'plafond_valide_at');

-- Attendu:
-- - plafond_intervention_chf: numeric, YES
-- - plafond_valide_par: uuid, YES
-- - plafond_valide_at: timestamptz, YES

-- Vérifier données ticket validé
SELECT 
  plafond_intervention_chf,
  plafond_valide_par,
  plafond_valide_at,
  diffuse_par,
  diffuse_at
FROM tickets
WHERE id = '<ticket_id>';
-- Attendu:
-- - plafond_intervention_chf = 500.00
-- - plafond_valide_par = <regie_profile_id>
-- - plafond_valide_at NOT NULL
-- - diffuse_par = <regie_profile_id>
-- - diffuse_at NOT NULL

-- ============================================================
-- TEST 6: RLS policy entreprise (mode general)
-- ============================================================

-- Lister policies entreprise sur tickets
SELECT 
  policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'tickets'
  AND policyname LIKE '%entreprise%';

-- Attendu: Policy qui filtre sur mode_diffusion='general' ET autorise=true

-- ============================================================
-- TEST 7: RLS policy entreprise (mode restreint)
-- ============================================================

-- Vérifier policy filtre entreprise_id
-- (Voir résultat TEST 4 - entreprise B ne voit pas)

-- ============================================================
-- FIN VALIDATION
-- ============================================================

RAISE NOTICE '✅ TOUS LES TESTS VALIDÉS';
```

---

## 🚨 PARTIE 6 : INCOHÉRENCES & MIGRATIONS NÉCESSAIRES

### 6.1 Incohérences détectées

| ID | Type | Sévérité | Description | Impact |
|----|------|----------|-------------|--------|
| INC-01 | Champ manquant | 🟠 MOYEN | `tickets.plafond_valide_par` absent | Pas de traçabilité QUI a validé |
| INC-02 | Champ manquant | 🟠 MOYEN | `tickets.plafond_valide_at` absent | Pas de traçabilité QUAND validé |
| INC-03 | Champ manquant | 🟠 MOYEN | `tickets.diffuse_at` absent | Pas de traçabilité diffusion |
| INC-04 | Champ manquant | 🟠 MOYEN | `tickets.diffuse_par` absent | Pas de traçabilité QUI a diffusé |
| INC-05 | Données incomplètes | 🟡 FAIBLE | Email/téléphone locataire pas affichés dans UI | Info disponible DB mais pas en front |
| INC-06 | Données incomplètes | 🟡 FAIBLE | Adresse complète logement pas claire | `logements.adresse` vs `immeubles.adresse` |
| INC-07 | RPC manquant | 🔴 CRITIQUE | `valider_ticket_regie()` n'existe pas | Bloquant pour workflow validation |
| INC-08 | RPC manquant | 🟠 MOYEN | `get_entreprises_autorisees()` n'existe pas | Dropdown entreprises vide |
| INC-09 | UI manquante | 🔴 CRITIQUE | Formulaire validation ticket absent | Régie ne peut pas valider/diffuser |
| INC-10 | Policy manquante | 🔴 CRITIQUE | Policy entreprise SELECT tickets à vérifier | Risque visibilité cross-régie |

---

### 6.2 Migrations SQL nécessaires

#### Migration M31 : Ajout colonnes traçabilité tickets

```sql
-- ============================================================
-- MIGRATION M31: Ajout colonnes traçabilité validation/diffusion
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Tracer QUI et QUAND a validé/diffusé un ticket

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_valide_par uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plafond_valide_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_par uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN tickets.plafond_valide_par IS 'Profile ID de la régie qui a validé le plafond';
COMMENT ON COLUMN tickets.plafond_valide_at IS 'Date/heure validation du plafond';
COMMENT ON COLUMN tickets.diffuse_at IS 'Date/heure diffusion/assignation aux entreprises';
COMMENT ON COLUMN tickets.diffuse_par IS 'Profile ID de la régie qui a diffusé';

-- Index pour queries de reporting
CREATE INDEX IF NOT EXISTS idx_tickets_plafond_valide_par ON tickets(plafond_valide_par);
CREATE INDEX IF NOT EXISTS idx_tickets_diffuse_par ON tickets(diffuse_par);
```

#### Migration M32 : RPC valider_ticket_regie

**(Voir PARTIE 4.1 ci-dessus)**

#### Migration M33 : RPC get_entreprises_autorisees

**(Voir PARTIE 4.2 ci-dessus)**

#### Migration M34 : Policy entreprise SELECT tickets

```sql
-- ============================================================
-- MIGRATION M34: Policy RLS entreprise SELECT tickets
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Filtrer tickets visibles selon mode_diffusion

-- Supprimer policy existante si présente
DROP POLICY IF EXISTS "Entreprise can view available tickets" ON tickets;

-- Policy mode GENERAL
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise voit tickets en mode 'general'
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
      AND re.autorise = true
  )
);

-- Policy mode RESTREINT
CREATE POLICY "Entreprise can view assigned tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise voit tickets où elle est explicitement assignée
  mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
);

COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Entreprise voit tickets diffusés en mode general de ses régies autorisées (statut en_attente, non verrouillés)';

COMMENT ON POLICY "Entreprise can view assigned tickets" ON tickets IS
'Entreprise voit tickets assignés directement (mode restreint) avec tous statuts mission';
```

---

## 📋 PARTIE 7 : PLAN D'APPLICATION

### Ordre d'exécution recommandé

#### Phase 1 : Migrations DB (sans front)

1. **M31** : Ajout colonnes traçabilité (`plafond_valide_par`, `plafond_valide_at`, `diffuse_at`, `diffuse_par`)
   - ✅ Impact : Aucun (colonnes NULL acceptées)
   - ✅ Rollback : Simple `ALTER TABLE tickets DROP COLUMN ...`

2. **M32** : RPC `valider_ticket_regie()`
   - ✅ Impact : Nouvelle fonction, ne casse rien
   - ✅ Test : `SELECT valider_ticket_regie(...)` en SQL Editor

3. **M33** : RPC `get_entreprises_autorisees()`
   - ✅ Impact : Nouvelle fonction, ne casse rien
   - ✅ Test : `SELECT * FROM get_entreprises_autorisees()`

4. **M34** : Policy RLS entreprise SELECT tickets
   - ⚠️ Impact : Change visibilité tickets pour entreprises
   - ⚠️ Test : Se connecter en tant qu'entreprise, vérifier `SELECT * FROM tickets` (devrait être vide si direct, OK si via RPC)

#### Phase 2 : Tests SQL (validation_ticket_workflow.sql)

1. Exécuter `TEST 1` : Régie voit ticket + locataire + logement
2. Exécuter `TEST 2` : Régie valide ticket (appel RPC M32)
3. Exécuter `TEST 3` : Entreprise voit ticket mode general
4. Exécuter `TEST 4` : Seule entreprise assignée voit ticket restreint
5. Exécuter `TEST 5` : Plafond stocké correctement
6. Exécuter `TEST 6-7` : Policies RLS entreprise

#### Phase 3 : Modifications frontend

1. **Fichier** : `public/regie/tickets.html`
   - Ajouter modal "Valider ticket" avec formulaire (plafond + mode diffusion + dropdown entreprises)
   - Ajouter appel `supabase.rpc('valider_ticket_regie', {...})`
   - Ajouter `supabase.rpc('get_entreprises_autorisees')` pour peupler dropdown
   - Afficher email/téléphone locataire dans détail ticket
   - Afficher adresse complète logement (décider `logements.adresse` vs `immeubles.adresse`)

2. **Fichier** : `public/regie/tickets.html` (détail ticket)
   - Section "Pièces jointes" : Afficher galerie `tickets.photos[]` si présent
   - Section "Traçabilité" : Afficher `plafond_valide_par`, `plafond_valide_at`, `diffuse_par`, `diffuse_at`

#### Phase 4 : Déploiement

1. **Git commit** :
   ```bash
   git add supabase/migrations/M31_*.sql
   git add supabase/migrations/M32_*.sql
   git add supabase/migrations/M33_*.sql
   git add supabase/migrations/M34_*.sql
   git add supabase/migrations/validation_ticket_workflow.sql
   git add public/regie/tickets.html
   git commit -m "feat(tickets): Workflow validation régie + diffusion entreprises (M31-M34)"
   ```

2. **Appliquer migrations Supabase** :
   - Via Dashboard > SQL Editor > Exécuter M31, M32, M33, M34 dans l'ordre

3. **Déployer frontend** :
   ```bash
   git push origin main  # Vercel auto-deploy
   ```

4. **Tests post-déploiement** :
   - Se connecter régie → Voir ticket "nouveau"
   - Cliquer "Valider" → Formulaire s'ouvre
   - Remplir plafond + choisir "general" → Valider
   - Vérifier ticket passe "en_attente"
   - Se connecter entreprise → Voir ticket dans "Tickets disponibles"
   - Se reconnecter régie → Créer nouveau ticket → Valider en "restreint" entreprise X
   - Se connecter entreprise Y → Ne voit PAS le ticket
   - Se connecter entreprise X → Voit le ticket

---

## ✅ CHECKLIST FINALE

### Migrations DB
- [ ] M31 appliquée (colonnes traçabilité)
- [ ] M32 appliquée (RPC valider_ticket_regie)
- [ ] M33 appliquée (RPC get_entreprises_autorisees)
- [ ] M34 appliquée (Policy RLS entreprise)

### Tests SQL
- [ ] TEST 1 : Régie voit ticket + locataire + logement → OK
- [ ] TEST 2 : Régie valide ticket → OK
- [ ] TEST 3 : Entreprise voit ticket general → OK
- [ ] TEST 4 : Entreprise ne voit PAS ticket restreint autre → OK
- [ ] TEST 5 : Plafond stocké correctement → OK
- [ ] TEST 6-7 : Policies RLS entreprise → OK

### Frontend
- [ ] Modal "Valider ticket" ajoutée
- [ ] Formulaire plafond + mode diffusion → OK
- [ ] Dropdown entreprises peuplé dynamiquement → OK
- [ ] Email/téléphone locataire affichés → OK
- [ ] Adresse complète logement affichée → OK
- [ ] Section pièces jointes (photos) → OK
- [ ] Section traçabilité (qui/quand validé) → OK

### Tests UI
- [ ] Régie peut valider ticket en mode general → OK
- [ ] Régie peut valider ticket en mode restreint → OK
- [ ] Dropdown entreprises charge uniquement autorisées → OK
- [ ] Entreprise voit tickets selon mode_diffusion → OK
- [ ] Logs console clairs ([TICKETS][STEP X]) → OK

---

## 📚 ANNEXES

### Convention mode_diffusion

**Source** : M30 (`20251227000600_m30_fix_mode_diffusion.sql`)

```sql
CHECK (mode_diffusion IN ('general', 'restreint'))
```

**Définitions** :
- `'general'` : Ticket diffusé à TOUTES les entreprises autorisées de la régie (mode "marché ouvert")
- `'restreint'` : Ticket assigné à UNE entreprise spécifique (mode "marché fermé")

**⚠️ JAMAIS** : `'actif'`, `'silencieux'`, `'public'`, `'private'` → Ces valeurs sont INTERDITES

### Référence RPC existants

| RPC | Fichier | Usage |
|-----|---------|-------|
| `get_tickets_list_regie(p_statut)` | M22.5_rpc_tickets_liste_detail_regie.sql | Liste tickets par statut (régie) |
| `get_ticket_detail_regie(p_ticket_id)` | M22.5_rpc_tickets_liste_detail_regie.sql | Détail ticket (régie) |
| `update_ticket_regie(...)` | M22.5_rpc_tickets_liste_detail_regie.sql | UPDATE ticket (régie) |
| `get_tickets_locataire()` | M23_rpc_tickets_locataire.sql | Liste tickets (locataire) |
| `get_ticket_detail_locataire(p_ticket_id)` | M23_rpc_tickets_locataire.sql | Détail ticket (locataire) |

### Référence tables

```
tickets
  ├─→ locataires (FK locataire_id)
  │    ├─→ profiles (FK profile_id)
  │    └─→ logements (FK logement_id)
  │         └─→ immeubles (FK immeuble_id)
  │              └─→ regies (FK regie_id)
  │
  ├─→ logements (FK logement_id)
  │
  ├─→ regies (regie_id - calculé trigger)
  │
  └─→ entreprises (FK entreprise_id - nullable)

missions
  ├─→ tickets (FK ticket_id UNIQUE)
  └─→ entreprises (FK entreprise_id)

regies_entreprises
  ├─→ regies (FK regie_id)
  └─→ entreprises (FK entreprise_id)
```

---

**Fin du document**  
**Version** : 1.0  
**Auteur** : GitHub Copilot  
**Date** : 2026-01-04
