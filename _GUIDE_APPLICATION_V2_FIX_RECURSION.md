# 🚨 FIX URGENT - RÉCURSION INFINIE RLS TECHNICIENS

## ❌ Problème actuel

La migration V1 (`_migration_rls_techniciens_tickets.sql`) a créé une **récursion infinie** :

```
Error: infinite recursion detected in policy for relation "tickets"
Error: infinite recursion detected in policy for relation "missions"
```

**Cause:** Les policies utilisent `EXISTS (SELECT ... FROM missions JOIN tickets ...)` ce qui crée une boucle :
- Policy tickets → vérifie missions
- Policy missions → vérifie tickets
- → Récursion infinie ♾️

---

## ✅ Solution V2 - SECURITY DEFINER Functions

### Différence technique

**V1 (bugguée):**
```sql
CREATE POLICY "..." ON tickets
USING (
  EXISTS (
    SELECT 1 FROM missions m
    JOIN tickets t ON ...  ← RLS vérifie policy tickets → RÉCURSION
  )
);
```

**V2 (correcte):**
```sql
-- Fonction qui IGNORE les policies RLS (SECURITY DEFINER)
CREATE FUNCTION technicien_can_view_ticket(p_ticket_id uuid)
RETURNS boolean
SECURITY DEFINER  ← Bypass RLS, pas de récursion
AS $$ ... $$;

-- Policy simple qui appelle la fonction
CREATE POLICY "..." ON tickets
USING (technicien_can_view_ticket(id));  ← Pas de JOIN direct
```

---

## 🚀 DÉPLOIEMENT V2

### Étape 1: Rollback V1 + Apply V2

**Ouvrir Supabase Dashboard → SQL Editor**

**Copier/coller le contenu COMPLET de:**
```
_migration_rls_techniciens_tickets_v2.sql
```

Ce fichier contient :
1. ❌ Suppression policies V1 (bugguées)
2. ✅ Création 4 fonctions SECURITY DEFINER
3. ✅ Création 4 policies V2 (sans récursion)
4. ✅ Vérification déploiement

**Cliquer sur "Run"**

### Étape 2: Vérifier déploiement

Dans le SQL Editor, exécuter :

```sql
-- Vérifier fonctions créées
SELECT proname, prosecdef
FROM pg_proc
WHERE proname LIKE 'technicien_can_view_%'
ORDER BY proname;
```

**Résultat attendu:** 4 fonctions avec `prosecdef = true`
```
technicien_can_view_immeuble    | t
technicien_can_view_locataire   | t
technicien_can_view_logement    | t
technicien_can_view_ticket      | t
```

```sql
-- Vérifier policies créées
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%Technicien can view%'
ORDER BY tablename;
```

**Résultat attendu:** 4 policies
```
immeubles   | Technicien can view immeubles from assigned missions
locataires  | Technicien can view locataires from assigned missions
logements   | Technicien can view logements from assigned missions
tickets     | Technicien can view tickets from assigned missions
```

---

## 🧪 TEST

### Test 1: Direct via SQL Editor

```sql
-- Se mettre dans le contexte d'un technicien
SET LOCAL auth.uid TO '3196179e-5258-457f-b31f-c88a4760ebe0';

-- Tester accès tickets (devrait marcher, pas d'erreur récursion)
SELECT id, categorie FROM tickets LIMIT 1;

-- Tester JOIN complet (comme dashboard)
SELECT 
  m.id,
  m.ticket_id,
  t.categorie,
  l.nom AS locataire_nom,
  log.adresse
FROM missions m
JOIN tickets t ON t.id = m.ticket_id
LEFT JOIN locataires l ON l.id = t.locataire_id
LEFT JOIN logements log ON log.id = t.logement_id
WHERE m.technicien_id = '3196179e-5258-457f-b31f-c88a4760ebe0'
LIMIT 1;
```

**Résultat attendu:** Pas d'erreur "infinite recursion", données retournées ✅

### Test 2: Dashboard technicien

1. Ouvrir: `http://localhost:3001/technicien/dashboard.html`
2. Login: `demo.technicien@test.app` / `Demo1234!`
3. **Vérifier:**
   - ✅ Pas de crash
   - ✅ Mission s'affiche
   - ✅ Console: `mission.ticket` n'est plus NULL
   - ✅ Catégorie, locataire, adresse visibles

4. Console (F12):
   ```javascript
   mission.ticket: {id: "...", categorie: "plomberie", locataire: {...}, logement: {...}}
   ```

---

## 📊 Comparaison V1 vs V2

| Aspect | V1 | V2 |
|--------|----|----|
| **Approche** | EXISTS + JOIN direct | SECURITY DEFINER function |
| **RLS récursion** | ❌ Oui (boucle infinie) | ✅ Non (bypass RLS) |
| **Performance** | ⚡ Très rapide | 🐢 Légèrement plus lent |
| **Complexité** | Simple (1 requête) | Moyenne (function + policy) |
| **Fonctionnalité** | ❌ Ne marche pas | ✅ Fonctionne |

**Conclusion:** V2 est la seule solution viable quand les policies font des JOINs entre tables protégées par RLS.

---

## 🔍 Pourquoi SECURITY DEFINER résout le problème ?

```sql
-- Sans SECURITY DEFINER:
CREATE POLICY ... USING (EXISTS (SELECT FROM missions JOIN tickets ...))
→ PostgreSQL vérifie RLS sur tickets
→ Policy tickets vérifie missions
→ Policy missions vérifie tickets
→ ♾️ RÉCURSION INFINIE

-- Avec SECURITY DEFINER:
CREATE FUNCTION technicien_can_view_ticket(...) SECURITY DEFINER
→ Fonction s'exécute avec les droits du créateur (superuser)
→ IGNORE toutes les policies RLS
→ Pas de récursion, retourne true/false directement
```

**`SECURITY DEFINER`** = La fonction s'exécute comme si c'était un admin qui l'appelle, donc RLS désactivé pour elle.

---

## ✅ CHECKLIST FINALE

- [ ] Copier/coller `_migration_rls_techniciens_tickets_v2.sql` dans SQL Editor
- [ ] Exécuter (devrait prendre ~2 secondes)
- [ ] Vérifier 4 fonctions créées (requête ci-dessus)
- [ ] Vérifier 4 policies créées (requête ci-dessus)
- [ ] Tester SQL direct avec SET LOCAL auth.uid
- [ ] Tester dashboard technicien UI
- [ ] Confirmer mission.ticket n'est plus NULL
- [ ] Vérifier console: pas d'erreur "infinite recursion"

---

## 📁 Fichiers

- ❌ **_migration_rls_techniciens_tickets.sql** - V1 bugguée (récursion)
- ✅ **_migration_rls_techniciens_tickets_v2.sql** - V2 correcte (SECURITY DEFINER)
- 📖 **_GUIDE_APPLICATION_V2_FIX_RECURSION.md** - Ce guide

---

**🎯 ACTION:** Déployer `_migration_rls_techniciens_tickets_v2.sql` maintenant via Supabase SQL Editor
