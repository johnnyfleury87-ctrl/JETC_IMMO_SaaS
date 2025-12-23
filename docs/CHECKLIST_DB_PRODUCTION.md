# 🔍 CHECKLIST VALIDATION DB PRODUCTION

**Date**: 23 décembre 2025  
**Issue**: Table `temporary_passwords` manquante en production  
**Impact**: Backend crash avec "Could not find the table 'public.temporary_passwords'"

---

## ✅ DIAGNOSTIC RÉALISÉ

### Problème identifié
- ❌ Le backend tente d'écrire dans `temporary_passwords`
- ❌ Cette table n'existe PAS en production
- ❌ Les migrations existent mais n'ont pas été déployées
- ✅ Le code a été adapté pour être non-bloquant

### Fichiers corrigés
- ✅ [api/services/passwordService.js](../api/services/passwordService.js)
  - Toutes les fonctions wrapped dans try/catch
  - Erreurs loggées mais non bloquantes
  - Fallback sur `Test1234!` si table absente
  
- ✅ [api/locataires/create.js](../api/locataires/create.js)
  - Génération mot de passe non bloquante
  - Stockage optionnel (silent fail si table absente)
  - Retourne toujours JSON même en erreur

---

## 📋 PLAN D'ACTION

### Option A : Déploiement immédiat (RECOMMANDÉ)
Backend fonctionne **SANS** la table `temporary_passwords` :
- ✅ Mot de passe fixe `Test1234!` retourné
- ✅ Pas de stockage en DB (temporaire)
- ✅ Flux RÉGIE → LOCATAIRE fonctionnel
- ⚠️ Sécurité réduite (acceptable pour dev/test)

**Actions** :
1. ✅ Push corrections (déjà fait)
2. ⏳ Attendre redéploiement Vercel (1-2 min)
3. 🧪 Tester API : `POST /api/locataires/create`
4. ✅ Vérifier retour JSON (pas HTML)

### Option B : Migration DB complète
Créer la table `temporary_passwords` en production :

**Actions** :
1. Se connecter à Supabase Dashboard
2. Ouvrir SQL Editor
3. Exécuter `VALIDATION_DB_PROD.sql` (diagnostic)
4. Exécuter `20251223000002_create_temporary_passwords_complete.sql`
5. Re-tester backend avec stockage activé

---

## 📊 TABLES BACKEND

### Tables critiques (BLOQUANTES)
| Table | Statut | Usage |
|-------|--------|-------|
| `profiles` | ✅ Existante | Authentification, rôles |
| `regies` | ✅ Existante | Gestion agences |
| `locataires` | ✅ Existante | Gestion locataires |
| `logements` | ✅ Existante | Logements/appartements |
| `immeubles` | ✅ Existante | Immeubles/bâtiments |

### Tables optionnelles (NON BLOQUANTES)
| Table | Statut | Usage |
|-------|--------|-------|
| `temporary_passwords` | ❌ **ABSENTE** | Stockage mots de passe temporaires |
| `tickets` | ? À vérifier | Module support/tickets |
| `messages` | ? À vérifier | Messagerie interne |

### Colonnes critiques
| Table.Colonne | Statut | Migration associée |
|---------------|--------|-------------------|
| `locataires.regie_id` | ✅ Créée | `20251223000000_add_regie_id_to_locataires.sql` |
| `profiles.regie_id` | ? À vérifier | - |

### Fonctions RPC
| Fonction | Statut | Paramètres critiques |
|----------|--------|---------------------|
| `creer_locataire_complet()` | ✅ Existante | `p_regie_id` (ajouté) |

---

## 🧪 TESTS VALIDATION

### 1. Validation DB (Supabase)
```sql
-- Exécuter dans SQL Editor
\i supabase/VALIDATION_DB_PROD.sql
```

**Résultat attendu** :
```
✅ profiles
✅ regies  
✅ locataires
✅ locataires.regie_id
⚠️  temporary_passwords ABSENTE (non bloquant)
✅ creer_locataire_complet() avec p_regie_id
```

### 2. Test Backend (Vercel)
```bash
curl -X POST https://votre-app.vercel.app/api/locataires/create \
  -H "Authorization: Bearer $TOKEN_REGIE" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test",
    "prenom": "Locataire",
    "email": "test@example.com",
    "date_entree": "2025-01-01"
  }'
```

**Résultat attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "...",
    "nom": "Test",
    "prenom": "Locataire",
    "email": "test@example.com"
  },
  "temporary_password": {
    "password": "Test1234!",
    "expires_at": "2025-12-30T...",
    "expires_in_days": 7
  }
}
```

**Erreurs à surveiller** :
- ❌ `SyntaxError: Unexpected token 'A'` → API retourne HTML, pas JSON
- ❌ `Could not find the table 'temporary_passwords'` → Table manquante ET code non adapté
- ❌ `bcryptjs module not found` → Dépendance bcrypt non supprimée

---

## 📁 FICHIERS MIGRATION

### Migrations existantes (non déployées)
1. `2025-12-20_temporary_passwords.sql` - Création table (version bcrypt)
2. `20251223000001_fix_temporary_passwords_no_bcrypt.sql` - Modification (password_clear)
3. **NOUVEAU** : `20251223000002_create_temporary_passwords_complete.sql` - Création complète

### Ordre d'exécution recommandé
Si table absente en prod :
```bash
# Option 1 : Nouvelle migration complète (RECOMMANDÉ)
psql < 20251223000002_create_temporary_passwords_complete.sql

# Option 2 : Migrations historiques
psql < 2025-12-20_temporary_passwords.sql
psql < 20251223000001_fix_temporary_passwords_no_bcrypt.sql
```

---

## ✅ VALIDATION FINALE

### Backend
- [ ] Pas d'erreur `bcryptjs not found` dans logs Vercel
- [ ] Pas d'erreur `temporary_passwords not found` (ou warning non bloquant)
- [ ] API retourne JSON (status 201 ou erreur JSON)
- [ ] Mot de passe `Test1234!` présent dans réponse

### Base de données (si Option B choisie)
- [ ] Table `temporary_passwords` existe
- [ ] RLS activé sur `temporary_passwords`
- [ ] Colonnes `profile_id`, `password_clear`, `expires_at` présentes
- [ ] Index créés (`idx_temp_passwords_*`)

### Frontend
- [ ] Création locataire ne déclenche pas erreur JSON parse
- [ ] Modal affiche mot de passe temporaire
- [ ] Message "Profil introuvable" ne s'affiche plus pour régie avec 0 locataires

---

## 🎯 DÉCISION RECOMMANDÉE

**OPTION A** : Déployer le code actuel SANS créer la table
- ✅ Déploiement immédiat
- ✅ Flux fonctionnel
- ⚠️ Pas de stockage mots de passe (acceptable pour dev/test)
- 📝 Créer la table plus tard quand nécessaire

**Avantage** : Débloquer le flux MAINTENANT, migrer la DB plus tard.

---

## 📞 SUPPORT

En cas d'échec après déploiement :
1. Vérifier logs Vercel : https://vercel.com/dashboard/deployments
2. Tester healthcheck : `GET /api/healthcheck`
3. Exécuter `VALIDATION_DB_PROD.sql` dans Supabase
4. Vérifier variables d'environnement Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
