# Standardisation Supabase - Routes API Backend

## 🎯 Problème résolu

**Avant** : Multiples conventions incohérentes dans `/api/**/*.js`
- Certaines routes utilisaient `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- D'autres créaient leur propre client à la volée
- `/api/regie/create-entreprise-account.js` mixait 3 conventions différentes

**Après** : Convention unique standardisée via helper centralisé

## 📁 Fichiers créés

### `/api/lib/supabaseServer.js`
**Helper unifié pour toutes les routes API backend**

Exports :
- `getAdminClient()` → Client admin (bypass RLS), singleton
- `getUserClient(token)` → Client avec contexte user (RLS appliqué)
- `verifyToken(token)` → Vérifie JWT et retourne user
- `getUserProfile(userId)` → Récupère profile depuis DB

Variables utilisées :
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

## 🔧 Fichiers modifiés

### `/api/regie/create-entreprise-account.js`
**Refactorisé pour utiliser le helper**

Changements :
- ✅ Supprimé : `import { createClient } from '@supabase/supabase-js'`
- ✅ Ajouté : `const { getAdminClient, getUserClient, verifyToken, getUserProfile } = require('../lib/supabaseServer')`
- ✅ Supprimé : Validation manuelle des env vars
- ✅ Supprimé : Création manuelle de clients Supabase
- ✅ Supprimé : Code dupliqué pour vérification auth
- ✅ Ajouté : Logs détaillés à chaque étape

Workflow actuel :
1. `verifyToken(token)` → Authentifie l'utilisateur
2. `getUserProfile(user.id)` → Récupère et valide role=regie
3. `getAdminClient()` → Crée Auth user + profile
4. `getUserClient(token).rpc()` → Appelle `create_entreprise_with_profile` avec contexte régie

## ✅ Variables d'environnement requises Vercel

### Production Environment Variables
**À vérifier/configurer dans Vercel Dashboard → Settings → Environment Variables**

```bash
# Backend (Server-Side Functions)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend (Exposed to Browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vérification Vercel CLI

```bash
# Lister les env vars en prod
vercel env ls

# Ajouter si manquantes
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

## 🔒 Sécurité

### Variables INTERDITES côté frontend
❌ `SUPABASE_SERVICE_ROLE_KEY` → Bypass TOUS les RLS
❌ Ne JAMAIS exposer dans `NEXT_PUBLIC_*`
❌ Ne JAMAIS committer dans Git

### Variables autorisées côté frontend
✅ `NEXT_PUBLIC_SUPABASE_URL` → URL publique
✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Clé anon (RLS appliqué)

## 📋 Routes à migrer (optionnel)

Les routes suivantes créent encore leur propre client manuellement.
Migration recommandée vers `/api/lib/supabaseServer.js` :

### Routes à garder telles quelles (utilisent déjà `/api/_supabase.js`)
- ✅ `/api/auth/login.js`
- ✅ `/api/auth/register.js`
- ✅ `/api/admin/valider-agence.js`
- ✅ `/api/services/passwordService.js`

### Routes à migrer (optionnel)
- `/api/techniciens/planning.js` → Utilise `SUPABASE_SERVICE_ROLE_KEY` manuellement
- `/api/techniciens/list.js` → idem
- `/api/messages/send.js` → Utilise `SUPABASE_ANON_KEY` manuellement
- `/api/factures/*.js` → idem
- `/api/notifications/*.js` → idem

**Migration type** :
```javascript
// AVANT
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// APRÈS
const { getAdminClient } = require('../lib/supabaseServer');
const supabase = getAdminClient();
```

## 🚀 Déploiement

```bash
# 1. Commit
git add .
git commit -m "fix(api): standardize Supabase client initialization"

# 2. Push
git push origin main

# 3. Vérifier variables Vercel (AVANT déploiement)
vercel env ls

# 4. Déployer
vercel --prod

# 5. Tester
curl -X POST https://your-domain.vercel.app/api/regie/create-entreprise-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test","email":"test@test.ch"}'
```

## 🧪 Tests

### Test 1 : Variables présentes
```bash
# Dans Vercel Function logs
[SUPABASE SERVER] Admin client initialized
```

### Test 2 : Auth fonctionne
```bash
[CREATE-ENTREPRISE] User authenticated: 00000000-0000-0000-0000-000000000000
[CREATE-ENTREPRISE] Regie validated: 11111111-1111-1111-1111-111111111111
```

### Test 3 : Création entreprise
```bash
[CREATE-ENTREPRISE] Creating Auth user...
[CREATE-ENTREPRISE] Profile created: 22222222-2222-2222-2222-222222222222
[CREATE-ENTREPRISE] Calling RPC create_entreprise_with_profile...
[CREATE-ENTREPRISE] SUCCESS! Entreprise ID: 33333333-3333-3333-3333-333333333333
```

## ❌ Erreurs connues et solutions

### Erreur : `supabaseUrl is required`
**Cause** : `SUPABASE_URL` absente en production
**Solution** : `vercel env add SUPABASE_URL production`

### Erreur : `Missing Supabase env`
**Cause** : `SUPABASE_SERVICE_ROLE_KEY` absente
**Solution** : `vercel env add SUPABASE_SERVICE_ROLE_KEY production`

### Erreur : `Token invalide`
**Cause** : Token JWT expiré ou malformé
**Solution** : Relancer login frontend

### Erreur : `Profile non trouvé`
**Cause** : User existe dans Auth mais pas dans `profiles` table
**Solution** : Vérifier trigger `handle_new_user()` en DB

### Erreur : `Utilisateur non autorisé (pas une régie)`
**Cause** : `get_user_regie_id()` retourne NULL
**Solution** : Vérifier que profile.role = 'regie' et regies.id existe

## 📚 Documentation

- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
