# 🔍 AUDIT PRÉ-DÉPLOIEMENT VERCEL

## ✅ RÉSUMÉ EXÉCUTIF

| Critère | État |
|---------|------|
| **État global** | ⚠️ **BLOQUANT - Corrections requises** |
| **Date audit** | 2025-12-18 11:15 UTC |
| **Commit analysé** | `8d0e213` (2025-12-18 10:57:33) |
| **Environnement** | Dev Container Ubuntu 24.04.3 LTS |
| **Auditeur** | GitHub Copilot (Claude Sonnet 4.5) |

---

## 🎯 SYNTHÈSE DES PROBLÈMES

### 🔴 **BLOQUANTS (4)**

1. **Variables d'environnement incohérentes** : Utilisation de `SUPABASE_SERVICE_KEY` au lieu de `SUPABASE_SERVICE_ROLE_KEY`
2. **Dépendances en devDependencies** : `@supabase/supabase-js` doit être en `dependencies`
3. **Clés Supabase exposées** : `.env.local` contient des vraies clés (risque Git)
4. **Aucun fichier Vercel** : Absence de `vercel.json` pour configuration déploiement

### ⚠️ **AVERTISSEMENTS (3)**

1. Fichiers SQL de backup non nettoyés
2. Documentation audit dispersée (4 fichiers)
3. Fichiers modifiés non committés

---

## 📊 DÉTAILS PAR CATÉGORIE

### 1️⃣ BASE DE DONNÉES

#### ✅ **Points validés**

| Élément | État | Détails |
|---------|------|---------|
| Schéma SQL | ✅ OK | 28 fichiers, 6092 lignes, structure cohérente |
| ENUMs complets | ✅ OK | `user_role`, `ticket_status`, `mission_status`, `plan_type` |
| RLS activé | ✅ OK | 15 tables avec RLS (profiles, regies, tickets, missions, etc.) |
| Foreign Keys | ✅ OK | Relations cohérentes |
| Triggers | ✅ OK | `handle_updated_at`, `update_mission_status`, etc. |
| Fonctions | ✅ OK | `get_user_regie_id()`, `set_ticket_regie_id()` |
| Migrations | ✅ OK | Fichiers numérotés 01→23, idempotents |
| Hotfix DDL | ✅ OK | `22c_hotfix_missions_statut_enum.sql` présent |

#### ⚠️ **Avertissements**

- **Fichiers de backup SQL** : `22_statuts_realignement.sql.backup`, `22_statuts_realignement.sql.backup2`, `22b_fix_enum_dependencies.sql` doivent être nettoyés
- **Schéma backup** : Dossier `supabase/schema_backup_20251217_091952/` à archiver

---

### 2️⃣ SÉCURITÉ

#### ✅ **Points validés**

| Élément | État | Détails |
|---------|------|---------|
| `.env` dans `.gitignore` | ✅ OK | Lignes 7-11 de `.gitignore` |
| SERVICE_ROLE frontend | ✅ OK | Absente de `src/` |
| Clés hardcodées | ✅ OK | Aucune clé JWT dans code source |
| RLS policies | ✅ OK | 74+ policies restrictives |
| Backend isolé | ✅ OK | `api/_supabase.js` utilise SERVICE_ROLE |
| Frontend isolé | ✅ OK | `src/lib/supabaseClient.js` utilise ANON |

#### 🔴 **BLOQUANT - Clés exposées**

**Fichier** : `.env.local`  
**Lignes** : 25, 32, 42  
**Problème** : Contient des vraies clés Supabase :

```bash
SUPABASE_URL=https://bwzyajsrmfhrxdmfpyqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Impact** : Risque de commit accidentel dans Git  
**Correction** :
```bash
# 1. Vérifier .gitignore
grep "\.env\.local" .gitignore

# 2. Vérifier statut Git
git status .env.local

# 3. Si non ignoré, STOPPER et corriger .gitignore
```

**⚠️ ATTENTION** : Si `.env.local` a déjà été commité :
1. Révoquer immédiatement les clés dans Dashboard Supabase
2. Générer de nouvelles clés
3. Nettoyer l'historique Git : `git filter-branch` ou BFG Repo-Cleaner

---

### 3️⃣ FRONTEND

#### ✅ **Points validés**

| Élément | État | Détails |
|---------|------|---------|
| Imports Supabase | ✅ OK | `src/lib/supabaseClient.js` propre |
| Variables env | ✅ OK | Utilise `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Aucun SERVICE_ROLE | ✅ OK | Vérifié dans `src/` |
| Console.log sensible | ✅ OK | Aucun log de secrets détecté |

#### ⚠️ **Avertissements**

- Aucune validation ESLint/TypeScript (projet en JavaScript pur)
- Pas de framework frontend (HTML/JS vanilla)

---

### 4️⃣ CONFIGURATION VERCEL

#### 🔴 **BLOQUANT - Variables incohérentes**

**Fichiers concernés** :
- `api/techniciens/planning.js` ligne 16
- `api/techniciens/list.js` ligne 16
- `api/missions/complete.js` ligne 22
- `api/missions/retards.js` ligne 16
- `api/missions/validate.js` ligne 21
- `api/missions/start.js` ligne 22
- `api/missions/assign-technicien.js` ligne 24
- `api/tickets/accept.js` ligne 23
- `api/tickets/diffuser.js` ligne 21

**Problème** :
```javascript
// ❌ INCORRECT
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// ✅ CORRECT
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

**Impact** : Variables d'environnement manquantes dans Vercel → erreurs 500  
**Correction** : Remplacer `SUPABASE_SERVICE_KEY` par `SUPABASE_SERVICE_ROLE_KEY` dans 9 fichiers

---

#### 🔴 **BLOQUANT - Dépendances incorrectes**

**Fichier** : `package.json`  
**Problème** : `@supabase/supabase-js` en `devDependencies`

```json
{
  "dependencies": {
    "dotenv": "^16.3.1"  // ❌ Seulement dotenv
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.88.0"  // ❌ Doit être en dependencies
  }
}
```

**Impact** : Module non installé en production Vercel → erreurs `Cannot find module`  
**Correction** :
```bash
npm install --save @supabase/supabase-js
npm uninstall --save-dev @supabase/supabase-js
```

---

#### 🔴 **BLOQUANT - Configuration Vercel manquante**

**Fichier manquant** : `vercel.json`  
**Impact** : Vercel ne sait pas comment router les requêtes `/api/*`

**Correction** : Créer `vercel.json` :
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
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

#### 📋 **Variables d'environnement requises Vercel**

| Variable | Type | Obligatoire | Commentaire |
|----------|------|-------------|-------------|
| `SUPABASE_URL` | Public | ✅ Oui | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✅ Oui | Clé publique ANON |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | ✅ Oui | Clé admin backend |
| `INSTALL_ADMIN_KEY` | Secret | ⚠️ Optionnel | Supprimer après 1er admin |
| `PORT` | Public | ❌ Non | Géré par Vercel |
| `NODE_ENV` | Public | ❌ Non | Auto `production` |
| `MODE` | Public | ⚠️ Optionnel | `pro` en production |

**Configuration Vercel Dashboard** :
```
Settings → Environment Variables → Add Variable
```

---

### 5️⃣ AUTRES VÉRIFICATIONS

#### ✅ **Points validés**

| Élément | État |
|---------|------|
| `.gitignore` | ✅ OK (node_modules, .env*) |
| `package.json` engines | ✅ OK (node >=18.0.0) |
| `server.js` | ✅ OK (serveur HTTP basique) |
| Dépendances installées | ✅ OK (4/4 modules) |

#### ⚠️ **Avertissements**

**Fichiers modifiés non committés** :
```
M .env.example
M api/_supabase.js
M src/lib/supabaseClient.js
?? docs/AUDIT_COMPLET_SCHEMA.md
?? docs/AUDIT_FONCTIONS_TRANSVERSES.md
?? docs/AUDIT_SCHEMA_AUTH.md
?? docs/RAPPORT_FINAL_AUDIT.md
```

**Recommendation** : Commit ces changements avant déploiement

---

## 🔧 CORRECTIFS REQUIS (PAR ORDRE DE PRIORITÉ)

### 🔴 **PRIORITÉ 1 - BLOQUANTS (à corriger AVANT déploiement)**

#### 1. Corriger variables d'environnement (9 fichiers)

```bash
# Remplacer SUPABASE_SERVICE_KEY → SUPABASE_SERVICE_ROLE_KEY
sed -i 's/SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY/g' \
  api/techniciens/planning.js \
  api/techniciens/list.js \
  api/missions/complete.js \
  api/missions/retards.js \
  api/missions/validate.js \
  api/missions/start.js \
  api/missions/assign-technicien.js \
  api/tickets/accept.js \
  api/tickets/diffuser.js
```

#### 2. Corriger dépendances package.json

```bash
npm install --save @supabase/supabase-js
npm uninstall --save-dev @supabase/supabase-js
```

#### 3. Créer vercel.json

Voir section "Configuration Vercel manquante" ci-dessus.

#### 4. Vérifier .env.local non tracké

```bash
git status .env.local
# Si affiché → DANGER, ajouter à .gitignore
```

---

### ⚠️ **PRIORITÉ 2 - RECOMMANDATIONS (avant mise en production)**

#### 1. Nettoyer fichiers SQL obsolètes

```bash
rm supabase/schema/22_statuts_realignement.sql.backup
rm supabase/schema/22_statuts_realignement.sql.backup2
rm supabase/schema/22b_fix_enum_dependencies.sql
```

#### 2. Archiver schema backup

```bash
tar -czf supabase_backup_20251217.tar.gz supabase/schema_backup_20251217_091952/
rm -rf supabase/schema_backup_20251217_091952/
```

#### 3. Consolider documentation audit

```bash
# Fusionner les 4 fichiers audit en 1 seul
cat docs/AUDIT_*.md > docs/AUDIT_COMPLET_FINAL.md
```

#### 4. Commit changements en attente

```bash
git add .env.example api/_supabase.js src/lib/supabaseClient.js
git commit -m "docs: amélioration commentaires sécurité Supabase"
```

---

## 🚫 CONCLUSION

### ❌ **DÉPLOIEMENT VERCEL : BLOQUÉ**

**Raisons** :
1. 🔴 9 fichiers API utilisent `SUPABASE_SERVICE_KEY` (variable inexistante)
2. 🔴 `@supabase/supabase-js` en devDependencies → module absent en production
3. 🔴 `vercel.json` manquant → routing API cassé
4. ⚠️ Vraies clés Supabase dans `.env.local` (risque sécurité)

### ✅ **ACTIONS REQUISES POUR DÉBLOQUER**

1. **Exécuter les 4 correctifs PRIORITÉ 1** (15 min)
2. **Tester localement** : `npm run dev` → `/api/healthcheck`
3. **Configurer variables Vercel** : Dashboard → Environment Variables
4. **Déployer** : `vercel` ou Git push vers branche connectée
5. **Vérifier RLS** : Exécuter migrations SQL dans Supabase Dashboard

### 📅 **TIMELINE ESTIMÉE**

- Correctifs techniques : **30 minutes**
- Tests locaux : **15 minutes**
- Configuration Vercel : **10 minutes**
- Déploiement + vérification : **20 minutes**

**Total** : ~1h15 avant déploiement production-ready

---

## 📋 CHECKLIST FINALE (avant commit)

- [ ] Variables d'environnement corrigées (9 fichiers)
- [ ] `package.json` dependencies corrigé
- [ ] `vercel.json` créé
- [ ] `.env.local` vérifié non tracké Git
- [ ] Tests locaux passés
- [ ] Variables configurées dans Vercel Dashboard
- [ ] Migrations SQL exécutées dans Supabase
- [ ] Documentation à jour

**Une fois cette checklist complète** → Commit autorisé :
```bash
git add -A
git commit -m "chore(audit): pre-deploy vercel validated - 2025-12-18 11:15"
```

---

**Audit généré par** : GitHub Copilot (Claude Sonnet 4.5)  
**Date** : 2025-12-18 11:15:00 UTC  
**Commit** : 8d0e213 (2025-12-18 10:57:33)
