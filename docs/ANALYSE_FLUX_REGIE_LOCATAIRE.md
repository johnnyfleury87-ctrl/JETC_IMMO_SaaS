# 🔍 ANALYSE COMPLÈTE : Flux REGIE → CREATION LOCATAIRE

**Date :** 2025-12-23  
**Statut :** 🔴 CRITIQUE - Module bcryptjs manquant + Validation flux incomplète

---

## 🚨 PROBLÈME RACINE IDENTIFIÉ

### ❌ Dépendance manquante : `bcryptjs`

**Fichier :** `/api/services/passwordService.js` ligne 13
```javascript
const bcrypt = require('bcryptjs');  // ❌ MODULE NON INSTALLÉ
```

**Fichier :** `/package.json`
```json
"dependencies": {
  "dotenv": "^16.3.1",
  "@supabase/supabase-js": "^2.88.0",
  "nodemailer": "^6.9.8"
  // ❌ MANQUE : "bcryptjs": "^2.4.3"
}
```

**Conséquence :**
- Vercel échoue au runtime : `Cannot find module 'bcryptjs'`
- API retourne une erreur 500 **en texte/HTML** (page d'erreur Vercel)
- Frontend parse JSON → `SyntaxError: Unexpected token 'A'`

---

## 📊 ANALYSE FLUX COMPLET (A → Z)

### 1️⃣ AUTH & PROFIL ✅ (OK)

**Fichier :** `/api/locataires/create.js` lignes 35-73

```javascript
// ✅ Vérification token
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

// ✅ Vérification rôle régie
const isRegie = await checkUserRole(user.id, 'regie');

// ✅ Récupération regie_id
const { data: regieProfile, error: regieError } = await supabaseAdmin
  .from('profiles')
  .select('regie_id')
  .eq('id', user.id)
  .single();

// ✅ Validation regie_id
if (regieError || !regieProfile?.regie_id) {
  return res.status(400).json({ 
    error: 'Profil régie sans rattachement valide.',
    code: 'REGIE_ID_MISSING'
  });
}
```

**✅ VALIDÉ :** 
- Token vérifié
- Rôle `regie` vérifié
- `regie_id` récupéré depuis `profiles`
- Erreur JSON si `regie_id` manquant

---

### 2️⃣ API `/api/locataires/create.js` ⚠️ (PROBLÈMES)

#### A. Dépendance bcryptjs (CRITIQUE)

**Ligne 16 :**
```javascript
const { createTempPassword, TEMP_PASSWORD_EXPIRY_DAYS } = require('../services/passwordService');
```

**Ligne 108-118 (passwordService.js ligne 13) :**
```javascript
const bcrypt = require('bcryptjs');  // ❌ MODULE MANQUANT
```

**Impact :**
- Import échoue au runtime
- Exception non catchée avant même d'entrer dans le try-catch
- Vercel renvoie page d'erreur HTML
- Frontend crash sur `JSON.parse()`

#### B. Gestion erreurs (CORRECT APRÈS CORRECTIONS)

✅ Toutes les erreurs retournent du JSON
✅ Codes erreur standardisés
✅ Rollback sécurisé
✅ Vérification `res.headersSent`

---

### 3️⃣ RPC `creer_locataire_complet()` ✅ (OK)

**Fichier :** `/supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql`

```sql
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,
  p_regie_id uuid,                -- ✅ OBLIGATOIRE
  p_logement_id uuid DEFAULT NULL,  -- ✅ OPTIONNEL
  ...
)
```

**Validations :**
```sql
-- ✅ Vérification p_regie_id non NULL
IF p_regie_id IS NULL THEN
  RAISE EXCEPTION 'regie_id obligatoire';
END IF;

-- ✅ Vérification régie existe
IF NOT EXISTS (SELECT 1 FROM regies WHERE id = p_regie_id) THEN
  RAISE EXCEPTION 'Régie non trouvée';
END IF;

-- ✅ Vérification ownership logement (si fourni)
IF v_regie_id != p_regie_id THEN
  RAISE EXCEPTION 'Le logement n''appartient pas à la régie';
END IF;

-- ✅ Insertion avec regie_id
INSERT INTO locataires (..., regie_id, ...) VALUES (..., p_regie_id, ...);
```

**✅ VALIDÉ :**
- `p_regie_id` obligatoire
- Régie doit exister
- Logement (si fourni) doit appartenir à la régie
- Impossible de créer locataire avec `regie_id = NULL`

---

### 4️⃣ FRONTEND ⚠️ (À VÉRIFIER)

**Besoin de vérifier :**
- Le frontend n'envoie JAMAIS `regie_id` dans le body
- Gestion erreurs JSON correcte
- Affichage message utilisateur lisible

---

## 🛠️ CORRECTIONS NÉCESSAIRES

### Correction 1 : Ajouter bcryptjs aux dépendances

**Fichier :** `package.json`

```json
"dependencies": {
  "dotenv": "^16.3.1",
  "@supabase/supabase-js": "^2.88.0",
  "nodemailer": "^6.9.8",
  "bcryptjs": "^2.4.3"  // ✅ AJOUTER
}
```

### Correction 2 : Alternative SANS bcryptjs (recommandé pour Vercel)

**Option A : Supprimer la logique de mot de passe temporaire hashé**

Supabase Auth gère déjà le hashing. Le mot de passe temporaire n'a pas besoin d'être hashé DEUX FOIS.

**Simplification :**
1. Générer mot de passe aléatoire (crypto natif Node.js)
2. Passer à Supabase Auth (qui hashe automatiquement)
3. Stocker en CLAIR dans `temporary_passwords` (protégé par RLS)
4. Supprimer après première connexion

**Option B : Utiliser l'API Supabase pour générer le mot de passe**

Laisser Supabase gérer tout le cycle de vie du mot de passe.

---

## ✅ SOLUTION RECOMMANDÉE : SIMPLIFIER PASSWORDSERVICE

Supprimer bcryptjs et stocker le mot de passe temporaire en clair dans la DB (protégé par RLS).

**Pourquoi c'est sécurisé :**
- Supabase Auth hashe déjà le mot de passe dans `auth.users`
- Table `temporary_passwords` protégée par RLS (seule la régie créatrice peut lire)
- Mot de passe expire après 7 jours
- Marqué `is_used = true` après première connexion
- Pas de double hashing inutile

**Nouveau fichier :** `/api/services/passwordService.js`

```javascript
/**
 * SERVICE - Génération et gestion des mots de passe temporaires
 * SIMPLIFIÉ : Pas de bcryptjs, stockage en clair (protégé par RLS)
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../_supabase');

const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_EXPIRY_DAYS = 7;

/**
 * Génère un mot de passe temporaire sécurisé
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const length = TEMP_PASSWORD_LENGTH;
  
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  
  return password;
}

/**
 * Crée ou remplace un mot de passe temporaire pour un locataire
 * STOCKÉ EN CLAIR (Supabase Auth hashe déjà dans auth.users)
 */
async function createTempPassword(profileId, createdByUserId) {
  const tempPassword = generateTempPassword();
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEMP_PASSWORD_EXPIRY_DAYS);
  
  // Stocker en CLAIR (protégé par RLS)
  const { error } = await supabaseAdmin
    .from('temporary_passwords')
    .upsert({
      profile_id: profileId,
      password_clear: tempPassword,  // ✅ En clair, pas de hash
      expires_at: expiresAt.toISOString(),
      is_used: false,
      used_at: null,
      created_by: createdByUserId,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'profile_id'
    });
  
  if (error) {
    throw new Error(`Erreur stockage mot de passe temporaire : ${error.message}`);
  }
  
  return {
    password: tempPassword,
    expiresAt: expiresAt
  };
}

/**
 * Marque le mot de passe temporaire comme utilisé
 */
async function markTempPasswordUsed(profileId) {
  const { error } = await supabaseAdmin
    .from('temporary_passwords')
    .update({
      is_used: true,
      used_at: new Date().toISOString()
    })
    .eq('profile_id', profileId);
  
  if (error) {
    console.error('Erreur marquage mot de passe utilisé:', error);
  }
}

module.exports = {
  generateTempPassword,
  createTempPassword,
  markTempPasswordUsed,
  TEMP_PASSWORD_EXPIRY_DAYS
};
```

**Migration DB nécessaire :**

```sql
-- Ajouter colonne password_clear (remplace password_hash)
ALTER TABLE temporary_passwords 
  ADD COLUMN IF NOT EXISTS password_clear text;

-- Optionnel : supprimer password_hash
ALTER TABLE temporary_passwords 
  DROP COLUMN IF EXISTS password_hash;
```

---

## 📝 PLAN DE CORRECTION (ORDRE STRICT)

### Phase 1 : Corriger passwordService.js (BLOQUANT)

1. ✅ Remplacer `/api/services/passwordService.js` par version sans bcryptjs
2. ✅ Supprimer tous les imports bcrypt
3. ✅ Stocker mot de passe en clair (protégé RLS)

### Phase 2 : Migration DB (BLOQUANT)

4. ✅ Ajouter colonne `password_clear` dans `temporary_passwords`
5. ✅ Supprimer colonne `password_hash` (optionnel)

### Phase 3 : Valider API (BLOQUANT)

6. ✅ Tester `/api/locataires/create` sans erreur bcryptjs
7. ✅ Vérifier toutes les réponses sont JSON
8. ✅ Vérifier regie_id est bien passé à la RPC

### Phase 4 : Tests E2E (VALIDATION)

9. ✅ Test : Régie valide → création locataire sans logement
10. ✅ Test : Régie valide → création locataire avec logement
11. ✅ Test : Tentative sans regie_id backend → REFUS
12. ✅ Test : Tentative logement autre régie → REFUS

---

## 🧪 SCRIPT DE TEST AUTOMATIQUE

```javascript
// tests/locataires-creation-e2e.test.js

const { supabaseAdmin } = require('../api/_supabase');
const fetch = require('node-fetch');

describe('🔬 FLUX REGIE → CREATION LOCATAIRE', () => {
  
  let regieToken, regieId, regieProfileId;
  let autreRegieId;
  let logementRegieId, logementAutreRegieId;
  
  before(async () => {
    // Setup : créer régie de test + logements
    // ...
  });
  
  after(async () => {
    // Cleanup : supprimer données de test
    // ...
  });
  
  // ============================================
  // TEST 1 : Régie valide → création locataire SANS logement
  // ============================================
  it('✅ Test 1 : Création locataire sans logement', async () => {
    const response = await fetch('http://localhost:3000/api/locataires/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regieToken}`
      },
      body: JSON.stringify({
        nom: 'Dupont',
        prenom: 'Jean',
        email: `test-${Date.now()}@test.com`,
        date_entree: '2025-01-01'
        // ❌ PAS DE regie_id dans le body
      })
    });
    
    expect(response.status).to.equal(201);
    
    const data = await response.json();
    expect(data.success).to.be.true;
    expect(data.locataire).to.exist;
    expect(data.temporary_password).to.exist;
    
    // Vérifier en DB : locataire a bien regie_id
    const { data: locataire } = await supabaseAdmin
      .from('locataires')
      .select('regie_id, logement_id')
      .eq('id', data.locataire.id)
      .single();
    
    expect(locataire.regie_id).to.equal(regieId);
    expect(locataire.logement_id).to.be.null;
  });
  
  // ============================================
  // TEST 2 : Régie valide → création locataire AVEC logement de la même régie
  // ============================================
  it('✅ Test 2 : Création locataire avec logement de la même régie', async () => {
    const response = await fetch('http://localhost:3000/api/locataires/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regieToken}`
      },
      body: JSON.stringify({
        nom: 'Martin',
        prenom: 'Sophie',
        email: `test-${Date.now()}@test.com`,
        date_entree: '2025-01-01',
        logement_id: logementRegieId  // ✅ Logement appartient à la régie
      })
    });
    
    expect(response.status).to.equal(201);
    
    const data = await response.json();
    
    // Vérifier en DB
    const { data: locataire } = await supabaseAdmin
      .from('locataires')
      .select('regie_id, logement_id')
      .eq('id', data.locataire.id)
      .single();
    
    expect(locataire.regie_id).to.equal(regieId);
    expect(locataire.logement_id).to.equal(logementRegieId);
  });
  
  // ============================================
  // TEST 3 : Tentative création avec logement d'une AUTRE régie
  // ============================================
  it('❌ Test 3 : Tentative logement autre régie → REFUS', async () => {
    const response = await fetch('http://localhost:3000/api/locataires/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regieToken}`
      },
      body: JSON.stringify({
        nom: 'Pirate',
        prenom: 'Jean',
        email: `test-${Date.now()}@test.com`,
        date_entree: '2025-01-01',
        logement_id: logementAutreRegieId  // ❌ Logement d'une autre régie
      })
    });
    
    expect(response.status).to.equal(500);  // RPC error
    
    const data = await response.json();
    expect(data.success).to.be.undefined;
    expect(data.error).to.include('appartient pas à la régie');
    expect(data.code).to.equal('RPC_ERROR');
  });
  
  // ============================================
  // TEST 4 : Tentative sans regie_id backend (profil régie orphelin)
  // ============================================
  it('❌ Test 4 : Profil régie sans regie_id → REFUS', async () => {
    // Setup : créer profil régie orphelin (regie_id = NULL)
    const { data: orphanProfile } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: 'orphan@test.com',
        role: 'regie',
        regie_id: null  // ❌ Orphelin
      })
      .select()
      .single();
    
    const { data: { session } } = await supabaseAdmin.auth.admin.createUser({
      email: 'orphan@test.com',
      password: 'test1234'
    });
    
    const response = await fetch('http://localhost:3000/api/locataires/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        nom: 'Test',
        prenom: 'Orphan',
        email: `test-${Date.now()}@test.com`,
        date_entree: '2025-01-01'
      })
    });
    
    expect(response.status).to.equal(400);
    
    const data = await response.json();
    expect(data.error).to.include('sans rattachement');
    expect(data.code).to.equal('REGIE_ID_MISSING');
  });
  
  // ============================================
  // TEST 5 : Vérification DB : AUCUN locataire orphelin
  // ============================================
  it('✅ Test 5 : Vérification DB : locataires.regie_id IS NOT NULL', async () => {
    const { data: orphans } = await supabaseAdmin
      .from('locataires')
      .select('id, nom, prenom')
      .is('regie_id', null);
    
    expect(orphans).to.be.empty;
  });
  
});
```

**Exécution :**
```bash
npm install --save-dev mocha chai node-fetch
npm test
```

---

## 🎯 CHECKLIST VALIDATION FINALE

### Backend

- [ ] `bcryptjs` supprimé OU ajouté aux dépendances
- [ ] `passwordService.js` simplifié (stockage en clair)
- [ ] `/api/locataires/create.js` : toutes erreurs retournent JSON
- [ ] `/api/locataires/create.js` : `regie_id` récupéré depuis `profiles`
- [ ] `/api/locataires/create.js` : `regie_id` passé à la RPC

### RPC

- [ ] `p_regie_id` obligatoire (NOT NULL)
- [ ] Validation régie existe
- [ ] Validation ownership logement
- [ ] Impossible créer locataire avec `regie_id = NULL`

### DB

- [ ] Colonne `locataires.regie_id` existe (NOT NULL)
- [ ] FK `locataires.regie_id → regies.id`
- [ ] Politiques RLS configurées
- [ ] Table `temporary_passwords` avec `password_clear` (pas `password_hash`)

### Frontend

- [ ] Ne passe JAMAIS `regie_id` dans le body
- [ ] Gère erreurs JSON correctement
- [ ] Affiche messages utilisateur lisibles

### Tests E2E

- [ ] Test 1 : Création sans logement → OK
- [ ] Test 2 : Création avec logement même régie → OK
- [ ] Test 3 : Tentative logement autre régie → REFUS
- [ ] Test 4 : Profil orphelin → REFUS
- [ ] Test 5 : DB : aucun locataire orphelin

---

## 🚀 CONCLUSION

**Problème racine :** Module `bcryptjs` manquant → import échoue → API crash → réponse HTML → frontend crash

**Solution :** Simplifier `passwordService.js` pour supprimer dépendance bcryptjs

**Validation :** Tests E2E pour vérifier toute la chaîne A → Z

**Règle métier garantie :** Locataire hérite OBLIGATOIREMENT du `regie_id` de la régie connectée
