# ✅ CHECKLIST VALIDATION RLS - PHASE 1 RÉGIE

**Date** : 23 décembre 2025  
**Script** : `supabase/RESET_RLS_REGIE_ONLY.sql`  
**Périmètre** : PHASE 1 - Création locataire par régie UNIQUEMENT  
**Idempotent** : Exécutable plusieurs fois sans erreur

---

## 🎯 OBJECTIF PHASE 1

- ✅ Régie connectée
- ✅ Régie crée locataires (avec ou sans logement)
- ❌ Aucune fonctionnalité locataire frontend
- ❌ Aucune récursion RLS

---

## 📋 ÉTAPE 1 : EXÉCUTER LE SCRIPT

### Dans Supabase SQL Editor

1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier **TOUT** le contenu de `RESET_RLS_REGIE_ONLY.sql`
3. Exécuter
4. Vérifier message final

**Message attendu** :
```
✅ NOMBRE DE POLICIES CORRECT
immeubles : 3 policies
logements : 3 policies
locataires : 5 policies
```

---

## ✅ ÉTAPE 2 : VALIDATION DB (SQL)

### Test 1 : Compter les policies

```sql
SELECT 
  'immeubles' AS table_name,
  COUNT(*) AS policy_count
FROM pg_policies 
WHERE tablename = 'immeubles'
UNION ALL
SELECT 
  'logements',
  COUNT(*)
FROM pg_policies 
WHERE tablename = 'logements'
UNION ALL
SELECT 
  'locataires',
  COUNT(*)
FROM pg_policies 
WHERE tablename = 'locataires';
```

**Attendu** :
```
immeubles  | 3
logements  | 3
locataires | 5
```

---

### Test 2 : Vérifier AUCUNE policy locataire

```sql
SELECT policyname, tablename
FROM pg_policies
WHERE tablename IN ('immeubles', 'logements', 'locataires')
  AND (policyname LIKE '%Locataire%' OR policyname LIKE '%locataire%');
```

**Attendu** : `0 lignes` (aucune policy pour locataire)

---

### Test 3 : Lister toutes les policies actives

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('immeubles', 'logements', 'locataires')
ORDER BY tablename, cmd, policyname;
```

**Attendu** (11 lignes exactement) :
```
immeubles  | Admin JTEC can view all immeubles     | SELECT
immeubles  | Regie can manage own immeubles        | ALL
immeubles  | Regie can view own immeubles          | SELECT
logements  | Admin JTEC can view all logements     | SELECT
logements  | Regie can manage own logements        | ALL
logements  | Regie can view own logements          | SELECT
locataires | Admin JTEC can view all locataires    | SELECT
locataires | Regie can delete own locataires       | DELETE
locataires | Regie can insert own locataires       | INSERT
locataires | Regie can update own locataires       | UPDATE
locataires | Regie can view own locataires         | SELECT
```

---

## ✅ ÉTAPE 3 : TESTS SQL (EN TANT QUE RÉGIE)

**Important** : Se connecter avec un compte régie avant d'exécuter ces tests

### Test 1 : SELECT immeubles

```sql
SELECT id, nom, regie_id FROM immeubles;
```

**Attendu** : 
- ✅ Liste des immeubles de cette régie
- ❌ Pas d'erreur `42P17` (récursion)
- ❌ Pas d'erreur `permission denied`

---

### Test 2 : SELECT logements

```sql
SELECT id, numero, immeuble_id FROM logements;
```

**Attendu** : 
- ✅ Liste des logements des immeubles de cette régie
- ❌ Pas d'erreur

---

### Test 3 : SELECT locataires

```sql
SELECT id, nom, prenom, regie_id, logement_id FROM locataires;
```

**Attendu** : 
- ✅ Liste des locataires de cette régie (peut être vide)
- ❌ Pas d'erreur

---

## ✅ ÉTAPE 4 : TESTS FRONTEND

### Test 1 : Page /regie/locataires charge

1. Se connecter en tant que régie
2. Aller sur `/regie/locataires`

**Vérifier** :
- [ ] Page charge sans erreur
- [ ] Console propre (F12 → onglet Console)
- [ ] Pas de `42P17` ou `infinite recursion`
- [ ] Nom régie affiché en haut
- [ ] Tableau locataires visible
- [ ] Bouton "Nouveau locataire" visible

---

### Test 2 : Création locataire SANS logement

1. Cliquer "Nouveau locataire"
2. Remplir :
   - Nom : `TestPhase1`
   - Prénom : `SansLogement`
   - Email : `testphase1@example.com`
   - Date entrée : `2025-12-23`
   - **Logement : VIDE**
3. Soumettre

**Vérifier** :
- [ ] Message succès
- [ ] Credentials affichés : `Test1234!`
- [ ] Locataire apparaît dans tableau

**Vérifier DB** :
```sql
SELECT nom, prenom, regie_id, logement_id 
FROM locataires 
WHERE email = 'testphase1@example.com';
```
- [ ] `regie_id` renseigné
- [ ] `logement_id` = NULL

---

## 🎯 CHECKLIST FINALE

- [ ] Script RESET_RLS_REGIE_ONLY.sql exécuté
- [ ] 3 policies immeubles
- [ ] 3 policies logements
- [ ] 5 policies locataires
- [ ] 0 policies "Locataire can..."
- [ ] SELECT immeubles → OK
- [ ] SELECT logements → OK
- [ ] SELECT locataires → OK
- [ ] Page /regie/locataires → OK
- [ ] Création locataire sans logement → OK
- [ ] Aucune erreur 42P17
- [ ] Aucune erreur "infinite recursion"

---

## ✅ VERDICT

**Si TOUTES les cases cochées** :

```
╔═══════════════════════════════════════════════════════════╗
║           ✅ PHASE 1 RÉGIE VALIDÉE                       ║
╚═══════════════════════════════════════════════════════════╝

État RLS : ✅ Propre (11 policies exactement)
Récursion : ❌ Aucune
Isolation : ✅ Multi-tenant garanti
Création locataire : ✅ Fonctionnelle

PRÊT pour utilisation régie.
```

**Si UN test échoue** :

1. Noter le numéro du test qui échoue
2. Copier l'erreur EXACTE (message + code)
3. Reporter dans le chat avec le contexte
