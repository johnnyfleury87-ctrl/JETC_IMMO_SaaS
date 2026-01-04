# FIX M30 - Correction mode_diffusion entreprises

## 🔥 Problème identifié

**Erreur production** :
```
new row for relation "regies_entreprises"
violates check constraint "check_mode_diffusion"
```

**Cause racine** :
- **Schema DB** (`10_entreprises.sql`) : `CHECK (mode_diffusion IN ('general', 'restreint'))`
- **Migration M29** : utilisait `'actif'`, `'silencieux'` ❌
- **Frontend** : envoyait `'actif'` ❌
- **Backend API** : validait `'actif'`, `'silencieux'` ❌

## ✅ Solution appliquée - Migration M30

### 1. Fichier créé
**`supabase/migrations/20251227000600_m30_fix_mode_diffusion.sql`**

Corrections :
- ✅ `create_entreprise_simple()` : default `'restreint'`, valide `IN ('general', 'restreint')`
- ✅ `create_entreprise_with_profile()` : idem
- ✅ `toggle_entreprise_mode()` : idem
- ✅ Ajout logs RAISE NOTICE pour debug

### 2. Frontend corrigé
**`public/regie/entreprises.html`**

Changements :
```diff
- p_mode_diffusion: 'actif'
+ p_mode_diffusion: 'restreint'

- mode_diffusion: 'actif'
+ mode_diffusion: 'restreint'
```

### 3. Backend API corrigé
**`api/regie/create-entreprise-account.js`**

Changements :
```diff
- mode_diffusion = 'actif'
+ mode_diffusion = 'restreint'

- if (!['actif', 'silencieux'].includes(mode_diffusion))
+ if (!['general', 'restreint'].includes(mode_diffusion))
```

## 📋 Valeurs mode_diffusion définitives

### Table `regies_entreprises`

| Valeur | Signification | Comportement |
|--------|---------------|--------------|
| `general` | Tous les tickets | Entreprise voit tous les tickets en statut `en_attente` |
| `restreint` | Sur assignation | Entreprise voit uniquement les tickets qui lui sont assignés |

### Contrainte CHECK
```sql
ALTER TABLE regies_entreprises 
ADD CONSTRAINT check_mode_diffusion 
CHECK (mode_diffusion IN ('general', 'restreint'));
```

**Default** : `'restreint'` (sécurisé par défaut)

## 🚀 Déploiement

```bash
# 1. Commit
git add -A
git commit -m "fix(db): correct mode_diffusion values (general/restreint) - M30"

# 2. Push
git push origin main

# 3. Appliquer M30 en production (Supabase SQL Editor)
# Copier le contenu de 20251227000600_m30_fix_mode_diffusion.sql
# Exécuter dans SQL Editor

# 4. Redéployer Vercel
vercel --prod
```

## 🧪 Tests post-déploiement

### Test 1 : Validation contrainte
```sql
-- Doit réussir
INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
VALUES ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'general');

-- Doit échouer
INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
VALUES ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'actif');
-- Error: check_mode_diffusion violated
```

### Test 2 : RPC create_entreprise_simple
```sql
-- Mode restreint (default)
SELECT create_entreprise_simple('Test Ent', 'test@test.ch');

-- Mode general (explicite)
SELECT create_entreprise_simple(
  'Test Ent 2', 
  'test2@test.ch',
  p_mode_diffusion := 'general'
);

-- Doit échouer
SELECT create_entreprise_simple(
  'Test Ent 3', 
  'test3@test.ch',
  p_mode_diffusion := 'actif'
);
-- Error: mode_diffusion doit être general ou restreint (reçu: actif)
```

### Test 3 : Frontend création entreprise
```javascript
// Depuis public/regie/entreprises.html
// 1. Créer entreprise sans compte → doit passer
// 2. Vérifier dans DB :
SELECT mode_diffusion FROM regies_entreprises 
WHERE entreprise_id = '<dernière_entreprise_créée>';
-- Résultat attendu: 'restreint'
```

### Test 4 : API création avec compte
```bash
curl -X POST https://your-domain.vercel.app/api/regie/create-entreprise-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Test API",
    "email": "api@test.ch",
    "mode_diffusion": "general"
  }'

# Résultat attendu: 201 Created
# { "success": true, "entreprise_id": "...", "credentials": {...} }
```

## 🔍 Vérifications logs

### Logs Supabase (après M30)
```
NOTICE: [create_entreprise_simple] regie_id=..., mode_diffusion=restreint
NOTICE: [create_entreprise_with_profile] regie_id=..., profile_id=..., mode_diffusion=restreint
```

### Logs Vercel Function
```
[CREATE-ENTREPRISE] User authenticated: ...
[CREATE-ENTREPRISE] Regie validated: ...
[CREATE-ENTREPRISE] Creating Auth user...
[CREATE-ENTREPRISE] Profile created: ...
[CREATE-ENTREPRISE] Calling RPC create_entreprise_with_profile...
[CREATE-ENTREPRISE] SUCCESS! Entreprise ID: ...
```

## ⚠️ Points d'attention

### Ne pas confondre avec mode_diffusion tickets
La table **`tickets`** utilise des valeurs différentes :
- `'public'` : ticket visible par toutes les entreprises en mode `general`
- `'assigné'` : ticket visible uniquement par l'entreprise assignée

**Tableaux concernés** :
- `regies_entreprises.mode_diffusion` → `'general'` | `'restreint'`
- `tickets.mode_diffusion` → `'public'` | `'assigné'`

### Migration historique
**Ne PAS modifier** les migrations déjà appliquées (M29).
M30 corrige **en place** (CREATE OR REPLACE) sans toucher aux policies RLS validées.

## 📚 Références

- Schema DB : `supabase/schema/10_entreprises.sql` (ligne 86)
- Migration M29 : `supabase/migrations/20251227000500_m29_rpc_create_entreprise_complete.sql`
- Migration M30 : `supabase/migrations/20251227000600_m30_fix_mode_diffusion.sql`
- Frontend : `public/regie/entreprises.html` (lignes 898, 932)
- Backend API : `api/regie/create-entreprise-account.js` (lignes 85, 94)

## ✅ Checklist validation

- [ ] M30 appliquée en DB Supabase
- [ ] Frontend redéployé (Vercel)
- [ ] Backend API redéployé (Vercel)
- [ ] Test création entreprise sans compte ✅
- [ ] Test création entreprise avec compte ✅
- [ ] Vérification contrainte CHECK respectée
- [ ] Logs Supabase montrent valeurs correctes
- [ ] Aucune erreur `check_mode_diffusion violated`
