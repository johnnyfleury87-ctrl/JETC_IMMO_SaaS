# 🚀 DÉPLOIEMENT VERCEL PRO - VARIABLES D'ENVIRONNEMENT REQUISES

Ce document liste toutes les variables d'environnement à configurer dans Vercel Dashboard.

## 📍 Où configurer ?

**Vercel Dashboard** → Votre projet → **Settings** → **Environment Variables**

---

## 🔐 Variables Supabase (OBLIGATOIRES)

### 1. SUPABASE_URL
- **Valeur** : URL de votre projet Supabase
- **Format** : `https://xxxxxxxxxxxxx.supabase.co`
- **Où trouver** : Supabase Dashboard → Settings → API → Project URL
- **Environnements** : Production, Preview, Development
- **Exposition** : ✅ Public (utilisé frontend + backend)

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Valeur** : Clé publique ANON
- **Où trouver** : Supabase Dashboard → Settings → API → `anon` public
- **Environnements** : Production, Preview, Development
- **Exposition** : ✅ Public (protection par RLS)
- **Usage** : Frontend uniquement

### 3. SUPABASE_SERVICE_ROLE_KEY
- **Valeur** : Clé admin SERVICE_ROLE
- **Où trouver** : Supabase Dashboard → Settings → API → `service_role` (cliquer "Reveal")
- **Environnements** : Production, Preview, Development
- **Exposition** : ❌ SECRET (BACKEND UNIQUEMENT)
- **Usage** : API routes backend (bypass RLS)
- **⚠️ CRITIQUE** : Ne JAMAIS exposer au frontend

---

## 🔧 Variables Optionnelles

### 4. MODE
- **Valeur recommandée** : `demo` (développement) ou `pro` (production)
- **Par défaut** : `demo`
- **Environnements** : 
  - Production → `pro`
  - Preview → `demo`
  - Development → `demo`

### 5. INSTALL_ADMIN_KEY
- **Valeur** : Clé aléatoire sécurisée (32+ caractères)
- **Usage** : Installation du premier admin JETC
- **Générer avec** : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Environnements** : Production uniquement
- **⚠️ À SUPPRIMER** : Après création du premier admin

### 6. NODE_ENV
- **Valeur** : `production`
- **Environnements** : Production uniquement
- **Note** : Déjà configuré dans vercel.json

---

## ✅ Checklist de configuration Vercel

- [ ] SUPABASE_URL configurée (tous les environnements)
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY configurée (tous les environnements)
- [ ] SUPABASE_SERVICE_ROLE_KEY configurée (tous les environnements)
- [ ] MODE = `pro` en Production
- [ ] MODE = `demo` en Preview/Development
- [ ] INSTALL_ADMIN_KEY générée (Production uniquement)
- [ ] Variables sauvegardées dans Vercel Dashboard

---

## 🔍 Vérification post-déploiement

Après déploiement, testez :

```bash
# Healthcheck (doit retourner ok: true)
curl https://votre-app.vercel.app/api/healthcheck

# Page d'accueil (doit retourner HTTP 200)
curl -I https://votre-app.vercel.app/

# Variables d'env (doit montrer environment.SUPABASE_URL: true)
curl https://votre-app.vercel.app/api/healthcheck | jq .environment
```

---

## 🚨 Sécurité

**NE JAMAIS** :
- ❌ Commit .env.local dans Git
- ❌ Exposer SUPABASE_SERVICE_ROLE_KEY au frontend
- ❌ Partager les clés dans les issues GitHub
- ❌ Logger les secrets en console

**TOUJOURS** :
- ✅ Utiliser ANON KEY côté frontend (RLS protégé)
- ✅ Utiliser SERVICE_ROLE KEY côté backend uniquement
- ✅ Régénérer INSTALL_ADMIN_KEY après usage
- ✅ Vérifier .gitignore contient .env.local

---

## 📚 Documentation

- [Supabase API Keys](https://supabase.com/dashboard/project/_/settings/api)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
