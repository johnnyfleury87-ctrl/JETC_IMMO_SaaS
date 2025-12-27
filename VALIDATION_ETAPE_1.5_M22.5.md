# ✅ VALIDATION ÉTAPE 1.5 - Correction Clic Ticket Régie

**Date**: 27 décembre 2025  
**Migration**: M22.5  
**Priorité**: 🔴 CRITIQUE  
**Statut**: ⏳ EN ATTENTE VALIDATION

---

## 📦 Changements Appliqués

### 1. Migration SQL
**Fichier**: `supabase/migrations/M22.5_rpc_tickets_liste_detail_regie.sql`

✅ **3 fonctions RPC créées** :
1. `get_tickets_list_regie(p_statut)` - Liste tickets par statut avec jointures
2. `get_ticket_detail_regie(p_ticket_id)` - Détail complet ticket
3. `update_ticket_regie(p_ticket_id, p_priorite, p_plafond)` - Update ticket

**Toutes** : `SECURITY DEFINER` → bypass RLS récursion

### 2. Frontend Modifié
**Fichier**: `public/regie/tickets.html`

✅ **2 fonctions refactorisées** :
- `loadTicketsByStatut()` : Utilise RPC `get_tickets_list_regie`
- `validateTicket()` : Utilise RPC `update_ticket_regie`

❌ **ÉLIMINÉ** : TOUS les `.from('tickets')` côté régie

### 3. Corrections 404 JS
**Fichiers** :
- `public/login.html` : i18n inline (évite `/src/lib/i18n.js` 404)
- `public/demo-hub.html` : i18n + demoProfiles inline

---

## 🔍 PROBLÈMES IDENTIFIÉS ET CORRIGÉS

### ❌ Problème 1 : `.from('tickets').select()` ligne 717
**Impact** : Chargement liste tickets déclenchait récursion RLS → déconnexion

**Correction** : Remplacé par `.rpc('get_tickets_list_regie', {p_statut: ...})`

### ❌ Problème 2 : `.from('tickets').update()` ligne 877
**Impact** : Validation ticket déclenchait récursion RLS → déconnexion

**Correction** : Remplacé par `.rpc('update_ticket_regie', {...})`

### ❌ Problème 3 : `/src/lib/i18n.js` 404
**Impact** : Erreur console, i18n non chargé

**Correction** : i18n inline dans login.html et demo-hub.html

---

## 🧪 PROCÉDURE DE VALIDATION

### ⚠️ CRITIQUE : Cette validation est BLOQUANTE
**On ne passe PAS à l'ÉTAPE 2 tant que tous les tests ne sont pas ✅**

---

### TEST 1 : Migration M22.5 Applied

#### Action
```bash
# Appliquer migration dans Supabase SQL Editor
# Copier contenu M22.5_rpc_tickets_liste_detail_regie.sql
# Coller dans SQL Editor Supabase
# Exécuter
```

#### Critères de succès
- [ ] Migration exécutée sans erreur
- [ ] 3 fonctions créées visibles dans Database → Functions

#### Requêtes vérification
```sql
-- Vérifier 3 fonctions créées
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%ticket%regie%'
ORDER BY routine_name;

-- Résultat attendu (3 lignes):
-- get_ticket_detail_regie        | FUNCTION | DEFINER
-- get_tickets_list_regie         | FUNCTION | DEFINER
-- update_ticket_regie            | FUNCTION | DEFINER
```

---

### TEST 2 : RPC Liste Tickets (Backend)

#### Action
```sql
-- Dans Supabase SQL Editor, connecté avec user régie
SELECT * FROM public.get_tickets_list_regie('nouveau');
SELECT * FROM public.get_tickets_list_regie('ouvert');
```

#### Critères de succès
- [ ] Requêtes s'exécutent sans erreur
- [ ] Retournent lignes avec colonnes attendues
- [ ] Jointures locataires/logements OK

---

### TEST 3 : RPC Détail Ticket (Backend)

#### Action
```sql
-- Récupérer un UUID ticket existant
SELECT id FROM public.tickets LIMIT 1;

-- Tester détail
SELECT * FROM public.get_ticket_detail_regie('<UUID_TICKET>');
```

#### Critères de succès
- [ ] Requête s'exécute sans erreur
- [ ] Retourne 1 ligne avec détails complets
- [ ] Toutes colonnes présentes

---

### TEST 4 : RPC Update Ticket (Backend)

#### Action
```sql
SELECT * FROM public.update_ticket_regie(
  '<UUID_TICKET>',
  'haute',
  750.00
);
```

#### Critères de succès
- [ ] Requête s'exécute sans erreur
- [ ] Retourne JSON `{"success": true, ...}`
- [ ] Ticket réellement mis à jour (vérifier avec SELECT)

---

### TEST 5 : Frontend UI - Login & Dashboard

#### Action
1. Déployer modifications (Vercel ou local)
2. Ouvrir navigateur **Incognito**
3. Aller sur login page
4. Login avec utilisateur **régie**

#### Critères de succès CRITIQUES
- [ ] ✅ Login réussi (pas de déconnexion)
- [ ] ✅ Dashboard charge (compteurs OK - M22 validé)
- [ ] ✅ **Pas d'erreur 404** `/src/lib/i18n.js` dans console

#### Logs console attendus
```
[REGIE][AUTH] ✅ Authentification validée - Régie: ...
[REGIE][TICKETS] 🚀 Chargement dashboard via RPC M22...
[REGIE][TICKETS] ✅ Compteurs reçus: {...}
```

---

### TEST 6 : 🔴 CRITIQUE - Clic sur Ticket

#### Action
1. Toujours connecté comme régie
2. Aller sur `/regie/tickets.html`
3. Attendre chargement liste tickets
4. **CLIQUER sur un ticket**

#### Critères de succès CRITIQUES
- [ ] ✅ **Pas de déconnexion**
- [ ] ✅ **Pas d'erreur RLS** dans console
- [ ] ✅ Liste tickets charge via RPC
- [ ] ✅ Détail ticket charge (modal/page)

#### Logs console attendus
```
[REGIE][TICKETS] 🚀 Chargement statut=nouveau via RPC M22.5...
[REGIE][TICKETS] ✅ 3 tickets nouveau chargés
```

#### ⚠️ Si logs d'erreur
```
[REGIE][TICKETS] ❌ Erreur RPC nouveau: {...}
→ Vérifier migration M22.5 appliquée
→ Vérifier permissions GRANT EXECUTE
```

---

### TEST 7 : Validation Ticket (Modal)

#### Action
1. Toujours sur `/regie/tickets.html`
2. Cliquer sur ticket statut "nouveau"
3. Cliquer bouton "Valider"
4. Remplir priorité + plafond
5. Soumettre formulaire

#### Critères de succès CRITIQUES
- [ ] ✅ **Pas de déconnexion**
- [ ] ✅ Modal se ferme
- [ ] ✅ Message succès affiché
- [ ] ✅ Ticket déplacé section "Ouvert"

#### Logs console attendus
```
[REGIE][ACTION] Validation ticket: {...}
[REGIE][ACTION] ✅ Ticket mis à jour: {...}
[REGIE][ACTION] ✅ Ticket validé avec succès
```

---

### TEST 8 : Logs Supabase (Backend)

#### Action
```sql
-- Vérifier aucune erreur récursion depuis 1h
SELECT 
  created_at,
  payload->'error' as error_msg
FROM auth.audit_log_entries
WHERE payload::text LIKE '%infinite%recursion%'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

#### Critères de succès
- [ ] ✅ **0 résultat** (aucune erreur récursion)

---

### TEST 9 : Vérification Exhaustive `.from('tickets')`

#### Action
```bash
# Dans workspace
cd /workspaces/JETC_IMMO_SaaS
grep -r "\.from('tickets')" public/regie/*.html
```

#### Critères de succès
- [ ] ✅ **0 résultat** actif (uniquement commentaires)

#### Résultat attendu
```
// Uniquement en commentaires :
// AVANT: .from('tickets').select(...) → Récursion RLS
// APRÈS: .rpc('get_tickets_list_regie', {...}) → Bypass RLS
```

---

## 📊 RÉSULTATS VALIDATION

### Checklist Globale

- [ ] TEST 1: Migration M22.5 appliquée (3 fonctions)
- [ ] TEST 2: RPC liste tickets fonctionne
- [ ] TEST 3: RPC détail ticket fonctionne
- [ ] TEST 4: RPC update ticket fonctionne
- [ ] TEST 5: Login régie OK + dashboard OK
- [ ] TEST 6: 🔴 **CRITIQUE** - Clic ticket = PAS déconnexion
- [ ] TEST 7: Validation ticket OK
- [ ] TEST 8: Logs Supabase propres (0 récursion)
- [ ] TEST 9: 0 `.from('tickets')` actif côté régie

### Statut Final Étape 1.5

- [ ] ✅ **VALIDÉ** - Tous tests passent → Passer ÉTAPE 2
- [ ] ❌ **BLOQUÉ** - Au moins 1 test échoue → **NE PAS AVANCER**

---

## 🐛 Troubleshooting

### Problème 1 : Déconnexion persiste au clic ticket

```
User déconnecté après clic sur ticket
```

**Diagnostic** :
1. Ouvrir console browser **AVANT** de cliquer
2. Noter **EXACTEMENT** l'erreur affichée
3. Noter **ligne exacte** du fichier JS
4. Vérifier si `.from('tickets')` encore présent

**Solution** :
- Si `.from('tickets')` trouvé → Supprimer et remplacer par RPC
- Si erreur RPC → Vérifier migration M22.5 appliquée

### Problème 2 : RPC introuvable

```
ERROR: function get_tickets_list_regie(ticket_status) does not exist
```

**Solution** :
1. Re-exécuter migration M22.5
2. Vérifier schema: `public.get_tickets_list_regie`
3. Vérifier permissions GRANT

### Problème 3 : 404 i18n.js persiste

```
GET /src/lib/i18n.js 404 (Not Found)
```

**Solution** :
1. Vider cache browser (Ctrl+Shift+Delete)
2. Vérifier modifications login.html déployées
3. Vérifier inline `<script>` présent

---

## 🛑 STOP CONDITION

**Si une déconnexion survient encore après TEST 6 :**

### ⚠️ NE PAS AVANCER - Lister exactement :

1. **Requête SQL exécutée** : (copier depuis console Network)
2. **Fichier JS** : (ex: `public/regie/tickets.html`)
3. **Ligne exacte** : (ex: ligne 850)
4. **Erreur console** : (copier message exact)

### 📸 Captures obligatoires :
- [ ] Console browser (onglet Console)
- [ ] Network tab (filtrer "tickets")
- [ ] Application tab (vérifier auth token présent)

---

## ✅ Signature Validation

**Étape 1.5 validée le** : ___________  
**Par** : ___________  
**Statut** : [ ] ✅ GO ÉTAPE 2 | [ ] ❌ BLOQUÉ

**Observations** :
```
<Ajouter notes ici>
```

---

## 🎯 Prochaine étape si validé

**ÉTAPE 2** : Diagnostic tickets invisibles locataire
- Instrumentation logs frontend
- Requêtes SQL diagnostic
- Migration M23 si RLS confirmée cause

---

**Validation créée le** : 27 décembre 2025  
**Criticité** : 🔴 BLOQUANTE  
**Durée estimée** : 30 min (si tout nominal)
