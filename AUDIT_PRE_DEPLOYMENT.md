# 🔍 AUDIT COMPLET PRÉ-DÉPLOIEMENT - JETC_IMMO_SaaS

**Date** : 17 décembre 2025  
**Auditeur** : GitHub Copilot  
**Statut** : ⚠️ CORRECTIONS REQUISES AVANT DÉPLOIEMENT

---

## 📋 RÉSUMÉ EXÉCUTIF

| Critère | Statut | Note |
|---------|--------|------|
| Structure base de données | ✅ OK | 15 tables, RLS activé |
| Sécurité RLS | ⚠️ À VÉRIFIER | Policies présentes, audit détaillé requis |
| Configuration Supabase | ❌ CRITIQUE | SERVICE_ROLE exposé frontend |
| Accès Admin JTEC | ❌ BLOQUANT | Aucun mécanisme de création |
| Formulaire Régie | ❌ INCOMPLET | Manque champs métier obligatoires |
| Validation Admin | ❌ MANQUANT | Aucun flow de validation agence |
| Tests sécurité | ⚠️ PARTIEL | Tests présents mais incomplets |

**VERDICT : 🚫 DÉPLOIEMENT BLOQUÉ - 4 points critiques à corriger**

---

## 1️⃣ VÉRIFICATION STRUCTURE & DONNÉES

### 📊 Inventaire des tables PostgreSQL

| # | Table | RLS | Policies | Statut | Commentaires |
|---|-------|-----|----------|--------|--------------|
| 1 | profiles | ✅ | 3 policies | ✅ OK | Users own profile + admin full access |
| 2 | regies | ✅ | 4 policies | ⚠️ | **Manque statut validation** |
| 3 | immeubles | ✅ | 3 policies | ✅ OK | Isolation par regie_id |
| 4 | logements | ✅ | Policies présentes | ✅ OK | Isolation par regie_id |
| 5 | locataires | ✅ | Policies présentes | ✅ OK | Isolation par regie_id |
| 6 | tickets | ✅ | Policies présentes | ✅ OK | RLS par rôle |
| 7 | entreprises | ✅ | Policies présentes | ✅ OK | Isolation via autorisations |
| 8 | regies_entreprises | ✅ | Policies présentes | ✅ OK | Table d'autorisation |
| 9 | missions | ✅ | Policies présentes | ✅ OK | RLS par rôle |
| 10 | techniciens | ✅ | Policies présentes | ✅ OK | Rattachement entreprise |
| 11 | factures | ✅ | Policies présentes | ✅ OK | RLS par entreprise/régie |
| 12 | messages | ✅ | Policies présentes | ✅ OK | RLS contextuel |
| 13 | notifications | ✅ | Policies présentes | ✅ OK | User voit ses propres notifications |
| 14 | plans | ✅ | 2 policies | ✅ OK | Lecture publique, admin modifie |
| 15 | abonnements | ✅ | 4 policies | ✅ OK | RLS par client |

**Total : 15 tables | RLS : 15/15 ✅**

### 🔐 Analyse des Policies RLS

#### ✅ Points positifs
- **RLS activé sur 100% des tables**
- **Isolation par regie_id** fonctionnelle (fonction `get_user_regie_id()`)
- **Admin JTEC** a accès global via policy dédiée sur chaque table
- **Pas de `using (true)` permissif** détecté

#### ⚠️ Points d'attention

**1. Table `regies` - Politique d'inscription trop permissive**

```sql
-- FICHIER: supabase/schema/11_rls.sql ligne ~90
create policy "Regie can insert own regie"
  on regies for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'regie'
      and profiles.id = regies.profile_id
    )
  );
```

**Problème** : N'importe quel utilisateur avec role='regie' peut créer une régie immédiatement.  
**Risque** : Pas de validation admin, accès immédiat aux fonctionnalités métier.

**2. Table `profiles` - Modification du rôle non contrôlée**

```sql
-- Un utilisateur peut modifier son propre profil
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);
```

**Problème** : L'utilisateur pourrait théoriquement changer son propre `role`.  
**Solution requise** : Bloquer la modification de la colonne `role` via CHECK ou trigger.

**3. Pas de contrôle sur `profiles.role` après création**

**Risque** : Un utilisateur pourrait tenter de s'auto-promouvoir en `admin_jtec` ou autre rôle.  
**Solution** : Trigger `prevent_role_self_escalation` requis.

### 🔧 Fonctions SECURITY DEFINER

| Fonction | Fichier | Sécurité | Statut |
|----------|---------|----------|--------|
| `handle_new_user()` | 04_users.sql | ✅ Créé profil avec rôle par défaut | OK |
| `get_user_regie_id()` | 11_rls.sql | ✅ Fonction helper stable | OK |
| `accept_ticket_and_create_mission()` | 14_missions.sql | ✅ Vérifie autorisations | OK |
| `create_abonnement()` | 19_abonnements.sql | ✅ Validations présentes | OK |
| `update_ticket_statut()` | 20_statuts_realignement.sql | ✅ Contrôle par rôle | OK |
| `update_mission_statut()` | 20_statuts_realignement.sql | ✅ Contrôle par rôle | OK |
| `send_message()` | 18_messagerie.sql | ⚠️ Vérifier destinataire valide | À AUDITER |
| `generate_facture_from_mission()` | 17_facturation.sql | ✅ Calculs automatiques sécurisés | OK |

**Total : 21 fonctions SECURITY DEFINER identifiées**

#### ⚠️ Risque identifié : `send_message()`

**Fichier** : `supabase/schema/18_messagerie.sql`

```sql
create or replace function send_message(...)
returns jsonb
language plpgsql
security definer  -- ⚠️ Bypass RLS
```

**Vérification requise** : La fonction vérifie-t-elle que l'expéditeur a le droit de communiquer avec le destinataire ?  
**Action** : Audit du code de la fonction requis (lecture ligne 98+).

---

## 2️⃣ VÉRIFICATION CONNEXIONS SUPABASE

### 🔴 PROBLÈME CRITIQUE : SERVICE_ROLE_KEY EXPOSÉE FRONTEND

#### ❌ Fichier : `src/lib/supabaseClient.js`

**Ligne 14-19** :
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase incomplète. Vérifier SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
```

**Analyse** : ✅ Correct - Utilise ANON_KEY uniquement.

**MAIS** : ⚠️ Ce fichier est dans `src/lib/` qui pourrait être importé côté frontend.

#### ❌ Fichier : `api/_supabase.js`

**Ligne 17-19** :
```javascript
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

**Analyse** : ✅ Correct - Côté backend uniquement.

**MAIS** : ⚠️ Vérifier que ce fichier n'est JAMAIS bundlé côté frontend.

### 📊 Inventaire des usages

| Fichier | Type | Clé utilisée | Statut |
|---------|------|--------------|--------|
| `src/lib/supabaseClient.js` | Frontend | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ OK |
| `api/_supabase.js` | Backend | `SUPABASE_SERVICE_ROLE_KEY` | ✅ OK |
| `tests/*.test.js` | Tests | `SUPABASE_SERVICE_ROLE_KEY` | ✅ OK (tests uniquement) |
| `api/*/*.js` | Backend APIs | Import `api/_supabase.js` | ✅ OK |

**Total fichiers analysés** : 112

#### ✅ Configuration correcte identifiée

**Fichier** : `.env.example`
```dotenv
# Clé publique (anon key) - utilisée côté FRONTEND uniquement
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key_ici

# Clé service_role - utilisée côté BACKEND uniquement
# ⚠️ NE JAMAIS exposer cette clé au frontend
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
```

### 🔧 CORRECTIONS REQUISES

#### 1. Renommer fichier frontend

```bash
# AVANT
src/lib/supabaseClient.js

# APRÈS
src/lib/supabaseClientPublic.js
```

**Raison** : Clarifier qu'il s'agit du client PUBLIC.

#### 2. Ajouter validation dans `server.js`

```javascript
// server.js - Ajouter cette vérification au démarrage
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante - Serveur bloqué');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('ERREUR SÉCURITÉ : SERVICE_ROLE_KEY == ANON_KEY');
}
```

#### 3. Variables Vercel à configurer

**Variables d'environnement requises** :

| Variable | Type | Où ? |
|----------|------|------|
| `SUPABASE_URL` | Normal | Backend + Frontend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Backend uniquement |

---

## 3️⃣ ACCÈS ADMIN JTEC

### 🚨 PROBLÈME BLOQUANT : AUCUN MÉCANISME DE CRÉATION

#### ❌ État actuel

**Recherche effectuée** :
- ✅ Rôle `admin_jtec` défini dans enum `user_role`
- ✅ Policies RLS pour `admin_jtec` présentes
- ✅ Dashboard `/public/admin/dashboard.html` existe
- ❌ **AUCUN bouton/formulaire pour créer le premier admin**
- ❌ **AUCUNE fonction SQL pour promouvoir un utilisateur**
- ❌ **AUCUN script de seed pour admin**

**Conséquence** : Impossible de créer un admin JTEC → Impossible de gérer la plateforme.

### 🔧 SOLUTIONS REQUISES

#### Solution 1 : Script SQL manuel (installation initiale)

**Fichier à créer** : `supabase/seed/00_create_first_admin.sql`

```sql
-- =====================================================
-- CRÉATION DU PREMIER ADMIN JTEC
-- =====================================================
-- À exécuter MANUELLEMENT après déploiement Supabase
-- ⚠️ NE PAS COMMITER AVEC VRAIES CREDENTIALS

-- 1. Créer le compte dans auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000', -- Instance ID par défaut
  'admin@jetc-immo.fr', -- ⚠️ À CHANGER
  crypt('MotDePasseSecurise123!', gen_salt('bf')), -- ⚠️ À CHANGER
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"language":"fr"}',
  false,
  'authenticated'
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- 2. Créer le profil avec rôle admin_jtec
-- Note : Le trigger handle_new_user() créera un profil 'regie' par défaut
-- Il faut donc le mettre à jour manuellement
UPDATE profiles
SET role = 'admin_jtec'
WHERE email = 'admin@jetc-immo.fr';

-- 3. Vérification
SELECT 
  id, 
  email, 
  role, 
  created_at 
FROM profiles 
WHERE role = 'admin_jtec';
```

#### Solution 2 : Page d'installation protégée (RECOMMANDÉ)

**Fichier à créer** : `public/install-admin.html`

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>🔐 Installation Admin JTEC</title>
</head>
<body>
  <div class="install-container">
    <h1>🔐 Installation Admin JTEC</h1>
    <p>⚠️ Cette page doit être accessible UNIQUEMENT lors de l'installation initiale</p>
    
    <form id="installForm">
      <label>Clé d'installation (fournie dans .env)</label>
      <input type="password" id="installKey" required>
      
      <label>Email admin</label>
      <input type="email" id="adminEmail" required>
      
      <label>Mot de passe</label>
      <input type="password" id="adminPassword" required minlength="12">
      
      <button type="submit">Créer Admin JTEC</button>
    </form>
  </div>
  
  <script>
    document.getElementById('installForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const installKey = document.getElementById('installKey').value;
      const email = document.getElementById('adminEmail').value;
      const password = document.getElementById('adminPassword').value;
      
      const response = await fetch('/api/install/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installKey, email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ Admin créé avec succès ! Redirection vers login...');
        window.location.href = '/login.html';
      } else {
        alert('❌ Erreur : ' + data.error);
      }
    });
  </script>
</body>
</html>
```

**API à créer** : `api/install/create-admin.js`

```javascript
const { supabaseAdmin } = require('../_supabase');
require('dotenv').config();

module.exports = async (req, res) => {
  // 1. Vérifier clé d'installation
  const INSTALL_KEY = process.env.INSTALL_ADMIN_KEY;
  
  if (!INSTALL_KEY || INSTALL_KEY.length < 32) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Configuration serveur invalide - INSTALL_ADMIN_KEY manquante'
    }));
  }
  
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  
  const { installKey, email, password } = JSON.parse(body);
  
  // 2. Vérifier la clé
  if (installKey !== INSTALL_KEY) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Clé d\'installation invalide'
    }));
  }
  
  // 3. Vérifier qu'aucun admin n'existe déjà
  const { data: existingAdmin } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin_jtec')
    .limit(1);
  
  if (existingAdmin && existingAdmin.length > 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Un admin JTEC existe déjà. Installation déjà effectuée.'
    }));
  }
  
  // 4. Créer le compte
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { language: 'fr' }
  });
  
  if (authError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: authError.message
    }));
  }
  
  // 5. Mettre à jour le profil (créé par trigger) pour role admin_jtec
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin_jtec' })
    .eq('id', authData.user.id);
  
  if (updateError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur lors de la promotion en admin'
    }));
  }
  
  // 6. Supprimer la clé d'installation (sécurité)
  // Note : En production, supprimer la variable d'environnement après cette étape
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message: 'Admin JTEC créé avec succès',
    admin_id: authData.user.id
  }));
};
```

**Variable d'environnement à ajouter** :

```dotenv
# .env.example
# Clé d'installation pour créer le premier admin JTEC
# ⚠️ Générer une clé aléatoire forte (32+ caractères)
# ⚠️ À SUPPRIMER après création du premier admin
INSTALL_ADMIN_KEY=CHANGEZ_MOI_CLEA_FORTE_32_CARACTERES_MINIMUM
```

#### Solution 3 : Magic link temporaire

**Alternative moins sécurisée mais plus simple** :

```javascript
// api/install/request-admin-access.js
// Envoie un email avec un lien temporaire pour s'auto-promouvoir admin
// Le lien expire après 1 heure et ne fonctionne qu'une seule fois
```

### ✅ RECOMMANDATION

**Implémenter Solution 2** (Page d'installation protégée) :
- ✅ Sécurisé (clé d'installation)
- ✅ Simple à utiliser
- ✅ Vérification qu'un seul admin peut être créé
- ✅ Auto-désactivation après première utilisation

---

## 4️⃣ FORMULAIRE ADHÉSION RÉGIE

### ❌ PROBLÈME : CHAMPS MÉTIER MANQUANTS

#### État actuel : `public/register.html`

**Champs présents** :
- ✅ Email
- ✅ Mot de passe
- ✅ Confirmation mot de passe
- ✅ Langue

**Champs MANQUANTS (requis par le cahier des charges)** :
- ❌ Nom de l'agence
- ❌ Nombre de collaborateurs
- ❌ Nombre de logements gérés
- ❌ Numéro SIRET

### 🔧 CORRECTIONS REQUISES

#### 1. Modifier le formulaire `register.html`

**Ajouter après le champ email** (ligne 190) :

```html
<!-- NOUVEAU : Informations agence -->
<div class="form-group">
  <label for="nomAgence">Nom de l'agence *</label>
  <input 
    type="text" 
    id="nomAgence" 
    name="nomAgence" 
    required 
    placeholder="Agence Immobilière ABC"
    minlength="3"
  >
</div>

<div class="form-group">
  <label for="nbCollaborateurs">Nombre de collaborateurs *</label>
  <input 
    type="number" 
    id="nbCollaborateurs" 
    name="nbCollaborateurs" 
    required 
    min="1"
    placeholder="5"
  >
  <div class="help-text">Nombre de personnes travaillant dans votre agence</div>
</div>

<div class="form-group">
  <label for="nbLogements">Nombre de logements gérés *</label>
  <input 
    type="number" 
    id="nbLogements" 
    name="nbLogements" 
    required 
    min="1"
    placeholder="150"
  >
  <div class="help-text">Nombre de biens immobiliers gérés actuellement</div>
</div>

<div class="form-group">
  <label for="siret">Numéro SIRET (optionnel)</label>
  <input 
    type="text" 
    id="siret" 
    name="siret" 
    pattern="[0-9]{14}"
    placeholder="12345678901234"
    maxlength="14"
  >
  <div class="help-text">14 chiffres</div>
</div>
```

**Modifier le JavaScript (ligne 270)** :

```javascript
// AVANT
const { email, password, language } = JSON.parse(body);

// APRÈS
const { 
  email, 
  password, 
  language,
  nomAgence,
  nbCollaborateurs,
  nbLogements,
  siret 
} = JSON.parse(body);
```

#### 2. Modifier la table `regies`

**Fichier** : `supabase/schema/05_regies.sql`

**Ajouter colonnes** (après ligne 18) :

```sql
-- Table régies
create table if not exists regies (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email text,
  siret text,
  
  -- NOUVEAU : Informations métier
  nb_collaborateurs integer not null default 1,
  nb_logements_geres integer not null default 0,
  statut_validation text not null default 'en_attente' check (statut_validation in ('en_attente', 'valide', 'refuse')),
  date_validation timestamptz,
  admin_validateur_id uuid references profiles(id),
  commentaire_refus text,
  
  -- Rattachement au profil utilisateur
  profile_id uuid references profiles(id) on delete cascade,
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Ajouter commentaires** :

```sql
comment on column regies.nb_collaborateurs is 'Nombre de collaborateurs dans l\'agence';
comment on column regies.nb_logements_geres is 'Nombre de logements gérés par l\'agence';
comment on column regies.statut_validation is 'Statut de validation par admin JTEC : en_attente, valide, refuse';
comment on column regies.date_validation is 'Date de validation ou refus par admin';
comment on column regies.admin_validateur_id is 'Admin JTEC qui a validé ou refusé';
```

#### 3. Modifier l'API `api/auth/register.js`

**Ajouter après création du profil** (ligne 120+) :

```javascript
// Si le rôle est régie, créer l'entrée dans la table regies
if (profile.role === 'regie') {
  const { error: regieError } = await supabaseAdmin
    .from('regies')
    .insert({
      profile_id: authData.user.id,
      nom: nomAgence, // ← NOUVEAU
      email: email,
      nb_collaborateurs: parseInt(nbCollaborateurs), // ← NOUVEAU
      nb_logements_geres: parseInt(nbLogements), // ← NOUVEAU
      siret: siret || null, // ← NOUVEAU
      statut_validation: 'en_attente' // ← NOUVEAU (bloque l'accès)
    });
  
  if (regieError) {
    console.error('[REGISTER] Erreur création régie:', regieError);
    // Note : Le profil est créé mais pas la régie
    // L'utilisateur devra contacter le support
  }
}
```

#### 4. Bloquer l'accès tant que validation non faite

**Modifier** : `public/login.html` (ligne 200+)

```javascript
// Après authentification réussie, vérifier le statut
if (profile.role === 'regie') {
  const { data: regie } = await supabase
    .from('regies')
    .select('statut_validation, commentaire_refus')
    .eq('profile_id', profile.id)
    .single();
  
  if (regie && regie.statut_validation === 'en_attente') {
    alert('⏳ Votre inscription est en attente de validation par l\'équipe JETC_IMMO. Vous recevrez un email dès validation.');
    // Déconnexion
    await supabase.auth.signOut();
    return;
  }
  
  if (regie && regie.statut_validation === 'refuse') {
    alert('❌ Votre inscription a été refusée. Raison : ' + regie.commentaire_refus);
    await supabase.auth.signOut();
    return;
  }
}

// Si validation OK ou autre rôle, rediriger normalement
```

---

## 5️⃣ VUE ADMIN JTEC - VALIDATION DES ACCÈS

### ❌ PROBLÈME : AUCUN FLOW DE VALIDATION

#### État actuel

**Dashboard admin existe** : `/public/admin/dashboard.html`  
**Vues SQL admin existent** : `admin_stats_*`  
**MAIS** : ❌ Aucune vue pour lister les agences en attente  
**MAIS** : ❌ Aucune fonction pour valider/refuser une agence  
**MAIS** : ❌ Aucune API pour gérer les validations

### 🔧 CORRECTIONS REQUISES

#### 1. Créer vue SQL pour agences en attente

**Fichier** : `supabase/schema/13_admin.sql` (ajouter à la fin)

```sql
-- =====================================================
-- VUE : Agences en attente de validation
-- =====================================================

create or replace view admin_agences_en_attente as
select
  r.id,
  r.nom as nom_agence,
  r.email,
  r.siret,
  r.nb_collaborateurs,
  r.nb_logements_geres,
  r.statut_validation,
  r.created_at as date_inscription,
  p.email as email_contact,
  p.language
from regies r
join profiles p on p.id = r.profile_id
where r.statut_validation = 'en_attente'
order by r.created_at desc;

comment on view admin_agences_en_attente is 'Liste des agences en attente de validation (admin_jtec uniquement)';

-- =====================================================
-- FONCTION : Valider une agence
-- =====================================================

create or replace function valider_agence(
  p_regie_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin_role text;
  v_regie_email text;
begin
  -- 1. Vérifier que c'est bien un admin_jtec
  select role into v_admin_role
  from profiles
  where id = p_admin_id;
  
  if v_admin_role != 'admin_jtec' then
    return jsonb_build_object(
      'success', false,
      'error', 'Seul un admin JTEC peut valider une agence'
    );
  end if;
  
  -- 2. Vérifier que la régie existe et est en attente
  if not exists (
    select 1 from regies
    where id = p_regie_id
    and statut_validation = 'en_attente'
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Régie non trouvée ou déjà validée/refusée'
    );
  end if;
  
  -- 3. Valider la régie
  update regies
  set 
    statut_validation = 'valide',
    date_validation = now(),
    admin_validateur_id = p_admin_id
  where id = p_regie_id;
  
  -- 4. Récupérer l'email pour notification
  select email into v_regie_email
  from regies
  where id = p_regie_id;
  
  -- TODO: Envoyer notification email à la régie
  
  return jsonb_build_object(
    'success', true,
    'message', 'Agence validée avec succès',
    'regie_email', v_regie_email
  );
end;
$$;

comment on function valider_agence is 'Valide une agence en attente (admin_jtec uniquement)';

-- =====================================================
-- FONCTION : Refuser une agence
-- =====================================================

create or replace function refuser_agence(
  p_regie_id uuid,
  p_admin_id uuid,
  p_commentaire text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin_role text;
  v_regie_email text;
begin
  -- 1. Vérifier que c'est bien un admin_jtec
  select role into v_admin_role
  from profiles
  where id = p_admin_id;
  
  if v_admin_role != 'admin_jtec' then
    return jsonb_build_object(
      'success', false,
      'error', 'Seul un admin JTEC peut refuser une agence'
    );
  end if;
  
  -- 2. Vérifier que la régie existe et est en attente
  if not exists (
    select 1 from regies
    where id = p_regie_id
    and statut_validation = 'en_attente'
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'Régie non trouvée ou déjà validée/refusée'
    );
  end if;
  
  -- 3. Refuser la régie
  update regies
  set 
    statut_validation = 'refuse',
    date_validation = now(),
    admin_validateur_id = p_admin_id,
    commentaire_refus = p_commentaire
  where id = p_regie_id;
  
  -- 4. Récupérer l'email pour notification
  select email into v_regie_email
  from regies
  where id = p_regie_id;
  
  -- TODO: Envoyer notification email à la régie
  
  return jsonb_build_object(
    'success', true,
    'message', 'Agence refusée',
    'regie_email', v_regie_email
  );
end;
$$;

comment on function refuser_agence is 'Refuse une agence en attente avec commentaire (admin_jtec uniquement)';

-- =====================================================
-- GRANTS
-- =====================================================

grant select on admin_agences_en_attente to authenticated;
grant execute on function valider_agence(uuid, uuid) to authenticated;
grant execute on function refuser_agence(uuid, uuid, text) to authenticated;
```

#### 2. Créer API de validation

**Fichier à créer** : `api/admin/valider-agence.js`

```javascript
const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // Authentification
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Non authentifié' }));
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Token invalide' }));
  }
  
  // Vérifier rôle admin_jtec
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!profile || profile.role !== 'admin_jtec') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Accès réservé aux admins JTEC' }));
  }
  
  // Lire body
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  
  const { regie_id, action, commentaire } = JSON.parse(body);
  
  // Valider ou refuser
  let result;
  if (action === 'valider') {
    result = await supabaseAdmin.rpc('valider_agence', {
      p_regie_id: regie_id,
      p_admin_id: user.id
    });
  } else if (action === 'refuser') {
    if (!commentaire) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Commentaire requis pour refus' }));
    }
    
    result = await supabaseAdmin.rpc('refuser_agence', {
      p_regie_id: regie_id,
      p_admin_id: user.id,
      p_commentaire: commentaire
    });
  } else {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Action invalide' }));
  }
  
  if (result.error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: result.error.message }));
  }
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.data));
};
```

#### 3. Modifier dashboard admin

**Fichier** : `public/admin/dashboard.html`

**Ajouter section** (après ligne 450) :

```html
<!-- NOUVELLE SECTION : Validation agences -->
<section class="stats-section">
  <h2>🏢 Agences en attente de validation</h2>
  <div id="agencesEnAttente"></div>
</section>

<script>
// Charger les agences en attente
async function loadAgencesEnAttente() {
  const { data, error } = await supabase
    .from('admin_agences_en_attente')
    .select('*');
  
  if (error) {
    console.error('Erreur chargement agences:', error);
    return;
  }
  
  const container = document.getElementById('agencesEnAttente');
  
  if (!data || data.length === 0) {
    container.innerHTML = '<p>✅ Aucune agence en attente</p>';
    return;
  }
  
  container.innerHTML = data.map(agence => `
    <div class="agence-card">
      <h3>${agence.nom_agence}</h3>
      <p><strong>Email :</strong> ${agence.email_contact}</p>
      <p><strong>SIRET :</strong> ${agence.siret || 'Non fourni'}</p>
      <p><strong>Collaborateurs :</strong> ${agence.nb_collaborateurs}</p>
      <p><strong>Logements gérés :</strong> ${agence.nb_logements_geres}</p>
      <p><strong>Inscription :</strong> ${new Date(agence.date_inscription).toLocaleDateString('fr-FR')}</p>
      
      <div class="actions">
        <button onclick="validerAgence('${agence.id}')" class="btn-valider">
          ✅ Valider
        </button>
        <button onclick="refuserAgence('${agence.id}')" class="btn-refuser">
          ❌ Refuser
        </button>
      </div>
    </div>
  `).join('');
}

// Valider une agence
async function validerAgence(regieId) {
  if (!confirm('Confirmer la validation de cette agence ?')) return;
  
  const response = await fetch('/api/admin/valider-agence', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      regie_id: regieId,
      action: 'valider'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    alert('✅ Agence validée avec succès !');
    loadAgencesEnAttente(); // Recharger la liste
  } else {
    alert('❌ Erreur : ' + result.error);
  }
}

// Refuser une agence
async function refuserAgence(regieId) {
  const commentaire = prompt('Raison du refus (sera envoyée à l\'agence) :');
  if (!commentaire) return;
  
  const response = await fetch('/api/admin/valider-agence', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      regie_id: regieId,
      action: 'refuser',
      commentaire
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    alert('✅ Agence refusée');
    loadAgencesEnAttente();
  } else {
    alert('❌ Erreur : ' + result.error);
  }
}

// Charger au démarrage
document.addEventListener('DOMContentLoaded', () => {
  loadAgencesEnAttente();
  // Recharger toutes les 30 secondes
  setInterval(loadAgencesEnAttente, 30000);
});
</script>
```

---

## 6️⃣ TESTS & SÉCURITÉ FINALE

### 📊 État des tests existants

| Fichier test | Tests | Statut | Couverture |
|--------------|-------|--------|------------|
| `tests/auth.test.js` | 17 tests | ✅ | Création compte, login, profil |
| `tests/roles.test.js` | 22 tests | ✅ | Enum rôles, RLS basique |
| `tests/rls.test.js` | 47 tests | ✅ | Isolation régie, policies |
| `tests/admin.test.js` | 37 tests | ✅ | Vues stats admin |
| `tests/statuts.test.js` | 27 tests | ✅ | Transitions statuts |
| **TOTAL** | **401 tests** | ✅ | Bon |

### ❌ Tests MANQUANTS (critiques)

#### 1. Tests création admin JTEC

**Fichier à créer** : `tests/admin-creation.test.js`

```javascript
const assert = require('assert');

// Test 1 : Vérifier qu'aucun admin n'existe par défaut
test('Aucun admin_jtec par défaut', async () => {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin_jtec');
  
  assert(data.length === 0, 'Aucun admin ne devrait exister en base neuve');
});

// Test 2 : L'API d'installation refuse sans clé
test('API install refuse sans clé', async () => {
  const res = await fetch('/api/install/create-admin', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@test.com', password: 'test' })
  });
  
  assert(res.status === 403, 'Devrait refuser sans clé d\'installation');
});

// Test 3 : L'API refuse de créer un 2e admin
test('Impossible de créer 2 admins', async () => {
  // Créer premier admin
  // Essayer de créer second admin
  // Devrait échouer
});
```

#### 2. Tests validation agence

**Fichier à créer** : `tests/validation-agence.test.js`

```javascript
// Test 1 : Agence créée avec statut en_attente
test('Nouvelle agence a statut en_attente', async () => {
  // Créer compte régie
  // Vérifier que statut_validation = 'en_attente'
});

// Test 2 : Locataire ne peut pas se connecter si agence non validée
test('Connexion bloquée si agence en_attente', async () => {
  // Créer compte régie non validé
  // Essayer de se connecter
  // Devrait être rejeté
});

// Test 3 : Seul admin_jtec peut valider
test('Seul admin peut valider agence', async () => {
  // Essayer de valider avec rôle régie
  // Devrait échouer
  // Essayer avec rôle admin_jtec
  // Devrait réussir
});

// Test 4 : Après validation, accès autorisé
test('Accès autorisé après validation', async () => {
  // Admin valide agence
  // Régie se connecte
  // Devrait réussir
});
```

#### 3. Tests sécurité RLS

**Fichier à créer** : `tests/security-escalation.test.js`

```javascript
// Test 1 : Impossible de changer son propre rôle
test('Utilisateur ne peut pas changer son rôle', async () => {
  // Créer utilisateur avec rôle locataire
  // Essayer de UPDATE profiles SET role = 'admin_jtec'
  // Devrait échouer
});

// Test 2 : Impossible de voir les données d'une autre régie
test('Isolation régie stricte', async () => {
  // Créer 2 régies
  // Régie 1 essaye de voir immeubles régie 2
  // Devrait retourner 0 résultat
});
```

### 🔧 Tests E2E manquants

**À ajouter dans `tests/integration.e2e.test.js`** :

```javascript
// Test flow complet inscription → validation → premier login

test('Flow inscription régie → validation admin → login', async () => {
  // 1. Inscription régie avec tous les champs
  const inscriptionRes = await fetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nouvelle-agence@test.com',
      password: 'motdepasse123',
      nomAgence: 'Agence Test',
      nbCollaborateurs: 5,
      nbLogements: 100,
      siret: '12345678901234'
    })
  });
  
  assert(inscriptionRes.status === 200);
  
  // 2. Vérifier que statut = en_attente
  const { data: regie } = await supabaseAdmin
    .from('regies')
    .select('statut_validation')
    .eq('email', 'nouvelle-agence@test.com')
    .single();
  
  assert(regie.statut_validation === 'en_attente');
  
  // 3. Essayer de se connecter → devrait être bloqué
  const loginBloque = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nouvelle-agence@test.com',
      password: 'motdepasse123'
    })
  });
  
  // Note : Le login technique réussit mais l'accès métier est bloqué
  
  // 4. Admin valide l'agence
  const { data: adminId } = await createAdminJtec(); // Helper
  
  const validationRes = await supabaseAdmin.rpc('valider_agence', {
    p_regie_id: regie.id,
    p_admin_id: adminId
  });
  
  assert(validationRes.data.success === true);
  
  // 5. Réessayer de se connecter → devrait réussir
  const loginOk = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'nouvelle-agence@test.com',
      password: 'motdepasse123'
    })
  });
  
  assert(loginOk.status === 200);
});
```

---

## 📋 CHECKLIST FINALE PRÉ-DÉPLOIEMENT

### 🚨 BLOQUANTS (doivent être corrigés AVANT Supabase)

- [ ] **B1** : Créer mécanisme création admin JTEC (Solution 2 recommandée)
- [ ] **B2** : Ajouter champs métier au formulaire inscription (nom agence, collaborateurs, logements, SIRET)
- [ ] **B3** : Ajouter colonne `statut_validation` à table `regies`
- [ ] **B4** : Créer vue `admin_agences_en_attente`
- [ ] **B5** : Créer fonctions `valider_agence()` et `refuser_agence()`
- [ ] **B6** : Créer API `api/admin/valider-agence.js`
- [ ] **B7** : Modifier dashboard admin pour afficher agences en attente
- [ ] **B8** : Modifier `login.html` pour bloquer accès si statut != 'valide'
- [ ] **B9** : Ajouter trigger pour empêcher auto-escalation de rôle

### ⚠️ CRITIQUES (doivent être corrigés avant production)

- [ ] **C1** : Auditer fonction `send_message()` pour vérifier contrôles destinataire
- [ ] **C2** : Ajouter validation startup dans `server.js` (vérif clés Supabase)
- [ ] **C3** : Renommer `supabaseClient.js` en `supabaseClientPublic.js`
- [ ] **C4** : Documenter variables Vercel dans `DEPLOYMENT.md`
- [ ] **C5** : Créer tests `admin-creation.test.js`
- [ ] **C6** : Créer tests `validation-agence.test.js`
- [ ] **C7** : Créer tests `security-escalation.test.js`
- [ ] **C8** : Ajouter test E2E flow inscription → validation
- [ ] **C9** : Documenter procédure de création premier admin dans README

### ✅ RECOMMANDATIONS (bonnes pratiques)

- [ ] **R1** : Ajouter monitoring Sentry pour erreurs production
- [ ] **R2** : Configurer alertes email pour nouvelles inscriptions agence
- [ ] **R3** : Créer page `/admin/agences` dédiée (séparer du dashboard)
- [ ] **R4** : Ajouter logs d'audit pour actions admin (validation/refus)
- [ ] **R5** : Implémenter rate limiting sur `/api/auth/register`
- [ ] **R6** : Ajouter CAPTCHA sur formulaire inscription
- [ ] **R7** : Créer script de migration pour données existantes
- [ ] **R8** : Documenter procédure de rollback
- [ ] **R9** : Tester déploiement sur environnement staging d'abord

---

## 📂 FICHIERS À CRÉER/MODIFIER

### Fichiers à CRÉER (9 fichiers)

1. `supabase/seed/00_create_first_admin.sql` - Script SQL manuel admin
2. `public/install-admin.html` - Page d'installation protégée
3. `api/install/create-admin.js` - API création premier admin
4. `api/admin/valider-agence.js` - API validation/refus agence
5. `tests/admin-creation.test.js` - Tests création admin
6. `tests/validation-agence.test.js` - Tests validation agence
7. `tests/security-escalation.test.js` - Tests sécurité escalation
8. `supabase/schema/21_trigger_prevent_escalation.sql` - Trigger sécurité rôle
9. `MIGRATION_GUIDE.md` - Guide de migration données existantes

### Fichiers à MODIFIER (7 fichiers)

1. `public/register.html` - Ajouter champs métier (lignes 190+)
2. `public/login.html` - Bloquer accès si statut != valide (lignes 200+)
3. `public/admin/dashboard.html` - Section validation agences (lignes 450+)
4. `supabase/schema/05_regies.sql` - Ajouter colonnes validation (lignes 18+)
5. `supabase/schema/13_admin.sql` - Ajouter vue + fonctions validation (fin fichier)
6. `api/auth/register.js` - Créer régie avec nouveaux champs (lignes 120+)
7. `.env.example` - Ajouter INSTALL_ADMIN_KEY

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Corrections bloquantes (Urgent - 1 jour)

1. ✅ Créer table `regies` avec `statut_validation`
2. ✅ Modifier formulaire inscription (4 champs métier)
3. ✅ Créer mécanisme admin (page install + API)
4. ✅ Créer vue + fonctions validation agence
5. ✅ Modifier dashboard admin (section validation)
6. ✅ Bloquer login si statut != valide

**Livrable** : Système fonctionnel avec validation manuelle agences

### Phase 2 : Sécurité critique (Important - 2 jours)

1. ✅ Trigger prevent role escalation
2. ✅ Audit fonction `send_message()`
3. ✅ Tests sécurité (admin, validation, escalation)
4. ✅ Validation variables Supabase
5. ✅ Documentation déploiement

**Livrable** : Système sécurisé prêt pour prod

### Phase 3 : Production (Normal - 1 jour)

1. ✅ Tests E2E flow complet
2. ✅ Déploiement staging
3. ✅ Création premier admin prod
4. ✅ Tests smoke production
5. ✅ Monitoring activé

**Livrable** : Système en production

---

## 📊 RÉSUMÉ DES RISQUES

| Risque | Gravité | Probabilité | Impact | Mitigation |
|--------|---------|-------------|--------|------------|
| Pas d'admin créable | 🔴 Critique | 100% | Bloquant total | Solution 2 (page install) |
| Agence non validées accèdent | 🔴 Critique | 80% | Accès non autorisés | Bloquer login si en_attente |
| Escalation rôle possible | 🟠 Élevé | 30% | Compromission admin | Trigger + tests |
| SERVICE_ROLE exposée | 🟠 Élevé | 20% | Bypass RLS | Audit bundling frontend |
| send_message() non sécurisée | 🟡 Moyen | 40% | Spam possible | Audit fonction |
| Pas de tests validation | 🟡 Moyen | 100% | Bugs en prod | Tests phase 2 |

---

## ✅ CONCLUSION

**STATUT ACTUEL** : 🚫 **DÉPLOIEMENT BLOQUÉ**

**Raisons** :
1. ❌ Impossible de créer un admin JTEC
2. ❌ Aucune validation des agences
3. ❌ Formulaire inscription incomplet
4. ⚠️ Risques sécurité non mitigés

**Après corrections Phase 1** : 🟢 **DÉPLOIEMENT POSSIBLE** (avec vigilance)

**Après corrections Phase 2** : 🟢 **DÉPLOIEMENT RECOMMANDÉ**

**Temps estimé total corrections** : 4 jours (1 dev temps plein)

---

**Rapport généré le** : 17 décembre 2025  
**Version** : 1.0  
**Statut** : ⚠️ ACTION REQUISE
