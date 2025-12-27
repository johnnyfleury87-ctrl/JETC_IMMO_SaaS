# ✅ VALIDATION ÉTAPE 1 - M22 Hotfix Déconnexion Régie

**Date**: 27 décembre 2025  
**Migration**: M22  
**Priorité**: 🔴 CRITIQUE  
**Statut**: ⏳ EN ATTENTE VALIDATION

---

## 📦 Changements Appliqués

### 1. Migration SQL
**Fichier**: `supabase/migrations/M22_rpc_regie_dashboard_tickets.sql`

✅ Fonction `get_tickets_dashboard_regie()` créée
- Type: `SECURITY DEFINER` (bypass RLS)
- Retourne: Compteurs tickets (nouveau, en_attente, en_cours, termine)
- Sécurité: Vérifie `regies.profile_id = auth.uid()`
- Permissions: `GRANT EXECUTE TO authenticated`

### 2. Frontend Modifié
**Fichier**: `public/regie/dashboard.html`

✅ Fonction `loadDashboard()` refactorisée
- **AVANT**: `.from('tickets').select(...count...)` → Récursion RLS
- **APRÈS**: `.rpc('get_tickets_dashboard_regie')` → Bypass RLS
- Logs ajoutés: `[REGIE][TICKETS]` avec emojis pour suivi
- Gestion erreurs améliorée

---

## 🧪 PROCÉDURE DE VALIDATION

### ⚠️ CRITIQUE : Cette validation est BLOQUANTE
**On ne passe PAS à l'étape 2 tant que tous les tests ne sont pas ✅**

---

### TEST 1 : Migration SQL Applied

#### Action
```bash
# Appliquer migration dans Supabase SQL Editor
cd supabase/migrations
# Copier contenu M22_rpc_regie_dashboard_tickets.sql
# Coller dans SQL Editor Supabase
# Exécuter
```

#### Critères de succès
- [ ] Migration exécutée sans erreur
- [ ] Message: "Success. No rows returned"
- [ ] Fonction visible dans Database → Functions

#### Requête vérification
```sql
-- Vérifier fonction créée
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_tickets_dashboard_regie';

-- Résultat attendu:
-- routine_name                    | routine_type | security_type
-- -------------------------------|--------------|---------------
-- get_tickets_dashboard_regie    | FUNCTION     | DEFINER
```

---

### TEST 2 : Fonction RPC (Backend)

#### Action
```sql
-- Dans Supabase SQL Editor, connecté avec un utilisateur RÉGIE
-- (ou via Dashboard Supabase > SQL Editor avec user régie)

SELECT * FROM public.get_tickets_dashboard_regie();
```

#### Critères de succès
- [ ] Requête s'exécute sans erreur
- [ ] Retourne 1 ligne avec 4 colonnes
- [ ] Valeurs cohérentes (integers >= 0)

#### Résultat attendu
```
count_nouveau | count_en_attente | count_en_cours | count_termine
--------------|------------------|----------------|---------------
      2       |        1         |      3         |       5
```
*(Valeurs exactes dépendent des tickets en base)*

#### Si erreur
```
ERROR: Utilisateur non associé à une régie
→ User testé n'est PAS un rôle régie
→ Tester avec bon user ou créer user régie
```

---

### TEST 3 : Frontend UI (Utilisateur Régie)

#### Action
1. Déployer modifications sur Vercel (ou local)
2. Ouvrir navigateur en mode **Incognito**
3. Aller sur `https://<domain>/login.html`
4. Login avec utilisateur **régie** :
   - Email: `<email_regie_test>`
   - Mot de passe: `<password_test>`
5. Observer comportement dashboard

#### Critères de succès CRITIQUES
- [ ] ✅ **Login réussi** (pas de déconnexion immédiate)
- [ ] ✅ **Dashboard charge** (vue d'accueil s'affiche)
- [ ] ✅ **Pas de déconnexion automatique**
- [ ] ✅ **Compteurs tickets visibles** ou "Aucun ticket"
- [ ] ✅ **Console browser propre** (pas d'erreur RLS)

#### Logs console attendus
```
[REGIE][TICKETS] 🚀 Chargement dashboard via RPC M22...
[REGIE][TICKETS] ✅ Compteurs reçus: {nouveau: 2, en_attente: 1, ...}
[REGIE][TICKETS] 🔔 Alerte affichée: 2 tickets nouveaux
```

#### Si logs d'erreur
```
[REGIE][TICKETS] ❌ Erreur RPC: {...}
→ Vérifier migration M22 appliquée
→ Vérifier permissions GRANT EXECUTE
→ Consulter logs Supabase
```

---

### TEST 4 : Logs Supabase (Backend)

#### Action
```bash
# Si Supabase Cloud : Dashboard > Logs
# Si local : docker logs supabase-db

# Ou requête SQL :
SELECT 
  created_at,
  payload->'error' as error_msg
FROM auth.audit_log_entries
WHERE payload::text LIKE '%infinite%recursion%'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

#### Critères de succès
- [ ] ✅ **0 erreur** "infinite recursion"
- [ ] ✅ **0 erreur** RLS policy
- [ ] ✅ **0 timeout** PostgreSQL

---

### TEST 5 : Navigation Régie

#### Action
1. Toujours connecté comme régie
2. Cliquer sur menu "Tickets" (si existe)
3. Cliquer sur onglet "Dashboard"
4. Rafraîchir page (F5)

#### Critères de succès
- [ ] ✅ Navigation fluide
- [ ] ✅ Aucune déconnexion
- [ ] ✅ Compteurs se rechargent correctement

---

### TEST 6 : Performance

#### Action
```javascript
// Dans console browser (après login régie)
console.time('RPC_DASHBOARD');
const { data, error } = await supabase.rpc('get_tickets_dashboard_regie');
console.timeEnd('RPC_DASHBOARD');
console.log('Résultat:', data);
```

#### Critères de succès
- [ ] ✅ Temps exécution **< 500ms**
- [ ] ✅ Pas d'erreur retournée

---

## 📊 RÉSULTATS VALIDATION

### Checklist Globale

- [ ] TEST 1: Migration SQL appliquée
- [ ] TEST 2: RPC fonctionne (SQL Editor)
- [ ] TEST 3: Frontend UI OK (pas déconnexion)
- [ ] TEST 4: Logs Supabase propres
- [ ] TEST 5: Navigation stable
- [ ] TEST 6: Performance < 500ms

### Statut Final Étape 1

- [ ] ✅ **VALIDÉ** - Tous tests passent → Passer ÉTAPE 2
- [ ] ❌ **BLOQUÉ** - Au moins 1 test échoue → Corriger avant ÉTAPE 2

---

## 🐛 Troubleshooting

### Problème 1 : Fonction introuvable
```
ERROR: function get_tickets_dashboard_regie() does not exist
```

**Solution** :
1. Vérifier migration M22 appliquée dans bon projet Supabase
2. Re-exécuter migration SQL
3. Vérifier schema: doit être `public.get_tickets_dashboard_regie`

### Problème 2 : Permission denied
```
ERROR: permission denied for function get_tickets_dashboard_regie
```

**Solution** :
```sql
GRANT EXECUTE ON FUNCTION public.get_tickets_dashboard_regie() TO authenticated;
```

### Problème 3 : User non régie
```
ERROR: Utilisateur non associé à une régie
```

**Solution** :
- Vérifier `profiles.role = 'regie'`
- Vérifier `regies.profile_id = auth.uid()`
- Tester avec autre user régie

### Problème 4 : Déconnexion persiste
```
User déconnecté après login régie
```

**Solution** :
1. Vérifier migration M22 bien appliquée
2. Vider cache browser (Ctrl+Shift+Delete)
3. Tester mode Incognito
4. Consulter logs Supabase pour autre erreur

---

## 📝 Notes de Validation

**Validateur** : _____________  
**Date test** : _____________  
**Environnement** : [ ] Production [ ] Staging [ ] Local  
**User testé** : _____________

**Observations** :
```
<Ajouter notes ici>
```

**Captures écran** :
- [ ] Console browser (logs)
- [ ] Dashboard régie (UI)
- [ ] SQL Editor (résultat RPC)

---

## ✅ Signature Validation

**Étape 1 validée le** : ___________  
**Par** : ___________  
**Statut** : [ ] ✅ GO ÉTAPE 2 | [ ] ❌ BLOQUÉ

---

**Prochaine étape si validé** : ÉTAPE 2 - Diagnostic tickets locataire
