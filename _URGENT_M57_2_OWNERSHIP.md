# 🚨 BUG CRITIQUE IDENTIFIÉ - OWNERSHIP VIA PROFILES

## 🎯 PROBLÈME RACINE

### Bug dans M56 et M57 (RLS + API)
Les comparaisons d'ownership utilisaient les **mauvais IDs** :

```sql
-- ❌ INCORRECT (M56)
factures.entreprise_id = auth.uid()
factures.regie_id = auth.uid()

-- ❌ INCORRECT (API PDF M57)
facture.entreprise_id === user.id
facture.regie_id === user.id
```

### Pourquoi c'est faux ?

| Variable | Valeur | Table source |
|----------|--------|--------------|
| `auth.uid()` / `user.id` | `97fb8c...` | `profiles.id` (UUID compte utilisateur) |
| `factures.entreprise_id` | `6ff210bc...` | `entreprises.id` (UUID entité entreprise) |
| `factures.regie_id` | `abc123...` | `regies.id` (UUID entité régie) |

**Ces IDs ne correspondent JAMAIS.**

### Architecture correcte

```
auth.users.id (UUID compte)
    ↓
profiles.id = auth.uid()
profiles.entreprise_id → entreprises.id
profiles.regie_id → regies.id
    ↓
factures.entreprise_id
factures.regie_id
```

**Comparaison correcte :**
```sql
-- ✅ CORRECT
profiles.entreprise_id = factures.entreprise_id
profiles.regie_id = factures.regie_id
```

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. API PDF corrigée
**Fichier :** `api/facture-pdf.js`

**Avant (M57) :**
```javascript
if (facture.entreprise_id !== user.id) { // ❌ Toujours faux
  return 403;
}
```

**Après (M57.2) :**
```javascript
// Récupérer profile.entreprise_id et profile.regie_id
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('role, entreprise_id, regie_id')
  .eq('id', user.id)
  .maybeSingle();

// Comparer avec les bons IDs
if (facture.entreprise_id !== profile.entreprise_id) { // ✅ Correct
  return 403;
}
```

### 2. RLS Factures corrigée
**Migration :** `20260109010002_m57_2_fix_rls_factures_ownership.sql`

**Avant (M56) :**
```sql
-- ❌ Toujours bloque (IDs différents)
CREATE POLICY "Entreprise voit ses factures"
  USING (entreprise_id = auth.uid());
```

**Après (M57.2) :**
```sql
-- ✅ Compare via profiles.entreprise_id
CREATE POLICY "factures_entreprise_select"
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );
```

### 3. Synchronisation données
La migration M57.2 synchronise automatiquement :

```sql
-- Entreprises
UPDATE profiles
SET entreprise_id = profiles.id
WHERE role = 'entreprise' AND entreprise_id IS NULL;

-- Régies
UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie' AND regie_id IS NULL;
```

---

## 🚀 DÉPLOIEMENT URGENT

### ORDRE D'EXÉCUTION (CRITIQUE)

#### Étape 1 : M57.1 (RLS regies)
```sql
-- Supabase SQL Editor
-- Fichier: 20260109010001_m57_1_fix_rls_regies_urgent.sql
-- Crée policies sur table regies
```

#### Étape 2 : M57.2 (RLS factures ownership)
```sql
-- Supabase SQL Editor
-- Fichier: 20260109010002_m57_2_fix_rls_factures_ownership.sql
-- Corrige policies factures + synchronise profiles.<role>_id
```

#### Étape 3 : Vérifier (optionnel)
```sql
-- Tester ownership pour une facture
SELECT * FROM debug_facture_ownership('<UUID_FACTURE>');

-- Résultat attendu :
-- user_entreprise_id = facture_entreprise_id → can_read = true
-- can_update dépend du statut
```

#### Étape 4 : Push code (déjà fait)
```bash
git push origin main
# Vercel déploie automatiquement l'API PDF corrigée
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Entreprise charge factures (frontend)
**Contexte :** Entreprise login

**Action :** Onglet Factures

**✅ ATTENDU :**
- Liste factures affichée (RLS OK via profiles.entreprise_id)

**❌ AVANT M57.2 :**
- Aucune facture (RLS bloquait car IDs différents)

### Test 2 : Entreprise télécharge PDF
**Contexte :** Entreprise avec factures

**Action :** Cliquer "📥 Télécharger PDF"

**✅ ATTENDU :**
- PDF téléchargé (API compare profile.entreprise_id)
- Console : `[PDF] Entreprise access granted`

**❌ AVANT M57.2 :**
- 403 "Cette facture ne vous appartient pas"
- Console : Entreprise 97fb8c tente facture 6ff210bc

### Test 3 : Régie charge factures
**Contexte :** Régie login (APRÈS M57.1 appliqué)

**Action :** Menu Factures

**✅ ATTENDU :**
- Liste factures envoyées (RLS OK via profiles.regie_id)

**❌ AVANT M57.2 :**
- Aucune facture (RLS bloquait)

### Test 4 : Régie télécharge PDF
**Contexte :** Régie avec factures envoyées

**Action :** Cliquer "📄 Télécharger PDF"

**✅ ATTENDU :**
- PDF téléchargé (API compare profile.regie_id)
- Console : `[PDF] Régie access granted`

**❌ AVANT M57.2 :**
- 403 "Cette facture ne concerne pas votre régie"

---

## 🔍 VÉRIFICATION DB

### Vérifier profiles.<role>_id synchronisé
```sql
-- Entreprises
SELECT 
  p.id AS profile_id,
  p.email,
  p.role,
  p.entreprise_id,
  e.id AS entreprise_table_id
FROM profiles p
LEFT JOIN entreprises e ON e.id = p.id
WHERE p.role = 'entreprise';

-- ATTENDU : p.entreprise_id = e.id (ou p.id si même UUID)
```

```sql
-- Régies
SELECT 
  p.id AS profile_id,
  p.email,
  p.role,
  p.regie_id,
  r.id AS regie_table_id
FROM profiles p
LEFT JOIN regies r ON r.id = p.id
WHERE p.role = 'regie';

-- ATTENDU : p.regie_id = r.id (ou p.id si même UUID)
```

### Tester ownership facture
```sql
-- Remplacer <UUID_FACTURE> par une vraie facture
SELECT * FROM debug_facture_ownership('<UUID_FACTURE>');

-- Colonnes importantes :
-- user_entreprise_id = facture_entreprise_id → can_read = true (si entreprise)
-- user_regie_id = facture_regie_id → can_read = true (si régie + envoyée)
```

---

## 📊 IMPACT

### Avant M57.2

| Rôle | Factures visibles | PDF téléchargeable | Cause |
|------|-------------------|-------------------|-------|
| Entreprise | ❌ 0 | ❌ 403 | RLS compare auth.uid() ≠ entreprise_id |
| Régie | ❌ 0 | ❌ 403 | RLS compare auth.uid() ≠ regie_id |

### Après M57.2

| Rôle | Factures visibles | PDF téléchargeable | Méthode |
|------|-------------------|-------------------|---------|
| Entreprise | ✅ OUI | ✅ OUI | RLS via profiles.entreprise_id |
| Régie | ✅ OUI | ✅ OUI | RLS via profiles.regie_id |

---

## 📝 LOGS DEBUG

### Console navigateur (après M57.2)
```
[PDF] User: 97fb8c... Role: entreprise entreprise_id: 6ff210bc regie_id: null
[PDF] Facture entreprise_id: 6ff210bc regie_id: abc123...
[PDF] Entreprise access granted
```

**Analyse :**
- `user.id` (97fb8c) ≠ `facture.entreprise_id` (6ff210bc) ✅ Normal
- `profile.entreprise_id` (6ff210bc) = `facture.entreprise_id` (6ff210bc) ✅ Match !

### Logs Vercel (après M57.2)
```bash
vercel logs --since 5m | grep PDF

# Succès :
[PDF] Entreprise access granted
[PDF] Génération PDF pour facture xxx

# Si erreur :
[PDF] Entreprise profile incomplet: entreprise_id manquant
→ Indique que profiles.entreprise_id est NULL (à synchroniser)
```

---

## ⚠️ CHECKLIST DÉPLOIEMENT

- [ ] **M57.1 appliqué** (RLS regies) → Régie peut lire sa ligne
- [ ] **M57.2 appliqué** (RLS factures ownership) → Ownership via profiles
- [ ] **Code déployé** (Vercel auto-deploy) → API PDF corrigée
- [ ] **Test Entreprise** → Factures visibles + PDF OK
- [ ] **Test Régie** → Factures visibles + PDF OK
- [ ] **Logs propres** → Pas de 403 ownership

---

## 🔗 FICHIERS CONCERNÉS

### Migrations SQL (à appliquer dans l'ordre)
1. [20260109010001_m57_1_fix_rls_regies_urgent.sql](supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql)
2. [20260109010002_m57_2_fix_rls_factures_ownership.sql](supabase/migrations/20260109010002_m57_2_fix_rls_factures_ownership.sql)

### Code modifié (déjà déployé)
- [api/facture-pdf.js](api/facture-pdf.js) - Auth via profiles.<role>_id

---

**Statut :** 🔴 CRITIQUE - Appliquer M57.1 + M57.2 maintenant

**Priorité :** 🔥 BLOQUANT (Entreprise et Régie ne peuvent pas utiliser factures)
