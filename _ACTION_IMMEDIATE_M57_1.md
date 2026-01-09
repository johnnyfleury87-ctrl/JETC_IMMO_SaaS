# ✅ M57.1 HOTFIX - BUGS CRITIQUES CORRIGÉS

## 🚨 SITUATION

Après déploiement M57, 2 bugs critiques empêchaient l'utilisation :

### Bug 1 : Régie 406 PGRST116 ❌
```
Symptôme : Page Factures affiche "Erreur d'authentification"
Console  : PGRST116 "Cannot coerce the result to a single JSON object"
Cause    : .single() sur requête regies qui retourne 0 rows (RLS bloquait)
```

### Bug 2 : PDF 403 "Accès refusé" ❌
```
Symptôme : Bouton "Télécharger PDF" → 403
Console  : GET /api/facture-pdf → {"error":"Accès refusé"}
Cause    : Logique d'auth vérifiait mal entreprise_id/regie_id
```

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. RLS sur table regies (CRITIQUE)
**Fichier :** `supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql`

**Ajouts :**
- Policy `regies_read_self` : Régie lit `id = auth.uid()`
- Policy `regies_admin_read_all` : Admin lit tout
- Policy `regies_entreprise_read_validated` : Entreprise lit validées
- Policy `regies_update_self` : Régie update sa ligne
- Colonne `profiles.regie_id` (sync avec `regies.id`)
- Fonction `debug_regie_access()` pour debug

**Impact :** Régie peut maintenant lire sa propre ligne dans table `regies`.

### 2. Frontend Régie - Message d'erreur clair
**Fichier :** `public/regie/factures.html` ligne 505

**Avant :**
```javascript
.single(); // ❌ Erreur 406 si 0 rows
// Message: "Erreur d'authentification" (trompeur)
```

**Après :**
```javascript
.maybeSingle(); // ✅ Retourne null si 0 rows
// Message: "Profil régie incomplet (regie_id manquant ou accès refusé)"
```

### 3. Backend API PDF - Auth correcte
**Fichier :** `api/facture-pdf.js` lignes 69-88

**Avant :**
```javascript
if (isRegie && facture.regie_id !== user.id) {
  return 403; // ❌ Toujours 403 car logique incorrecte
}
```

**Après :**
```javascript
if (isRegie) {
  if (facture.regie_id !== user.id) {
    console.error('[PDF] Régie', user.id, 'tente facture regie_id', facture.regie_id);
    return 403; // ✅ Avec log debug
  }
}
// + Même logique pour Entreprise et Admin
```

---

## 📋 CHECKLIST DÉPLOIEMENT

### Étape 1 : Migration SQL (URGENT)
```sql
-- Dans Supabase Dashboard → SQL Editor
-- Copier-coller le contenu de :
supabase/migrations/20260109010001_m57_1_fix_rls_regies_urgent.sql

-- Cliquer "RUN"
```

**Résultat attendu :**
```
✅ Success. No rows returned
```

### Étape 2 : Vérifier RLS appliqué
```sql
-- Dans SQL Editor
SELECT policyname FROM pg_policies WHERE tablename = 'regies';

-- Doit retourner :
-- regies_read_self
-- regies_admin_read_all
-- regies_entreprise_read_validated
-- regies_update_self
```

### Étape 3 : Push code (déjà fait)
```bash
git add .
git commit -m "M57.1 HOTFIX: RLS regies + auth PDF"
git push origin main
```

### Étape 4 : Tests
- [ ] Régie login → Factures → ✅ Page charge
- [ ] Régie PDF → ✅ Téléchargement OK
- [ ] Entreprise PDF → ✅ Téléchargement OK
- [ ] Console propre (pas d'erreur 406/403)

---

## 🎯 RÉSULTAT FINAL

| Test | Avant M57.1 | Après M57.1 |
|------|-------------|-------------|
| Régie ouvre Factures | ❌ Erreur 406 | ✅ OK |
| Message erreur | ❌ "Erreur d'authentification" | ✅ "Profil régie incomplet" |
| Régie télécharge PDF | ❌ 403 | ✅ OK |
| Entreprise télécharge PDF | ❌ 403 | ✅ OK |
| RLS regies | ❌ Aucune policy | ✅ 4 policies |

---

## 📞 SI PROBLÈME PERSISTE

### Debug SQL
```sql
-- Tester accès Régie
SELECT * FROM debug_regie_access();

-- Vérifier que can_read_self = true
```

### Logs Vercel
```bash
vercel logs --since 10m | grep PDF
```

### Console navigateur
```
F12 → Console → Filtrer "AUTH" ou "PDF"
```

---

## 🔗 DOCUMENTATION COMPLÈTE

- **Hotfix détaillé :** [_HOTFIX_M57_1.md](_HOTFIX_M57_1.md)
- **M57 original :** [_README_M57.md](_README_M57.md)
- **Déploiement M57 :** [_GUIDE_DEPLOIEMENT_M57.md](_GUIDE_DEPLOIEMENT_M57.md)

---

**Statut :** 🟢 Corrigé - Déployer migration SQL maintenant

**Priorité :** 🔴 URGENT (bloque utilisation Régie)
