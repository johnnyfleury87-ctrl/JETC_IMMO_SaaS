# 🚀 Guide de Déploiement JETC_IMMO - Vercel

**Date**: 19 décembre 2025  
**Version**: 2.0.0 (après harmonisation UI complète)  
**Statut**: ✅ Prêt pour déploiement

---

## 📋 Pré-requis

### Comptes requis
- ✅ Compte GitHub (repository: johnnyfleury87-ctrl/JETC_IMMO_SaaS)
- ✅ Compte Vercel Pro
- ✅ Compte Supabase avec projet créé

### Fichiers critiques vérifiés
- ✅ `vercel.json` - Configuration routing
- ✅ `package.json` - Dependencies Node.js
- ✅ `server.js` - API routes backend
- ✅ `/public` - Tous les fichiers statiques harmonisés
- ✅ `/api` - Routes API fonctionnelles

---

## 🎯 ÉTAPE 1 : Préparation Supabase

### 1.1 Récupérer les credentials

**Se connecter à Supabase Dashboard** : https://app.supabase.com

1. Sélectionner votre projet JETC_IMMO
2. Aller dans **Settings** → **API**
3. Noter les valeurs suivantes :

```bash
# Project URL
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon Public Key (visible frontend)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (SECRET - backend only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANT**: Le `SUPABASE_SERVICE_ROLE_KEY` doit rester **SECRET** (jamais exposé au frontend).

### 1.2 Vérifier la base de données

```sql
-- Se connecter au SQL Editor Supabase et vérifier :

-- Tables principales
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM regies;
SELECT COUNT(*) FROM tickets;

-- RLS activé ?
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Toutes les tables doivent avoir `rowsecurity = true`.

---

## 🚀 ÉTAPE 2 : Configuration Vercel

### 2.1 Connecter le repository GitHub

1. Aller sur https://vercel.com
2. Cliquer **Add New** → **Project**
3. Importer `johnnyfleury87-ctrl/JETC_IMMO_SaaS`
4. Sélectionner la branche `main`

### 2.2 Configurer les variables d'environnement

**Dans Vercel Dashboard** → Votre projet → **Settings** → **Environment Variables**

#### Variables OBLIGATOIRES (Production + Preview + Development)

| Variable | Valeur | Exposition |
|----------|--------|------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | ✅ Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | ✅ Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | ❌ **SECRET** |

**Comment ajouter une variable** :
```
1. Cliquer "Add New"
2. Key: SUPABASE_URL
3. Value: https://xxxxx.supabase.co
4. Environnements: Production, Preview, Development
5. Cliquer "Save"
```

Répéter pour les 3 variables obligatoires.

#### Variables OPTIONNELLES

| Variable | Valeur Production | Valeur Preview/Dev |
|----------|-------------------|-------------------|
| `MODE` | `pro` | `demo` |
| `INSTALL_ADMIN_KEY` | Clé aléatoire 32+ chars | Même clé |

**Générer INSTALL_ADMIN_KEY** :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copier le résultat dans Vercel
```

### 2.3 Configuration du build

**Framework Preset**: `Other`  
**Build Command**: `npm install` (ou laisser vide)  
**Output Directory**: `public`  
**Install Command**: `npm install`

---

## 🎨 ÉTAPE 3 : Vérifier les fichiers harmonisés

Tous les fichiers suivants ont été harmonisés avec le design system :

### Pages publiques
- ✅ `/public/index.html` - Landing page (gradient bleu, CHF, logo)
- ✅ `/public/register.html` - Formulaire adhésion
- ✅ `/public/login.html` - Authentification
- ✅ `/public/install-admin.html` - Installation admin
- ✅ `/public/demo-hub.html` - Sélection rôle démo

### Dashboards
- ✅ `/public/admin/dashboard.html` - Dashboard admin (validation régies)
- ✅ `/public/regie/dashboard.html` - Dashboard régie
- ✅ `/public/entreprise/dashboard.html` - Dashboard entreprise
- ✅ `/public/technicien/dashboard.html` - Dashboard technicien
- ✅ `/public/locataire/dashboard.html` - Dashboard locataire
- ✅ `/public/proprietaire/dashboard.html` - Dashboard propriétaire

### Assets
- ✅ `/public/css/design-system.css` - Design system centralisé (600 lignes)
- ✅ `/public/logo_moi.png` - Logo officiel (474KB)
- ✅ `/public/js/languageManager.js` - Traductions FR/EN/DE avec CHF

### API Routes (backend)
- ✅ `/api/auth/register.js` - Inscription régies
- ✅ `/api/admin/valider-agence.js` - Validation/refus régies
- ✅ `/api/tickets/create.js` - Création tickets locataires
- ✅ `/api/healthcheck.js` - Vérification santé app

---

## 🔴 ÉTAPE 4 : Déploiement

### 4.1 Déployer sur Vercel

1. **Vérifier la configuration** :
   - Variables d'environnement saisies ✅
   - Repository GitHub connecté ✅
   - Branche `main` sélectionnée ✅

2. **Lancer le déploiement** :
   - Cliquer **Deploy** dans Vercel Dashboard
   - Attendre le build (2-3 minutes)
   - Vérifier qu'il n'y a pas d'erreurs

3. **Obtenir l'URL de production** :
   ```
   https://jetc-immo-saas.vercel.app
   ```
   Ou votre domaine personnalisé.

### 4.2 Vérifications post-déploiement

#### Test 1 : Landing page
```
URL: https://your-app.vercel.app/
Vérifier:
- ✅ Logo JETC_IMMO visible
- ✅ Gradient bleu (pas violet)
- ✅ Prix en CHF (99, 199, 399)
- ✅ Boutons "Choisir" fonctionnels
- ✅ Changement de langue FR/EN/DE
```

#### Test 2 : Inscription régie
```
URL: https://your-app.vercel.app/register.html
Vérifier:
- ✅ Formulaire s'affiche correctement
- ✅ Soumission crée un profil dans Supabase
- ✅ Redirection vers index.html avec message
- ✅ Email de confirmation (si SMTP configuré)
```

#### Test 3 : Installation admin
```
URL: https://your-app.vercel.app/install-admin.html
Actions:
1. Entrer INSTALL_ADMIN_KEY (variable Vercel)
2. Créer email + mot de passe admin
3. Vérifier création dans Supabase profiles (role=admin_jtec)
```

#### Test 4 : Connexion admin
```
URL: https://your-app.vercel.app/login.html
Actions:
1. Se connecter avec admin créé
2. Vérifier redirection vers /admin/dashboard.html
3. Vérifier affichage régies en attente
4. Tester validation d'une régie
```

#### Test 5 : Connexion régie validée
```
URL: https://your-app.vercel.app/login.html
Actions:
1. Se connecter avec régie validée
2. Vérifier redirection vers /regie/dashboard.html
3. Vérifier affichage nom agence
4. Vérifier sidebar moderne avec logo
```

---

## 🐛 Troubleshooting

### Erreur : "Supabase client not loaded"

**Cause** : Variables d'environnement manquantes ou mal configurées.

**Solution** :
1. Vérifier dans Vercel Dashboard → Settings → Environment Variables
2. S'assurer que `SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont définies
3. Redéployer : Deployments → ⋯ → Redeploy

### Erreur 404 sur les routes `/api/*`

**Cause** : `vercel.json` mal configuré ou server.js non démarré.

**Solution** :
1. Vérifier que `vercel.json` contient les rewrites
2. Vérifier que `server.js` est présent à la racine
3. Check logs : Deployments → Votre deployment → View Function Logs

### CSS design-system.css non chargé

**Cause** : Chemin absolu `/css/design-system.css` non résolu.

**Solution** :
1. Vérifier que le fichier existe dans `/public/css/design-system.css`
2. Dans browser DevTools, vérifier Network → design-system.css (200 OK)
3. Si 404, vérifier les rewrites dans vercel.json

### Logo logo_moi.png ne s'affiche pas

**Cause** : Fichier trop lourd (474KB) ou chemin incorrect.

**Solution** :
1. Vérifier `/public/logo_moi.png` existe
2. Compresser l'image si nécessaire : https://tinypng.com
3. Vérifier les chemins dans HTML : `<img src="/logo_moi.png">`

### Erreur : "Redirect loop" après connexion

**Cause** : Vérification de rôle échoue en boucle.

**Solution** :
1. Vérifier que le profil a un rôle dans Supabase profiles
2. Check console browser : erreurs JavaScript ?
3. Vérifier RLS policies autorisent SELECT sur profiles

---

## 📊 Monitoring Post-Déploiement

### Vercel Analytics (recommandé)

1. Activer dans Vercel Dashboard → Analytics
2. Suivre :
   - **Page Views** : Quelle page la plus visitée ?
   - **Performance** : Temps de chargement <2s ?
   - **Errors** : Erreurs 500 backend ?

### Supabase Monitoring

1. Aller dans Supabase Dashboard → Reports
2. Vérifier :
   - **API Requests** : Volume normal ?
   - **Database Queries** : Pas de requêtes lentes (>1s) ?
   - **Auth Users** : Nombre d'inscriptions

### Logs Serverless Functions

```bash
# Voir les logs API routes
Vercel Dashboard → Deployments → [Votre deployment] → View Function Logs

# Rechercher les erreurs
Filtrer par "error" ou "ERROR"
```

---

## 🔐 Sécurité Post-Déploiement

### 1. Vérifier HTTPS

```bash
curl -I https://your-app.vercel.app/
# Doit retourner "HTTP/2 200"
```

### 2. Headers de sécurité

Vérifier avec https://securityheaders.com :
- ✅ `X-Frame-Options: DENY`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`

Vercel ajoute automatiquement ces headers.

### 3. Supabase RLS

```sql
-- Vérifier que toutes les policies sont activées
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public';

-- Doit retourner des policies pour :
-- profiles, regies, tickets, immeubles, logements, etc.
```

### 4. Rate Limiting

Vercel Pro inclut rate limiting automatique (1000 req/10s par IP).

Pour augmenter : Vercel Dashboard → Settings → Rate Limiting

---

## 🚀 Optimisations Performance

### 1. Cache assets statiques

Les fichiers dans `/public` sont automatiquement cachés par Vercel CDN :
- CSS/JS : 1 an
- Images : 1 an
- HTML : 0 (pas de cache)

### 2. Compresser images

```bash
# Si logo_moi.png trop lourd (>100KB)
npm install -g imagemin-cli
imagemin public/logo_moi.png --plugin=pngquant --out-dir=public/
```

### 3. Minifier CSS (optionnel)

```bash
npm install -g cssnano-cli
cssnano public/css/design-system.css public/css/design-system.min.css
# Puis mettre à jour les <link> vers design-system.min.css
```

### 4. Lazy load images

Dans index.html, ajouter `loading="lazy"` :
```html
<img src="/logo_moi.png" alt="Logo" loading="lazy">
```

---

## 🔄 Déploiements Futurs

### Workflow recommandé

1. **Développement local** :
   ```bash
   git checkout -b feature/nouvelle-fonctionnalite
   # Faire les modifications
   git commit -m "feat: ajouter fonctionnalité X"
   git push origin feature/nouvelle-fonctionnalite
   ```

2. **Preview deployment automatique** :
   - Vercel crée automatiquement un preview : `https://jetc-immo-git-feature-xxx.vercel.app`
   - Tester sur cette URL
   - Demander revue de code

3. **Merge en production** :
   ```bash
   git checkout main
   git merge feature/nouvelle-fonctionnalite
   git push origin main
   ```
   - Vercel redéploie automatiquement en production

### Rollback en cas de problème

```bash
# Via Vercel Dashboard
1. Aller dans Deployments
2. Trouver le dernier deployment stable
3. Cliquer ⋯ → Promote to Production
```

---

## 📝 Checklist Finale de Déploiement

### Pré-déploiement
- [ ] Variables d'environnement Vercel configurées (3 obligatoires)
- [ ] Supabase tables créées avec migrations
- [ ] RLS policies activées sur toutes les tables
- [ ] Logo logo_moi.png présent dans /public
- [ ] design-system.css présent dans /public/css
- [ ] Tous les dashboards harmonisés testés localement

### Déploiement
- [ ] Repository GitHub connecté à Vercel
- [ ] Branche main sélectionnée
- [ ] Build réussi sans erreurs
- [ ] URL de production notée

### Post-déploiement
- [ ] Landing page s'affiche correctement
- [ ] Logo visible partout
- [ ] Palette bleue (pas violet)
- [ ] Prix en CHF
- [ ] Installation admin fonctionnelle
- [ ] Inscription régie fonctionnelle
- [ ] Connexion admin → dashboard admin
- [ ] Connexion régie validée → dashboard regie
- [ ] API /api/healthcheck retourne 200 OK

### Monitoring 24h après
- [ ] Aucune erreur 500 dans logs Vercel
- [ ] Aucune erreur Supabase
- [ ] Performance <2s chargement landing page
- [ ] Au moins 1 régie inscrite et validée (test)

---

## 🎯 Métriques de Succès

| Métrique | Objectif | Comment mesurer |
|----------|----------|-----------------|
| **Uptime** | >99.9% | Vercel Analytics |
| **Page Load** | <2s | Lighthouse / WebPageTest |
| **Error Rate** | <0.1% | Vercel Function Logs |
| **Conversions** | >5 régies/mois | Supabase count(regies) |

---

## 🆘 Support

### Documentation
- Design System : `/docs/interventions/2025-12-19_ui_global_redesign.md`
- Phase 2 Dashboards : `/docs/interventions/2025-12-19_phase2_dashboards_redesign.md`
- Variables Vercel : `/VERCEL_ENV_VARS.md`

### Logs d'erreur
```bash
# Backend errors
Vercel Dashboard → Deployments → View Function Logs

# Frontend errors
Browser DevTools → Console
```

### Contacts
- **Vercel Support** : https://vercel.com/support (Pro account)
- **Supabase Support** : https://supabase.com/dashboard/support
- **GitHub Issues** : johnnyfleury87-ctrl/JETC_IMMO_SaaS/issues

---

## ✅ Conclusion

Votre application JETC_IMMO est maintenant **prête pour le déploiement Vercel** avec :

- ✅ Design system moderne harmonisé sur toutes les pages
- ✅ Logo officiel intégré
- ✅ Palette bleue/grise cohérente
- ✅ Sidebar dashboards avec navigation
- ✅ Authentification Supabase fonctionnelle
- ✅ API routes backend opérationnelles
- ✅ Responsive design (desktop/tablet/mobile)
- ✅ Documentation complète

**Prochaine étape recommandée** : Phase 3 (Burger menu mobile + Tests responsive + Accessibilité)

---

**Document créé le** : 19 décembre 2025  
**Version** : 2.0.0  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Production Ready
