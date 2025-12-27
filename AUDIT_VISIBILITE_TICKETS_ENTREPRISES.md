# 🔐 AUDIT VISIBILITÉ TICKETS ENTREPRISES (STRICT READ-ONLY)

**Date**: 27 décembre 2025  
**Type**: Audit factuel métier (AUCUNE MODIFICATION)  
**Objectif**: Instaurer logique visibilité progressive pilotée par régie  
**Règle métier**: Infos sensibles locataire visibles UNIQUEMENT si assignation OU acceptation

---

## ⚠️ CONTEXTE CRITIQUE

**État actuel système** :
- ✅ Aucune entreprise active en production
- ✅ Aucun ticket diffusé
- ✅ Vue `tickets_visibles_entreprise` existe (M06)
- ✅ RPC `accept_ticket_and_create_mission` opérationnelle (M05)
- ❌ **PAS DE MASQUAGE CONDITIONNEL IMPLÉMENTÉ**

**Portée audit** :
- Identification colonnes sensibles
- Mapping visibilité actuelle par rôle
- Vérification faisabilité technique masquage
- Point de décision BLOQUANT

---

## 📊 ÉTAPE 1 - INVENTAIRE FACTUEL

### 1.1 Colonnes Table `tickets` (Source: schema/12_tickets.sql)

| Colonne | Type | Sensibilité | Raison | Requis Métier |
|---------|------|-------------|--------|---------------|
| `id` | uuid | ✅ Public | Identifiant technique | Toujours visible |
| `titre` | text | ✅ Public | Info technique problème | Toujours visible |
| `description` | text | ⚠️ Partiel | Peut contenir détails persos | Toujours visible (assumé métier) |
| `categorie` | text | ✅ Public | Type problème | Toujours visible |
| `priorite` | text | ✅ Public | Niveau urgence | Toujours visible |
| `statut` | ticket_status | ✅ Public | État workflow | Toujours visible |
| **`logement_id`** | uuid | 🔴 **SENSIBLE** | FK vers adresse précise | **Masquer si public** |
| **`locataire_id`** | uuid | 🔴 **SENSIBLE** | FK vers identité locataire | **Masquer si public** |
| `regie_id` | uuid | ✅ Public | Identité régie publique | Toujours visible |
| `entreprise_id` | uuid | ✅ Public | Assignation visible | Toujours visible |
| `technicien_id` | uuid | ✅ Public | Assignation visible | Toujours visible |
| `date_creation` | timestamptz | ✅ Public | Timing ticket | Toujours visible |
| `date_cloture` | timestamptz | ✅ Public | Timing ticket | Toujours visible |
| `date_limite` | timestamptz | ✅ Public | Timing ticket | Toujours visible |
| `photos` | text[] | ⚠️ Partiel | URLs photos (peuvent montrer intérieur) | Toujours visible (assumé métier) |
| `urgence` | boolean | ✅ Public | Flag urgence | Toujours visible |
| `created_at` | timestamptz | ✅ Public | Metadata | Toujours visible |
| `updated_at` | timestamptz | ✅ Public | Metadata | Toujours visible |

**Colonnes ajoutées par migrations (M01, M02)** :

| Colonne | Type | Sensibilité | Ajouté Par | Règle Visibilité |
|---------|------|-------------|------------|------------------|
| `sous_categorie` | text | ✅ Public | M01 | Toujours visible |
| `piece` | text | ⚠️ Partiel | M01 | Visible (info technique) |
| `plafond_intervention_chf` | numeric | ✅ Public | M01 | **REQUIS avant diffusion** |
| `devise` | text | ✅ Public | M01 | Toujours visible |
| `mode_diffusion` | text | ✅ Public | M02 | Contrôle visibilité |
| `locked_at` | timestamptz | ✅ Public | M02 | Contrôle acceptation |

---

### 1.2 Tables Liées (FK depuis tickets)

#### Table `locataires` (Source: schema/08_locataires.sql)

| Colonne | Type | Sensibilité | Accessible Via | Règle Masquage |
|---------|------|-------------|----------------|----------------|
| **`nom`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| **`prenom`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| **`telephone`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| **`email`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| `date_naissance` | date | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| `profile_id` | uuid | ✅ Public | FK `tickets.locataire_id` | Toujours masqué (technique) |
| **`logement_id`** | uuid | 🔴 **SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| `date_entree` | date | ⚠️ Partiel | FK `tickets.locataire_id` | Masquer si public |
| `date_sortie` | date | ⚠️ Partiel | FK `tickets.locataire_id` | Masquer si public |
| **`contact_urgence_nom`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |
| **`contact_urgence_telephone`** | text | 🔴 **TRÈS SENSIBLE** | FK `tickets.locataire_id` | **Masquer si public** |

#### Table `logements` (Source: schema/07_logements.sql)

| Colonne | Type | Sensibilité | Accessible Via | Règle Masquage |
|---------|------|-------------|----------------|----------------|
| `numero` | text | 🔴 **SENSIBLE** | FK `tickets.logement_id` | **Masquer si public** |
| **`etage`** | int | 🔴 **SENSIBLE** | FK `tickets.logement_id` | **Masquer si public** |
| `superficie` | numeric | ⚠️ Partiel | FK `tickets.logement_id` | Visible (info générale) |
| `nombre_pieces` | int | ⚠️ Partiel | FK `tickets.logement_id` | Visible (info générale) |
| `type_logement` | text | ⚠️ Partiel | FK `tickets.logement_id` | Visible (info générale) |
| **`immeuble_id`** | uuid | 🔴 **SENSIBLE** | FK `tickets.logement_id` | **Masquer si public** |
| `statut` | text | ✅ Public | FK `tickets.logement_id` | Toujours visible |
| `loyer_mensuel` | numeric | ⚠️ Partiel | FK `tickets.logement_id` | Masquer (confidentiel) |
| `balcon`, `parking`, etc. | boolean | ✅ Public | FK `tickets.logement_id` | Toujours visible |

**Accès immeuble → adresse complète** :
- Via FK `logements.immeuble_id` → `immeubles.id`
- Colonnes `immeubles.adresse`, `immeubles.ville`, `immeubles.code_postal`, `immeubles.code_entree`
- 🔴 **TRÈS SENSIBLE** : adresse précise + codes d'accès

---

### 1.3 Vue SQL Actuelle `tickets_visibles_entreprise` (M06)

**Fichier**: migrations/20251226170500_m06_fix_view_tickets_visibles_entreprise.sql

**SELECT actuel** :
```sql
SELECT
  t.*,  -- ⚠️ TOUTES colonnes tickets (24 colonnes)
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE
  -- Cas 1: Mode PUBLIC
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  -- Cas 2: Mode ASSIGNÉ
  (
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  -- Cas 3: Tickets ACCEPTÉS (historique)
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );
```

**Analyse critique** :

| Élément | État | Problème Identifié |
|---------|------|-------------------|
| **`t.*`** | 🔴 **VIOLATION** | Expose TOUTES colonnes sans distinction |
| `locataire_id` | 🔴 **EXPOSÉ** | UUID locataire visible mode public |
| `logement_id` | 🔴 **EXPOSÉ** | UUID logement visible mode public |
| Filtrage statut | ✅ OK | Filtre correct par statut/mode |
| Filtrage mode_diffusion | ✅ OK | Distinction public/assigné correcte |
| Filtrage locked_at | ✅ OK | Empêche double acceptation |

**Conclusion ÉTAPE 1.3** :
- ✅ Logique de filtrage **LIGNES** : correcte (qui voit quels tickets)
- ❌ Logique de filtrage **COLONNES** : inexistante (quelles infos voir)
- 🔴 **VIOLATION RÈGLE MÉTIER** : UUIDs sensibles exposés mode public

---

### 1.4 Frontend Entreprise (Audit complet déjà effectué)

**Fichier**: public/entreprise/dashboard.html

**Query utilisée ligne 768** :
```javascript
const { data: tickets, error } = await supabase
  .from('tickets_visibles_entreprise')
  .select('*')  // ⚠️ SELECT * = toutes colonnes vue
  .eq('visible_par_entreprise_id', window.currentEntreprise.id)
```

**Query logement ligne 983** :
```javascript
const { data: logement } = await supabase
  .from('logements')
  .select('ville, adresse')  // ⚠️ Accès direct table logements
  .eq('id', ticket.logement_id)
```

**Analyse critique** :

| Accès | État | Problème |
|-------|------|----------|
| `.from('tickets_visibles_entreprise')` | ⚠️ Indirect | Expose UUIDs via vue |
| `.from('logements')` | 🔴 **DIRECT** | Accès table sans filtre mode_diffusion |
| `logement_id` disponible | 🔴 **RISQUE** | Entreprise peut faire JOIN manuelle |
| `locataire_id` disponible | 🔴 **RISQUE** | Entreprise peut faire JOIN manuelle |

**Conclusion ÉTAPE 1.4** :
- Frontend peut accéder `logements.ville` + `logements.adresse` SANS vérification mode
- UUIDs `logement_id` et `locataire_id` permettent JOIN arbitraire côté client
- ❌ Aucune protection RLS sur `logements` pour entreprises

---

### 1.5 RPC `accept_ticket_and_create_mission` (M05)

**Fichier**: migrations/20251226170400_m05_fix_rpc_accept_ticket.sql

**Logique actuelle** :
1. Vérification statut = `en_attente`
2. Vérification `locked_at IS NULL`
3. **Mode public** : check `regies_entreprises.mode_diffusion = 'general'`
4. **Mode assigné** : check `entreprise_id = p_entreprise_id`
5. UPDATE `locked_at = now()`, `entreprise_id = p_entreprise_id`
6. Transition statut `en_attente` → `en_cours`
7. INSERT `missions`

**Analyse déverrouillage** :

| Moment | Statut | Mode | Infos Visibles | Mécanisme |
|--------|--------|------|----------------|-----------|
| **AVANT acceptation** | `en_attente` | `public` | 🔴 **TOUTES** (via vue) | Aucun masquage |
| **APRÈS acceptation** | `en_cours` | N/A | 🔴 **TOUTES** (via vue cas 3) | Aucun changement |

**Conclusion ÉTAPE 1.5** :
- ❌ RPC ne déclenche AUCUN "déverrouillage" explicite
- ❌ Infos déjà accessibles AVANT acceptation (violation règle)
- ✅ Filtrage cas 3 vue empêche autres entreprises de voir après acceptation
- 🔴 **PROBLÈME** : pas de distinction avant/après acceptation côté colonnes

---

## 📋 ÉTAPE 2 - MAPPING VISIBILITÉ ACTUELLE

### 2.1 Tableau Exhaustif par Rôle

| Rôle | Statut Ticket | Mode Diffusion | UUID `locataire_id` | UUID `logement_id` | Nom Locataire (via JOIN) | Adresse Logement (via JOIN) | Source | **CONFORME RÈGLE** |
|------|---------------|----------------|---------------------|--------------------|--------------------------|-----------------------------|--------|---------------------|
| **ENTREPRISE** | `en_attente` | `public` | 🔴 **VISIBLE** | 🔴 **VISIBLE** | ⚠️ Accessible (JOIN) | ⚠️ Accessible (JOIN) | Vue M06 | ❌ **NON** |
| **ENTREPRISE** | `en_attente` | `assigné` | 🔴 **VISIBLE** | 🔴 **VISIBLE** | ⚠️ Accessible (JOIN) | ⚠️ Accessible (JOIN) | Vue M06 | ✅ **OUI** (assignation = engagement) |
| **ENTREPRISE** | `en_cours` | N/A | 🔴 **VISIBLE** | 🔴 **VISIBLE** | ⚠️ Accessible (JOIN) | ⚠️ Accessible (JOIN) | Vue M06 cas 3 | ✅ **OUI** (accepté = engagement) |
| **ENTREPRISE** | `termine` | N/A | 🔴 **VISIBLE** | 🔴 **VISIBLE** | ⚠️ Accessible (JOIN) | ⚠️ Accessible (JOIN) | Vue M06 cas 3 | ✅ **OUI** (mission terminée) |
| **ENTREPRISE** | `clos` | N/A | 🔴 **VISIBLE** | 🔴 **VISIBLE** | ⚠️ Accessible (JOIN) | ⚠️ Accessible (JOIN) | Vue M06 cas 3 | ✅ **OUI** (historique) |
| **RÉGIE** | Tous | Tous | ✅ VISIBLE | ✅ VISIBLE | ✅ VISIBLE | ✅ VISIBLE | RPC M22.5 | ✅ **OUI** (propriétaire) |
| **LOCATAIRE** | Tous | Tous | ✅ VISIBLE (self) | ✅ VISIBLE | ✅ VISIBLE (self) | ✅ VISIBLE | RPC M23 | ✅ **OUI** (propriétaire) |

---

### 2.2 Violations Règle Métier Identifiées

#### 🔴 VIOLATION 1 : UUIDs Sensibles en Mode Public

**Règle** :
> Mode public → entreprises voient UNIQUEMENT ville, titre, catégorie, priorité, plafond

**État actuel** :
- Vue M06 expose `t.*` = TOUTES colonnes incluant `locataire_id`, `logement_id`
- Frontend peut faire `.from('logements').select('*').eq('id', logement_id)`
- Frontend peut faire `.from('locataires').select('*').eq('id', locataire_id)`
- ❌ **Aucune protection RLS** sur ces tables pour entreprises

**Impact** :
- Entreprise mode public peut récupérer nom/prénom/téléphone locataire
- Entreprise mode public peut récupérer adresse exacte + code entrée
- **Violation RGPD potentielle** : données persos sans consentement

#### 🔴 VIOLATION 2 : Pas de Distinction Avant/Après Acceptation

**Règle** :
> Déverrouillage TOTAL infos locataire UNIQUEMENT après acceptation

**État actuel** :
- Infos déjà visibles AVANT acceptation (mode assigné)
- Aucun mécanisme de "déverrouillage progressif"
- Vue M06 cas 2 (`mode_diffusion = 'assigné'`) expose tout immédiatement

**Impact** :
- Entreprise assignée voit tout SANS accepter (pas d'engagement)
- Pas de différence visibilité entre "assigné mais pas accepté" vs "accepté"

#### 🔴 VIOLATION 3 : Accès Direct Tables Liées

**Règle** :
> Logique centralisée DB/RPC/Vue (pas côté frontend)

**État actuel** :
- Frontend ligne 983 fait `.from('logements').select('ville, adresse')`
- Aucun RPC pour masquer conditionnellement
- Entreprise peut contourner vue en accédant tables directement

**Impact** :
- Masquage côté vue inutile si tables accessibles directement
- Obligation de dupliquer logique RLS sur TOUTES les tables liées

---

### 2.3 Synthèse Conformité

| Cas d'Usage | Conforme Règle | Raison |
|-------------|----------------|--------|
| Régie voit tout | ✅ OUI | Propriétaire données |
| Locataire voit ses infos | ✅ OUI | Propriétaire données |
| Entreprise mode PUBLIC avant acceptation | ❌ **NON** | UUIDs + JOIN exposent données sensibles |
| Entreprise mode ASSIGNÉ avant acceptation | ❌ **NON** | Toutes infos visibles sans engagement |
| Entreprise mode ASSIGNÉ après acceptation | ✅ OUI | Engagement contractuel effectif |
| Entreprise mode PUBLIC après acceptation | ✅ OUI | Engagement contractuel effectif |

**Taux conformité actuel** : 50% (3/6 cas)

---

## 🔍 ÉTAPE 3 - VÉRIFICATION STRUCTURE TECHNIQUE

### 3.1 Masquage Conditionnel : Faisabilité

**Question** : La structure actuelle permet-elle un masquage conditionnel SANS duplication logique frontend ?

#### Option A : Modifier Vue SQL `tickets_visibles_entreprise`

**Approche** :
- Remplacer `SELECT t.*` par `SELECT CASE WHEN ... colonnes spécifiques`
- Ajouter logique conditionnelle par colonne selon :
  - `t.mode_diffusion`
  - `t.statut`
  - `t.locked_at`
  - `t.entreprise_id = visible_par_entreprise_id`

**Exemple technique** :
```sql
SELECT
  t.id,
  t.titre,
  t.categorie,
  t.priorite,
  t.plafond_intervention_chf,
  -- Masquage conditionnel locataire_id
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL  -- Mode public avant acceptation : masquer
    ELSE t.locataire_id  -- Sinon : visible
  END AS locataire_id,
  -- Masquage conditionnel logement_id
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL  -- Mode public avant acceptation : masquer
    ELSE t.logement_id  -- Sinon : visible
  END AS logement_id,
  ...
FROM tickets t
INNER JOIN regies_entreprises re ON ...
WHERE ...
```

**Avantages** :
- ✅ Logique centralisée DB
- ✅ Aucune modification frontend
- ✅ Masquage automatique pour TOUTES requêtes

**Risques** :
- ⚠️ Vue complexe (24+ colonnes avec CASE)
- ⚠️ Performance : évaluation CASE pour chaque colonne/ligne
- ⚠️ Maintenance : ajout colonne = modifier CASE multiple

**Faisabilité** : ✅ **TECHNIQUEMENT POSSIBLE**

---

#### Option B : Créer RPC Entreprise (comme Locataire/Régie)

**Approche** :
- Créer `get_tickets_disponibles_entreprise()`
- Retourner colonnes SÉLECTIVES selon mode_diffusion
- Frontend remplace `.from('tickets_visibles_entreprise')` par `.rpc()`

**Exemple technique** :
```sql
CREATE FUNCTION get_tickets_disponibles_entreprise()
RETURNS TABLE(...) -- Colonnes non sensibles uniquement
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.titre, t.categorie, t.priorite,
    -- PAS de locataire_id, logement_id en mode public
    NULL::uuid AS locataire_id,  -- Masqué
    NULL::uuid AS logement_id    -- Masqué
  FROM tickets t
  WHERE ... mode_diffusion = 'public' ...;
END;
$$;
```

**Avantages** :
- ✅ Cohérence architecture (locataire/régie utilisent RPC)
- ✅ Lisibilité code (logique explicite)
- ✅ Flexibilité : différentes RPC pour différents modes

**Risques** :
- ⚠️ Modification frontend (`.from()` → `.rpc()`)
- ⚠️ Multiplication RPC (1 par mode ?)
- ⚠️ Duplication logique filtrage (WHERE déjà dans vue M06)

**Faisabilité** : ✅ **TECHNIQUEMENT POSSIBLE**

---

#### Option C : RLS Strict sur Tables Liées

**Approche** :
- Ajouter RLS sur `locataires` table :
  - Entreprises mode public : `RETURNS FALSE`
  - Entreprises assigné/accepté : `RETURNS ticket.entreprise_id = current_entreprise_id`
- Ajouter RLS sur `logements` table :
  - Entreprises mode public : masquer `numero`, `etage`
  - Entreprises accepté : tout visible

**Avantages** :
- ✅ Protection complète (même si frontend contourne vue)
- ✅ Principe moindre privilège

**Risques** :
- 🔴 **RLS RÉCURSION** : vue M06 + RLS tables liées = boucle infinie potentielle
- 🔴 **Déjà vécu** : M22/M23 créés pour ÉVITER récursion RLS
- 🔴 **Complexité** : vérifier `regies_entreprises.mode_diffusion` depuis `locataires` RLS

**Faisabilité** : ❌ **RISQUE ÉLEVÉ RÉCURSION**

---

### 3.2 Blocages Techniques Identifiés

| Blocage | Sévérité | Description |
|---------|----------|-------------|
| **RLS Récursion** | 🔴 CRITIQUE | Option C déclencherait récursion infinie (déjà corrigée M22/M23) |
| **Frontend Accès Direct** | 🔴 ÉLEVÉ | `.from('logements')` contourne toute logique vue |
| **Vue SELECT t.*** | 🟡 MOYEN | Expose TOUTES colonnes sans distinction |
| **Pas de Ville Isolée** | 🟡 MOYEN | Besoin JOIN `immeubles` pour ville seule |

---

### 3.3 Dépendances Externes

**Pour implémenter masquage, il faut** :

1. ✅ **Colonne `mode_diffusion`** : existe (M02)
2. ✅ **Colonne `locked_at`** : existe (M02)
3. ✅ **Colonne `entreprise_id`** : existe (schema tickets)
4. ✅ **Vue filtrage lignes** : existe (M06)
5. ❌ **Vue filtrage colonnes** : n'existe PAS
6. ❌ **RPC entreprise** : n'existe PAS
7. ❌ **Colonne `ville` dans tickets** : n'existe PAS (nécessite JOIN immeubles)
8. ❌ **RLS `logements` pour entreprises** : n'existe PAS

**Conclusion ÉTAPE 3.3** :
- 4/8 éléments requis existent (50%)
- Ajout colonne `ville` = risque dénormalisation
- RLS `logements` = risque récursion
- RPC entreprise = modification frontend obligatoire

---

## 🚨 ÉTAPE 4 - POINT DE DÉCISION BLOQUANT

### 4.1 Recommandation Technique

**Option privilégiée** : **Option A - Modifier Vue SQL M06**

**Justification** :
1. ✅ AUCUNE récursion RLS (vue SQL indépendante)
2. ✅ AUCUNE modification frontend (vue transparente)
3. ✅ Cohérence architecture (entreprise garde accès vue)
4. ✅ Centralisé DB (pas de logique frontend)
5. ⚠️ Complexité vue acceptable (24 colonnes → 24 CASE)

**Implémentation proposée** :
- Migration M24 : `DROP VIEW tickets_visibles_entreprise; CREATE VIEW ...`
- Remplacer `SELECT t.*` par 24 colonnes avec CASE conditionnel
- Masquer `locataire_id`, `logement_id` SI mode public ET `locked_at IS NULL`
- Exposer `ville` via JOIN `immeubles` (nouveau champ calculé)

---

### 4.2 Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Performance Vue** | 🟡 Moyen | 🟡 Moyen | Indexer `tickets(mode_diffusion, locked_at)` |
| **Maintenance Complexe** | 🟡 Moyen | 🟡 Moyen | Documenter CASE dans migration |
| **Frontend Contournement** | 🔴 Élevé | 🔴 Critique | Ajouter RLS minimal `logements.numero` |
| **Ville Manquante** | 🟡 Moyen | 🟡 Moyen | JOIN `immeubles.ville` dans vue |
| **Régression Existant** | 🟢 Faible | 🔴 Critique | Tester cas 2/3 vue (assigné/accepté) |

---

### 4.3 Points Bloquants Non Résolus

#### 🔴 BLOQUANT 1 : Frontend Accès Direct `logements`

**Problème** :
- Ligne 983 : `.from('logements').select('ville, adresse')`
- Même si vue masque `logement_id`, frontend PEUT contourner

**Solutions possibles** :
1. **Ajouter RLS `logements`** : risque récursion
2. **Supprimer query frontend** : modifier public/entreprise/dashboard.html
3. **RPC dédiée `get_logement_ville(ticket_id)`** : évite accès direct

**Décision requise** : Quelle solution acceptée ?

#### 🔴 BLOQUANT 2 : Définition "Ville Seule"

**Problème** :
- Règle métier : "entreprise voit ville"
- Aucune colonne `ville` dans `tickets`
- Nécessite JOIN `logements → immeubles → ville`

**Questions** :
1. Ville = `immeubles.ville` (commune) OU `immeubles.code_postal` ?
2. Afficher ville SI mode public OU toujours masquer avec adresse ?
3. Vue doit-elle inclure `ville` comme colonne séparée ?

**Décision requise** : Clarification métier

#### 🔴 BLOQUANT 3 : Priorité/Plafond Requis Avant Diffusion

**Problème** :
- Règle métier : "priorité + plafond OBLIGATOIRES avant diffusion"
- Aucune contrainte DB actuellement
- RPC `diffuser_ticket` ne vérifie PAS ces champs

**Solutions possibles** :
1. **Modifier M04 `diffuser_ticket`** : ajouter check NOT NULL
2. **Trigger BEFORE UPDATE** : empêcher `mode_diffusion` si NULL
3. **Frontend validation** : bloquer bouton diffusion

**Décision requise** : Quelle implémentation ?

---

### 4.4 Conclusion ÉTAPE 4

#### ✅ Structure Technique VALIDÉE

**Faisabilité** : ✅ **OUI**, masquage conditionnel réalisable via vue SQL M06 modifiée

**Prérequis** :
- Résoudre 3 bloquants ci-dessus
- Obtenir validation métier définitions (ville, priorité obligatoire)
- Décider stratégie frontend accès direct

#### ⛔ STOP - Décisions Métier Requises

**JE M'ARRÊTE ICI** conformément aux instructions.

**Raisons** :
1. 🔴 3 points bloquants nécessitent décisions métier
2. 🔴 Clarification "ville" requise (quel champ exactement ?)
3. 🔴 Priorité/plafond obligatoires : implémentation à valider
4. 🔴 Accès direct `logements` : solution à choisir

**Prochaines étapes SI validation** :
1. Créer migration M24 : modifier vue `tickets_visibles_entreprise`
2. Ajouter CASE conditionnel sur `locataire_id`, `logement_id`
3. Ajouter colonne calculée `ville` via JOIN `immeubles`
4. Modifier RPC `diffuser_ticket` : vérifier priorité/plafond NOT NULL
5. Ajouter RLS minimal `logements` : bloquer `numero`, `adresse` si mode public
6. Tester exhaustivement 3 cas vue (public/assigné/accepté)

**Documents à produire SI GO** :
- Migration M24 SQL (200 lignes estimées)
- Tests SQL validations (50 lignes)
- Documentation règles masquage (ce document complété)

---

## 📊 ANNEXES

### Annexe A : Colonnes Vue Actuelle vs Requis Métier

| Colonne Vue M06 | Mode Public AVANT Accept. | Mode Assigné AVANT Accept. | APRÈS Acceptation | Implémentation Requise |
|-----------------|---------------------------|----------------------------|-------------------|------------------------|
| `id` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `titre` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `categorie` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `priorite` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `plafond_intervention_chf` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| **`locataire_id`** | ❌ **MASQUER** | ❌ **MASQUER** | ✅ Visible | **CASE WHEN ... NULL** |
| **`logement_id`** | ❌ **MASQUER** | ❌ **MASQUER** | ✅ Visible | **CASE WHEN ... NULL** |
| **`ville`** (nouveau) | ✅ Visible | ✅ Visible | ✅ Visible | **JOIN immeubles.ville** |
| `description` | ✅ Visible (métier assumé) | ✅ Visible | ✅ Visible | Aucun changement |
| `sous_categorie` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `piece` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `statut` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |
| `date_creation` | ✅ Visible | ✅ Visible | ✅ Visible | Aucun changement |

**Total modifications requises** : 3 colonnes (2 masquages + 1 ajout)

---

### Annexe B : Tests SQL Requis (Post-M24)

```sql
-- TEST 1: Mode public AVANT acceptation → locataire_id NULL
SELECT 
  id, titre, locataire_id, logement_id, ville
FROM tickets_visibles_entreprise
WHERE mode_diffusion = 'public' 
  AND locked_at IS NULL
LIMIT 1;
-- Attendu: locataire_id = NULL, logement_id = NULL, ville != NULL

-- TEST 2: Mode assigné AVANT acceptation → locataire_id NULL (si règle stricte)
-- OU locataire_id visible (si assigné = engagement)
-- → Décision métier requise

-- TEST 3: Mode public APRÈS acceptation → locataire_id visible
SELECT 
  id, titre, locataire_id, logement_id, ville
FROM tickets_visibles_entreprise
WHERE entreprise_id = '<entreprise_acceptée>'
  AND statut = 'en_cours'
LIMIT 1;
-- Attendu: locataire_id != NULL, logement_id != NULL

-- TEST 4: Autre entreprise ne voit PAS ticket accepté
SELECT COUNT(*)
FROM tickets_visibles_entreprise
WHERE id = '<ticket_accepté>'
  AND visible_par_entreprise_id != '<entreprise_acceptée>';
-- Attendu: 0
```

---

**FIN AUDIT STRICT READ-ONLY**

**Statut** : ⛔ **EN ATTENTE DÉCISIONS MÉTIER**

**Prochaine action** : Validation 3 bloquants + GO migration M24
