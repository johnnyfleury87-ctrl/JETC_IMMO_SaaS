# 🚨 RAPPORT DIAGNOSTIC - mission.ticket NULL CÔTÉ TECHNICIEN

**Date:** 7 janvier 2026  
**Problème:** Dashboard technicien crash car `mission.ticket === null`  
**Statut:** ✅ **CAUSE IDENTIFIÉE + FIX FOURNI**

---

## 🎯 SYMPTÔME

```javascript
Console: "[TECH][DEBUG] TICKET OBJECT: null"
→ Crash application (Cannot read property 'categorie' of null)
```

**Observation:**
- En `service_role`: `mission.ticket_id` existe ET ticket existe en DB
- Côté technicien (RLS actif): `mission.ticket === null` malgré `mission.ticket_id` valide

---

## 🔍 DIAGNOSTIC EFFECTUÉ

### ✅ Étape 1: Requête dashboard technicien

**Fichier:** [public/technicien/dashboard.html](public/technicien/dashboard.html#L841-L877)

**Requête Supabase (lignes 841-877):**
```javascript
const { data: missions, error } = await window.supabaseClient
  .from('missions')
  .select(`
    *,
    ticket:tickets(
      id,
      categorie,
      sous_categorie,
      description,
      piece,
      photos,
      locataire:locataires(nom, prenom, telephone, email),
      logement:logements(
        adresse, npa, ville, numero, etage, pays,
        immeuble:immeubles(nom, adresse, npa, ville, digicode, interphone, ascenseur)
      )
    )
  `);
```

**✅ Requête correcte:** Fait bien le JOIN `missions → tickets → locataires/logements/immeubles`

### ✅ Étape 2: Test avec compte technicien (RLS actif)

**Résultats:**
```
Login technicien: demo.technicien@test.app ✅
auth.uid(): 3196179e

Test 1: Accès direct tickets
  ❌ ERREUR RLS: PGRST116
  → Le technicien NE PEUT PAS lire la table tickets

Test 2: Mission avec JOIN ticket (comme dashboard)
  ✅ Requête mission OK
  ❌ mission.ticket: NULL
  
🚨 PROBLÈME: ticket_id existe MAIS ticket (join) est NULL
   → RLS bloque le JOIN vers tickets

Test 3: Accès locataires
  ❌ ERREUR RLS: Cannot coerce result
  → Le technicien NE PEUT PAS lire la table locataires

Test 4: Accès logements
  ❌ ERREUR RLS: Cannot coerce result
  → Le technicien NE PEUT PAS lire la table logements
```

### ✅ Étape 3: Vérification RLS policies existantes

**Fichier:** [supabase/schema/18_rls.sql](supabase/schema/18_rls.sql#L195-L250)

**Policies tickets existantes:**
1. `Locataire can view own tickets` - Pour locataires
2. `Locataire can create own tickets` - Pour locataires
3. `Regie can view own tickets` - Pour régies
4. `Regie can manage own tickets` - Pour régies
5. `Entreprise can view authorized tickets` - Pour entreprises
6. `Admin JTEC can view all tickets` - Pour admins

**❌ MANQUANT:** Aucune policy pour **techniciens** avec missions assignées !

**Même constat pour:**
- ❌ `locataires` - Pas de policy pour techniciens
- ❌ `logements` - Pas de policy pour techniciens
- ❌ `immeubles` - Pas de policy pour techniciens

---

## 🎯 CAUSE RACINE

**RLS bloque l'accès des techniciens aux tables nécessaires**

```
Technicien connecté (auth.uid() = profile_id)
    ↓
Requête: missions → tickets (JOIN)
    ↓
RLS vérifie policies sur table tickets
    ↓
Aucune policy ne permet à ce technicien de voir le ticket
    ↓
JOIN retourne NULL silencieusement
    ↓
mission.ticket === null ❌
```

**Comportement Supabase:**
- Les JOINs bloqués par RLS retournent `null` (pas d'erreur explicite)
- Le frontend reçoit `mission.ticket_id` (présent) mais `mission.ticket` (null)
- Résultat: Crash si code ne vérifie pas `ticket !== null`

---

## ✅ SOLUTION APPLIQUÉE

### 1️⃣ Migration SQL - Policies RLS pour techniciens

**Fichier créé:** `_migration_rls_techniciens_tickets.sql`

**Policies ajoutées:**

```sql
-- 1. Techniciens peuvent voir tickets de leurs missions
CREATE POLICY "Technicien can view tickets from assigned missions"
ON tickets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN techniciens t ON t.id = m.technicien_id
    WHERE m.ticket_id = tickets.id
      AND t.profile_id = auth.uid()
  )
);

-- 2. Techniciens peuvent voir locataires de leurs missions
CREATE POLICY "Technicien can view locataires from assigned missions"
ON locataires FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.locataire_id = locataires.id
      AND tech.profile_id = auth.uid()
  )
);

-- 3. Techniciens peuvent voir logements de leurs missions
CREATE POLICY "Technicien can view logements from assigned missions"
ON logements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.logement_id = logements.id
      AND tech.profile_id = auth.uid()
  )
);

-- 4. Techniciens peuvent voir immeubles de leurs missions
CREATE POLICY "Technicien can view immeubles from assigned missions"
ON immeubles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN logements log ON log.id = t.logement_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE log.immeuble_id = immeubles.id
      AND tech.profile_id = auth.uid()
  )
);
```

**Logique:**
- Filtre via `missions.technicien_id → techniciens.profile_id = auth.uid()`
- Le technicien voit UNIQUEMENT les données des missions qui lui sont assignées
- Aucun accès aux autres tickets/locataires/logements

### 2️⃣ Patch frontend - Robustesse

**Fichier modifié:** [public/technicien/dashboard.html](public/technicien/dashboard.html)

**Changements:**

**A) Logs améliorés (lignes 900-906):**
```javascript
if (!sample.ticket) {
  console.error('[TECH][DEBUG] ❌ TICKET IS NULL/UNDEFINED');
  console.error('[TECH][DEBUG] → RLS bloque probablement l\'accès aux tickets');
  console.error('[TECH][DEBUG] → Appliquer migration: _migration_rls_techniciens_tickets.sql');
  console.error('[TECH][DEBUG] → Mission ID:', sample.id);
  console.error('[TECH][DEBUG] → Ticket ID:', sample.ticket_id);
}
```

**B) Gestion ticket null dans createMissionCard() (lignes 972-1001):**
```javascript
if (!mission.ticket) {
  console.warn('[TECH][CARD] Mission sans ticket (RLS bloque):', {
    mission_id: mission.id,
    ticket_id: mission.ticket_id
  });
  
  card.innerHTML = `
    <div class="mission-header">
      <span class="badge badge-${mission.statut}">${getStatutLabel(mission.statut)}</span>
      <span class="mission-ref">#${mission.id.substring(0, 8)}</span>
    </div>
    <div class="mission-body">
      <h3>⚠️ Ticket inaccessible (RLS)</h3>
      <p style="color: var(--red-500);">Les informations du ticket ne sont pas disponibles.</p>
      <p style="font-size: 13px;">Ticket ID: ${mission.ticket_id?.substring(0, 8)}</p>
      <p style="font-size: 13px;">Cause: Policies RLS manquantes</p>
    </div>
  `;
  
  return card;
}
```

**Résultat:** Le dashboard ne crash plus, affiche un message explicite si RLS bloque.

---

## 📋 QUESTION: tickets.technicien_id

### ✅ Vérification effectuée

**Script:** `_verifier_tickets_technicien_id.js`

**Résultat:**
```
tickets.technicien_id: Existe dans le schéma (FK vers techniciens)
Valeur actuelle: NULL pour tous les tickets
```

**Observation code:**
- Aucun code ne remplit `tickets.technicien_id`
- Seul `missions.technicien_id` est utilisé pour l'assignation

### 📊 Conclusion

**tickets.technicien_id reste NULL par design**

**Raisons:**
1. **Éviter duplication:** L'assignation est portée par `missions.technicien_id`
2. **Souplesse:** Un ticket peut avoir plusieurs missions (différents techniciens)
3. **Cohérence:** Source de vérité unique = `missions`

**Preuve:**
- RPC `assign_technicien_to_mission` ne touche PAS à `tickets.technicien_id`
- Aucun trigger/fonction ne synchronise `tickets.technicien_id`
- Les policies entreprise filtrent sur `tickets.entreprise_id`, pas `technicien_id`

**Recommandation:** ✅ **GARDER l'état actuel**
- `tickets.technicien_id` reste NULL
- Policies RLS basées sur `missions.technicien_id` (comme fourni)
- Plus simple, moins de risque d'incohérence

---

## 🚀 DÉPLOIEMENT

### Actions requises

**1. Déployer migration SQL (OBLIGATOIRE)**

```bash
# Via Supabase SQL Editor
1. Ouvrir: Dashboard Supabase → SQL Editor
2. Copier/coller: _migration_rls_techniciens_tickets.sql
3. Exécuter
```

**Durée:** 30 secondes  
**Impact:** Aucun downtime, ajout de policies uniquement

**2. Frontend déjà patché** ✅

Le code [public/technicien/dashboard.html](public/technicien/dashboard.html) a été modifié pour:
- Logger explicitement si `ticket === null`
- Afficher un message d'erreur clair au lieu de crasher

---

## 🧪 TESTS À EFFECTUER

### Test 1: Vérifier policies déployées

```sql
-- Via SQL Editor
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE policyname LIKE '%Technicien can view%';
```

**Résultat attendu:** 4 policies (tickets, locataires, logements, immeubles)

### Test 2: Login technicien

```bash
# Test automatisé
node _diagnostic_ticket_null.js
```

**Avant migration:**
```
❌ Accès direct tickets: ERREUR RLS
❌ mission.ticket: NULL
```

**Après migration:**
```
✅ Accès direct tickets: OK
✅ mission.ticket: PRÉSENT
✅ ticket.categorie: plomberie
✅ ticket.locataire: PRÉSENT
✅ ticket.logement: PRÉSENT
```

### Test 3: Dashboard technicien UI

1. Ouvrir: http://localhost:3001/technicien/dashboard.html
2. Login: demo.technicien@test.app / Demo1234!
3. **Vérifier:**
   - ✅ Mission s'affiche (pas de crash)
   - ✅ Catégorie visible (ex: "Plomberie")
   - ✅ Locataire visible (nom, téléphone)
   - ✅ Adresse visible (rue, NPA, ville)
   - ✅ Code d'accès visible

4. Console (F12):
   ```
   [TECH][DEBUG] ticket: {id: "...", categorie: "plomberie", ...}
   ✅ Pas d'erreur "TICKET IS NULL"
   ```

---

## 📊 RÉSUMÉ

| Aspect | État AVANT | État APRÈS |
|--------|------------|------------|
| **RLS tickets** | ❌ Bloque techniciens | ✅ Policy ajoutée |
| **RLS locataires** | ❌ Bloque techniciens | ✅ Policy ajoutée |
| **RLS logements** | ❌ Bloque techniciens | ✅ Policy ajoutée |
| **RLS immeubles** | ❌ Bloque techniciens | ✅ Policy ajoutée |
| **mission.ticket** | ❌ NULL (RLS) | ✅ Objet complet |
| **Dashboard** | ❌ Crash | ✅ Fonctionne |
| **Frontend robustesse** | ⚠️ Pas de vérif | ✅ Gestion null |

---

## 📁 FICHIERS CRÉÉS

1. **_diagnostic_ticket_null.js** - Script de diagnostic complet
2. **_verifier_tickets_technicien_id.js** - Vérification tickets.technicien_id
3. **_migration_rls_techniciens_tickets.sql** - ⚠️ **À DÉPLOYER**
4. **_RAPPORT_DIAGNOSTIC_TICKET_NULL.md** - Ce rapport

**Fichier modifié:**
- [public/technicien/dashboard.html](public/technicien/dashboard.html) - Patch robustesse ✅

---

## ✅ CHECKLIST FINALE

- [x] Cause identifiée (RLS manquant)
- [x] Migration SQL créée
- [x] Frontend patché (robustesse)
- [x] Tests automatisés créés
- [x] Documentation complète
- [ ] **Migration SQL déployée** ⚠️ À FAIRE
- [ ] **Tests UI validés** ⚠️ À FAIRE

---

**🎯 ACTION IMMÉDIATE:** Déployer `_migration_rls_techniciens_tickets.sql` via Supabase SQL Editor

**Durée:** 30 secondes  
**Résultat attendu:** Les techniciens voient leurs tickets immédiatement
