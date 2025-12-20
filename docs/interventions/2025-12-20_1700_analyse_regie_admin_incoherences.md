# RAPPORT D'ANALYSE : Incohérences Dashboard Régie & Admin

**Date :** 20 décembre 2025  
**Heure :** 17:00 UTC+1  
**Type :** Analyse diagnostic - AUCUNE MODIFICATION APPORTÉE  
**Analyste :** GitHub Copilot (Agent IA)

---

## 📋 CONTEXTE

### Situation actuelle
Le workflow d'adhésion fonctionne **correctement** :
- ✅ Inscription régie via `/register.html`
- ✅ Validation admin via `/admin/dashboard.html`
- ✅ Email non-bloquant (correction appliquée)
- ✅ Authentification Supabase valide
- ✅ `statut_validation` correctement mis à jour
- ✅ Accès au dashboard régie (soft-lock corrigé)

### Problèmes identifiés
Malgré un workflow opérationnel, **4 incohérences fonctionnelles** persistent :

1. **Vue régie** : Informations affichées restent sur "Chargement..."
2. **Vue admin** : Régies validées non visibles dans la liste
3. **Navigation régie** : Section "Locataires" manquante
4. **Architecture collaborateurs** : Système multi-utilisateurs absent

---

## 🔍 ANALYSE DÉTAILLÉE

---

## 1️⃣ VUE RÉGIE : Informations non chargées

### Symptôme observé

**Fichier :** `/public/regie/dashboard.html`

**État actuel :**
```html
<!-- Ligne 261 : Sidebar -->
<div class="user-email" id="userEmail">Chargement...</div>

<!-- Ligne 274-275 : Main content -->
<p>Agence : <strong id="agenceName">Chargement...</strong></p>
<p>Email : <strong id="userEmailDisplay">Chargement...</strong></p>
```

**Logs console :**
```javascript
[REGIE][AUTH] ✅ Authentification validée - Régie: Test Régie
[REGIE] Dashboard chargé pour: {email: "test@exemple.ch", agence: "Test Régie", statut: "valide"}
```

**Observation :** Les logs indiquent que les données sont **récupérées avec succès**, mais les éléments HTML restent sur "Chargement...".

---

### Analyse technique

#### Code d'assignation (lignes 479-486)

```javascript
// 6️⃣ Afficher les infos utilisateur
const email = profile.email;
document.getElementById('userEmail').textContent = email;
document.getElementById('agenceName').textContent = regie.nom;

// Première lettre pour l'avatar
const firstLetter = email.charAt(0).toUpperCase();
document.getElementById('userAvatar').textContent = firstLetter;

console.log('[REGIE] Dashboard chargé pour:', {
  email: profile.email,
  agence: regie.nom,
  statut: regie.statut_validation
});
```

#### Éléments HTML concernés

| ID Element | Ligne HTML | Assignation JS | État |
|------------|------------|----------------|------|
| `userEmail` | 261 | Ligne 479 ✅ | Sidebar (devrait fonctionner) |
| `agenceName` | 262 + 274 | Ligne 480 ✅ | **2 éléments avec même ID !** |
| `userEmailDisplay` | 275 | ❌ **ABSENT** | Jamais assigné |
| `userAvatar` | ? | Ligne 483 ✅ | (probablement OK) |

---

### CAUSE RACINE IDENTIFIÉE

#### Problème 1 : Duplicata ID `agenceName`

**Ligne 262 (sidebar) :**
```html
<div class="user-role" id="agenceName">Régie</div>
```

**Ligne 274 (main content) :**
```html
<p>Agence : <strong id="agenceName">Chargement...</strong></p>
```

**Conséquence :**
- `document.getElementById('agenceName')` retourne le **premier élément** trouvé (ligne 262)
- Le texte "Régie" est remplacé par le nom de l'agence → **mauvais emplacement**
- L'élément ligne 274 reste sur "Chargement..." car **jamais atteint**

**Niveau de certitude :** 🟢 **FORT** (violation HTML spec, behavior documenté)

---

#### Problème 2 : ID `userEmailDisplay` jamais assigné

**HTML ligne 275 :**
```html
<p>Email : <strong id="userEmailDisplay">Chargement...</strong></p>
```

**JS ligne 479 :**
```javascript
document.getElementById('userEmail').textContent = email;  // ← Assigne à userEmail, pas userEmailDisplay
```

**Conséquence :**
- `userEmail` (sidebar) est mis à jour ✅
- `userEmailDisplay` (main content) reste sur "Chargement..." ❌

**Niveau de certitude :** 🟢 **FORT** (code JavaScript ne référence jamais `userEmailDisplay`)

---

### Hypothèse alternative (faible probabilité)

**Scénario :** Timing race condition (JS exécuté avant que DOM soit prêt)

**Arguments contre :**
- Le code utilise `document.addEventListener('DOMContentLoaded', ...)`
- Les logs montrent que `checkAuth()` s'exécute correctement
- `setTimeout(() => checkAuth(), 100)` ajoute un délai supplémentaire

**Niveau de certitude :** 🔴 **FAIBLE** (timing peu probable vu les logs)

---

### Recommandations

#### Correction 1 : Renommer ID duplicata

**Fichier :** `/public/regie/dashboard.html`

**Ligne 262 (sidebar) :**
```html
<!-- AVANT -->
<div class="user-role" id="agenceName">Régie</div>

<!-- APRÈS -->
<div class="user-role" id="userRoleSidebar">Régie immobilière</div>
```

**Ligne 480 (JS) :**
```javascript
// AVANT
document.getElementById('agenceName').textContent = regie.nom;

// APRÈS
document.getElementById('agenceName').textContent = regie.nom;  // ← Garde le nom, pointe maintenant le bon élément
```

**Bénéfice :** L'ID `agenceName` ne pointe plus que le main content (ligne 274)

---

#### Correction 2 : Assigner `userEmailDisplay`

**Ligne 479-480 (JS) :**
```javascript
// AVANT
const email = profile.email;
document.getElementById('userEmail').textContent = email;
document.getElementById('agenceName').textContent = regie.nom;

// APRÈS
const email = profile.email;
document.getElementById('userEmail').textContent = email;
document.getElementById('userEmailDisplay').textContent = email;  // ← NOUVEAU
document.getElementById('agenceName').textContent = regie.nom;
```

**Bénéfice :** Les deux zones affichent l'email correctement

---

#### Correction 3 : Ajouter validation (défensive)

**Après ligne 486 (JS) :**
```javascript
// Vérifier que tous les éléments ont été mis à jour
const elementsToCheck = ['userEmail', 'userEmailDisplay', 'agenceName', 'userAvatar'];
elementsToCheck.forEach(id => {
  const el = document.getElementById(id);
  if (el && el.textContent.includes('Chargement')) {
    console.warn(`[REGIE][UI] Élément ${id} non mis à jour`);
  }
});
```

**Bénéfice :** Détection proactive des éléments non mis à jour

---

### Fichiers concernés

| Fichier | Lignes | Action requise |
|---------|--------|----------------|
| `/public/regie/dashboard.html` | 262 | Renommer ID `agenceName` → `userRoleSidebar` |
| `/public/regie/dashboard.html` | 479-486 | Ajouter assignation `userEmailDisplay` |
| `/public/regie/dashboard.html` | 486+ | Ajouter validation défensive (optionnel) |

---

## 2️⃣ VUE ADMIN : Régie validée non visible

### Symptôme observé

**Fichier :** `/public/admin/dashboard.html`

**Comportement :**
- Une régie avec `statut_validation = 'valide'` n'apparaît **pas** dans la liste admin
- La régie peut se connecter et accéder à son dashboard ✅
- L'admin ne voit que les régies en `'en_attente'`

**État attendu :**
- Vue admin devrait afficher **toutes les régies** (en_attente, valide, refuse)
- OU avoir plusieurs sections (onglets) pour filtrer par statut

---

### Analyse technique

#### Code de chargement (lignes 655-720)

```javascript
async function loadRegiesEnAttente() {
  console.log('[REGIES] Chargement des régies en attente...');
  
  // ✅ CORRECTION ERREUR FK : Pas de join profiles
  const { data: regies, error: fetchError } = await supabase
    .from('regies')
    .select('id, nom, email, nb_collaborateurs, nb_logements_geres, siret, created_at, statut_validation')
    .eq('statut_validation', 'en_attente')  // ← FILTRE ICI
    .order('created_at', { ascending: false });
  
  // ... affichage régies
}
```

**Observation :** Le filtre `.eq('statut_validation', 'en_attente')` est **explicite**.

---

### CAUSE RACINE IDENTIFIÉE

#### Problème : Requête filtre uniquement `en_attente`

**Ligne 672 :**
```javascript
.eq('statut_validation', 'en_attente')
```

**Conséquence :**
- Seules les régies en attente sont récupérées
- Les régies validées **ne sont jamais interrogées**
- Les régies refusées **ne sont jamais affichées**

**Niveau de certitude :** 🟢 **FORT** (comportement SQL exact)

---

### Hypothèse alternative 1 : RLS bloque les régies validées

**Scénario :** Policy RLS empêche admin de voir régies validées

**Vérification RLS :** `/supabase/schema/18_rls.sql` ligne 74-76

```sql
create policy "Admin JTEC can manage all regies"
on regies for all
using (public.is_admin_jtec());
```

**Fonction `is_admin_jtec()` :** (ligne 32-45)
```sql
create or replace function public.is_admin_jtec()
returns boolean
as $$
begin
  return exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin_jtec'
  );
end;
$$;
```

**Conclusion :** RLS **autorise** admin à voir TOUTES les régies (FOR ALL = SELECT + INSERT + UPDATE + DELETE)

**Niveau de certitude :** 🔴 **TRÈS FAIBLE** (RLS correctement configurée)

---

### Hypothèse alternative 2 : Vue matérialisée désynchronisée

**Scénario :** Dashboard admin utilise une vue matérialisée non rafraîchie

**Vérification :** Recherche de vues dans le schéma

```bash
grep -r "CREATE MATERIALIZED VIEW" supabase/schema/
# Aucun résultat
```

**Conclusion :** Aucune vue matérialisée utilisée

**Niveau de certitude :** 🔴 **NULLE** (pas de vue matérialisée)

---

### Recommandations

#### Option 1 : Afficher toutes les régies avec badges statut

**Ligne 672 :**
```javascript
// AVANT
.eq('statut_validation', 'en_attente')

// APRÈS
.in('statut_validation', ['en_attente', 'valide', 'refuse'])
```

**Affichage :**
```javascript
regies.forEach(regie => {
  const card = document.createElement('div');
  card.className = 'agence-card';
  
  // Badge statut
  let badgeClass = '';
  let badgeText = '';
  if (regie.statut_validation === 'en_attente') {
    badgeClass = 'badge-warning';
    badgeText = '⏳ En attente';
  } else if (regie.statut_validation === 'valide') {
    badgeClass = 'badge-success';
    badgeText = '✅ Validée';
  } else {
    badgeClass = 'badge-danger';
    badgeText = '❌ Refusée';
  }
  
  card.innerHTML = `
    <div class="badge ${badgeClass}">${badgeText}</div>
    <h3>${regie.nom}</h3>
    ...
  `;
});
```

**Bénéfice :** Vision complète de toutes les régies en une page

---

#### Option 2 : Onglets par statut (UX améliorée)

**HTML :**
```html
<div class="tabs">
  <button class="tab active" data-status="en_attente">En attente (3)</button>
  <button class="tab" data-status="valide">Validées (12)</button>
  <button class="tab" data-status="refuse">Refusées (1)</button>
</div>

<div id="regies-container-attente"></div>
<div id="regies-container-valide" style="display:none;"></div>
<div id="regies-container-refuse" style="display:none;"></div>
```

**JS :**
```javascript
async function loadRegiesByStatus(status) {
  const { data: regies } = await supabase
    .from('regies')
    .select('*')
    .eq('statut_validation', status)
    .order('created_at', { ascending: false });
  
  const container = document.getElementById(`regies-container-${status}`);
  // ... affichage
}

// Event listeners sur tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const status = tab.dataset.status;
    loadRegiesByStatus(status);
  });
});
```

**Bénéfice :** Navigation claire, performance (lazy load), compteurs visibles

---

#### Option 3 : Fonction RPC dédiée (performance)

**SQL :** `/supabase/schema/20_admin.sql` (ou créer nouveau fichier)

```sql
CREATE OR REPLACE FUNCTION public.get_regies_stats()
RETURNS TABLE (
  statut TEXT,
  count BIGINT,
  noms_sample TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    statut_validation as statut,
    COUNT(*) as count,
    ARRAY_AGG(nom ORDER BY created_at DESC LIMIT 5) as noms_sample
  FROM regies
  GROUP BY statut_validation;
$$;
```

**Frontend :**
```javascript
const { data: stats } = await supabase.rpc('get_regies_stats');
// stats = [
//   {statut: 'en_attente', count: 3, noms_sample: ['Régie A', ...]},
//   {statut: 'valide', count: 12, noms_sample: [...]},
//   {statut: 'refuse', count: 1, noms_sample: [...]}
// ]
```

**Bénéfice :** Performance (1 requête), compteurs pré-calculés, échantillons

---

### Fichiers concernés

| Fichier | Lignes | Action requise |
|---------|--------|----------------|
| `/public/admin/dashboard.html` | 672 | Modifier filtre `.eq('statut_validation', ...)` |
| `/public/admin/dashboard.html` | 690-715 | Adapter affichage (badges OU onglets) |
| `/public/admin/dashboard.html` | HTML | Ajouter structure onglets (option 2) |
| `/supabase/schema/20_admin.sql` | Nouveau | Fonction RPC stats (option 3) |

---

## 3️⃣ NAVIGATION RÉGIE : Section Locataires manquante

### Symptôme observé

**Fichier :** `/public/regie/dashboard.html`

**Menu sidebar actuel (lignes 231-256) :**
```html
<nav class="sidebar-menu">
  <a href="#" class="menu-item active">🏠 Dashboard</a>
  <a href="#" class="menu-item">🏢 Immeubles</a>
  <a href="#" class="menu-item">🏠 Logements</a>
  <a href="#" class="menu-item">🎫 Tickets</a>
  <a href="#" class="menu-item">🛠️ Missions</a>
  <a href="#" class="menu-item">📄 Factures</a>
</nav>
```

**Observation :** Aucune entrée "Locataires" dans le menu

**Roadmap affichée (lignes 280-283) :**
```html
<li><strong>ÉTAPE 4</strong> : Gérer immeubles et logements</li>
<li><strong>ÉTAPE 5</strong> : Valider les tickets locataires</li>  <!-- ← Mention de "locataires" -->
<li><strong>ÉTAPE 6</strong> : Diffuser les tickets</li>
```

---

### Analyse technique

#### Recherche pages locataires existantes

```bash
ls -la public/regie/
# Résultat :
# dashboard.html
# dashboard_backup_20251219_103917.html
# (aucune page locataires.html)
```

**Conclusion :** Aucune page dédiée n'existe pour gérer les locataires

---

#### Vérification table locataires en BDD

**Fichier :** `/supabase/schema/08_locataires.sql`

```sql
create table if not exists locataires (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text,
  email text,
  telephone text,
  logement_id uuid not null references logements(id) on delete cascade,
  profile_id uuid unique references profiles(id) on delete cascade,
  date_entree date,
  date_sortie date,
  statut text default 'actif' check (statut in ('actif', 'inactif', 'resilie')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Observation :** La table **existe**, elle est **utilisée** dans les RLS et helpers

---

### CAUSE RACINE IDENTIFIÉE

#### Problème : Incohérence roadmap vs navigation

**État actuel :**
- Table `locataires` existe ✅
- RLS configurée ✅
- Mention dans roadmap ✅
- Page de gestion **absente** ❌
- Lien de navigation **absent** ❌

**Conséquence :**
- Régie ne peut pas créer/voir/modifier des locataires
- Données locataires inaccessibles via UI
- Workflow incomplet (Immeubles → Logements → **[GAP]** → Tickets)

**Niveau de certitude :** 🟢 **FORT** (code HTML ne contient pas de lien locataires)

---

### Hypothèse alternative : Feature volontairement différée

**Scénario :** Section locataires prévue pour ÉTAPE 5 (non encore implémentée)

**Arguments pour :**
- Roadmap mentionne "ÉTAPE 5 : Valider les tickets **locataires**"
- Workflow progressif (Étapes 4, 5, 6)
- Architecture BDD en place (préparation future)

**Arguments contre :**
- Les autres entités (Immeubles, Logements, Tickets) sont déjà dans le menu
- Incohérence UX : menu affiche des sections non implémentées (`#` links)

**Niveau de certitude :** 🟡 **MOYEN** (pourrait être un choix de roadmap)

---

### Recommandations

#### Option 1 : Ajouter lien temporaire "À venir"

**HTML ligne 245 (après Logements) :**
```html
<a href="#" class="menu-item menu-item-disabled" title="Fonctionnalité à venir">
  <span>👥</span>
  <span>Locataires</span>
  <span class="badge-soon">Bientôt</span>
</a>
```

**CSS :**
```css
.menu-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.badge-soon {
  background: #f59e0b;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}
```

**Bénéfice :** UX claire (feature prévue mais pas disponible), cohérence menu

---

#### Option 2 : Créer page locataires minimale (MVP)

**Nouveau fichier :** `/public/regie/locataires.html`

**Structure minimale :**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <title>Locataires - JETC_IMMO</title>
  <link rel="stylesheet" href="/css/design-system.css">
</head>
<body>
  <div class="container">
    <!-- Sidebar (copié depuis dashboard.html) -->
    <aside class="sidebar">...</aside>
    
    <!-- Main content -->
    <main class="main-content">
      <h1>Gestion des Locataires</h1>
      
      <!-- Liste locataires -->
      <div id="locataires-container">
        <p>Chargement...</p>
      </div>
      
      <!-- Bouton ajouter -->
      <button onclick="showAddLocataireModal()">+ Ajouter un locataire</button>
    </main>
  </div>
  
  <script>
    async function loadLocataires() {
      const { data: locataires } = await supabase
        .from('locataires')
        .select('*, logement:logements(adresse, immeuble:immeubles(nom))')
        .eq('logement.immeuble.regie_id', await getUserRegieId())  // RLS
        .order('created_at', { ascending: false });
      
      // Affichage tableau
    }
  </script>
</body>
</html>
```

**Lien menu (ligne 245) :**
```html
<a href="/regie/locataires.html" class="menu-item">
  <span>👥</span>
  <span>Locataires</span>
</a>
```

**Bénéfice :** Feature exploitable, workflow complet, données accessibles

---

#### Option 3 : Modal inline dans dashboard (SPA-like)

**HTML dashboard.html (après ligne 285) :**
```html
<section id="section-locataires" style="display:none;">
  <h2>Locataires</h2>
  <div id="locataires-list"></div>
</section>
```

**JS :**
```javascript
// Menu click handlers
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = e.target.closest('a').textContent.trim().toLowerCase();
    
    // Cacher toutes les sections
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    
    // Afficher section cliquée
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) {
      targetSection.style.display = 'block';
      
      // Charger données si nécessaire
      if (section === 'locataires') loadLocataires();
    }
  });
});
```

**Bénéfice :** Pas de nouvelle page, navigation fluide, cohérence design

---

### Fichiers concernés

| Fichier | Lignes | Action requise |
|---------|--------|----------------|
| `/public/regie/dashboard.html` | 245 | Ajouter lien "Locataires" (option 1, 2 ou 3) |
| `/public/regie/locataires.html` | Nouveau | Créer page dédiée (option 2) |
| `/public/regie/dashboard.html` | 285+ | Ajouter section inline (option 3) |
| `/public/css/design-system.css` | Nouveau | Styles `.menu-item-disabled`, `.badge-soon` |

---

## 4️⃣ GESTION COLLABORATEURS : Architecture multi-utilisateurs

### Contexte métier

**Besoin identifié :**
- Une régie (admin principal) doit pouvoir créer des **collaborateurs**
- Chaque collaborateur = utilisateur avec rôle `'regie'` + rattachement à la même agence
- Contrôle des quotas selon abonnement (Basic: 3 users, Pro: 10, Enterprise: illimité)

**Workflow attendu :**
1. Admin régie clique "Ajouter collaborateur"
2. Remplit formulaire (nom, email, rôle interne)
3. Système vérifie quota abonnement
4. Si quota dépassé → message "Veuillez upgrader votre abonnement"
5. Si quota OK → création compte + envoi email invitation

---

### Analyse technique

#### État actuel de l'architecture

**Table `profiles` :**
```sql
create table profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  role user_role not null default 'regie',  -- admin_jtec, regie, entreprise, locataire
  language text not null default 'fr',
  is_demo boolean not null default false,
  regie_id uuid,              -- ← Optionnel (non utilisé actuellement)
  entreprise_id uuid,
  logement_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Observation :** `regie_id` existe mais **n'est pas utilisé**

---

**Table `regies` :**
```sql
create table regies (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  ...
  nb_collaborateurs integer not null default 1,  -- ← Nombre déclaré à l'inscription
  profile_id uuid references profiles(id),       -- ← UN SEUL profil (admin principal)
  ...
);
```

**Observation :** 
- `nb_collaborateurs` est un champ **statique** (saisi à l'inscription)
- `profile_id` pointe **un seul** utilisateur (admin principal)
- Aucune FK `profiles.regie_id → regies.id` configurée

---

**Table `abonnements` et `plans` :**

`/supabase/schema/21_abonnements.sql` (lignes 13-48)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY,
  nom VARCHAR(50) UNIQUE NOT NULL CHECK (nom IN ('basic', 'pro', 'enterprise')),
  prix_mensuel DECIMAL(10, 2),
  prix_annuel DECIMAL(10, 2),
  limite_missions_mois INTEGER,
  limite_techniciens INTEGER,
  limite_utilisateurs INTEGER,  -- ← Quota collaborateurs défini ici
  modules_actifs JSONB DEFAULT '[]'::jsonb,
  ...
);

CREATE TABLE abonnements (
  id UUID PRIMARY KEY,
  entreprise_id UUID REFERENCES entreprises(id),
  regie_id UUID REFERENCES regies(id),  -- ← Abonnement par régie
  plan_id UUID NOT NULL REFERENCES plans(id),
  statut VARCHAR(20) DEFAULT 'actif',
  missions_ce_mois INTEGER DEFAULT 0,
  ...
);
```

**Observation :** Infrastructure d'abonnements **existe déjà** avec quotas `limite_utilisateurs`

---

#### Architecture actuelle vs attendue

| Aspect | État actuel | État attendu |
|--------|-------------|--------------|
| **Multi-users** | ❌ 1 profile = 1 régie | ✅ N profiles → 1 régie |
| **Rattachement** | `regies.profile_id` (1-1) | `profiles.regie_id` (N-1) |
| **Role granularité** | `role = 'regie'` (global) | `role_regie = 'admin'/'user'` |
| **Quota contrôle** | ❌ Absent | ✅ Via `plans.limite_utilisateurs` |
| **Invitation** | ❌ Absent | ✅ API `/api/regie/inviter-collaborateur` |

---

### CAUSE RACINE IDENTIFIÉE

#### Problème 1 : Relation 1-1 au lieu de 1-N

**Schéma actuel :**
```
profiles (1) ──profile_id──> (1) regies
```

**Schéma attendu :**
```
profiles (N) ──regie_id──> (1) regies
       │
       └─ profile_id (admin principal unique)
```

**Conséquence :**
- Impossible de créer un 2e utilisateur pour la même régie
- `regies.profile_id` limite à 1 admin
- `profiles.regie_id` existe mais non exploité

**Niveau de certitude :** 🟢 **FORT** (architecture BDD inadaptée au besoin métier)

---

#### Problème 2 : Rôle `user_role` trop global

**ENUM actuel :**
```sql
CREATE TYPE user_role AS ENUM ('admin_jtec', 'regie', 'entreprise', 'locataire');
```

**Limitation :**
- Tous les utilisateurs d'une régie ont `role = 'regie'`
- Impossible de distinguer **admin régie** vs **collaborateur régie**
- Pas de granularité permissions (lecture seule, édition, admin)

**Conséquence :**
- Tous les collaborateurs = mêmes droits que l'admin
- Risque sécurité (collaborateur peut supprimer la régie)

**Niveau de certitude :** 🟡 **MOYEN** (dépend du niveau de granularité souhaité)

---

#### Problème 3 : Workflow invitation absent

**Besoin :**
1. Admin régie saisit email collaborateur
2. Système crée compte Supabase Auth (`pending` ou `invited`)
3. Email envoyé avec lien d'activation + définition mot de passe
4. Collaborateur clique lien → définit MDP → accède dashboard

**État actuel :**
- ❌ Aucune API `/api/regie/inviter-collaborateur`
- ❌ Aucune fonction RPC `create_collaborateur`
- ❌ Aucun système d'invitation Supabase exploité

**Niveau de certitude :** 🟢 **FORT** (aucune trace de workflow invitation)

---

### Recommandations

#### Architecture cible proposée

##### Option A : Rôle interne régie (recommandé)

**Nouvelle colonne `profiles` :**
```sql
ALTER TABLE profiles 
ADD COLUMN role_regie TEXT CHECK (role_regie IN ('admin', 'user', 'readonly'));
```

**Règles :**
- `role_regie = 'admin'` : Admin principal (peut inviter, gérer abonnement, supprimer régie)
- `role_regie = 'user'` : Collaborateur standard (CRUD immeubles/logements/tickets)
- `role_regie = 'readonly'` : Lecture seule (consultation uniquement)

**Bénéfice :** Granularité permissions, sécurité renforcée, évolutivité

---

##### Option B : Table `regie_users` (relation explicite)

**Nouvelle table :**
```sql
CREATE TABLE regie_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regie_id UUID NOT NULL REFERENCES regies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_regie TEXT NOT NULL CHECK (role_regie IN ('admin', 'user', 'readonly')),
  date_invitation TIMESTAMPTZ DEFAULT NOW(),
  date_acceptation TIMESTAMPTZ,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'invite_pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(regie_id, profile_id)
);
```

**Bénéfice :** Relation explicite, historique invitations, évolutivité (multi-régies futures)

---

#### Workflow invitation proposé

##### Étape 1 : API Backend

**Nouveau fichier :** `/api/regie/inviter-collaborateur.js`

```javascript
// Pseudo-code
async function inviterCollaborateur(req, res) {
  const { email_collaborateur, role_regie } = req.body;
  const admin_regie_id = req.user.id;  // Depuis Bearer token
  
  // 1. Vérifier que l'utilisateur est admin de la régie
  const { data: regie } = await supabase
    .from('regies')
    .select('id, abonnement:abonnements(plan:plans(limite_utilisateurs))')
    .eq('profile_id', admin_regie_id)
    .single();
  
  if (!regie) return res.status(403).json({ error: 'Non autorisé' });
  
  // 2. Compter collaborateurs existants
  const { count: nb_users } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('regie_id', regie.id);
  
  // 3. Vérifier quota
  const limite = regie.abonnement.plan.limite_utilisateurs;
  if (limite && nb_users >= limite) {
    return res.status(402).json({
      error: 'Quota atteint',
      message: `Votre abonnement ${plan.nom} autorise ${limite} utilisateurs. Veuillez upgrader.`,
      upgrade_url: '/regie/abonnement.html'
    });
  }
  
  // 4. Créer invitation Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email_collaborateur,
    {
      data: {
        regie_id: regie.id,
        role_regie: role_regie,
        invited_by: admin_regie_id
      },
      redirectTo: 'https://jetc-immo.com/regie/accept-invitation.html'
    }
  );
  
  // 5. Créer profil (profile créé à l'acceptation)
  // Ou insérer dans regie_users avec statut 'invite_pending'
  
  return res.status(200).json({
    success: true,
    message: 'Invitation envoyée à ' + email_collaborateur
  });
}
```

---

##### Étape 2 : Frontend UI

**Nouvelle page :** `/public/regie/collaborateurs.html`

```html
<h1>Collaborateurs</h1>

<!-- Liste collaborateurs existants -->
<table id="collaborateurs-table">
  <thead>
    <tr>
      <th>Nom</th>
      <th>Email</th>
      <th>Rôle</th>
      <th>Statut</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <!-- Rempli dynamiquement -->
  </tbody>
</table>

<!-- Bouton inviter -->
<button onclick="showInviteModal()">+ Inviter un collaborateur</button>

<!-- Modal invitation -->
<div id="invite-modal" style="display:none;">
  <h3>Inviter un collaborateur</h3>
  <input type="email" id="collab-email" placeholder="Email">
  <select id="collab-role">
    <option value="user">Utilisateur standard</option>
    <option value="readonly">Lecture seule</option>
  </select>
  <button onclick="sendInvitation()">Envoyer</button>
</div>

<script>
async function sendInvitation() {
  const email = document.getElementById('collab-email').value;
  const role = document.getElementById('collab-role').value;
  
  const res = await fetch('/api/regie/inviter-collaborateur', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabase.auth.session().access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email_collaborateur: email, role_regie: role })
  });
  
  const data = await res.json();
  
  if (res.status === 402) {
    // Quota atteint
    alert(data.message + '\n\n[Cliquez OK pour upgrader]');
    window.location.href = data.upgrade_url;
  } else if (data.success) {
    alert('Invitation envoyée !');
    loadCollaborateurs();  // Refresh liste
  } else {
    alert('Erreur : ' + data.error);
  }
}
</script>
```

---

##### Étape 3 : Contrôle quota (backend + frontend)

**Backend :** (déjà dans pseudo-code API ci-dessus)
```javascript
if (limite && nb_users >= limite) {
  return res.status(402).json({
    error: 'Quota atteint',
    message: `Quota: ${nb_users}/${limite} utilisateurs`,
    upgrade_url: '/regie/abonnement.html'
  });
}
```

**Frontend :** Affichage proactif
```javascript
async function displayQuotaInfo() {
  const { data: quota } = await supabase.rpc('get_regie_quota_info');
  // quota = { nb_users: 3, limite: 5, plan: 'basic' }
  
  document.getElementById('quota-info').innerHTML = `
    <p>Utilisateurs : <strong>${quota.nb_users} / ${quota.limite || '∞'}</strong></p>
    ${quota.nb_users >= quota.limite ? 
      '<a href="/regie/abonnement.html" class="btn-upgrade">⬆️ Upgrader</a>' : 
      ''}
  `;
}
```

---

##### Étape 4 : Fonction RPC quota (SQL)

**Nouveau fichier :** `/supabase/schema/23_regie_quotas.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_regie_quota_info()
RETURNS TABLE (
  nb_users BIGINT,
  limite INTEGER,
  plan_nom TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE regie_id = r.id) as nb_users,
    p.limite_utilisateurs as limite,
    p.nom as plan_nom
  FROM regies r
  JOIN abonnements a ON a.regie_id = r.id
  JOIN plans p ON p.id = a.plan_id
  WHERE r.profile_id = auth.uid()
    AND a.statut = 'actif'
  LIMIT 1;
$$;
```

**Usage frontend :**
```javascript
const { data } = await supabase.rpc('get_regie_quota_info');
console.log(data);  // { nb_users: 3, limite: 5, plan_nom: 'basic' }
```

---

#### Message UX blocage quota

**Scénario :** Admin tente d'inviter 6e collaborateur (quota Basic = 5)

**Popup recommandée :**
```
┌─────────────────────────────────────────────┐
│  ⚠️  Quota utilisateurs atteint             │
│                                              │
│  Votre abonnement Basic autorise 5          │
│  utilisateurs. Vous en avez actuellement 5. │
│                                              │
│  Pour ajouter plus de collaborateurs,       │
│  passez à l'abonnement Pro (10 users) ou    │
│  Enterprise (illimité).                     │
│                                              │
│  [ Comparer les plans ]  [ Plus tard ]     │
└─────────────────────────────────────────────┘
```

**Variante inline (dashboard) :**
```html
<div class="alert alert-warning" id="quota-warning" style="display:none;">
  <strong>⚠️ Quota atteint</strong>
  <p>Vous avez atteint votre limite de 5 utilisateurs.</p>
  <a href="/regie/abonnement.html" class="btn btn-primary">Upgrader maintenant</a>
</div>
```

---

### Fichiers concernés

| Fichier | Action | Complexité |
|---------|--------|------------|
| `/supabase/schema/04_users.sql` | Ajouter colonne `role_regie` OU créer table `regie_users` | Moyenne |
| `/supabase/schema/05_regies.sql` | Documenter `profile_id` = admin principal | Faible |
| `/supabase/schema/23_regie_quotas.sql` | Fonction RPC `get_regie_quota_info()` | Moyenne |
| `/api/regie/inviter-collaborateur.js` | Nouveau endpoint API invitation | Haute |
| `/public/regie/collaborateurs.html` | Nouvelle page gestion collaborateurs | Haute |
| `/public/regie/dashboard.html` | Ajouter lien menu "Collaborateurs" | Faible |

---

## 📊 SYNTHÈSE DES RECOMMANDATIONS

### Matrice priorité / complexité

| Point | Priorité | Complexité | Effort estimé | Impact UX |
|-------|----------|------------|---------------|-----------|
| **1. Infos régie non chargées** | 🔴 **Haute** | 🟢 Faible | 30 min | 🟢 Fort |
| **2. Régies validées invisibles** | 🟡 Moyenne | 🟡 Moyenne | 2h (option 2) | 🟢 Fort |
| **3. Section Locataires manquante** | 🟡 Moyenne | 🟡 Moyenne | 4h (option 2) | 🟡 Moyen |
| **4. Gestion collaborateurs** | 🟠 Basse | 🔴 Haute | 16h (complet) | 🟠 Faible (MVP) |

---

### Ordre de traitement recommandé

#### Phase 1 : Corrections critiques (4h)
1. ✅ **Point 1** : Corriger IDs duplicata + `userEmailDisplay` (30 min)
2. ✅ **Point 2** : Afficher régies validées avec badges (2h)
3. ✅ **Point 3** : Ajouter lien "Locataires (bientôt)" (30 min)
4. ✅ Tests manuels (1h)

**Bénéfice :** Dashboard fonctionnel, admin voit toutes les régies, UX cohérente

---

#### Phase 2 : Features complémentaires (8h)
5. ✅ **Point 3** : Créer page locataires MVP (4h)
6. ✅ **Point 2** : Implémenter onglets admin (2h)
7. ✅ Tests E2E (2h)

**Bénéfice :** Workflow complet Immeubles → Logements → Locataires → Tickets

---

#### Phase 3 : Architecture avancée (16h+)
8. ✅ **Point 4** : Analyse architecture multi-users (2h)
9. ✅ **Point 4** : Modification schéma BDD (2h)
10. ✅ **Point 4** : API invitation (4h)
11. ✅ **Point 4** : Frontend collaborateurs (4h)
12. ✅ **Point 4** : Contrôle quotas (2h)
13. ✅ Tests multi-users (2h)

**Bénéfice :** Gestion équipe, quotas, évolutivité

---

## 🚫 MODIFICATIONS NON EFFECTUÉES

**Conformément aux instructions, AUCUNE modification de code n'a été apportée.**

Ce rapport contient **uniquement** :
- ✅ Analyse détaillée des causes
- ✅ Hypothèses alternatives évaluées
- ✅ Propositions architecturales
- ✅ Pseudo-code illustratif
- ✅ Recommandations priorisées

**Aucune action effectuée :**
- ❌ Aucun fichier modifié
- ❌ Aucun commit créé
- ❌ Aucune table ajoutée/modifiée
- ❌ Aucune RLS modifiée
- ❌ Aucun refactor

---

## 📋 CHECKLIST VALIDATION HUMAINE

Avant d'appliquer les corrections, vérifier :

### Point 1 : Infos régie
- [ ] Confirmer que `agenceName` apparaît 2× dans le HTML
- [ ] Vérifier que `userEmailDisplay` n'est jamais assigné en JS
- [ ] Valider les numéros de ligne (HTML peut avoir changé)

### Point 2 : Régies admin
- [ ] Tester requête `.eq('statut_validation', 'en_attente')` en console
- [ ] Vérifier que RLS admin_jtec autorise bien SELECT all
- [ ] Décider option UX (badges simples vs onglets)

### Point 3 : Locataires
- [ ] Confirmer qu'aucune page `/public/regie/locataires.html` n'existe
- [ ] Valider que table `locataires` est bien en BDD
- [ ] Décider si feature immédiate ou différée

### Point 4 : Collaborateurs
- [ ] Valider besoin métier multi-users
- [ ] Choisir architecture (Option A ou B)
- [ ] Prioriser vs autres features
- [ ] Estimer effort réel (16h+ confirmé)

---

## 🔗 ANNEXES

### Références techniques
- **Schéma BDD :** `/supabase/schema/`
- **RLS :** `/supabase/schema/18_rls.sql`
- **Abonnements :** `/supabase/schema/21_abonnements.sql`
- **Dashboard régie :** `/public/regie/dashboard.html`
- **Dashboard admin :** `/public/admin/dashboard.html`

### Logs utiles
```javascript
// Point 1
[REGIE][AUTH] ✅ Authentification validée - Régie: Test Régie
[REGIE] Dashboard chargé pour: {email: "...", agence: "Test Régie", statut: "valide"}

// Point 2
[REGIES] Chargement des régies en attente...
[REGIES] Régies trouvées: 0  // ← Si aucune en attente
```

---

**FIN DU RAPPORT**

**Prochaine étape :** Validation humaine → Priorisation → Implémentation progressive

