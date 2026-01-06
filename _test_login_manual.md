# 🧪 GUIDE DE TEST MANUEL - LOGINS & DASHBOARDS

## 🎯 Objectif
Valider que **CHAQUE RÔLE** peut se connecter et accéder à son dashboard sans erreur visible.

---

## 🚀 ÉTAPE 1: Démarrer le Serveur Local

```bash
cd /workspaces/JETC_IMMO_SaaS
npx vite --port 3000
```

**Attendez le message**: `Local: http://localhost:3000`

---

## 🔐 ÉTAPE 2: Tests de Login (un par un)

### Test 1️⃣: Admin JTEC
1. Ouvrir: `http://localhost:3000/login.html`
2. Saisir:
   - Email: `johnny.fleury87@gmail.com`
   - Mot de passe: `TestJetc2026!`
3. Cliquer sur "Se connecter"
4. **Vérifications**:
   - [ ] Redirection vers `/admin/dashboard.html`
   - [ ] Aucune popup d'erreur
   - [ ] Console (F12) → Aucune erreur rouge
   - [ ] Message "✅ Supabase client initialisé" dans console
   - [ ] Nom/email affiché sur le dashboard
   - [ ] Bouton "Déconnexion" visible
5. Cliquer sur "Déconnexion" → Doit revenir à `/login.html`

---

### Test 2️⃣: Régie
1. Ouvrir: `http://localhost:3000/login.html`
2. Saisir:
   - Email: `johnny.thiriet@gmail.com`
   - Mot de passe: `TestJetc2026!`
3. Cliquer sur "Se connecter"
4. **Vérifications**:
   - [ ] Redirection vers `/regie/dashboard.html`
   - [ ] Aucune popup d'erreur
   - [ ] Console (F12) → Aucune erreur rouge
   - [ ] Message "✅ Supabase client initialisé" dans console
   - [ ] Nom "Johnny Thiriet" affiché
   - [ ] Menu de navigation visible (Tickets, Entreprises, etc.)
   - [ ] Pas d'erreur "Une erreur s'est produite lors du chargement"
5. Cliquer sur "Déconnexion" → Doit revenir à `/login.html`

---

### Test 3️⃣: Entreprise
1. Ouvrir: `http://localhost:3000/login.html`
2. Saisir:
   - Email: `entreprise@test.app`
   - Mot de passe: `TestJetc2026!`
3. Cliquer sur "Se connecter"
4. **Vérifications**:
   - [ ] Redirection vers `/entreprise/dashboard.html`
   - [ ] Aucune popup d'erreur
   - [ ] Console (F12) → Aucune erreur rouge
   - [ ] Message "✅ Supabase client initialisé" dans console
   - [ ] Dashboard entreprise affiché correctement
5. Cliquer sur "Déconnexion" → Doit revenir à `/login.html`

---

### Test 4️⃣: Locataire
1. Ouvrir: `http://localhost:3000/login.html`
2. Saisir:
   - Email: `locataire1@exemple.ch`
   - Mot de passe: `TestJetc2026!`
3. Cliquer sur "Se connecter"
4. **Vérifications**:
   - [ ] Redirection vers `/locataire/dashboard.html`
   - [ ] Aucune popup d'erreur
   - [ ] Console (F12) → Aucune erreur rouge
   - [ ] Message "✅ Supabase client initialisé" dans console
   - [ ] Dashboard locataire affiché correctement
5. Cliquer sur "Déconnexion" → Doit revenir à `/login.html`

---

### Test 5️⃣: Technicien
1. Ouvrir: `http://localhost:3000/login.html`
2. Saisir:
   - Email: `tech@test.app`
   - Mot de passe: `TestJetc2026!`
3. Cliquer sur "Se connecter"
4. **Vérifications**:
   - [ ] Redirection vers `/technicien/dashboard.html`
   - [ ] Aucune popup d'erreur
   - [ ] Console (F12) → Aucune erreur rouge
   - [ ] Message "✅ Supabase client initialisé" dans console
   - [ ] Dashboard technicien affiché correctement
5. Cliquer sur "Déconnexion" → Doit revenir à `/login.html`

---

## 🔍 ÉTAPE 3: Vérifications Complémentaires

### Navigation Entre Pages (Régie)
1. Se connecter en tant que `johnny.thiriet@gmail.com`
2. Depuis `/regie/dashboard.html`, cliquer sur:
   - [ ] "Tickets" → `/regie/tickets.html` (doit charger sans erreur)
   - [ ] "Entreprises" → `/regie/entreprises.html` (doit charger sans erreur)
   - [ ] "Locataires" → `/regie/locataires.html` (doit charger sans erreur)
   - [ ] "Immeubles" → `/regie/immeubles.html` (doit charger sans erreur)
   - [ ] "Logements" → `/regie/logements.html` (doit charger sans erreur)

### Erreurs Console à Surveiller
**Erreurs BLOQUANTES** (ne doivent PAS apparaître):
- ❌ `supabase is not defined`
- ❌ `401 (Unauthorized)`
- ❌ `403 (Forbidden)`
- ❌ `Cannot read properties of undefined`
- ❌ `Session not found`

**Warnings ACCEPTABLES** (peuvent apparaître):
- ⚠️ Messages de CORS (si RPC désactivées temporairement)
- ⚠️ `404` sur des ressources manquantes (images, etc.)

---

## ✅ CRITÈRES DE VALIDATION

Un login est considéré **VALIDÉ** si:
1. ✅ Authentification réussie (pas d'erreur 401)
2. ✅ Redirection automatique vers la bonne page
3. ✅ Page affichée sans popup d'erreur
4. ✅ Console sans erreurs rouges critiques
5. ✅ Profil utilisateur visible sur le dashboard
6. ✅ Déconnexion fonctionne et redirige vers login

---

## 📝 RAPPORT DE TEST À COMPLÉTER

```markdown
## Résultats des Tests Manuels (Local)

| Rôle | Email | Login | Dashboard | Console | Navigation | Déconnexion | Statut Final |
|------|-------|-------|-----------|---------|------------|-------------|--------------|
| Admin | johnny.fleury87@gmail.com | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Régie | johnny.thiriet@gmail.com | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Entreprise | entreprise@test.app | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Locataire | locataire1@exemple.ch | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Technicien | tech@test.app | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |

Légende: ⬜ À tester | ✅ OK | ❌ KO
```

---

## 🌐 ÉTAPE 4: Tests en Production (Vercel)

**⚠️ IMPORTANT**: Répéter TOUS les tests ci-dessus sur l'URL de production Vercel.

**Règle absolue**:
> Un login qui fonctionne en local mais pas en prod = **NON VALIDÉ**

### URL de Production
```
https://[votre-projet].vercel.app/login.html
```

### Variables d'Environnement Vercel (à vérifier)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🚨 EN CAS D'ERREUR

### Erreur "supabase is not defined"
**Cause**: `bootstrapSupabase.js` non chargé ou chargé après le script principal  
**Solution**: Vérifier ordre des `<script>` dans le `<head>` de la page

### Erreur "401 Unauthorized"
**Cause**: Mot de passe incorrect ou compte n'existe pas  
**Solution**: Vérifier avec `node _test_all_logins.js` que le compte existe

### Redirection vers /login.html après login réussi
**Cause**: Logique de routing dans la page protégée échoue  
**Solution**: Vérifier console pour erreur JS bloquante

### Popup "Erreur technique"
**Cause**: Erreur dans le code de la page (fetch échoué, etc.)  
**Solution**: Ouvrir console (F12) et lire le message d'erreur complet

---

## 📞 SUPPORT

En cas de problème, exécuter:
```bash
node _test_all_logins.js
```

Si ce script montre ✅ OK mais le test manuel échoue, le problème est dans le code frontend.
Si ce script montre ❌ KO, le problème est dans la base de données ou l'auth Supabase.
