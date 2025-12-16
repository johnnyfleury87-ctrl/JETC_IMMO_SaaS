# JETC_IMMO SaaS

**Plateforme de gestion des interventions techniques immobilières**

Version : 1.0.0  
Statut : **ÉTAPE 0 - Initialisé** ✅

---

## 📋 Projet

JETC_IMMO est une application complète permettant de gérer :
- Régies immobilières
- Immeubles et logements
- Locataires
- Tickets d'intervention
- Entreprises et techniciens
- Missions techniques
- Facturation et abonnements

---

## 🏗️ Architecture

### Stack technique

- **Backend** : Node.js + Supabase
- **Base de données** : PostgreSQL (via Supabase)
- **Authentification** : Supabase Auth
- **Sécurité** : Row Level Security (RLS)
- **Storage** : Supabase Storage
- **Déploiement** : Vercel

### Modes de fonctionnement

- **MODE DEMO** : Simulation frontend, aucune donnée réelle
- **MODE PRO** : Mode production avec données persistées

---

## 🚀 Installation

### Prérequis

- Node.js >= 18.0.0
- npm ou yarn
- Compte Supabase (pour MODE PRO)

### Installation des dépendances

```bash
npm install
```

### Configuration

1. Copier le fichier d'environnement :
```bash
cp .env.example .env.local
```

2. Remplir les variables dans `.env.local` :
```env
MODE=demo
SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

---

## 🧪 Tests

### Test de démarrage local

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### Test de la route healthcheck

#### Option 1 : Navigateur
Ouvrir : `http://localhost:3000/api/healthcheck`

#### Option 2 : cURL
```bash
curl http://localhost:3000/api/healthcheck
```

#### Réponse attendue
```json
{
  "ok": true,
  "timestamp": "2025-12-16T...",
  "mode": "demo",
  "environment": {
    "SUPABASE_URL": true,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "MODE": "demo"
  },
  "version": "1.0.0",
  "project": "JETC_IMMO"
}
```

---

## 📁 Structure du projet

```
/workspaces/JETC_IMMO_SaaS/
├── api/                          # Routes API backend
│   ├── _supabase.js             # Client Supabase backend (service_role)
│   └── healthcheck.js           # Route de vérification
├── src/                          # Code frontend
│   └── lib/
│       └── supabaseClient.js    # Client Supabase frontend (anon key)
├── supabase/                     # SQL et configuration Supabase
│   ├── schema/                  # Schéma de base de données
│   │   ├── 01_extensions.sql   # Extensions PostgreSQL
│   │   └── 02_enums.sql        # Types énumérés
│   └── policies/                # RLS (Étape 7)
├── public/                       # Fichiers statiques (à créer)
├── server.js                     # Serveur de développement
├── package.json                  # Dépendances
├── .env.example                 # Template de configuration
├── .gitignore                   # Fichiers ignorés
└── # JETC IMMO SaaS - Plateforme de gestion d'interventions immobilières

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-15-blue.svg)
![Tests](https://img.shields.io/badge/tests-351%20passing-brightgreen.svg)

## 📋 Vue d'ensemble

**JETC IMMO** est une plateforme SaaS complète de gestion d'interventions pour le secteur immobilier, connectant locataires, régies, entreprises et techniciens.

### Statistiques

- **16 étapes** complétées
- **13 tables** PostgreSQL avec RLS
- **21 fonctions** métier
- **9 vues** statistiques
- **351 tests** automatisés
- **5 rôles** utilisateurs
- **3 plans** tarifaires

## 🚀 Installation rapide

```bash
git clone https://github.com/johnnyfleury87-ctrl/JETC_IMMO_SaaS.git
cd JETC_IMMO_SaaS
npm install
cp .env.example .env
# Éditer .env avec vos credentials Supabase
npm start
```

## 📚 Documentation

- [**Guide des Statuts**](STATUTS_GUIDE.md) - ⭐ Source de vérité pour la logique métier des statuts
- [Validation Réalignement Statuts](VALIDATION_REALIGNEMENT_STATUTS.md) - Validation de la logique officielle (27 tests ✅)
- [Guide de déploiement](DEPLOYMENT.md)
- [Documentation par étape](VALIDATION_ETAPE_15.md)
- Voir les autres fichiers VALIDATION_ETAPE_*.md pour le détail

## ✨ Fonctionnalités clés

- Gestion tickets et missions
- Planning techniciens
- Facturation automatique
- Messagerie intégrée
- Abonnements SaaS (Basic/Pro/Enterprise)
- Analytics temps réel

## 🧪 Tests

```bash
npm test                          # 351 tests
node tests/integration.e2e.test.js  # Tests E2E
```

## 📞 Support

Email : support@jetc-immo.com

---

**Version 1.0.0 - Décembre 2025**                    # Ce fichier
```

---

## ✅ Critères de validation ÉTAPE 0

- [x] Arborescence créée
- [x] Fichiers de configuration présents
- [x] Clients Supabase séparés (frontend/backend)
- [x] Route healthcheck fonctionnelle
- [x] Structure SQL de base créée
- [x] MODE=demo actif par défaut
- [x] Projet démarre en local

---

## 🔒 Sécurité

### Règles absolues

1. **Ne JAMAIS commit le fichier `.env.local`**
2. **Ne JAMAIS exposer la `SERVICE_ROLE_KEY` au frontend**
3. **Toujours vérifier les rôles côté backend**
4. **Les RLS sont obligatoires (Étape 7)**
5. **MODE DEMO et MODE PRO sont totalement isolés**

---

## 📝 Prochaines étapes

- ✅ **ÉTAPE 0** - Initialisation (TERMINÉE)
- ✅ **ÉTAPE 1** - Landing page & choix DEMO/PRO (TERMINÉE)
- ✅ **ÉTAPE 2** - Authentification PRO (TERMINÉE)
- ✅ **ÉTAPE 3** - Profils & rôles (TERMINÉE)
- ✅ **ÉTAPE 4** - Structure immobilière (TERMINÉE)
- ✅ **ÉTAPE 5** - Création de tickets (TERMINÉE)
- ⏳ **ÉTAPE 6** - À venir
- ⏳ **ÉTAPE 4** - Structure immobilière
- ... (voir document JETC_IMMO complet)

---

## 📚 Documentation

- Document de référence : `JETCv1.pdf`
- Ce document est la **source de vérité unique** du projet

---

## 🆘 Support

En cas de problème :
1. Vérifier que toutes les variables d'environnement sont configurées
2. Vérifier les logs du serveur
3. Tester la route `/api/healthcheck`
4. Vérifier que Node.js >= 18.0.0

---

**JETC_IMMO** - Gestion intelligente des interventions immobilières
