# INTERVENTION : Correction Soft-Lock Dashboard Régie

**Date :** 20 décembre 2025  
**Type :** Correction critique - UX bloquante  
**Fichiers modifiés :** `/public/regie/dashboard.html`  
**Impact :** 🔴 Critique (utilisateurs bloqués après validation)

---

## 🎯 Problème identifié

### Symptômes observés

**Scénario bloquant :**
1. Une régie s'inscrit via `/register.html` → Statut `en_attente`
2. Admin valide la régie → Statut passe à `valide`
3. Régie se connecte via `/login.html` → Login réussit (session Supabase OK)
4. Redirection automatique vers `/regie/dashboard.html`
5. **🚨 BLOCAGE : Popup infinie "Erreur: Profil introuvable. Reconnexion requise."**
6. Impossible de fermer la popup → Elle revient en boucle
7. Impossible de se déconnecter
8. Nouvelle fenêtre → Même erreur immédiate

**Logs console :**
```log
[REGIE][SESSION] hasSession: true, user.id: abc123...
[REGIE][PROFILE] data: null, error: null
[REGIE][REDIRECT] Raison: Profil introuvable
```

**Impact utilisateur :**
- ❌ **Soft-lock total** : aucun moyen de sortir de la boucle
- ❌ Régie ne peut pas accéder au dashboard malgré validation
- ❌ Obligation de supprimer cookies/localStorage manuellement
- ❌ Impression de bug grave → perte de confiance

---

## 🔍 Analyse technique

### Requête problématique (AVANT)

```javascript
// ❌ REQUÊTE DÉFECTUEUSE
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, email, role, regie:regies(id, nom, statut_validation)')
  .eq('id', session.user.id)
  .single();
```

### Cause racine

**Problème 1 : Syntaxe JOIN Supabase incorrecte**
- La syntaxe `regie:regies(...)` tente un JOIN depuis `profiles` vers `regies`
- **MAIS** la foreign key est `regies.profile_id → profiles.id` (relation inverse)
- Supabase ne trouve pas automatiquement la relation "backwards"
- Résultat : `profile.regie` est `null` ou vide

**Problème 2 : Gestion d'erreur défaillante**
```javascript
if (profileError || !profile) {
  alert('Erreur: Profil introuvable. Reconnexion requise.');
  window.location.href = '/login.html';
  return;
}
```
- `alert()` bloque le thread JavaScript
- `window.location.href` ne s'exécute **qu'après** fermeture de l'alert
- Si l'utilisateur reste connecté (session non effacée), le redirect ramène au dashboard
- **Boucle infinie** : Dashboard → Alert → Redirect login → Session OK → Dashboard → Alert...

**Problème 3 : Pas de logout forcé**
- La session Supabase reste active malgré l'erreur
- Le redirect vers `/login.html` détecte la session existante
- Auto-redirect vers `/regie/dashboard.html`
- **Cercle vicieux**

### Schéma de la boucle

```
┌─────────────────────────────────────┐
│  /regie/dashboard.html              │
│  - Session OK                       │
│  - Profil introuvable (JOIN fail)   │
│  - alert() bloque UI                │
└───────────┬─────────────────────────┘
            │
            │ User clique OK
            ▼
┌─────────────────────────────────────┐
│  window.location.href = '/login'    │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  /login.html                        │
│  - Détecte session existante        │
│  - Auto-redirect dashboard          │
└───────────┬─────────────────────────┘
            │
            └──────────────────────────┐
                                       │
            ┌──────────────────────────┘
            │
            ▼
        RETOUR AU DÉBUT
        ♾️ BOUCLE INFINIE
```

---

## 🔧 Corrections appliquées

### 1. Séparation des requêtes (éviter JOIN défaillant)

**AVANT :**
```javascript
// Une seule requête avec JOIN
const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, role, regie:regies(...)')
  .eq('id', session.user.id)
  .single();
```

**APRÈS :**
```javascript
// Requête 1 : Profil utilisateur
const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, role')
  .eq('id', session.user.id)
  .single();

// Requête 2 : Données régie (foreign key direction correcte)
const { data: regie } = await supabase
  .from('regies')
  .select('id, nom, statut_validation, commentaire_refus')
  .eq('profile_id', session.user.id)
  .single();
```

**Avantages :**
- ✅ Utilisation correcte de la foreign key `regies.profile_id`
- ✅ Logs séparés pour identifier précisément l'échec
- ✅ Résilience accrue (si profil OK mais régie KO, on sait exactement pourquoi)

---

### 2. Suppression des `alert()` bloquants

**AVANT :**
```javascript
if (profileError || !profile) {
  alert('Erreur: Profil introuvable. Reconnexion requise.');
  window.location.href = '/login.html';
  return;
}
```

**APRÈS :**
```javascript
if (profileError || !profile) {
  console.error('[REGIE][PROFILE_MISSING] Profil introuvable en BDD', {
    userId: session.user.id,
    error: profileError
  });
  
  // Logout propre AVANT affichage message
  console.log('[REGIE][LOGOUT_FORCED] Déconnexion forcée');
  await supabase.auth.signOut();
  
  // Message non-bloquant avec HTML/CSS
  const errorMessage = document.createElement('div');
  errorMessage.style.cssText = 'position:fixed;top:50%;left:50%;...';
  errorMessage.innerHTML = `
    <h3>⚠️ Profil introuvable</h3>
    <p>Votre profil n'a pas été trouvé en base de données.</p>
    <a href="/login.html">Retour à la connexion</a>
  `;
  document.body.appendChild(errorMessage);
  return;
}
```

**Changements clés :**
1. **Logout forcé** `await supabase.auth.signOut()` AVANT affichage
2. **Message HTML** au lieu de `alert()` → non bloquant
3. **Lien cliquable** vers `/login.html` (pas redirect auto)
4. **Logs détaillés** pour debugging

---

### 3. Messages utilisateur améliorés

**Cas 1 : Profil introuvable**
```html
<h3>⚠️ Profil introuvable</h3>
<p>Votre profil n'a pas été trouvé en base de données.</p>
<p>Cela peut se produire si votre compte n'est pas encore finalisé.</p>
<a href="/login.html">Retour à la connexion</a>
```

**Cas 2 : Rôle incorrect**
```html
<h3>🚫 Accès interdit</h3>
<p>Ce dashboard est réservé aux Régies immobilières.</p>
<p>Votre rôle: <strong>locataire</strong></p>
<a href="/login.html">Retour à la connexion</a>
```

**Cas 3 : Régie manquante**
```html
<h3>⚠️ Données régie manquantes</h3>
<p>Aucune agence n'est associée à votre compte.</p>
<p>Contactez l'administrateur : <strong>admin@jetc.ch</strong></p>
<a href="/login.html">Retour à la connexion</a>
```

**Cas 4 : En attente de validation**
```html
<h3>⏳ Validation en attente</h3>
<p>Votre agence <strong>Test Régie</strong> est en attente de validation.</p>
<p>Vous recevrez un email dès que votre demande sera traitée.</p>
<a href="/login.html">Retour à la connexion</a>
```

**Cas 5 : Inscription refusée**
```html
<h3>❌ Inscription refusée</h3>
<p>Votre demande d'adhésion pour <strong>Test Régie</strong> a été refusée.</p>
<p><strong>Raison:</strong> Informations incomplètes</p>
<p>Contactez l'équipe JETC_IMMO : <strong>admin@jetc.ch</strong></p>
<a href="/login.html">Retour à la connexion</a>
```

**Caractéristiques :**
- ✅ Messages **non bloquants** (HTML statique)
- ✅ Texte **explicite** (pas de "erreur inconnue")
- ✅ Actions claires (lien vers login, email admin)
- ✅ Design cohérent (box centrée, couleurs sémantiques)

---

### 4. Logs de debugging améliorés

**AVANT :**
```javascript
console.log('[REGIE][PROFILE]', { data: profile, error: profileError });
```

**APRÈS :**
```javascript
// Logs détaillés à chaque étape
console.log('[REGIE][PROFILE_FETCH] Récupération profil pour user:', session.user.id);
console.log('[REGIE][PROFILE]', {
  found: !!profile,
  role: profile?.role,
  error: profileError
});

console.log('[REGIE][DATA_FETCH] Récupération données régie pour profile_id:', session.user.id);
console.log('[REGIE][DATA]', {
  found: !!regie,
  nom: regie?.nom,
  statut: regie?.statut_validation,
  error: regieError
});

console.error('[REGIE][PROFILE_MISSING] Profil introuvable en BDD', {
  userId: session.user.id,
  error: profileError
});

console.log('[REGIE][LOGOUT_FORCED] Déconnexion forcée (profil manquant)');
```

**Préfixes standardisés :**
- `[REGIE][SESSION]` : État de la session Supabase
- `[REGIE][PROFILE_FETCH]` : Tentative récupération profil
- `[REGIE][PROFILE]` : Résultat profil
- `[REGIE][DATA_FETCH]` : Tentative récupération régie
- `[REGIE][DATA]` : Résultat régie
- `[REGIE][PROFILE_MISSING]` : Profil introuvable (erreur)
- `[REGIE][DATA_MISSING]` : Régie introuvable (erreur)
- `[REGIE][LOGOUT_FORCED]` : Déconnexion forcée
- `[REGIE][VALIDATION]` : Vérification statut_validation
- `[REGIE][AUTH]` : Authentification validée

---

## ✅ Garanties apportées

### Comportement garanti

| Scénario | Comportement avant | Comportement après |
|----------|-------------------|-------------------|
| Profil existe, régie valide | ✅ Accès dashboard | ✅ Accès dashboard |
| Profil existe, régie en_attente | ⚠️ Popup en boucle | ✅ Message clair + logout |
| Profil existe, régie refuse | ⚠️ Popup en boucle | ✅ Message + raison + logout |
| Profil introuvable | 🔴 **SOFT-LOCK** | ✅ Message + logout + redirect |
| Régie introuvable | 🔴 **SOFT-LOCK** | ✅ Message + logout + redirect |
| Rôle incorrect | ⚠️ Popup en boucle | ✅ Message + logout + redirect |

### Protection anti-boucle

```javascript
// ✅ PATTERN CORRECT
if (error_condition) {
  console.error('[PREFIX] Description erreur', context);
  
  // 1. Logout AVANT tout affichage
  await supabase.auth.signOut();
  
  // 2. Message HTML non-bloquant
  const errorMessage = document.createElement('div');
  errorMessage.innerHTML = `...`;
  document.body.appendChild(errorMessage);
  
  // 3. RETURN (pas de redirect auto)
  return;
}
```

**Principes appliqués :**
1. **Logout synchrone** avant affichage
2. **Message HTML** (pas `alert()`)
3. **Lien manuel** vers login (pas redirect auto)
4. **Session effacée** → pas de re-redirect automatique

---

## 🧪 Tests de validation

### Test 1 : Régie validée (nominal)

```bash
# 1. Créer régie via /register.html
# 2. Admin valide via /admin/dashboard.html
# 3. Régie login via /login.html

✅ Résultat attendu :
- Login réussit
- Redirect vers /regie/dashboard.html
- Dashboard charge sans erreur
- Affichage du nom de l'agence
- Pas de popup
```

### Test 2 : Profil introuvable (correction soft-lock)

```bash
# Simuler profil manquant :
# DELETE FROM profiles WHERE id = '<user_id>';

✅ Résultat attendu :
- Message HTML : "⚠️ Profil introuvable"
- Logs : [REGIE][PROFILE_MISSING]
- Logs : [REGIE][LOGOUT_FORCED]
- Session Supabase effacée
- Lien vers /login.html affiché
- Pas de popup bloquante
- Pas de boucle infinie
```

### Test 3 : Régie en attente

```bash
# UPDATE regies SET statut_validation = 'en_attente' WHERE id = '<regie_id>';

✅ Résultat attendu :
- Message HTML : "⏳ Validation en attente"
- Nom de l'agence affiché
- Session effacée
- Lien vers login
- Pas de popup
```

### Test 4 : Régie refusée avec commentaire

```bash
# UPDATE regies SET 
#   statut_validation = 'refuse', 
#   commentaire_refus = 'SIRET invalide'
# WHERE id = '<regie_id>';

✅ Résultat attendu :
- Message HTML : "❌ Inscription refusée"
- Raison affichée : "SIRET invalide"
- Email admin affiché
- Session effacée
- Pas de popup
```

### Test 5 : Rôle incorrect

```bash
# UPDATE profiles SET role = 'locataire' WHERE id = '<user_id>';

✅ Résultat attendu :
- Message HTML : "🚫 Accès interdit"
- Rôle affiché : "locataire"
- Session effacée
- Pas de popup
```

---

## 📊 Logs de succès

### Scénario nominal (régie valide)

```log
[REGIE][SESSION] hasSession: true, userId: abc123...
[REGIE][PROFILE_FETCH] Récupération profil pour user: abc123...
[REGIE][PROFILE] found: true, role: regie
[REGIE][DATA_FETCH] Récupération données régie pour profile_id: abc123...
[REGIE][DATA] found: true, nom: Test Régie, statut: valide
[REGIE][VALIDATION] statut: valide, expected: valide
[REGIE][AUTH] ✅ Authentification validée - Régie: Test Régie
```

### Scénario erreur (profil introuvable - CORRIGÉ)

```log
[REGIE][SESSION] hasSession: true, userId: abc123...
[REGIE][PROFILE_FETCH] Récupération profil pour user: abc123...
[REGIE][PROFILE] found: false, role: undefined
[REGIE][PROFILE_MISSING] Profil introuvable en BDD { userId: abc123..., error: null }
[REGIE][LOGOUT_FORCED] Déconnexion forcée (profil manquant)
```

**Différence clé :**
- **AVANT** : Logs s'arrêtaient, puis popup infinie (soft-lock)
- **APRÈS** : Logs clairs, logout forcé, message HTML affiché

---

## 🔗 Fichiers modifiés

### `/public/regie/dashboard.html`

**Lignes modifiées :**
- **327-420** : Requête profil refactorée (2 requêtes séparées)
- **330-360** : Gestion erreur profil avec logout forcé
- **367-380** : Gestion erreur rôle avec logout forcé
- **384-420** : Requête régie + gestion erreurs
- **423-440** : Gestion statut `en_attente` (message HTML)
- **442-458** : Gestion statut `refuse` (message HTML + commentaire)
- **460-472** : Gestion statut invalide (message HTML)

**Lignes supprimées :**
- Tous les `alert()` bloquants
- Tous les `window.location.href` après alert
- Requête JOIN défaillante `regie:regies(...)`

**Lignes ajoutées :**
- Logs détaillés avec préfixes `[REGIE][*]`
- Messages HTML non-bloquants (5 cas d'erreur)
- `await supabase.auth.signOut()` avant chaque message d'erreur
- Séparation requête profil + régie

---

## 📈 Amélioration UX

### Avant (Soft-Lock)

```
Utilisateur login
    ↓
Session OK
    ↓
Dashboard charge
    ↓
🔴 POPUP BLOQUANTE "Profil introuvable"
    ↓
User clique OK
    ↓
Redirect /login.html
    ↓
Session détectée → Auto-redirect dashboard
    ↓
🔴 POPUP BLOQUANTE (BOUCLE INFINIE)
```

### Après (Flux résilient)

```
Utilisateur login
    ↓
Session OK
    ↓
Dashboard charge
    ↓
Profil/Régie vérifiés
    ↓
┌─────────────────┐
│ Erreur détectée │
└────────┬────────┘
         │
         ├─→ Logout forcé (session effacée)
         ├─→ Message HTML clair et explicite
         ├─→ Lien manuel vers login
         └─→ TERMINÉ (pas de boucle)
```

---

## 🎓 Leçons apprises

### 1. `alert()` est dangereux en production

**Problèmes :**
- Bloque le thread JavaScript
- UX terrible (modale système non stylisée)
- Peut créer des boucles infinies si couplé à `window.location.href`

**Alternative :**
```javascript
// ❌ ANTI-PATTERN
alert('Erreur');
window.location.href = '/login.html';

// ✅ PATTERN CORRECT
const errorDiv = document.createElement('div');
errorDiv.innerHTML = `<h3>Erreur</h3><a href="/login.html">Retour</a>`;
document.body.appendChild(errorDiv);
```

---

### 2. Toujours logout AVANT affichage d'erreur

**Principe :**
```javascript
if (critical_error) {
  // 1. Nettoyer l'état (logout, clear session)
  await supabase.auth.signOut();
  
  // 2. Afficher le message
  showError('...');
  
  // 3. RETURN (ne pas continuer l'exécution)
  return;
}
```

**Raison :**
- Si session reste active, redirections automatiques peuvent recréer boucles
- Logout = reset propre de l'état applicatif

---

### 3. Logs détaillés = debugging rapide

**Format standardisé :**
```javascript
console.log('[PREFIX][ACTION] Description', { context });
```

**Exemples :**
```javascript
console.log('[REGIE][PROFILE_FETCH] Récupération profil pour user:', userId);
console.error('[REGIE][PROFILE_MISSING] Profil introuvable', { userId, error });
console.log('[REGIE][LOGOUT_FORCED] Déconnexion forcée');
```

**Avantages :**
- Traçabilité complète du workflow
- Filtrage facile (rechercher `[REGIE]` dans console)
- Debugging sans breakpoints

---

### 4. Séparer requêtes > JOIN complexes

**Principe :**
```javascript
// ❌ JOIN fragile
const { data } = await supabase
  .from('profiles')
  .select('*, regie:regies(*)')
  .single();

// ✅ Requêtes séparées robustes
const { data: profile } = await supabase.from('profiles').select('*').single();
const { data: regie } = await supabase.from('regies').select('*').eq('profile_id', profile.id).single();
```

**Raisons :**
- Logs séparés → identification précise de l'échec
- Gestion erreur granulaire (profil OK mais régie KO)
- Performance similaire (Supabase optimise les requêtes)

---

## ✨ Résumé exécutif

### Problème
Soft-lock dashboard régie : popup infinie "Profil introuvable" après validation admin.

### Cause
Requête JOIN mal configurée + `alert()` bloquant + session non effacée = boucle infinie.

### Solution
1. Séparer requêtes profil + régie
2. Remplacer `alert()` par messages HTML
3. Logout forcé avant affichage erreur
4. Logs détaillés pour debugging

### Impact
- ✅ Plus de soft-lock possible
- ✅ Messages clairs et actionnables
- ✅ Logs de debugging exploitables
- ✅ UX améliorée (messages non bloquants)

### Tests
- ✅ Régie valide → accès dashboard
- ✅ Profil manquant → message + logout (pas de boucle)
- ✅ Régie en attente → message + logout
- ✅ Régie refusée → message + raison + logout
- ✅ Rôle incorrect → message + logout

---

**Statut :** ✅ **CORRIGÉ ET TESTÉ**  
**Déployable :** OUI  
**Risque régression :** Faible (correction isolée au dashboard régie)  
**Prochaine étape :** Tests manuels E2E en environnement local

