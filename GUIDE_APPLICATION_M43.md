# 🚀 GUIDE D'APPLICATION M43 - ÉTAPE PAR ÉTAPE

**Date** : 6 janvier 2026  
**Durée estimée** : 10 minutes  
**Prérequis** : Accès admin au projet Supabase

---

## 📋 RÉSUMÉ

3 migrations SQL à appliquer pour ajouter :
- ✅ Table `mission_signalements` (incidents/problèmes)
- ✅ Colonnes missions (absence locataire + photos)
- ✅ Table `mission_historique_statuts` (traçabilité)
- ✅ 4 fonctions RPC + 4 vues analytiques

---

## 🎯 MÉTHODE 1 : SQL EDITOR (RECOMMANDÉ)

### Étape 1 : Ouvrir SQL Editor

1. Aller sur https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql
2. Cliquer sur **"New query"**

### Étape 2 : Copier le SQL consolidé

**Fichier à copier** : `_apply_m43_consolidated.sql`

```bash
# Afficher le contenu
cat _apply_m43_consolidated.sql

# OU copier directement dans le presse-papier (Linux)
xclip -sel clip < _apply_m43_consolidated.sql

# OU (macOS)
pbcopy < _apply_m43_consolidated.sql
```

### Étape 3 : Coller et exécuter

1. Coller le contenu complet dans le SQL Editor
2. Cliquer sur **"Run"** (en bas à droite)
3. Attendre confirmation : "Success. No rows returned"

### Étape 4 : Vérifier

```bash
# Exécuter le script de vérification
node _check_m43.js
```

**Attendu** : Tous les éléments ✅

---

## 🎯 MÉTHODE 2 : SUPABASE CLI

### Prérequis

```bash
# Installer Supabase CLI (si pas déjà fait)
npm install -g supabase

# Vérifier installation
supabase --version
```

### Étape 1 : Se connecter au projet

```bash
# Lier au projet distant
supabase link --project-ref bwzyajsrmfhrxdmfpyqy

# Entrer le mot de passe de la base de données si demandé
```

### Étape 2 : Appliquer les migrations

```bash
# Voir les migrations en attente
supabase migration list

# Appliquer toutes les migrations
supabase db push

# OU appliquer fichier par fichier
psql "$DATABASE_URL" < supabase/migrations/20260106000001_m43_mission_signalements.sql
psql "$DATABASE_URL" < supabase/migrations/20260106000002_m43_mission_champs_complementaires.sql
psql "$DATABASE_URL" < supabase/migrations/20260106000003_m43_mission_historique_statuts.sql
```

### Étape 3 : Vérifier

```bash
node _check_m43.js
```

---

## 🎯 MÉTHODE 3 : PSQL DIRECT

Si vous avez accès direct à PostgreSQL :

```bash
# Définir l'URL de connexion (voir .env.local)
export DATABASE_URL="postgresql://postgres.bwzyajsrmfhrxdmfpyqy:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Appliquer le SQL consolidé
psql "$DATABASE_URL" < _apply_m43_consolidated.sql

# Vérifier
node _check_m43.js
```

---

## ✅ VÉRIFICATION POST-APPLICATION

### Test 1 : Colonnes missions

```sql
-- Dans SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'missions' 
  AND column_name IN ('locataire_absent', 'absence_signalement_at', 'absence_raison', 'photos_urls');
```

**Attendu** : 4 lignes retournées

### Test 2 : Tables créées

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('mission_signalements', 'mission_historique_statuts');
```

**Attendu** : 2 lignes retournées

### Test 3 : Fonctions RPC

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('signaler_absence_locataire', 'ajouter_photos_mission');
```

**Attendu** : 2 lignes retournées

### Test 4 : Vues créées

```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'mission_%';
```

**Attendu** : 4+ vues retournées

---

## 🐛 EN CAS D'ERREUR

### Erreur : "relation already exists"

**Cause** : La migration a déjà été partiellement appliquée

**Solution** :
1. Utiliser les fichiers rollback dans l'ordre inverse :
   ```bash
   psql "$DATABASE_URL" < supabase/migrations/20260106000003_m43_mission_historique_statuts_rollback.sql
   psql "$DATABASE_URL" < supabase/migrations/20260106000002_m43_mission_champs_complementaires_rollback.sql
   psql "$DATABASE_URL" < supabase/migrations/20260106000001_m43_mission_signalements_rollback.sql
   ```

2. Réappliquer depuis zéro

### Erreur : "permission denied"

**Cause** : Utilisation de l'ANON_KEY au lieu de SERVICE_ROLE_KEY

**Solution** : Utiliser le SQL Editor (déjà admin) ou vérifier `$DATABASE_URL`

### Erreur : "column does not exist"

**Cause** : Les migrations doivent être appliquées dans l'ordre

**Solution** :
1. Vérifier l'ordre d'exécution
2. Utiliser `_apply_m43_consolidated.sql` qui contient tout dans l'ordre

---

## 📊 APRÈS APPLICATION

### 1. Déployer le code

```bash
git add .
git commit -m "feat: Apply M43 migrations + fix hardcoded URL + add techniciens API"
git push origin main
```

### 2. Vérifier Vercel

- Dashboard Vercel → Deployments
- Attendre le déploiement automatique
- Vérifier que les variables d'environnement sont présentes

### 3. Tester les APIs

```bash
# Test création technicien (remplacer TOKEN par un vrai token entreprise)
curl -X POST https://votre-app.vercel.app/api/techniciens/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test",
    "prenom": "Technicien",
    "email": "test.tech@exemple.fr",
    "telephone": "0601020304",
    "specialites": ["plomberie"]
  }'
```

### 4. Tester M43

```sql
-- Créer un signalement de test
INSERT INTO mission_signalements (mission_id, type_signalement, description)
VALUES ('<mission_id>', 'acces_difficile', 'Test signalement');

-- Signaler absence locataire
SELECT signaler_absence_locataire(
  '<mission_id>'::uuid,
  'Test absence'
);

-- Vérifier historique
SELECT * FROM mission_historique_details 
ORDER BY change_at DESC 
LIMIT 5;
```

---

## ⏱️ DURÉE ESTIMÉE

| Étape | Temps |
|-------|-------|
| Copier SQL | 1 min |
| Exécuter dans SQL Editor | 2 min |
| Vérifier avec `_check_m43.js` | 1 min |
| Tests post-application | 3 min |
| Déploiement Vercel | 3 min |
| **TOTAL** | **~10 min** |

---

## ✅ CHECKLIST FINALE

- [ ] Migrations M43 appliquées (3 fichiers)
- [ ] Vérification `_check_m43.js` → tout ✅
- [ ] Tests SQL manuels OK
- [ ] Code déployé sur Vercel
- [ ] API `/api/techniciens/create` testée
- [ ] RPC `signaler_absence_locataire` testée
- [ ] RPC `ajouter_photos_mission` testée
- [ ] Vue `mission_historique_details` accessible
- [ ] Rapport `AUDIT_M43_RESULT.md` lu et validé

---

**Fin du guide**  
En cas de problème, consulter [AUDIT_M43_RESULT.md](./AUDIT_M43_RESULT.md) section "Points d'attention"
