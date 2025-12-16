# Guide de déploiement - JETC IMMO SaaS

## 📋 Vue d'ensemble

Ce guide vous accompagne dans le déploiement complet de la plateforme JETC IMMO, depuis la configuration initiale jusqu'à la mise en production.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     JETC IMMO PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Static)          Backend (Supabase)               │
│  ┌──────────────────┐      ┌───────────────────────┐        │
│  │  HTML/CSS/JS     │─────▶│  PostgreSQL           │        │
│  │  Dashboard UI    │      │  + RLS                │        │
│  │  Public Pages    │◀─────│  + Triggers           │        │
│  └──────────────────┘      │  + Functions          │        │
│                             │  + Auth               │        │
│                             └───────────────────────┘        │
│                                                               │
│  APIs (Node.js)                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  /api/tickets    /api/missions  /api/factures   │       │
│  │  /api/messages   /api/abonnements                │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Étape 1 : Configuration Supabase

### 1.1 Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com)
2. Créer un compte ou se connecter
3. Cliquer sur "New Project"
4. Choisir :
   - **Nom** : `jetc-immo-prod` (ou `jetc-immo-demo`)
   - **Database Password** : Générer un mot de passe fort
   - **Région** : Europe (West) - Paris recommended
   - **Plan** : Pro (pour production) ou Free (pour demo)

### 1.2 Récupérer les credentials

Une fois le projet créé :

1. Aller dans **Settings** → **API**
2. Noter les valeurs suivantes :

```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANT** : Ne jamais committer la `SERVICE_ROLE_KEY` dans Git !

### 1.3 Exécuter les migrations SQL

Dans l'ordre suivant, exécuter chaque fichier SQL via **SQL Editor** de Supabase :

```bash
supabase/schema/01_regies.sql
supabase/schema/02_entreprises.sql
supabase/schema/03_locataires.sql
supabase/schema/04_auth_users.sql
supabase/schema/05_autorisation.sql
supabase/schema/06_stats_admin.sql
supabase/schema/07_tickets.sql
supabase/schema/08_stats_tickets.sql
supabase/schema/14_missions.sql
supabase/schema/15_techniciens.sql
supabase/schema/16_intervention.sql
supabase/schema/17_facturation.sql
supabase/schema/18_messagerie.sql
supabase/schema/19_abonnements.sql
```

**Méthode 1 : Via UI Supabase**
1. Ouvrir **SQL Editor**
2. Copier-coller le contenu de chaque fichier
3. Cliquer sur "Run"
4. Vérifier qu'il n'y a pas d'erreurs

**Méthode 2 : Via CLI Supabase**
```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref xxxxxxxxxxxxx

# Exécuter les migrations
supabase db push
```

### 1.4 Vérifier le schéma

Exécuter le script de validation :

```bash
# Configurer les variables d'environnement
export SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

# Valider
./scripts/validate-schema.sh
```

Sortie attendue :
```
✅ SCHÉMA COMPLET VALIDÉ
Tables    : 13/13
Fonctions : 21/21
Vues      : 9/9
```

---

## 🔐 Étape 2 : Configuration de l'authentification

### 2.1 Activer les providers

Dans Supabase : **Authentication** → **Providers**

1. **Email** : Activé par défaut ✅
2. **Magic Link** (optionnel) : Pour connexion sans mot de passe
3. **OAuth** (optionnel) : Google, GitHub, etc.

### 2.2 Configurer les templates d'emails

**Authentication** → **Email Templates**

Personnaliser les emails :
- Confirmation d'inscription
- Réinitialisation de mot de passe
- Invitation utilisateur

### 2.3 Créer le premier admin JTEC

Via **SQL Editor** :

```sql
-- Créer un utilisateur dans auth.users
INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
) VALUES (
    'admin@jetc.com',
    crypt('MotDePasseSecurise123!', gen_salt('bf')),
    now(),
    now(),
    now()
);

-- Récupérer l'ID généré
SELECT id, email FROM auth.users WHERE email = 'admin@jetc.com';

-- Créer l'entrée dans auth_users (remplacer UUID par l'ID ci-dessus)
INSERT INTO public.auth_users (id, email, role)
VALUES ('uuid-from-above', 'admin@jetc.com', 'admin_jtec');
```

---

## 🖥️ Étape 3 : Déploiement du backend (APIs)

### 3.1 Préparer l'environnement

Créer un fichier `.env` :

```bash
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_ANON_KEY=eyJhbGci...

# Serveur
PORT=3000
NODE_ENV=production

# CORS (optionnel)
ALLOWED_ORIGINS=https://jetc-immo.com,https://www.jetc-immo.com
```

### 3.2 Option A : Déploiement sur Vercel

1. Créer un compte sur [vercel.com](https://vercel.com)
2. Installer Vercel CLI :
   ```bash
   npm install -g vercel
   ```

3. Configurer `vercel.json` :
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "server.js"
       }
     ],
     "env": {
       "SUPABASE_URL": "@supabase-url",
       "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
       "NODE_ENV": "production"
     }
   }
   ```

4. Déployer :
   ```bash
   vercel --prod
   ```

5. Configurer les secrets :
   ```bash
   vercel secrets add supabase-url "https://xxxxx.supabase.co"
   vercel secrets add supabase-service-key "eyJhbGci..."
   ```

### 3.3 Option B : Déploiement sur Heroku

1. Créer une app Heroku :
   ```bash
   heroku create jetc-immo-api
   ```

2. Configurer les variables d'environnement :
   ```bash
   heroku config:set SUPABASE_URL="https://xxxxx.supabase.co"
   heroku config:set SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
   heroku config:set NODE_ENV=production
   ```

3. Créer `Procfile` :
   ```
   web: node server.js
   ```

4. Déployer :
   ```bash
   git push heroku main
   ```

### 3.4 Option C : Déploiement sur VPS (DigitalOcean, AWS EC2, etc.)

1. Se connecter au serveur :
   ```bash
   ssh root@your-server-ip
   ```

2. Installer Node.js :
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Installer PM2 (gestionnaire de processus) :
   ```bash
   sudo npm install -g pm2
   ```

4. Cloner le repo :
   ```bash
   git clone https://github.com/your-org/jetc-immo.git
   cd jetc-immo
   ```

5. Installer les dépendances :
   ```bash
   npm install --production
   ```

6. Créer `.env` avec les credentials

7. Démarrer avec PM2 :
   ```bash
   pm2 start server.js --name jetc-api
   pm2 save
   pm2 startup
   ```

8. Configurer Nginx en reverse proxy :
   ```nginx
   server {
       listen 80;
       server_name api.jetc-immo.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. Installer Certbot pour SSL :
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.jetc-immo.com
   ```

---

## 🌐 Étape 4 : Déploiement du frontend

### 4.1 Option A : Netlify (Recommandé pour static)

1. Créer un compte sur [netlify.com](https://netlify.com)

2. Créer `netlify.toml` :
   ```toml
   [build]
     publish = "public"
     command = "echo 'No build step'"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

3. Déployer via CLI :
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod
   ```

4. Ou via GitHub :
   - Connecter le repo GitHub
   - Netlify déploiera automatiquement à chaque push

### 4.2 Option B : Vercel

```bash
vercel --prod
```

### 4.3 Option C : Hébergement statique (Nginx)

1. Copier les fichiers sur le serveur :
   ```bash
   scp -r public/* root@your-server:/var/www/jetc-immo/
   ```

2. Configurer Nginx :
   ```nginx
   server {
       listen 80;
       server_name jetc-immo.com www.jetc-immo.com;
       root /var/www/jetc-immo;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:3000;
       }
   }
   ```

3. SSL avec Certbot :
   ```bash
   sudo certbot --nginx -d jetc-immo.com -d www.jetc-immo.com
   ```

---

## 🔧 Étape 5 : Configuration des variables frontend

Dans chaque dashboard HTML, mettre à jour la configuration :

```javascript
// public/admin/dashboard.html
// public/regie/dashboard.html
// etc.

const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const API_BASE_URL = 'https://api.jetc-immo.com'; // ou URL Vercel/Heroku
```

**Option avec variables d'environnement (build step) :**

Créer `public/config.js` :
```javascript
window.APP_CONFIG = {
    SUPABASE_URL: '%%SUPABASE_URL%%',
    SUPABASE_ANON_KEY: '%%SUPABASE_ANON_KEY%%',
    API_BASE_URL: '%%API_BASE_URL%%'
};
```

Script de remplacement :
```bash
#!/bin/bash
sed -i "s|%%SUPABASE_URL%%|$SUPABASE_URL|g" public/config.js
sed -i "s|%%SUPABASE_ANON_KEY%%|$SUPABASE_ANON_KEY|g" public/config.js
sed -i "s|%%API_BASE_URL%%|$API_BASE_URL|g" public/config.js
```

---

## 📊 Étape 6 : Données de démonstration (DEMO env)

### 6.1 Créer un script de seed

`scripts/seed-demo.js` :

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
    console.log('🌱 Seeding demo data...');
    
    // 1. Créer 3 régies
    const regies = await Promise.all([
        supabase.from('regies').insert({ nom: 'Régie Paris Centre', email: 'paris@demo.com' }).select().single(),
        supabase.from('regies').insert({ nom: 'Régie Lyon', email: 'lyon@demo.com' }).select().single(),
        supabase.from('regies').insert({ nom: 'Régie Marseille', email: 'marseille@demo.com' }).select().single()
    ]);
    
    // 2. Créer 5 entreprises
    const entreprises = await Promise.all([
        supabase.from('entreprises').insert({ nom: 'PlombiPro', categorie: 'plomberie', email: 'contact@plombipro.com' }).select().single(),
        supabase.from('entreprises').insert({ nom: 'ElecTech', categorie: 'electricite', email: 'contact@electech.com' }).select().single(),
        // ... etc
    ]);
    
    // 3. Créer 10 locataires
    // 4. Créer 20 tickets réalistes
    // 5. Créer 15 missions avec différents statuts
    // 6. Créer 10 factures
    
    console.log('✅ Demo data seeded!');
}

seed();
```

Exécuter :
```bash
node scripts/seed-demo.js
```

---

## 🔍 Étape 7 : Tests et validation

### 7.1 Tests E2E

```bash
# Configurer les credentials de test
export SUPABASE_URL="https://xxxxx-demo.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

# Exécuter les tests
node tests/integration.e2e.test.js
```

Résultat attendu :
```
🎉 PARCOURS COMPLET VALIDÉ - Aucune régression!
✓ 50/50 tests réussis
```

### 7.2 Tests de charge (optionnel)

Utiliser Artillery ou k6 :

```yaml
# artillery.yml
config:
  target: 'https://api.jetc-immo.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Create ticket"
    flow:
      - post:
          url: "/api/tickets/create"
          json:
            titre: "Test ticket"
            categorie: "plomberie"
```

```bash
artillery run artillery.yml
```

---

## 📈 Étape 8 : Monitoring et observabilité

### 8.1 Supabase Dashboard

- **Monitoring** : CPU, Mémoire, Connexions DB
- **Logs** : Requêtes SQL, Erreurs
- **Performance** : Requêtes lentes

### 8.2 Sentry (Erreurs frontend/backend)

1. Créer un projet sur [sentry.io](https://sentry.io)

2. Ajouter au frontend :
   ```html
   <script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
   <script>
   Sentry.init({
       dsn: "https://xxxxx@sentry.io/xxxxx",
       environment: "production"
   });
   </script>
   ```

3. Ajouter au backend :
   ```javascript
   const Sentry = require('@sentry/node');
   Sentry.init({ dsn: "https://xxxxx@sentry.io/xxxxx" });
   ```

### 8.3 Uptime monitoring

Utiliser UptimeRobot, Pingdom ou StatusCake pour surveiller :
- `https://jetc-immo.com` (frontend)
- `https://api.jetc-immo.com/health` (API)

---

## 🔒 Étape 9 : Sécurité

### 9.1 Checklist de sécurité

- [ ] RLS activé sur toutes les tables
- [ ] SERVICE_ROLE_KEY jamais exposée côté client
- [ ] HTTPS activé (Certbot)
- [ ] CORS configuré (seulement domaines autorisés)
- [ ] Rate limiting activé sur les APIs
- [ ] Mots de passe admin forts (>12 caractères)
- [ ] 2FA activé pour comptes admin
- [ ] Logs d'audit activés
- [ ] Backups automatiques configurés

### 9.2 Rate Limiting

Ajouter au `server.js` :

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // max 100 requêtes par IP
});

app.use('/api/', limiter);
```

### 9.3 Backups Supabase

Dans **Settings** → **Backups** :
- Activer les backups quotidiens
- Rétention : 30 jours minimum
- Tester la restauration mensuelle

---

## 🚦 Étape 10 : Checklist de déploiement

### Environnement DEMO

- [ ] Base de données Supabase créée
- [ ] Schéma SQL appliqué (13 tables, 21 fonctions, 9 vues)
- [ ] Données de démo injectées
- [ ] Frontend déployé sur Netlify/Vercel
- [ ] Backend déployé
- [ ] Variables d'environnement configurées
- [ ] HTTPS activé
- [ ] Tests E2E réussis
- [ ] 1 admin JTEC créé
- [ ] Documentation accessible

### Environnement PRODUCTION

- [ ] Tous les items DEMO validés
- [ ] Plan Supabase Pro activé
- [ ] Backups automatiques configurés
- [ ] Monitoring activé (Sentry, Uptime)
- [ ] Nom de domaine configuré
- [ ] SSL/TLS actif
- [ ] Rate limiting en place
- [ ] CORS restreint aux domaines prod
- [ ] Logs centralisés
- [ ] Alertes configurées (Slack/Email)
- [ ] Plan de disaster recovery documenté
- [ ] Équipe formée à l'utilisation

---

## 📞 Support et maintenance

### Logs

**Supabase** :
- Dashboard → Logs → Database

**Backend (PM2)** :
```bash
pm2 logs jetc-api
pm2 monit
```

**Frontend** :
- Console navigateur
- Sentry errors

### Mise à jour

```bash
# Backend
git pull origin main
npm install
pm2 restart jetc-api

# Frontend
git pull origin main
# Redéploiement automatique via Netlify/Vercel
```

### Rollback

**Supabase** :
- Restore from backup via Dashboard

**Backend** :
```bash
git revert HEAD
git push origin main
```

**Frontend** :
- Rollback via Netlify/Vercel dashboard

---

## 🎓 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Documentation PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- Support JETC IMMO : support@jetc-immo.com

---

**Version** : 1.0.0  
**Date** : Décembre 2025  
**Auteur** : Équipe JETC IMMO
