# 🚨 HOTFIX M57.1 - RLS RÉGIES + AUTH PDF

## 🎯 BUGS CORRIGÉS

### Bug 1: Régie 406 PGRST116 "Cannot coerce to single JSON object"
**Cause :** `.single()` sur requête `regies` qui retourne 0 rows (RLS bloquait l'accès)

**Symptôme :**
```
Error: {"code":"PGRST116","message":"Cannot coerce the result to a single JSON object"}
Console: PGRST116 + requête retourne 0 rows
```

**Corrections appliquées :**
1. ✅ `public/regie/factures.html` ligne 505 : `.single()` → `.maybeSingle()`
2. ✅ Message d'erreur précis : "Profil régie incomplet" au lieu de "Erreur d'authentification"
3. ✅ Migration M57.1 : RLS policies sur table `regies` (MANQUAIT dans schéma original)

### Bug 2: PDF Entreprise 403 "Accès refusé"
**Cause :** Logique d'auth incorrecte dans `api/facture-pdf.js` (vérifiait `user.id` au lieu de role)

**Symptôme :**
```
GET /api/facture-pdf?facture_id=xxx → 403
{"error":"Accès refusé"}
```

**Corrections appliquées :**
1. ✅ `api/facture-pdf.js` lignes 69-88 : Logique d'auth refactorisée
   - Entreprise : vérifie `facture.entreprise_id === user.id`
   - Régie : vérifie `facture.regie_id === user.id`
   - Admin : accès total
2. ✅ `.single()` → `.maybeSingle()` sur profiles
3. ✅ Logs détaillés pour debug

---

## 📦 FICHIERS MODIFIÉS

### Frontend
- [x] `public/regie/factures.html` (ligne 505 : maybeSingle + message clair)

### Backend
- [x] `api/facture-pdf.js` (lignes 69-88 : auth logic corrigée)

### Migration SQL
- [x] `supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql`

---

## 🚀 DÉPLOIEMENT

### ÉTAPE 1 : Migration SQL (URGENT)
```sql
-- Dans Supabase Dashboard → SQL Editor
-- Exécuter : supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql
```

**Résultat attendu :**
```
✅ ALTER TABLE regies ENABLE ROW LEVEL SECURITY
✅ CREATE POLICY regies_read_self (Régie lit id = auth.uid())
✅ CREATE POLICY regies_admin_read_all (Admin tout lire)
✅ CREATE POLICY regies_entreprise_read_validated (Entreprise lit validées)
✅ CREATE POLICY regies_update_self (Régie update sa ligne)
✅ ALTER TABLE profiles ADD COLUMN regie_id (si manquant)
✅ UPDATE profiles SET regie_id (sync avec regies.id)
✅ CREATE FUNCTION debug_regie_access() (helper debug)
```

### ÉTAPE 2 : Push code
```bash
git add public/regie/factures.html
git add api/facture-pdf.js
git add supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql
git commit -m "M57.1 HOTFIX: RLS regies + auth PDF"
git push origin main
```

**Vercel déploie automatiquement le code.**

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Debug RLS Régie (SQL)
```sql
-- Se connecter en tant que Régie dans Supabase SQL Editor
-- Exécuter :
SELECT * FROM debug_regie_access();

-- Résultat attendu :
-- user_id         : <UUID de la régie>
-- user_email      : regie@example.com
-- profile_role    : regie
-- profile_regie_id: <UUID> (même que user_id)
-- regie_exists    : true
-- regie_nom       : "Nom Régie"
-- can_read_self   : true ✅
```

Si `can_read_self = false` → RLS mal configuré (refaire migration).

### Test 2 : Régie charge page Factures
1. **Connexion :** Régie login
2. **Action :** Cliquer menu "Factures"
3. **✅ ATTENDU :**
   - Page charge sans erreur
   - Liste factures affichée (ou "Aucune facture")
4. **❌ AVANT :**
   - Erreur 406 PGRST116
   - Message "Erreur d'authentification"

### Test 3 : Régie télécharge PDF
1. **Contexte :** Régie avec factures
2. **Action :** Cliquer "📄 Télécharger PDF"
3. **✅ ATTENDU :**
   - PDF téléchargé
   - Contient : numéro, entreprise, régie, mission, lignes, totaux
4. **❌ AVANT :**
   - 403 "Accès refusé"

### Test 4 : Entreprise télécharge PDF
1. **Contexte :** Entreprise avec factures
2. **Action :** Cliquer "📥 Télécharger PDF"
3. **✅ ATTENDU :**
   - PDF téléchargé
   - Même contenu que Régie
4. **❌ AVANT :**
   - 403 "Accès refusé"

### Test 5 : Entreprise ne peut PAS télécharger PDF d'une autre entreprise
1. **Contexte :** Entreprise A, facture appartient à Entreprise B
2. **Action :** Appel direct API `/api/facture-pdf?facture_id=xxx`
3. **✅ ATTENDU :**
   - 403 "Cette facture ne vous appartient pas"
4. **Résultat :** Sécurité RLS confirmée

---

## 🔍 VÉRIFICATIONS SQL DIRECTES

### Vérifier RLS sur regies
```sql
SELECT 
  schemaname, tablename, 
  policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'regies';

-- ATTENDU :
-- regies_read_self          | SELECT | authenticated | (id = auth.uid())
-- regies_admin_read_all     | SELECT | authenticated | (profile.role = 'admin_jtec')
-- regies_entreprise_read... | SELECT | authenticated | (statut_validation = 'valide')
-- regies_update_self        | UPDATE | authenticated | (id = auth.uid())
```

### Tester accès Régie direct
```sql
-- En tant que Régie (avec son token)
SELECT id, nom, email FROM regies WHERE id = auth.uid();

-- ATTENDU : 1 ligne retournée
-- SI 0 ligne : RLS bloque → refaire migration M57.1
```

### Vérifier profiles.regie_id synchronisé
```sql
SELECT 
  p.id, 
  p.email, 
  p.role, 
  p.regie_id,
  r.id AS regie_table_id,
  r.nom
FROM profiles p
LEFT JOIN regies r ON r.id = p.id
WHERE p.role = 'regie';

-- ATTENDU : p.regie_id = r.id pour toutes les régies
```

---

## 📊 DIFFÉRENCES AVANT/APRÈS

| Aspect | Avant M57.1 | Après M57.1 |
|--------|-------------|-------------|
| RLS regies | ❌ Aucune policy | ✅ 4 policies (read_self, admin, entreprise, update_self) |
| Régie SELECT regies | ❌ 0 rows (bloqué) | ✅ 1 row (sa ligne) |
| Message erreur | ❌ "Erreur d'authentification" (trompeur) | ✅ "Profil régie incomplet (regie_id manquant)" (précis) |
| PDF auth Entreprise | ❌ 403 (logique incorrecte) | ✅ 200 + PDF (entreprise_id vérifié) |
| PDF auth Régie | ❌ 403 (logique incorrecte) | ✅ 200 + PDF (regie_id vérifié) |
| profiles.regie_id | ❌ NULL (manquant) | ✅ Synchronisé avec regies.id |

---

## ⚠️ ROLLBACK SI PROBLÈME

### Annuler M57.1 (SQL)
```sql
-- Supprimer policies
DROP POLICY IF EXISTS regies_read_self ON regies;
DROP POLICY IF EXISTS regies_admin_read_all ON regies;
DROP POLICY IF EXISTS regies_entreprise_read_validated ON regies;
DROP POLICY IF EXISTS regies_update_self ON regies;

-- Désactiver RLS (ATTENTION: ouvre accès total)
ALTER TABLE regies DISABLE ROW LEVEL SECURITY;

-- Supprimer fonction debug
DROP FUNCTION IF EXISTS debug_regie_access;

-- Supprimer colonne regie_id (optionnel)
ALTER TABLE profiles DROP COLUMN IF EXISTS regie_id;
```

### Revenir code
```bash
git revert HEAD~1
git push origin main
```

---

## 📝 LOGS DEBUG

### Côté Frontend (Console navigateur)
```javascript
// En cas d'erreur, vérifier console :
[AUTH] Erreur lecture régie: {code: "PGRST116", message: "..."}

// Après fix M57.1 :
[AUTH] Régie: { id: "xxx", nom: "Régie Test", email: "..." }
```

### Côté Backend (Vercel logs)
```bash
vercel logs --follow

# En cas d'erreur PDF :
[PDF] Régie xxx tente d'accéder à facture regie_id yyy
→ Indique problème ownership

# Après fix M57.1 :
[PDF] Génération PDF pour facture xxx (role: regie)
→ OK
```

---

## 🎉 RÉSULTAT FINAL

### Workflow complet fonctionnel
```
[Régie Login] 
    ↓
[Menu Factures] → ✅ Charge sans 406
    ↓
[Liste Factures] → ✅ Affiche factures (RLS OK)
    ↓
[Télécharger PDF] → ✅ PDF généré (auth OK)
```

### Sécurité renforcée
- ✅ RLS sur `regies` : Régie ne voit QUE sa ligne
- ✅ Auth PDF : Entreprise/Régie ne peut télécharger QUE ses factures
- ✅ Messages d'erreur clairs : plus de confusion auth vs données

---

## 📞 SUPPORT

En cas de problème persistant :

1. **Vérifier migration appliquée :**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'regies';
   ```

2. **Tester fonction debug :**
   ```sql
   SELECT * FROM debug_regie_access();
   ```

3. **Logs Vercel :**
   ```bash
   vercel logs --since 1h
   ```

4. **Supabase Logs :**
   Dashboard → Logs → SQL Logs

**Statut :** 🟢 Prêt à déployer (URGENT)
