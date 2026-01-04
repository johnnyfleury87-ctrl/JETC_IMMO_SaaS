# Fix Login Entreprise - Commit Summary

## 🎯 Objectif
Corriger l'erreur "Email ou mot de passe incorrect" lors du login avec identifiants temporaires après création d'une entreprise via la régie.

## 🔴 Problème Identifié

### Cause Racine
```javascript
// api/regie/create-entreprise-account.js (ligne 126)
email_confirm: false,  // ❌ Bloque signInWithPassword()
```

**Conséquence** :
- `auth.users.email_confirmed_at = NULL`
- Supabase Auth refuse `signInWithPassword()` avec erreur 400
- Message utilisateur : "Email ou mot de passe incorrect"
- Identifiants temporaires inutilisables

## ✅ Solution Implémentée

### 1. Backend API
**Fichier** : `api/regie/create-entreprise-account.js`

```diff
  const { data: userData, error: userError } = await admin
    .auth.admin.createUser({
      email: body.email,
      password: tempPassword,
-     email_confirm: false,
+     email_confirm: true,  // ✅ Permet login immédiat
      user_metadata: {
        role: 'entreprise',
        created_by: 'regie',
        regie_id: regie.id,
        regie_nom: regie.nom
      }
    });

+ console.log('[CREATE-ENTREPRISE][Step 5 OK] User created', {
+   userId: userData.user.id,
+   email: userData.user.email,
+   emailConfirmedAt: userData.user.email_confirmed_at,  // ✅ NOT NULL
+   hasPassword: true
+ });
```

**Impact** :
- `email_confirmed_at = NOW()` au moment de la création
- Login password immédiatement autorisé
- Pas besoin de confirmation d'email

### 2. Frontend Login
**Fichier** : `public/login.html`

**Ajout** : Logs détaillés par étape (STEP 1-6)

```javascript
[LOGIN][STEP 1] Submitting login for: email
[LOGIN][STEP 2] Calling signInWithPassword...
[LOGIN][STEP 2 OK] Auth successful { userId, emailConfirmedAt, hasSession }
[LOGIN][STEP 3] Fetching user profile...
[LOGIN][STEP 3 OK] Profile retrieved { role, ... }
[LOGIN][STEP 4] Role-specific validation...
[LOGIN][STEP 5] Determining redirect route for role: entreprise
[LOGIN][STEP 6] Redirecting to dashboard { targetPath }
[LOGIN][STEP 6 OK] Executing redirect to: /entreprise/dashboard.html
```

**Amélioration** : Messages d'erreur différenciés

| Erreur Supabase | Message Utilisateur |
|-----------------|---------------------|
| `Email not confirmed` | 📧 Veuillez confirmer votre email... |
| `Invalid login credentials` | ❌ Email ou mot de passe incorrect... |
| `user_not_found` | ❌ Aucun compte trouvé avec cet email |
| `profileError` | ❌ Profil introuvable. Contactez l'administrateur. |

### 3. Outils de Diagnostic
**Nouveau fichier** : `supabase/migrations/debug_entreprise_login.sql`

Script SQL en 7 étapes pour valider :
1. ✅ User dans `auth.users` (email_confirmed_at NOT NULL)
2. ✅ Profile dans `profiles` (role='entreprise')
3. ✅ Entreprise dans `entreprises` (profile_id lié)
4. ✅ Lien dans `regies_entreprises` (mode_diffusion valide)
5. ✅ Simulation query (JOIN toutes tables)
6. ✅ Vérification RLS policies
7. ✅ Script cleanup si nécessaire

**Nouveau fichier** : `TEST_LOGIN_ENTREPRISE.md`

Guide complet de test avec :
- Procédure étape par étape
- Logs attendus (backend + frontend)
- Cas d'erreur + corrections manuelles
- Checklist de validation

## 📁 Fichiers Modifiés

```
api/regie/create-entreprise-account.js     (1 ligne critique + logs)
public/login.html                          (6 blocs STEP + erreurs)
supabase/migrations/debug_entreprise_login.sql  (NOUVEAU - 213 lignes)
TEST_LOGIN_ENTREPRISE.md                   (NOUVEAU - 350 lignes)
FIX_LOGIN_ENTREPRISE_VISUAL.txt            (NOUVEAU - résumé visuel)
COMMIT_SUMMARY_FIX_LOGIN_ENTREPRISE.md     (CE FICHIER)
```

## 🧪 Testing

### Compte Test
- **Email** : `entreprise@test.app`
- **Password** : `GNzMYSsF#Gn$` (exemple généré)
- **Régie** : Fleury_Teste
- **Mode** : restreint

### Procédure
1. ✅ Créer entreprise via `/regie/entreprises.html`
2. ✅ Copier identifiants de la modale
3. ✅ Login via `/login.html`
4. ✅ Vérifier redirection vers `/entreprise/dashboard.html`
5. ✅ Vérifier logs `[LOGIN][STEP 1-6]` dans console
6. ✅ Vérifier tickets affichés selon `mode_diffusion`

### Validation SQL
```sql
SELECT 
  u.email,
  u.email_confirmed_at,  -- DOIT être NOT NULL
  p.role,                -- DOIT être 'entreprise'
  e.nom,
  re.mode_diffusion      -- DOIT être 'general' ou 'restreint'
FROM auth.users u
JOIN profiles p ON p.id = u.id
JOIN entreprises e ON e.profile_id = p.id
JOIN regies_entreprises re ON re.entreprise_id = e.id
WHERE u.email = 'entreprise@test.app';
```

**Résultat attendu** : 1 ligne avec `email_confirmed_at NOT NULL`

## 🔐 Sécurité

### Justification `email_confirm: true`

**Contexte** :
- Création par admin (régie validée)
- Pas d'auto-inscription
- Entreprise reçoit identifiants via canal sécurisé (hors système)

**Avantages** :
- ✅ Login immédiat sans friction
- ✅ Pas de dépendance à l'email de l'entreprise
- ✅ Régie contrôle totalement le processus

**Risques mitigés** :
- ⚠️ Mot de passe temporaire fort (12 chars, alphanumeric + symboles)
- ⚠️ Affiché UNE SEULE FOIS (pas de stockage)
- ⚠️ Transmission sécurisée recommandée (SMS, appel)

**TODO Future** : Forcer changement de mot de passe au premier login

## 🚀 Déploiement

### Commandes
```bash
git add -A
git commit -m "fix(entreprise): Enable immediate login with temp credentials

- Change email_confirm: false → true in createUser()
- Add detailed [LOGIN][STEP 1-6] logs in frontend
- Add specific error messages (email not confirmed, profile not found, etc.)
- Add debug_entreprise_login.sql validation script
- Add comprehensive TEST_LOGIN_ENTREPRISE.md guide

Fixes: Login failure with 'Email ou mot de passe incorrect' after
entreprise account creation via regie interface.

Root cause: email_confirmed_at = NULL blocked signInWithPassword().
Solution: Set email_confirm: true for immediate login capability."

git push origin main
```

### Vercel
- Auto-deploy déclenché par push
- Attendre status "Ready" (~ 2-3 min)
- Variables d'environnement déjà configurées (cf. VERCEL_ENV_VARS_GUIDE.md)

## 📊 Impact

### Utilisateurs Affectés
- ✅ **Régies** : Peuvent créer entreprises avec comptes fonctionnels
- ✅ **Entreprises** : Peuvent se connecter avec identifiants temporaires
- ⚠️ **Existants** : Comptes créés AVANT ce fix ont toujours `email_confirmed_at = NULL`

### Correction Manuelle (Existants)
```sql
-- Si entreprises créées avant le fix ne peuvent pas se connecter
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email IN (
  SELECT p.email 
  FROM profiles p 
  WHERE p.role = 'entreprise' 
    AND p.created_at < '2025-01-27 12:00:00'  -- Ajuster date du fix
);
```

## 📈 Métriques de Succès

### Post-Déploiement
- [ ] 0 erreurs login pour nouvelles entreprises
- [ ] Logs `[LOGIN][STEP 1-6]` visibles dans DevTools
- [ ] Redirection vers `/entreprise/dashboard.html` fonctionnelle
- [ ] Mode diffusion `restreint` filtre tickets correctement
- [ ] Session persistante après F5

### Monitoring
```javascript
// Rechercher dans Vercel Logs
[CREATE-ENTREPRISE][Step 5 OK] User created
emailConfirmedAt: "2025-01-27T..."  // ✅ Présent
```

```javascript
// Rechercher dans Browser Console
[LOGIN][STEP 2 OK] Auth successful
emailConfirmedAt: "2025-01-27T..."  // ✅ Présent
hasSession: true                     // ✅ True
```

## 🔗 Références

### Migrations Précédentes
- M26 : INSERT policy entreprises (RLS)
- M27 : Documentation RPC
- M28 : Fix RLS recursion (SECURITY DEFINER)
- M29 : Workflow complet entreprises (dual mode)
- M30 : Fix mode_diffusion ('general'/'restreint')

### Documentation
- `VERCEL_ENV_VARS_GUIDE.md` - Configuration variables
- `STANDARDISATION_SUPABASE_API.md` - Helper api/lib/supabaseServer.js
- `FIX_M30_MODE_DIFFUSION.md` - Correction CHECK constraint

### Liens Supabase Auth
- [createUser() Docs](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [email_confirm parameter](https://supabase.com/docs/reference/javascript/auth-admin-createuser#parameters)
- [signInWithPassword() Docs](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)

---

**Date** : 2025-01-27  
**Author** : GitHub Copilot  
**Status** : ✅ Ready to Deploy  
**Review** : ⏳ Pending User Test
