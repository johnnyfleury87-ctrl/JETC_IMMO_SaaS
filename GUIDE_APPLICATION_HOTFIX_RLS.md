# GUIDE D'APPLICATION - HOTFIX RLS RECURSION

**Date**: 26 décembre 2025  
**Fichier SQL**: `HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES.sql`  
**Erreur corrigée**: `infinite recursion detected in policy for relation "regies_entreprises"`

---

## 📋 PRÉ-REQUIS

✅ **Migrations M20-M24 déjà appliquées**  
✅ **CREATE ticket fonctionne** (locataire peut créer des tickets)  
❌ **SELECT tickets échoue** pour entreprises (récursion RLS)  
❌ **Régie peut se déconnecter** sur certaines pages

---

## 🎯 CE QUE CE HOTFIX CORRIGE

### Problème 1: Entreprise ne peut pas lire tickets
**Erreur**: `infinite recursion detected in policy for relation "regies_entreprises"`  
**Cause**: Policy `tickets` → lit `regies_entreprises` → policy lit `entreprises` → policy lit `regies_entreprises` → BOUCLE

### Problème 2: Vue `tickets_visibles_entreprise` cause récursion
**Erreur**: Même erreur récursion  
**Cause**: Vue hérite RLS des tables → récursion garantie

### Problème 3: Storage signatures inaccessible
**Erreur**: Récursion sur policies storage  
**Cause**: Policy JOIN `regies_entreprises` directement

---

## 🔧 CE QUE LE HOTFIX FAIT

### 1. Crée 3 fonctions SECURITY DEFINER (bypass RLS)
```sql
✅ get_user_entreprise_id()
   → Retourne entreprise.id pour auth.uid()
   → SECURITY DEFINER = bypass RLS sur table entreprises

✅ is_ticket_authorized_for_entreprise(ticket_id, entreprise_id)
   → Vérifie si entreprise autorisée pour ticket
   → SECURITY DEFINER = bypass RLS sur tickets + regies_entreprises

✅ is_entreprise_authorized_for_regie(entreprise_id, regie_id)
   → Vérifie liaison regies_entreprises
   → SECURITY DEFINER = bypass RLS
```

### 2. Corrige 3 policies RLS
```sql
✅ "Entreprise can view own authorizations" (regies_entreprises)
   AVANT: EXISTS (SELECT ... FROM entreprises WHERE ...)
   APRÈS: entreprise_id = get_user_entreprise_id()
   → Plus de récursion

✅ "Entreprise can view authorized tickets" (tickets)
   AVANT: EXISTS (SELECT ... FROM regies_entreprises WHERE ...)
   APRÈS: is_ticket_authorized_for_entreprise(...)
   → Plus de récursion

✅ "Regie can view signatures..." (storage.objects)
   AVANT: JOIN regies_entreprises
   APRÈS: is_entreprise_authorized_for_regie(...)
   → Plus de récursion
```

### 3. Convertit vue en fonction
```sql
✅ DROP VIEW tickets_visibles_entreprise
✅ CREATE FUNCTION get_tickets_visibles_entreprise()
   → STABLE + SECURITY DEFINER
   → Bypass RLS → pas de récursion
```

---

## 🚀 PROCÉDURE D'APPLICATION

### ÉTAPE 1: Ouvrir Supabase Dashboard

1. Aller sur https://supabase.com/dashboard
2. Sélectionner projet JETC_IMMO
3. Menu latéral → **SQL Editor**

---

### ÉTAPE 2: Copier le SQL complet

1. Ouvrir fichier: `HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES.sql`
2. **Copier TOUT le contenu** (Ctrl+A → Ctrl+C)
3. Coller dans SQL Editor de Supabase

---

### ÉTAPE 3: Exécuter le script

1. Cliquer sur **Run** (ou Ctrl+Enter)
2. Attendre fin d'exécution (≈ 5-10 secondes)

**Résultats attendus**:
```
✅ CREATE FUNCTION get_user_entreprise_id
✅ CREATE FUNCTION is_ticket_authorized_for_entreprise
✅ CREATE FUNCTION is_entreprise_authorized_for_regie
✅ DROP POLICY (x3)
✅ CREATE POLICY (x3)
✅ DROP VIEW tickets_visibles_entreprise
✅ CREATE FUNCTION get_tickets_visibles_entreprise
```

---

### ÉTAPE 4: Vérifier l'application

Exécuter les 3 tests de validation (inclus dans le script):

#### Test 1: Vérifier policies
```sql
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'regies_entreprises'
ORDER BY policyname;
```

**Attendu**: 6 policies, dont "Entreprise can view own authorizations"

---

#### Test 2: Vérifier fonction vue
```sql
SELECT
  proname,
  provolatile,  -- doit être 's' (STABLE)
  prosecdef      -- doit être 't' (SECURITY DEFINER)
FROM pg_proc
WHERE proname = 'get_tickets_visibles_entreprise';
```

**Attendu**: 1 ligne avec `provolatile='s'` et `prosecdef='t'`

---

#### Test 3: Vérifier fonctions helper
```sql
SELECT proname
FROM pg_proc
WHERE proname IN (
  'get_user_entreprise_id',
  'is_ticket_authorized_for_entreprise',
  'is_entreprise_authorized_for_regie'
);
```

**Attendu**: 3 lignes

---

## ✅ TESTS FONCTIONNELS

### Test A: Locataire crée ticket
```
1. Login: test-locataire@jetc.ch
2. Aller sur /locataire/dashboard.html
3. Créer ticket (plomberie, description, disponibilités)
4. ✅ Attendu: POST 201, ticket créé
5. ✅ Attendu: Aucune erreur console
```

---

### Test B: Régie voit tickets
```
1. Login: test-regie@jetc.ch
2. Aller sur /regie/tickets.html
3. ✅ Attendu: Page charge (pas de déconnexion)
4. ✅ Attendu: Tickets affichés par section
5. ✅ Attendu: Aucune erreur "infinite recursion"
```

---

### Test C: Entreprise voit tickets autorisés
```
1. Login: test-entreprise@jetc.ch (si existe)
2. Exécuter dans SQL Editor:

SELECT *
FROM get_tickets_visibles_entreprise(NULL)
WHERE statut = 'ouvert'
LIMIT 5;

3. ✅ Attendu: 0-N lignes (selon données)
4. ✅ Attendu: Aucune erreur récursion
5. ❌ PAS d'erreur "infinite recursion"
```

---

## ❌ EN CAS DE PROBLÈME

### Si erreur pendant application du hotfix

**Erreur**: `function get_user_entreprise_id already exists`  
**Solution**: Normal si réapplication. Continuer.

**Erreur**: `policy "..." does not exist`  
**Solution**: Normal si policy déjà supprimée. Continuer.

---

### Si comportement inattendu APRÈS application

**Option 1: Rollback complet**
```bash
# Exécuter fichier rollback
→ Ouvrir HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES_ROLLBACK.sql
→ Copier/coller dans SQL Editor
→ Run

⚠️ ATTENTION: Erreur récursion reviendra
```

**Option 2: Debug spécifique**
```sql
-- Vérifier policies actives
SELECT * FROM pg_policies
WHERE tablename IN ('tickets', 'regies_entreprises', 'entreprises')
ORDER BY tablename, policyname;

-- Vérifier fonctions
SELECT proname, prosecdef
FROM pg_proc
WHERE proname LIKE '%entreprise%';
```

---

## 📊 IMPACT ATTENDU

### ✅ Après application réussie

| Test | Avant Hotfix | Après Hotfix |
|------|--------------|--------------|
| Locataire → CREATE ticket | ✅ OK | ✅ OK |
| Régie → SELECT tickets | ⚠️ Déconnexion parfois | ✅ OK |
| Entreprise → SELECT tickets | ❌ Récursion | ✅ OK |
| Vue tickets_visibles_entreprise | ❌ Récursion | ✅ OK (fonction) |
| Storage signatures | ❌ Récursion | ✅ OK |

---

## 🔍 DÉTAILS TECHNIQUES

### Fonctions SECURITY DEFINER
**Comportement**: Exécutent avec privilèges du propriétaire (postgres)  
**Conséquence**: Bypass RLS sur tables lues  
**Sécurité**: ✅ `SET search_path = public` force schéma connu  

### Différence vue vs fonction
```
VUE normale:
  → SELECT * FROM tickets_visibles_entreprise
  → PostgreSQL applique RLS sur tickets + regies_entreprises
  → Récursion détectée
  
FONCTION SECURITY DEFINER:
  → SELECT * FROM get_tickets_visibles_entreprise()
  → PostgreSQL bypass RLS (SECURITY DEFINER)
  → Pas de récursion
```

---

## 📞 SUPPORT

Si problème persistant:

1. ✅ Vérifier logs Supabase (Dashboard → Logs)
2. ✅ Exécuter tests validation (PARTIE 6 du hotfix)
3. ✅ Consulter `AUDIT_RLS_RECURSION_REGIES_ENTREPRISES.md` (diagnostic complet)
4. ❌ Ne PAS créer de nouvelle migration automatique
5. ✅ Reporter erreur exacte + contexte

---

**FIN DU GUIDE**
