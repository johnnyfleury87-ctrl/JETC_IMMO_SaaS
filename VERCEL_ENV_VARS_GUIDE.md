# Configuration Variables Vercel - Workflow Entreprise

## 🎯 Problème résolu

**Erreur Vercel** : `supabaseUrl is required`

**Cause** : Variables d'environnement manquantes ou mal nommées dans Vercel Production/Preview.

## 📋 Variables requises

### Configuration Vercel Dashboard

**Navigation** : Vercel Dashboard → Projet → Settings → Environment Variables

### Variables Backend (Server-Side Functions)

Ces variables sont utilisées par les **Vercel Functions** (`/api/**/*.js`).

| Variable | Valeur | Environnements | Usage |
|----------|--------|----------------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development | URL du projet Supabase (backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Production, Preview, Development | Clé admin (bypass RLS) - **SECRET** |

⚠️ **IMPORTANT** : 
- `SUPABASE_SERVICE_ROLE_KEY` est **SECRÈTE** et ne doit JAMAIS être exposée au frontend
- Elle bypass TOUS les RLS - utiliser uniquement côté serveur
- Ne JAMAIS committer ces valeurs dans Git

### Variables Frontend (Client-Side)

Ces variables sont exposées au navigateur (préfixe `NEXT_PUBLIC_`).

| Variable | Valeur | Environnements | Usage |
|----------|--------|----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development | URL du projet Supabase (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Production, Preview, Development | Clé anonyme (RLS appliqué) |

✅ **Sécurisé** : Ces clés peuvent être exposées publiquement (RLS protège les données).

## 🔧 Configuration dans Vercel

### Méthode 1 : Interface Web

1. Aller sur https://vercel.com/dashboard
2. Sélectionner le projet `JETC_IMMO_SaaS`
3. Settings → Environment Variables
4. Ajouter chaque variable :
   - Name: `SUPABASE_URL`
   - Value: `https://xxx.supabase.co`
   - Environments: ☑️ Production ☑️ Preview ☑️ Development
5. Répéter pour les 3 autres variables

### Méthode 2 : Vercel CLI

```bash
# Backend (server-side)
vercel env add SUPABASE_URL production
# Entrer: https://xxx.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Entrer: eyJhbGciOiJIUzI1NiIs... (clé secrète)

# Frontend (client-side)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Entrer: https://xxx.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Entrer: eyJhbGciOiJIUzI1NiIs... (clé publique)

# Répéter pour Preview et Development
vercel env add SUPABASE_URL preview
# etc.
```

### Méthode 3 : Vérifier variables existantes

```bash
# Lister toutes les variables
vercel env ls

# Vérifier une variable spécifique
vercel env pull .env.local
cat .env.local | grep SUPABASE
```

## 📍 Où trouver les valeurs Supabase

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Settings → API

**Project URL** → Copier pour `SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_URL`

**Project API Keys** :
- `anon public` → Copier pour `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → Copier pour `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Secret

## 🔍 Utilisation dans le code

### Backend (Vercel Functions)

**Fichier** : `api/lib/supabaseServer.js`

```javascript
// Support des deux conventions (tolère NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validation stricte
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Variables manquantes');
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

**Utilisé par** :
- `api/regie/create-entreprise-account.js`
- `api/auth/login.js`
- `api/auth/register.js`
- Toutes les routes `/api/**` nécessitant privilèges admin

### Frontend (Browser)

**Fichier** : `public/js/supabaseClient.js` ou inline

```javascript
const supabase = window.supabase.createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

**Utilisé par** :
- `public/regie/entreprises.html`
- `public/locataire/dashboard.html`
- Toutes les pages frontend

## ✅ Validation post-configuration

### 1. Vérifier dans Vercel Dashboard

Settings → Environment Variables → Devrait afficher :

```
SUPABASE_URL                      Production, Preview, Development
SUPABASE_SERVICE_ROLE_KEY         Production, Preview, Development
NEXT_PUBLIC_SUPABASE_URL          Production, Preview, Development
NEXT_PUBLIC_SUPABASE_ANON_KEY     Production, Preview, Development
```

### 2. Redéployer

```bash
# Push déclenche auto-deploy
git push origin main

# Ou forcer redéploiement
vercel --prod
```

### 3. Vérifier logs Vercel

Après déploiement, tester l'endpoint :

```bash
curl -X POST https://your-domain.vercel.app/api/regie/create-entreprise-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test","email":"test@test.ch","mode_diffusion":"restreint"}'
```

**Logs attendus** :
```
[CREATE-ENTREPRISE] Step 0: Request received
[CREATE-ENTREPRISE] Step 1: Initializing Supabase clients
[CREATE-ENTREPRISE] Step 1.1: Admin client OK
[CREATE-ENTREPRISE] Step 2: Verifying token
[CREATE-ENTREPRISE] Step 2 OK: User authenticated: ...
```

**Erreur disparue** :
- ❌ Avant : `[SUPABASE SERVER] Variables d'environnement manquantes`
- ❌ Avant : `supabaseUrl is required`
- ✅ Après : `[CREATE-ENTREPRISE] Step 1.1: Admin client OK`

## 🚨 Erreurs communes

### Erreur 1 : `supabaseUrl is required`

**Cause** : `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL` absente

**Solution** :
```bash
vercel env add SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
```

### Erreur 2 : `SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis`

**Cause** : Variables présentes mais mal nommées (typo, espace, etc.)

**Solution** : Vérifier l'orthographe exacte dans Vercel Dashboard

### Erreur 3 : Variables visibles en local mais pas en production

**Cause** : Variables ajoutées uniquement en "Development"

**Solution** : Cocher ☑️ Production lors de l'ajout

### Erreur 4 : Ancien déploiement sans les nouvelles variables

**Cause** : Variables ajoutées après le dernier déploiement

**Solution** : Redéployer `vercel --prod` ou push un commit

## 📚 Références

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-api)
- Code source : `api/lib/supabaseServer.js`
- Tests : `supabase/migrations/sanity_check_entreprise_workflow.sql`
