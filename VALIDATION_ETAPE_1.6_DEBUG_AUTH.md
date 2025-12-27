# 🚨 VALIDATION ÉTAPE 1.6 - DEBUG AUTH FORCÉ (RÉGIE)

**Date**: 27 décembre 2025  
**Priorité**: 🔴 CRITIQUE - BLOQUANT ABSOLU  
**Statut**: ⏳ EN ATTENTE TEST UTILISATEUR

---

## 🎯 OBJECTIF

**EMPÊCHER TOUT LOGOUT AUTOMATIQUE** et **CAPTURER L'ERREUR EXACTE** qui provoque la déconnexion immédiate à l'ouverture de `/regie/tickets.html`.

---

## 📦 CHANGEMENTS APPLIQUÉS

### 1. Logout Automatique DÉSACTIVÉ

**Fichier**: [public/regie/tickets.html](public/regie/tickets.html)

✅ **5 redirections `/login.html` COMMENTÉES** :
1. Ligne ~651: Session null → LOGOUT BLOQUÉ
2. Ligne ~664: Profile null → LOGOUT BLOQUÉ
3. Ligne ~671: Role incorrect → LOGOUT BLOQUÉ
4. Ligne ~685: Régie null → LOGOUT BLOQUÉ
5. Ligne ~721: Exception catch → LOGOUT BLOQUÉ

**Tous les `window.location.href = '/login.html'` sont précédés de** :
```javascript
// 🛑 TEMPORAIREMENT DÉSACTIVÉ POUR DEBUG (ÉTAPE 1.6)
// window.location.href = '/login.html';
```

### 2. Logs DEBUG Complets Ajoutés

#### Fonction `checkAuth()`
```javascript
console.log('[REGIE][DEBUG] 🚀 checkAuth() démarré');
console.log('[REGIE][DEBUG] session=', session, 'sessionError=', sessionError);
console.log('[REGIE][DEBUG] profile=', profile, 'profileError=', profileError);
console.log('[REGIE][DEBUG] regie=', regie, 'regieError=', regieError);
```

#### Fonction `loadAllTickets()`
```javascript
console.log('[REGIE][DEBUG] 🚀 loadAllTickets() démarré');
console.log('[REGIE][DEBUG] currentRegieId=', window.currentRegieId);
// + try/catch avec stack trace
```

#### Fonction `loadTicketsByStatut()`
```javascript
console.log('[REGIE][DEBUG] 🔵 loadTicketsByStatut(nouveau) démarré');
console.log('[REGIE][DEBUG] 🚀 Appel RPC get_tickets_list_regie...');
console.log('[REGIE][DEBUG] 📥 Résultat RPC:', { tickets, error });

// Si erreur:
console.error('[REGIE][DEBUG]   - error.message:', error.message);
console.error('[REGIE][DEBUG]   - error.details:', error.details);
console.error('[REGIE][DEBUG]   - error.hint:', error.hint);
console.error('[REGIE][DEBUG]   - error.code:', error.code);
console.error('[REGIE][DEBUG]   - error complet:', JSON.stringify(error, null, 2));
```

### 3. Patch SQL Temporaire (OPTIONNEL)

**Fichier**: [M22.5.DEBUG_patch_raise_return.sql](supabase/migrations/M22.5.DEBUG_patch_raise_return.sql)

**Remplace** `RAISE EXCEPTION` par `RETURN` dans 3 RPC :
- `get_tickets_list_regie()` → RETURN vide
- `get_ticket_detail_regie()` → RETURN vide
- `update_ticket_regie()` → RETURN JSON erreur

**Objectif**: Confirmer si `RAISE EXCEPTION` invalide le token auth

---

## 🧪 PROCÉDURE DE TEST

### ⚠️ CRITIQUE : Tests OBLIGATOIRES

---

### TEST 1 : Déploiement Frontend

#### Action
```bash
# Déployer tickets.html modifié
git add public/regie/tickets.html
git commit -m "DEBUG: Désactiver logout auto + logs ÉTAPE 1.6"
git push
# Attendre déploiement Vercel (1-2 min)
```

#### Critères de succès
- [ ] Commit poussé sans erreur
- [ ] Déploiement Vercel terminé
- [ ] tickets.html modifié visible en production

---

### TEST 2 : Console Browser Ouverte AVANT Navigation

#### Action
1. Ouvrir navigateur **Incognito** (Ctrl+Shift+N)
2. **Ouvrir DevTools** (F12) AVANT toute navigation
3. Onglet **Console** visible
4. Cocher **Preserve log** (pour garder logs après redirection)
5. Aller sur `/login.html`

#### Résultat attendu
Console prête à capturer tous les logs

---

### TEST 3 : Login Régie

#### Action
1. Login avec utilisateur **régie**
2. **NE PAS NAVIGUER** tout de suite
3. Attendre redirection dashboard automatique

#### Logs attendus dans console
```
[REGIE][DEBUG] 🚀 checkAuth() démarré
[REGIE][DEBUG] session= {...}
[REGIE][DEBUG] profile= {...}
[REGIE][DEBUG] regie= {...}
```

#### Critères de succès
- [ ] Login réussi (pas de déconnexion)
- [ ] Dashboard régie charge
- [ ] Logs `[REGIE][DEBUG]` visibles dans console

---

### TEST 4 : 🔴 CRITIQUE - Navigation vers /regie/tickets.html

#### Action
1. Toujours avec console ouverte
2. Cliquer sur "Tickets" dans menu OU aller manuellement sur `/regie/tickets.html`
3. **OBSERVER IMMÉDIATEMENT LA CONSOLE**

#### 🎯 Scénario A : Logs s'affichent, PAS de déconnexion

```
[REGIE][DEBUG] 🚀 checkAuth() démarré
[REGIE][DEBUG] session= {user: {...}, access_token: "..."}
[REGIE][DEBUG] profile= {id: "...", email: "...", role: "regie"}
[REGIE][DEBUG] regie= {id: "...", nom_agence: "..."}
[REGIE][DEBUG] 🚀 loadAllTickets() démarré
[REGIE][DEBUG] currentRegieId= "..."
[REGIE][DEBUG] 🔵 loadTicketsByStatut(nouveau) démarré
[REGIE][DEBUG] 🚀 Appel RPC get_tickets_list_regie...
[REGIE][DEBUG] ❌ ERREUR RPC nouveau:
  - error.message: "Utilisateur non associé à une régie"
  - error.code: "P0001"
  - error.details: null
```

**→ DIAGNOSTIC** : `RAISE EXCEPTION` dans RPC invalide token  
**→ SOLUTION** : Appliquer patch M22.5.DEBUG (RETURN au lieu de RAISE)

#### 🎯 Scénario B : Session null immédiatement

```
[REGIE][DEBUG] 🚀 checkAuth() démarré
[REGIE][DEBUG] session= null, sessionError= {...}
[REGIE][DEBUG] ❌ SESSION NULL - LOGOUT BLOQUÉ POUR DEBUG
```

**→ DIAGNOSTIC** : Token invalidé AVANT checkAuth()  
**→ SOLUTION** : Vérifier policies `regies` SELECT (RLS récursion)

#### 🎯 Scénario C : Profile null

```
[REGIE][DEBUG] session= {user: {...}}
[REGIE][DEBUG] profile= null, profileError= {...}
[REGIE][DEBUG] ❌ PROFILE NULL - LOGOUT BLOQUÉ POUR DEBUG
```

**→ DIAGNOSTIC** : `profiles.id` != `auth.uid()`  
**→ SOLUTION** : Vérifier user ID dans `auth.users` vs `public.profiles`

#### 🎯 Scénario D : Régie null

```
[REGIE][DEBUG] profile= {id: "...", role: "regie"}
[REGIE][DEBUG] regie= null, regieError= {...}
[REGIE][DEBUG] ❌ REGIE NULL - LOGOUT BLOQUÉ POUR DEBUG
```

**→ DIAGNOSTIC** : `regies.profile_id` != profile.id OU policy SELECT trop stricte  
**→ SOLUTION** : Vérifier `regies` pour cet utilisateur

---

### TEST 5 : Appliquer Patch DEBUG (SI Scénario A)

#### Condition
**UNIQUEMENT si erreur RPC avec `error.message: "Utilisateur non associé à une régie"`**

#### Action SQL
```sql
-- Dans Supabase SQL Editor
-- Copier TOUT le contenu de M22.5.DEBUG_patch_raise_return.sql
-- Coller et exécuter
```

#### Vérification
```sql
-- Tester manuellement la RPC
SELECT * FROM public.get_tickets_list_regie('nouveau');
-- Doit retourner 0 lignes (pas d'exception)
```

#### Re-test Frontend
1. Vider cache browser (Ctrl+Shift+F5)
2. Re-login régie
3. Aller sur `/regie/tickets.html`

#### Résultat attendu (SI PATCH CORRECT)
- [ ] **PAS de déconnexion**
- [ ] Console affiche :
  ```
  [REGIE][DEBUG] ✅ 0 tickets nouveau chargés
  ```
- [ ] Page reste fonctionnelle (même si vide)

**→ CONFIRMÉ** : `RAISE EXCEPTION` était le coupable

---

## 📊 RÉSULTATS À COMMUNIQUER

### Checklist OBLIGATOIRE

Après TEST 4, tu dois me fournir **EXACTEMENT** :

- [ ] **Scénario rencontré** : A, B, C, D ou autre
- [ ] **Logs console complets** (copier/coller TOUT depuis `[REGIE][DEBUG]`)
- [ ] **Nom fonction RPC fautive** (si Scénario A)
- [ ] **Message error.message exact** (si erreur RPC)
- [ ] **error.code** (ex: P0001)
- [ ] **Fichier JS** qui a déclenché l'erreur
- [ ] **Ligne SQL** si identifiée (ex: ligne 38 M22.5)

### Template Réponse

```
🔴 ÉTAPE 1.6 - RÉSULTATS TEST

Scénario: [A/B/C/D]

Logs console:
```
[Copier TOUS les logs [REGIE][DEBUG] ici]
```

Fonction fautive: [ex: get_tickets_list_regie]
Error message: [ex: "Utilisateur non associé à une régie"]
Error code: [ex: P0001]

Fichier JS: public/regie/tickets.html
Ligne JS: [ex: ligne 735]

Patch DEBUG appliqué: [OUI/NON]
Déconnexion après patch: [OUI/NON]
```

---

## 🛑 STOP CONDITIONS

### ❌ NE PAS AVANCER TANT QUE :

1. **Logs console non fournis** (je dois voir EXACTEMENT ce qui se passe)
2. **Déconnexion non résolue** (même avec patch DEBUG)
3. **Cause racine non identifiée** (session/profile/régie/RPC)

### ✅ ON AVANCE SI :

1. **Logs complets fournis**
2. **Cause racine identifiée** avec certitude
3. **Un des 4 scénarios A/B/C/D confirmé**

---

## 🐛 Troubleshooting Rapide

### Problème : Console vide, aucun log

**Solution** :
- Vérifier "Preserve log" coché
- Vider cache (Ctrl+Shift+Delete)
- Re-déployer frontend
- Vérifier fichier tickets.html en production (View Source)

### Problème : Redirection login persiste malgré patch

**Diagnostic** : Un AUTRE guard auth existe ailleurs

**Solution** :
```bash
grep -r "window.location.*login" public/regie/*.html
# Vérifier si d'autres redirections actives
```

### Problème : RPC introuvable (error.code = 42883)

```
error.message: "function get_tickets_list_regie(ticket_status) does not exist"
```

**Solution** : Migration M22.5 non appliquée ou ROLLBACK accidentel
```sql
-- Vérifier existence
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%ticket%regie%';
```

---

## 🎯 Prochaines Étapes (Après validation)

### Si Scénario A confirmé (RAISE EXCEPTION)
1. **Analyser pourquoi `auth.uid()` retourne NULL** ou `regies.profile_id` incorrect
2. Requête SQL diagnostic :
   ```sql
   SELECT auth.uid() AS current_user_id;
   SELECT * FROM public.profiles WHERE id = auth.uid();
   SELECT * FROM public.regies WHERE profile_id = auth.uid();
   ```
3. Corriger données OU modifier RPC pour gérer cas NULL gracieusement

### Si Scénario B/C/D (Auth/Profile/Régie)
1. Vérifier policies RLS sur tables concernées
2. Vérifier intégrité données (FK, UUID matching)
3. Créer hotfix spécifique

---

**Validation créée le** : 27 décembre 2025  
**Criticité** : 🔴 BLOQUANTE ABSOLUE  
**Durée estimée** : 15 min (si logs complets fournis)

---

## 🚀 COMMANDES RAPIDES

```bash
# Déployer
git add public/regie/tickets.html
git commit -m "DEBUG: ÉTAPE 1.6 - Logs auth complets"
git push

# Vérifier déploiement Vercel
git log --oneline -1

# Tester RPC en SQL
SELECT * FROM public.get_tickets_list_regie('nouveau');

# Appliquer patch DEBUG
# (Copier M22.5.DEBUG_patch_raise_return.sql dans SQL Editor)
```
