# 📐 ANALYSE ARCHITECTURE FRONTEND - JETC_IMMO

**Date**: 2025-12-26  
**Contexte**: Backend PHASE 1-3 appliqué avec succès. Préparation intégration frontend tickets.

---

## 🏗️ ARCHITECTURE ACTUELLE

### Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **Frontend** | Vanilla JavaScript (ES6+) | - |
| **HTML/CSS** | HTML5 + CSS3 + Design System | - |
| **Client Supabase** | `@supabase/supabase-js` | 2.88.0 |
| **Serveur Dev** | Node.js HTTP Server | >=18.0.0 |
| **Serveur Prod** | Vercel Serverless | - |

**Architecture**: Multi-page application (MPA) avec pages statiques HTML.

---

## 📁 STRUCTURE FICHIERS

### Public (Frontend)

```
public/
├── index.html                  # Landing page
├── login.html                  # Authentification Supabase
├── register.html               # Inscription (locataire, régie, entreprise)
├── reset-password.html         # Réinitialisation mot de passe
├── install-admin.html          # Installation admin JTEC
├── demo-hub.html               # Hub démo (si MODE=demo)
│
├── admin/
│   └── dashboard.html          # Dashboard admin JTEC ✅ (validation régies)
│
├── regie/
│   ├── dashboard.html          # Dashboard régie ⚠️ (welcome card, pas de tickets)
│   ├── immeubles.html          # Gestion immeubles
│   ├── logements.html          # Gestion logements
│   └── locataires.html         # Gestion locataires
│
├── locataire/
│   └── dashboard.html          # Dashboard locataire ❌ (à aligner)
│
├── entreprise/
│   └── dashboard.html          # Dashboard entreprise ❌ (à aligner)
│
├── proprietaire/
│   └── dashboard.html          # Dashboard propriétaire (hors scope)
│
├── technicien/
│   └── dashboard.html          # Dashboard technicien (hors scope)
│
├── css/
│   └── design-system.css       # Variables CSS communes (couleurs, radius, shadows)
│
└── js/
    ├── supabaseClient.js       # Init client Supabase global (window.supabase)
    ├── demoProfiles.js         # Profils démo (MODE=demo)
    └── mobile-menu.js          # Menu mobile responsive
```

### Backend (API)

```
api/
├── _supabase.js                # Helper Supabase server-side
├── healthcheck.js              # Health check endpoint
│
├── admin/
│   └── valider-agence.js       # Validation/refus régies ✅
│
├── auth/
│   ├── login.js                # POST login
│   ├── register.js             # POST register
│   └── reset-password.js       # POST reset password
│
├── tickets/
│   ├── create.js               # POST /api/tickets/create ⚠️ (statut forcé à 'ouvert' - M12)
│   ├── diffuser.js             # POST /api/tickets/diffuser
│   └── accept.js               # POST /api/tickets/accept
│
├── missions/
│   └── (à explorer)
│
└── (autres endpoints...)
```

---

## 🔐 AUTHENTIFICATION

### Pattern Utilisé (Toutes Pages Dashboard)

```javascript
// 1. Vérifier session Supabase (SOURCE DE VÉRITÉ)
const { data: { session }, error } = await supabase.auth.getSession();

// 2. Récupérer profil utilisateur
const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, role')
  .eq('id', session.user.id)
  .single();

// 3. Vérifier rôle attendu
if (profile.role !== 'regie') {
  // Redirect avec message erreur
}

// 4. Charger données spécifiques rôle (ex: régie, locataire, entreprise)
const { data: regie } = await supabase
  .from('regies')
  .select('id, nom, statut_validation')
  .eq('profile_id', session.user.id)
  .maybeSingle();

// 5. Vérifications métier (ex: statut_validation='valide' pour régie)

// 6. Afficher dashboard
```

**Sécurité**: 
- ✅ Pas de localStorage pour session (géré par Supabase)
- ✅ Vérification systématique session + profil
- ✅ Redirect explicite si rôle incorrect ou données manquantes
- ✅ Messages d'erreur clairs (pas de popup bloquante)

---

## 🎨 DESIGN SYSTEM

### Variables CSS (design-system.css)

```css
/* Couleurs principales */
--primary-blue: #2563eb
--accent-blue: #667eea
--gray-50 à --gray-900: Palette de gris

/* Radius */
--radius-sm: 6px
--radius-md: 8px
--radius-lg: 12px

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg

/* Responsive */
@media (max-width: 768px)
```

### Pattern Layout Dashboard

```
┌─────────────────────────────────────────┐
│         SIDEBAR (280px fixe)            │
│ ┌──────────────────────────────────┐    │
│ │ Logo + Titre                      │    │
│ │ Sous-titre (rôle)                 │    │
│ ├──────────────────────────────────┤    │
│ │ Menu Navigation                   │    │
│ │  🏠 Dashboard                     │    │
│ │  📋 (Items spécifiques rôle)     │    │
│ ├──────────────────────────────────┤    │
│ │ Footer                            │    │
│ │  Avatar + Email + Rôle           │    │
│ │  [Bouton Déconnexion]            │    │
│ └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
         ┌────────────────────────────────┐
         │    MAIN CONTENT (flex: 1)      │
         │  margin-left: 280px            │
         │  padding: 30px 40px            │
         │                                │
         │  [Contenu spécifique page]     │
         └────────────────────────────────┘
```

**Mobile** (<768px): Sidebar masquée, main-content full-width.

---

## 📊 ÉTAT ACTUEL DASHBOARDS

### ✅ Admin Dashboard (`/admin/dashboard.html`)

**Statut**: Fonctionnel, aligné backend.

**Fonctionnalités**:
- ✅ Section "Régies en attente de validation"
- ✅ Fonction `loadRegiesEnAttente()` → récupère régies via Supabase
- ✅ Bouton "✅ Valider" → appelle `/api/admin/valider-agence`
- ✅ Bouton "❌ Refuser" → prompt commentaire + appelle API
- ✅ Statistiques globales (tickets, régies, entreprises, locataires)
- ✅ Charts (tickets par statut, catégorie, priorité)

**Correctif appliqué**: Interface validation régies ajoutée (était absente initialement).

---

### ⚠️ Régie Dashboard (`/regie/dashboard.html`)

**Statut**: Authentification OK, **contenu placeholder**.

**État actuel**:
- ✅ Sidebar avec menu: Dashboard, Immeubles, Logements, Locataires, **Tickets**, Missions, Factures
- ✅ Auth check (session + rôle + statut_validation='valide')
- ❌ **Welcome card générique** → "Fonctionnalités à venir ÉTAPE 5, 6, 13"
- ❌ **Aucune gestion tickets** (menu Tickets lien vide `<a href="#">`)

**Ce qui manque** (à implémenter):
1. **Section "Tickets nouveaux"** (`statut='nouveau'`)
   - Liste tickets créés par locataires, non encore validés
   - Action: Bouton "Valider" → transition `nouveau` → `ouvert`
   
2. **Section "Tickets à diffuser"** (`statut='ouvert'`)
   - Liste tickets validés, pas encore diffusés
   - Action: Bouton "Diffuser" → modal choix mode (`public` ou `assigné`)
   - Appel RPC `diffuser_ticket()`
   
3. **Section "Tickets diffusés"** (`statut='en_attente'`)
   - Liste tickets en attente acceptation entreprise
   - Read-only, affichage état
   
4. **Section "Tickets en cours"** (`statut='en_cours'`)
   - Liste tickets avec mission active
   - Read-only, voir mission associée
   
5. **Section "Tickets terminés"** (`statut='termine'`)
   - Liste tickets terminés par entreprise, en attente validation régie
   - Action: Bouton "Clôturer" → transition `termine` → `clos`
   
6. **Section "Tickets clos"** (`statut='clos'`)
   - Historique tickets finalisés
   - Read-only

---

### ❌ Locataire Dashboard (`/locataire/dashboard.html`)

**Statut**: À auditer et aligner avec backend.

**Ce qui doit exister**:
1. **Formulaire création ticket**
   - Champs:
     - `titre` (text)
     - `description` (textarea)
     - `categorie` (select: plomberie, electricite, chauffage, etc.)
     - `sous_categorie` (select dynamique selon catégorie - M08)
     - `piece` (select: cuisine, salle_de_bain, chambre, wc, etc. - M08)
     - `priorite` (select: urgente, haute, normale, basse)
     - `plafond_intervention_chf` (number, optional)
   - **Ajout 3 disponibilités** (M09):
     - Créneau 1 (date_debut, date_fin, preference=1)
     - Créneau 2 (date_debut, date_fin, preference=2)
     - Créneau 3 (date_debut, date_fin, preference=3)
   - Validation frontend: 3 créneaux obligatoires, non chevauchants
   - Appel: `POST /api/tickets/create` (⚠️ corriger statut forcé - M12)
   
2. **Liste "Mes tickets"**
   - Filtres par statut (nouveau, ouvert, en_attente, en_cours, termine, clos)
   - Affichage badge statut avec couleur
   - Clic ticket → modal détails
   
3. **Détails ticket**
   - Toutes infos ticket
   - Créneaux disponibilité
   - Historique transitions (si implémenté)
   - Mission associée (si existe)

---

### ❌ Entreprise Dashboard (`/entreprise/dashboard.html`)

**Statut**: À auditer et aligner avec backend.

**Ce qui doit exister**:
1. **Liste "Tickets disponibles"** (`statut='en_attente'`)
   - Requête via **vue `tickets_visibles_entreprise`** (M06) ou RLS policy (M07)
   - Filtres:
     - `mode_diffusion='public'` ET `locked_at IS NULL`
     - OU `mode_diffusion='assigné'` ET `entreprise_id=<current_user_entreprise>`
   - Action: Bouton "Accepter" → appelle RPC `accept_ticket_and_create_mission()`
   
2. **Liste "Mes missions"** (`statut='en_cours'`)
   - Tickets acceptés par cette entreprise
   - Action: Bouton "Terminer" → appelle RPC `update_mission_statut('terminee')`
   - Synchronisation auto mission → ticket via trigger M14
   
3. **Historique missions** (`statut IN ('terminee', 'validee')`)
   - Read-only
   - Affichage montant réel (si renseigné)

---

## 🔗 INTÉGRATION BACKEND (PHASE 1-3)

### RPCs Disponibles (à appeler depuis frontend)

| RPC | Rôles autorisés | Paramètres | Description |
|-----|-----------------|------------|-------------|
| `update_ticket_statut()` | `regie`, `admin_jtec` | `p_ticket_id`, `p_nouveau_statut` | Transition statut ticket (M03) |
| `diffuser_ticket()` | `regie`, `admin_jtec` | `p_ticket_id`, `p_mode_diffusion` | Diffuser ticket public/assigné (M04) |
| `accept_ticket_and_create_mission()` | `entreprise`, `admin_jtec` | `p_ticket_id`, `p_montant_estime_chf` | Accepter ticket + créer mission (M05) |

### Vues Disponibles

| Vue | Accessible par | Usage |
|-----|----------------|-------|
| `tickets_visibles_entreprise` | `entreprise` | Liste tickets diffusés visibles (M06) |
| `tickets_complets` | Tous (selon RLS) | Vue enrichie tickets avec infos locataire/logement |
| `missions_details` | Selon RLS | Vue enrichie missions avec infos ticket/entreprise |

### Tables Directes (via RLS)

| Table | Opérations autorisées | Rôle |
|-------|----------------------|------|
| `tickets` | SELECT | `locataire` (ses tickets), `regie` (sa régie), `entreprise` (via policy M07) |
| `tickets` | INSERT | `locataire` uniquement |
| `tickets` | UPDATE | Via RPC uniquement (pas direct) |
| `tickets` | DELETE | `regie`, `admin_jtec` SI aucune mission (M13) |
| `tickets_disponibilites` | CRUD | `locataire` (ses tickets), SELECT `regie`/`entreprise` |
| `missions` | SELECT | Selon RLS (entreprise ses missions, régie tickets sa régie) |
| `missions` | INSERT | Via RPC uniquement |
| `missions` | UPDATE | Via RPC uniquement |

---

## ⚠️ POINTS CRITIQUES FRONTEND

### 🔴 Critique 1: API `/api/tickets/create` force statut='ouvert'

**Fichier**: `api/tickets/create.js`  
**Problème**: Code force `statut: 'ouvert'` au lieu de laisser DEFAULT SQL `'nouveau'`  
**Impact**: Tickets créés directement en `ouvert`, ignore workflow `nouveau` → régie valide → `ouvert`  
**Correction M12**: Supprimer ligne `statut: 'ouvert'` dans INSERT

**Avant**:
```javascript
const { data, error } = await supabase
  .from('tickets')
  .insert({
    titre, description, categorie, priorite,
    locataire_id, logement_id, regie_id,
    statut: 'ouvert'  // ❌ ERREUR
  });
```

**Après**:
```javascript
const { data, error } = await supabase
  .from('tickets')
  .insert({
    titre, description, categorie, priorite,
    locataire_id, logement_id, regie_id
    // ✅ Pas de statut → DEFAULT SQL 'nouveau'
  });
```

---

### 🟡 Critique 2: Pas de gestion sous_categorie/piece frontend

**Fichiers concernés**: `locataire/dashboard.html` (formulaire création ticket)  
**Problème**: Colonnes M08 (`sous_categorie`, `piece`) existent en base, pas dans frontend  
**Impact**: Tickets créés sans classification métier  
**Solution**: Ajouter selects dynamiques dans formulaire

**Logique requise**:
1. Select `categorie` → change options `sous_categorie`
   - plomberie → "Fuite d'eau", "WC bouché", "Chauffe-eau", etc.
   - electricite → "Panne générale", "Prise défectueuse", etc.
2. Select `piece` → valeurs fixes enum (cuisine, salle_de_bain, chambre, wc, etc.)

---

### 🟡 Critique 3: Pas de gestion disponibilités frontend

**Fichiers concernés**: `locataire/dashboard.html` (formulaire création ticket)  
**Problème**: Table M09 (`tickets_disponibilites`) existe, pas d'interface frontend  
**Impact**: Tickets créés sans créneaux → échec diffusion (trigger M10 bloque)  
**Solution**: Ajouter 3 inputs datetime dans formulaire + validation

**Logique requise**:
1. 3 paires (date_debut, date_fin) avec label "Préférence 1, 2, 3"
2. Validation frontend:
   - `date_fin > date_debut` pour chaque créneau
   - Pas de chevauchement entre créneaux
   - Les 3 créneaux sont remplis
3. Appel API:
   - D'abord créer ticket
   - Puis INSERT 3 lignes dans `tickets_disponibilites`

---

### 🟢 Critique 4: Affichage statuts non aligné

**Fichiers concernés**: Tous dashboards  
**Problème**: Statuts hardcodés ou mappings incorrects  
**Impact**: Affichage incohérent avec backend  
**Solution**: Utiliser statuts exacts backend

**Statuts officiels** (à utiliser partout):
- `nouveau` → Badge jaune "🆕 Nouveau"
- `ouvert` → Badge bleu "📂 Ouvert"
- `en_attente` → Badge orange "⏳ En attente"
- `en_cours` → Badge bleu foncé "🔧 En cours"
- `termine` → Badge vert "✅ Terminé"
- `clos` → Badge gris "🔒 Clos"
- `annule` → Badge rouge "❌ Annulé"

**Code CSS badge** (à créer):
```css
.badge-statut {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.badge-nouveau { background: #fef3c7; color: #92400e; }
.badge-ouvert { background: #dbeafe; color: #1e40af; }
.badge-en-attente { background: #fed7aa; color: #9a3412; }
.badge-en-cours { background: #bfdbfe; color: #1e3a8a; }
.badge-termine { background: #d1fae5; color: #065f46; }
.badge-clos { background: #e5e7eb; color: #374151; }
.badge-annule { background: #fecaca; color: #991b1b; }
```

---

## 🎯 PLAN D'ACTION FRONTEND

### Phase 1 : Corrections API (M12)

1. ✅ Documenter problème `statut='ouvert'` forcé (fait - M12_API_CREATE_TICKET_FIX.md)
2. ⏳ **Appliquer correction** dans `api/tickets/create.js`
3. ⏳ **Tester** création ticket → vérifier `statut='nouveau'`

---

### Phase 2 : Dashboard Régie (priorité 1)

**Fichier**: `public/regie/dashboard.html`

#### 2.1. Supprimer welcome card placeholder

Remplacer par sections tickets réelles.

#### 2.2. Créer sections tickets

```html
<div class="tickets-container">
  <!-- Section 1: Tickets nouveaux -->
  <div class="tickets-section">
    <h2>🆕 Tickets nouveaux (à valider)</h2>
    <div id="tickets-nouveaux-list"></div>
  </div>
  
  <!-- Section 2: Tickets ouverts (à diffuser) -->
  <div class="tickets-section">
    <h2>📂 Tickets ouverts (prêts à diffuser)</h2>
    <div id="tickets-ouverts-list"></div>
  </div>
  
  <!-- Section 3: Tickets diffusés -->
  <div class="tickets-section">
    <h2>⏳ Tickets en attente entreprise</h2>
    <div id="tickets-attente-list"></div>
  </div>
  
  <!-- Section 4: Tickets en cours -->
  <div class="tickets-section">
    <h2>🔧 Tickets en cours (missions actives)</h2>
    <div id="tickets-encours-list"></div>
  </div>
  
  <!-- Section 5: Tickets terminés (à clôturer) -->
  <div class="tickets-section">
    <h2>✅ Tickets terminés (à valider)</h2>
    <div id="tickets-termines-list"></div>
  </div>
  
  <!-- Section 6: Tickets clos (historique) -->
  <div class="tickets-section">
    <h2>🔒 Tickets clos</h2>
    <div id="tickets-clos-list"></div>
  </div>
</div>
```

#### 2.3. Créer fonctions JavaScript

```javascript
// Charger tickets par statut
async function loadTicketsByStatut(statut, containerId) {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, titre, description, statut, priorite, categorie, created_at, locataire:locataires(nom, prenom)')
    .eq('statut', statut)
    .eq('regie_id', currentRegieId)  // RLS auto-filtre, mais explicite pour clarté
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`Erreur chargement tickets ${statut}:`, error);
    return;
  }
  
  const container = document.getElementById(containerId);
  container.innerHTML = tickets.length === 0 
    ? '<p class="empty-state">Aucun ticket</p>'
    : tickets.map(ticket => renderTicketCard(ticket, statut)).join('');
}

// Rendu carte ticket avec actions selon statut
function renderTicketCard(ticket, statut) {
  let actionButtons = '';
  
  if (statut === 'nouveau') {
    actionButtons = `<button onclick="validerTicket('${ticket.id}')">✅ Valider</button>`;
  } else if (statut === 'ouvert') {
    actionButtons = `<button onclick="openDiffuserModal('${ticket.id}')">📢 Diffuser</button>`;
  } else if (statut === 'termine') {
    actionButtons = `<button onclick="cloturerTicket('${ticket.id}')">🔒 Clôturer</button>`;
  }
  
  return `
    <div class="ticket-card">
      <h3>${ticket.titre}</h3>
      <p>${ticket.description}</p>
      <div class="ticket-meta">
        <span class="badge-statut badge-${statut}">${statut}</span>
        <span class="badge-priorite">${ticket.priorite}</span>
        <span class="badge-categorie">${ticket.categorie}</span>
      </div>
      <div class="ticket-footer">
        <span>Locataire: ${ticket.locataire.prenom} ${ticket.locataire.nom}</span>
        ${actionButtons}
      </div>
    </div>
  `;
}

// Actions régie
async function validerTicket(ticketId) {
  if (!confirm('Valider ce ticket (nouveau → ouvert) ?')) return;
  
  const { data, error } = await supabase.rpc('update_ticket_statut', {
    p_ticket_id: ticketId,
    p_nouveau_statut: 'ouvert'
  });
  
  if (error) {
    alert('Erreur validation: ' + error.message);
    return;
  }
  
  alert('Ticket validé avec succès !');
  loadTicketsByStatut('nouveau', 'tickets-nouveaux-list');
  loadTicketsByStatut('ouvert', 'tickets-ouverts-list');
}

async function openDiffuserModal(ticketId) {
  // Modal choix mode_diffusion (public / assigné)
  const mode = prompt('Mode de diffusion :\n1 = public\n2 = assigné à entreprise', '1');
  if (!mode) return;
  
  const modeDiffusion = mode === '1' ? 'public' : 'assigné';
  
  let entrepriseId = null;
  if (modeDiffusion === 'assigné') {
    entrepriseId = prompt('ID entreprise (si assigné):');
    if (!entrepriseId) return;
  }
  
  const { data, error } = await supabase.rpc('diffuser_ticket', {
    p_ticket_id: ticketId,
    p_mode_diffusion: modeDiffusion,
    p_entreprise_id: entrepriseId
  });
  
  if (error) {
    alert('Erreur diffusion: ' + error.message);
    return;
  }
  
  alert('Ticket diffusé avec succès !');
  loadTicketsByStatut('ouvert', 'tickets-ouverts-list');
  loadTicketsByStatut('en_attente', 'tickets-attente-list');
}

async function cloturerTicket(ticketId) {
  if (!confirm('Clôturer ce ticket (termine → clos) ?')) return;
  
  const { data, error } = await supabase.rpc('update_ticket_statut', {
    p_ticket_id: ticketId,
    p_nouveau_statut: 'clos'
  });
  
  if (error) {
    alert('Erreur clôture: ' + error.message);
    return;
  }
  
  alert('Ticket clôturé avec succès !');
  loadTicketsByStatut('termine', 'tickets-termines-list');
  loadTicketsByStatut('clos', 'tickets-clos-list');
}

// Init au chargement
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();  // Auth existante
  
  // Charger toutes sections tickets
  await Promise.all([
    loadTicketsByStatut('nouveau', 'tickets-nouveaux-list'),
    loadTicketsByStatut('ouvert', 'tickets-ouverts-list'),
    loadTicketsByStatut('en_attente', 'tickets-attente-list'),
    loadTicketsByStatut('en_cours', 'tickets-encours-list'),
    loadTicketsByStatut('termine', 'tickets-termines-list'),
    loadTicketsByStatut('clos', 'tickets-clos-list')
  ]);
});
```

---

### Phase 3 : Dashboard Locataire (priorité 2)

**Fichier**: `public/locataire/dashboard.html`

#### 3.1. Formulaire création ticket

- Ajouter selects `sous_categorie` (dynamique selon `categorie`)
- Ajouter select `piece`
- Ajouter 3 paires datetime (`date_debut`, `date_fin`) pour disponibilités
- Validation frontend (3 créneaux non chevauchants)

#### 3.2. Liste tickets

- Afficher tickets du locataire (RLS auto-filtre)
- Filtres par statut
- Modal détails ticket (readonly)

---

### Phase 4 : Dashboard Entreprise (priorité 3)

**Fichier**: `public/entreprise/dashboard.html`

#### 4.1. Liste tickets disponibles

- Requête via vue `tickets_visibles_entreprise` ou SELECT avec RLS
- Filtrer `statut='en_attente'` ET `locked_at IS NULL`
- Bouton "Accepter" → appelle RPC `accept_ticket_and_create_mission()`

#### 4.2. Liste missions

- Afficher missions entreprise
- Bouton "Terminer" si `statut='en_cours'`
- Historique missions terminées/validées

---

## 📊 RÉSUMÉ PRIORITÉS

| Ordre | Tâche | Criticité | Effort estimé |
|-------|-------|-----------|---------------|
| 1 | Corriger API `create` (M12) | 🔴 Haute | 10 min |
| 2 | Dashboard Régie - Tickets nouveaux/ouverts | 🔴 Haute | 3-4h |
| 3 | Dashboard Régie - Diffusion + Clôture | 🔴 Haute | 2-3h |
| 4 | Dashboard Locataire - Formulaire (base) | 🟡 Moyenne | 2-3h |
| 5 | Dashboard Locataire - Sous-catégories/pièces | 🟡 Moyenne | 1-2h |
| 6 | Dashboard Locataire - Disponibilités | 🟡 Moyenne | 2-3h |
| 7 | Dashboard Entreprise - Liste tickets | 🟡 Moyenne | 2-3h |
| 8 | Dashboard Entreprise - Missions | 🟡 Moyenne | 2-3h |
| 9 | Badges statuts CSS | 🟢 Faible | 30 min |
| 10 | Tests E2E frontend | 🟢 Faible | Continu |

**Total estimé**: 18-25 heures de développement frontend.

---

**Fin analyse architecture frontend.**
