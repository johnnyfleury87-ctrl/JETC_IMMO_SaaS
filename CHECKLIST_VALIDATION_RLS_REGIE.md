# ✅ CHECKLIST VALIDATION RLS - RÉGIE UNIQUEMENT

**Date** : 23 décembre 2025  
**Script** : `supabase/RESET_RLS_REGIE_ONLY.sql`  
**Périmètre** : Création locataire par régie (pas de fonctionnalité locataire)

---

## 📋 ACTIONS

### 1. Exécuter le script SQL

```bash
# Dans Supabase SQL Editor
# Copier RESET_RLS_REGIE_ONLY.sql
# Exécuter
```

**Résultat attendu** :
```
✅ POLICIES ACTIVES (RÉGIE UNIQUEMENT)
   → immeubles : 3 policies
   → logements : 3 policies
   → locataires : 5 policies
```

---

## ✅ VALIDATION DB

### Test 1 : Vérifier policies immeubles

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'immeubles';
```

**Attendu** (3 lignes) :
```
Regie can view own immeubles          | SELECT
Regie can manage own immeubles        | ALL
Admin JTEC can view all immeubles     | SELECT
```

**Vérifier** : Aucune policy contenant "Locataire"

---

### Test 2 : Vérifier policies logements

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'logements';
```

**Attendu** (3 lignes) :
```
Regie can view own logements          | SELECT
Regie can manage own logements        | ALL
Admin JTEC can view all logements     | SELECT
```

**Vérifier** : Aucune policy contenant "Locataire"

---

### Test 3 : Vérifier policies locataires

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'locataires';
```

**Attendu** (5 lignes) :
```
Regie can view own locataires         | SELECT
Regie can insert own locataires       | INSERT
Regie can update own locataires       | UPDATE
Regie can delete own locataires       | DELETE
Admin JTEC can view all locataires    | SELECT
```

**Vérifier** : Aucune policy "Locataire can view own data" ou "select_self_policy"

---

### Test 4 : SELECT immeubles (régie)

```sql
-- Se connecter avec compte régie
SELECT id, nom, regie_id FROM immeubles;
```

**Attendu** : Liste des immeubles de cette régie (pas d'erreur 42P17)

---

### Test 5 : SELECT logements (régie)

```sql
-- Se connecter avec compte régie
SELECT id, numero, immeuble_id FROM logements;
```

**Attendu** : Liste des logements des immeubles de cette régie

---

### Test 6 : SELECT locataires (régie)

```sql
-- Se connecter avec compte régie
SELECT id, nom, prenom, regie_id FROM locataires;
```

**Attendu** : Liste des locataires de cette régie

---

## ✅ VALIDATION FRONTEND

### Test 7 : Page locataires charge

1. Se connecter en tant que régie
2. Accéder à `/regie/locataires`
3. Vérifier :
   - ✅ Page charge sans erreur
   - ✅ Console logs propres (pas de 42P17, pas de "infinite recursion")
   - ✅ Nom régie affiché
   - ✅ Tableau locataires visible (vide ou avec données)
   - ✅ Bouton "Nouveau locataire" actif

---

### Test 8 : Création locataire SANS logement

1. Cliquer "Nouveau locataire"
2. Remplir formulaire :
   - Nom : `Test`
   - Prénom : `Sans Logement`
   - Email : `test.sans@example.com`
   - Date d'entrée : `2025-12-23`
   - **Logement : Laisser vide**
3. Soumettre

**Attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "uuid-xxx",
    "nom": "Test",
    "prenom": "Sans Logement",
    "regie_id": "uuid-regie",
    "logement_id": null
  },
  "credentials": {
    "email": "test.sans@example.com",
    "temporary_password": "Test1234!"
  }
}
```

**Vérifier DB** :
```sql
SELECT nom, prenom, regie_id, logement_id 
FROM locataires 
WHERE email = 'test.sans@example.com';
-- regie_id doit être renseigné, logement_id = NULL
```

---

### Test 9 : Création locataire AVEC logement

1. Cliquer "Nouveau locataire"
2. Remplir formulaire :
   - Nom : `Test`
   - Prénom : `Avec Logement`
   - Email : `test.avec@example.com`
   - Date d'entrée : `2025-12-23`
   - **Logement : Sélectionner un logement disponible**
3. Soumettre

**Attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "uuid-xxx",
    "nom": "Test",
    "prenom": "Avec Logement",
    "regie_id": "uuid-regie",
    "logement_id": "uuid-logement"
  }
}
```

**Vérifier DB** :
```sql
SELECT nom, prenom, regie_id, logement_id 
FROM locataires 
WHERE email = 'test.avec@example.com';
-- regie_id ET logement_id doivent être renseignés
```

---

## ✅ VÉRIFICATIONS FINALES

### Aucune récursion

```sql
-- Vérifier qu'aucune policy immeubles ne lit immeubles
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'immeubles'
  AND definition LIKE '%FROM immeubles%';
-- Doit retourner 0 lignes
```

### Aucune policy locataire active

```sql
-- Vérifier aucune policy pour rôle locataire
SELECT policyname
FROM pg_policies
WHERE tablename IN ('immeubles', 'logements', 'locataires')
  AND policyname LIKE '%Locataire%';
-- Doit retourner 0 lignes
```

### Cohérence regie_id

```sql
-- Tous les locataires ont un regie_id
SELECT COUNT(*) FROM locataires WHERE regie_id IS NULL;
-- Doit retourner 0
```

---

## 🎯 CHECKLIST GLOBALE

- [ ] Script RESET_RLS_REGIE_ONLY.sql exécuté
- [ ] 3 policies immeubles (régie + admin)
- [ ] 3 policies logements (régie + admin)
- [ ] 5 policies locataires (régie + admin)
- [ ] 0 policies "Locataire can..."
- [ ] SELECT immeubles → OK (régie)
- [ ] SELECT logements → OK (régie)
- [ ] SELECT locataires → OK (régie)
- [ ] Page /regie/locataires → OK
- [ ] Création locataire sans logement → OK
- [ ] Création locataire avec logement → OK
- [ ] Aucune erreur 42P17 (récursion)
- [ ] Aucune erreur "infinite recursion"

---

## ✅ VERDICT

**Si TOUS les tests passent** :

```
╔═══════════════════════════════════════════════════════════╗
║  ✅ RLS RÉGIE FONCTIONNEL                                ║
║                                                           ║
║  - Isolation multi-tenant : ✅                           ║
║  - Création locataire : ✅                               ║
║  - Aucune récursion : ✅                                 ║
║  - Policies propres : ✅                                 ║
║                                                           ║
║  Prêt pour premiers tests utilisateurs régie             ║
╚═══════════════════════════════════════════════════════════╝
```

**Si UN test échoue** : Reporter erreur exacte et numéro de test
