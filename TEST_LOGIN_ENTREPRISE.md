# 🧪 Test Login Entreprise - Guide Complet

**Date**: 2025-01-27  
**Objectif**: Valider le flux complet de création + login d'une entreprise via la régie  
**Compte test**: `entreprise@test.app` / `GNzMYSsF#Gn$`

---

## ✅ Corrections Appliquées

### 1. **API Backend** (`api/regie/create-entreprise-account.js`)
```javascript
// ❌ AVANT (ligne 126)
email_confirm: false,  // Bloque le login password

// ✅ APRÈS (ligne 126)
email_confirm: true,   // Permet login immédiat
```

**Impact**: Les utilisateurs créés peuvent maintenant se connecter avec le mot de passe temporaire sans confirmation d'email.

### 2. **Frontend Login** (`public/login.html`)
Ajout de logs détaillés pour tracer chaque étape :

- `[LOGIN][STEP 1]` - Form submit avec email
- `[LOGIN][STEP 2]` - signInWithPassword (avec gestion erreurs spécifiques)
- `[LOGIN][STEP 3]` - Récupération du profil
- `[LOGIN][STEP 4]` - Validation spécifique (statut régie si applicable)
- `[LOGIN][STEP 5]` - Détermination de la route de redirection
- `[LOGIN][STEP 6]` - Redirection vers dashboard

**Messages d'erreur différenciés** :
- `Email not confirmed` → "📧 Veuillez confirmer votre email..."
- `Invalid login credentials` → "❌ Email ou mot de passe incorrect..."
- `user_not_found` → "❌ Aucun compte trouvé avec cet email"
- `Profile not found` → "❌ Profil introuvable. Contactez l'administrateur."

---

## 🧪 Procédure de Test Complète

### **Étape 0️⃣ : Vérification BDD via SQL**

Exécuter le script de validation : [`supabase/migrations/debug_entreprise_login.sql`](supabase/migrations/debug_entreprise_login.sql)

```sql
-- ✅ CHECK 1 : User existe dans auth.users
SELECT 
  id,
  email,
  email_confirmed_at,  -- DOIT être NOT NULL pour permettre login
  created_at
FROM auth.users
WHERE email = 'entreprise@test.app';
-- Attendu : 1 ligne avec email_confirmed_at NOT NULL

-- ✅ CHECK 2 : Profil lié
SELECT 
  p.id,
  p.email,
  p.role,  -- DOIT être 'entreprise'
  p.created_at
FROM profiles p
WHERE p.email = 'entreprise@test.app';

-- ✅ CHECK 3 : Entreprise liée
SELECT 
  e.id,
  e.nom,
  e.profile_id,
  e.created_at
FROM entreprises e
JOIN profiles p ON p.id = e.profile_id
WHERE p.email = 'entreprise@test.app';

-- ✅ CHECK 4 : Lien regie_entreprise avec mode_diffusion valide
SELECT 
  re.id,
  re.regie_id,
  re.entreprise_id,
  re.mode_diffusion,  -- DOIT être 'general' ou 'restreint'
  re.created_at
FROM regies_entreprises re
JOIN entreprises e ON e.id = re.entreprise_id
JOIN profiles p ON p.id = e.profile_id
WHERE p.email = 'entreprise@test.app';
```

**Résultats attendus** :
- ✅ 1 ligne dans `auth.users` avec `email_confirmed_at NOT NULL`
- ✅ 1 ligne dans `profiles` avec `role='entreprise'`
- ✅ 1 ligne dans `entreprises` avec `profile_id` correspondant
- ✅ 1 ligne dans `regies_entreprises` avec `mode_diffusion='restreint'` (par défaut)

---

### **Étape 1️⃣ : Création Entreprise via Régie UI**

1. **Se connecter en tant que Régie** : `regie@fleury.com`
2. **Accéder à** : [/regie/entreprises.html](public/regie/entreprises.html)
3. **Créer une nouvelle entreprise** :
   - Nom : "Test Plomberie"
   - Email : `entreprise@test.app`
   - Téléphone : `0601020304`
   - SIRET : `12345678900011`
   - ✅ **Cocher** : "Créer un compte avec accès"
   - Sélectionner mode : **"Restreint"** (tickets assignés uniquement)
4. **Cliquer** : "Créer l'entreprise"

**Attendu** :
- ✅ Message de succès : "Entreprise créée avec compte"
- ✅ Affichage de la modale avec identifiants temporaires :
  ```
  Email : entreprise@test.app
  Mot de passe : GNzMYSsF#Gn$  (Exemple - généré aléatoirement)
  ```
- ✅ Instructions de transmission sécurisée

**Logs Backend attendus** (`Vercel Logs`) :
```javascript
[CREATE-ENTREPRISE][Step 0] Body received: {...}
[CREATE-ENTREPRISE][Step 1] Token validated: {...}
[CREATE-ENTREPRISE][Step 2] Regie found: {...}
[CREATE-ENTREPRISE][Step 3] Duplicate check: OK
[CREATE-ENTREPRISE][Step 4] Creating entreprise (no auth account)...
[CREATE-ENTREPRISE][Step 5] Auth user creation...
[CREATE-ENTREPRISE][Step 5 OK] User created: {..., email_confirmed_at: "2025-01-27T..."}
[CREATE-ENTREPRISE][Step 5.1] Generated temp password: GNzMYSsF#Gn$
[CREATE-ENTREPRISE][Step 6] Creating profile...
[CREATE-ENTREPRISE][Step 7] Updating entreprise with profile_id...
[CREATE-ENTREPRISE][Step 8] Success
```

---

### **Étape 2️⃣ : Connexion avec Identifiants Temporaires**

1. **Se déconnecter** de la session régie
2. **Accéder à** : [/login.html](public/login.html)
3. **Entrer les identifiants** :
   - Email : `entreprise@test.app`
   - Mot de passe : `GNzMYSsF#Gn$` (copier depuis la modale)
4. **Cliquer** : "Se connecter"

**Logs Frontend attendus** (`Console DevTools`) :
```javascript
[LOGIN][STEP 1] Submitting login for: entreprise@test.app
[LOGIN][STEP 2] Calling signInWithPassword...
[LOGIN][STEP 2 OK] Auth successful {
  userId: "uuid-...",
  email: "entreprise@test.app",
  emailConfirmedAt: "2025-01-27T...",  // ✅ NOT NULL
  hasSession: true
}
[LOGIN][STEP 3] Fetching user profile...
[LOGIN][STEP 3 OK] Profile retrieved {
  profileId: "uuid-...",
  role: "entreprise",
  email: "entreprise@test.app"
}
[LOGIN][STEP 4] Role-specific validation...
[LOGIN][STEP 5] Determining redirect route for role: entreprise
[LOGIN][STEP 6] Redirecting to dashboard {
  role: "entreprise",
  targetPath: "/entreprise/dashboard.html",
  willRedirectIn: "500ms"
}
[LOGIN][STEP 6 OK] Executing redirect to: /entreprise/dashboard.html
```

**Attendu** :
- ✅ Message : "Connexion réussie ! Redirection..."
- ✅ Redirection vers : `/entreprise/dashboard.html`
- ✅ Session active (vérifiable via `supabase.auth.getSession()`)

---

### **Étape 3️⃣ : Vérification Dashboard Entreprise**

Une fois redirigé vers `/entreprise/dashboard.html` :

1. **Vérifier le chargement** de la page
2. **Vérifier le header** : Affichage du nom de l'entreprise
3. **Vérifier les tickets** :
   - Si mode `restreint` : Uniquement tickets assignés à cette entreprise
   - Si mode `general` : Tous les tickets disponibles de la régie

**Console DevTools** :
```javascript
[ENTREPRISE][SESSION] User: {...}
[ENTREPRISE][PROFILE] Profile: {...}
[ENTREPRISE][ENTREPRISE] Data: {...}
[ENTREPRISE][TICKETS] Loaded: X tickets
```

---

## 🔧 Cas d'Erreur Possibles

### **Erreur 1 : "Email ou mot de passe incorrect"**

**Cause racine** : `email_confirmed_at = NULL` dans `auth.users`

**Diagnostic SQL** :
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'entreprise@test.app';
```

**Correction manuelle** (si nécessaire) :
```sql
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'entreprise@test.app';
```

---

### **Erreur 2 : "Profil introuvable"**

**Cause racine** : Pas de ligne dans `profiles` avec `id = auth.user.id`

**Diagnostic SQL** :
```sql
SELECT p.* 
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'entreprise@test.app';
```

**Correction manuelle** :
```sql
-- Récupérer l'ID user
SELECT id FROM auth.users WHERE email = 'entreprise@test.app';

-- Créer le profil
INSERT INTO profiles (id, email, role)
VALUES ('<user_id>', 'entreprise@test.app', 'entreprise');
```

---

### **Erreur 3 : Redirect vers mauvaise page**

**Cause racine** : `profile.role` incorrect ou mapping manquant

**Vérification** :
```sql
SELECT role FROM profiles WHERE email = 'entreprise@test.app';
-- Attendu : 'entreprise'
```

**Mapping dans login.html (ligne 342-349)** :
```javascript
const dashboardRoutes = {
  entreprise: '/entreprise/dashboard.html',  // ✅ Route correcte
  regie: '/regie/dashboard.html',
  locataire: '/locataire/dashboard.html',
  // ...
};
```

---

## 📊 Checklist de Validation

- [ ] **Création entreprise via UI régie** → Succès + identifiants affichés
- [ ] **Vérification BDD** → 4 tables liées correctement (auth.users, profiles, entreprises, regies_entreprises)
- [ ] **email_confirmed_at NOT NULL** → Permet login password
- [ ] **Login avec identifiants temporaires** → Succès sans erreur
- [ ] **Logs [LOGIN][STEP 1-6]** → Tous affichés dans console
- [ ] **Redirection vers `/entreprise/dashboard.html`** → OK
- [ ] **Dashboard charge données** → Nom entreprise + tickets selon mode_diffusion
- [ ] **Session persistante** → Rechargement de page conserve session

---

## 🚀 Déploiement

### **1. Commit des changements**
```bash
git add api/regie/create-entreprise-account.js
git add public/login.html
git add supabase/migrations/debug_entreprise_login.sql
git add TEST_LOGIN_ENTREPRISE.md
git commit -m "fix(entreprise): Enable immediate login with temp credentials (email_confirm: true) + detailed login logs"
```

### **2. Push vers Vercel**
```bash
git push origin main
```

### **3. Vérifier déploiement Vercel**
- Dashboard Vercel → Deployments
- Attendre "Ready" (build + deploy)
- Tester avec la procédure ci-dessus

---

## 📝 Notes Techniques

### **Pourquoi `email_confirm: true` ?**

Dans Supabase Auth, `signInWithPassword()` refuse les connexions si `email_confirmed_at = NULL`.

**Comportement par défaut** :
- `email_confirm: false` → Email confirmation requis (magic link)
- User reçoit un email avec lien de confirmation
- Tant que non cliqué → `email_confirmed_at = NULL` → Login bloqué

**Notre besoin** :
- Créer compte **pour** l'entreprise (elle ne demande pas)
- Générer mot de passe temporaire
- Permettre login immédiat avec ce mot de passe
- Pas de flux email (l'entreprise reçoit les identifiants via la régie directement)

**Solution** :
- `email_confirm: true` → Force `email_confirmed_at = NOW()`
- Login password immédiatement autorisé
- L'entreprise peut se connecter sans attendre d'email

---

## 🔐 Sécurité

### **Génération Mot de Passe**
```javascript
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
const length = 12;
// Exemple : GNzMYSsF#Gn$
```

### **Transmission Sécurisée**
⚠️ **Important** : Les identifiants temporaires sont affichés **une seule fois** dans la modale.

**Recommandations** :
1. Copier immédiatement
2. Transmettre via canal sécurisé (SMS, appel, email chiffré)
3. Demander changement de mot de passe au premier login

**TODO Future** : Implémenter changement forcé de mot de passe au premier login.

---

## 📚 Fichiers Liés

- [`api/regie/create-entreprise-account.js`](api/regie/create-entreprise-account.js) - API création compte
- [`public/login.html`](public/login.html) - Page login universelle
- [`public/regie/entreprises.html`](public/regie/entreprises.html) - UI régie gestion entreprises
- [`public/entreprise/dashboard.html`](public/entreprise/dashboard.html) - Dashboard entreprise
- [`supabase/migrations/debug_entreprise_login.sql`](supabase/migrations/debug_entreprise_login.sql) - Script validation SQL
- [`api/lib/supabaseServer.js`](api/lib/supabaseServer.js) - Helper Supabase unifié

---

**Dernière mise à jour** : 2025-01-27  
**Testeur** : À compléter  
**Statut** : ⏳ En attente de déploiement
