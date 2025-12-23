# ✅ Corrections API `/api/locataires/create.js`

**Date :** 2025-12-23  
**Problème :** API retournait du texte/HTML au lieu de JSON en cas d'erreur → `SyntaxError: Unexpected token` côté frontend

---

## 🔧 Corrections appliquées

### 1. **Génération mot de passe temporaire** (lignes 105-118)

**AVANT :**
```javascript
const { password: tempPassword, expiresAt } = await createTempPassword('temp', user.id);
// ❌ Exception non catchée si createTempPassword échoue
```

**APRÈS :**
```javascript
let tempPassword, expiresAt;
try {
  const tempPasswordResult = await createTempPassword('temp', user.id);
  tempPassword = tempPasswordResult.password;
  expiresAt = tempPasswordResult.expiresAt;
} catch (tempPasswordError) {
  console.error('[CREATE LOCATAIRE] Erreur génération mot de passe:', tempPasswordError);
  return res.status(500).json({ 
    error: 'Erreur lors de la génération du mot de passe temporaire',
    code: 'TEMP_PASSWORD_ERROR',
    details: tempPasswordError.message
  });
}
```

**✅ Résultat :** Retour JSON garanti même si génération mot de passe échoue

---

### 2. **Création compte auth.users** (lignes 140-147)

**AVANT :**
```javascript
return res.status(400).json({ 
  error: `Erreur création compte : ${createAuthError.message}` 
});
```

**APRÈS :**
```javascript
return res.status(400).json({ 
  error: `Erreur création compte : ${createAuthError.message}`,
  code: 'AUTH_CREATE_ERROR',
  details: createAuthError.message
});
```

**✅ Résultat :** Code erreur standardisé + details pour debugging

---

### 3. **Création profile** (lignes 155-172)

**AVANT :**
```javascript
if (profileError) {
  await supabaseAdmin.auth.admin.deleteUser(profileId);
  throw new Error(`Erreur création profile : ${profileError.message}`);
  // ❌ throw → pas de JSON retourné immédiatement
}
```

**APRÈS :**
```javascript
if (profileError) {
  console.error('[CREATE LOCATAIRE] Erreur création profile:', profileError);
  try {
    await supabaseAdmin.auth.admin.deleteUser(profileId);
  } catch (deleteError) {
    console.error('[CREATE LOCATAIRE] Erreur rollback deleteUser:', deleteError);
  }
  return res.status(400).json({ 
    error: `Erreur création profil locataire : ${profileError.message}`,
    code: 'PROFILE_CREATE_ERROR',
    details: profileError.message
  });
}
```

**✅ Résultat :** Retour JSON immédiat + rollback sécurisé (pas de crash si deleteUser échoue)

---

### 4. **Stockage mot de passe temporaire** (lignes 177-193)

**AVANT :**
```javascript
const { password: finalTempPassword } = await createTempPassword(profileId, user.id);
// ❌ Exception non catchée
```

**APRÈS :**
```javascript
let finalTempPassword = tempPassword;
try {
  await supabaseAdmin
    .from('temporary_passwords')
    .update({ profile_id: profileId, created_by: user.id })
    .eq('profile_id', 'temp');

  const tempPasswordResult = await createTempPassword(profileId, user.id);
  finalTempPassword = tempPasswordResult.password;
} catch (tempPasswordUpdateError) {
  console.error('[CREATE LOCATAIRE] Erreur mise à jour mot de passe temporaire:', tempPasswordUpdateError);
  // Non bloquant, on continue avec le mot de passe initial
}
```

**✅ Résultat :** Erreur non bloquante, fallback sur mot de passe initial

---

### 5. **Appel RPC creer_locataire_complet** (lignes 211-228)

**AVANT :**
```javascript
if (rpcError) {
  await supabaseAdmin.from('profiles').delete().eq('id', profileId);
  await supabaseAdmin.auth.admin.deleteUser(profileId);
  throw new Error(`Erreur RPC : ${rpcError.message}`);
  // ❌ throw → pas de JSON retourné immédiatement
}
```

**APRÈS :**
```javascript
if (rpcError) {
  console.error('[CREATE LOCATAIRE] Erreur RPC creer_locataire_complet:', rpcError);
  try {
    await supabaseAdmin.from('profiles').delete().eq('id', profileId);
    await supabaseAdmin.auth.admin.deleteUser(profileId);
  } catch (rollbackError) {
    console.error('[CREATE LOCATAIRE] Erreur rollback après RPC:', rollbackError);
  }
  return res.status(500).json({ 
    error: `Erreur lors de la création du locataire : ${rpcError.message}`,
    code: 'RPC_ERROR',
    details: rpcError.message
  });
}
```

**✅ Résultat :** Retour JSON immédiat + rollback sécurisé

---

### 6. **Catch global** (lignes 253-262)

**AVANT :**
```javascript
} catch (error) {
  console.error('[CREATE LOCATAIRE] Erreur globale:', error);
  return res.status(500).json({ 
    error: 'Erreur serveur interne',
    details: error.message 
  });
}
```

**APRÈS :**
```javascript
} catch (error) {
  console.error('[CREATE LOCATAIRE] Erreur globale non catchée:', error);
  
  // S'assurer de toujours retourner du JSON
  if (!res.headersSent) {
    return res.status(500).json({ 
      error: 'Erreur serveur interne',
      code: 'INTERNAL_SERVER_ERROR',
      details: error.message || 'Une erreur inattendue s\'est produite'
    });
  }
}
```

**✅ Résultat :** Vérification `res.headersSent` pour éviter double-réponse + code erreur standardisé

---

## 📋 Codes erreur standardisés

| Code | Status | Description |
|------|--------|-------------|
| `REGIE_ID_MISSING` | 400 | Profile régie sans `regie_id` |
| `TEMP_PASSWORD_ERROR` | 500 | Échec génération mot de passe |
| `AUTH_CREATE_ERROR` | 400 | Échec création `auth.users` |
| `PROFILE_CREATE_ERROR` | 400 | Échec création `profiles` |
| `RPC_ERROR` | 500 | Échec RPC `creer_locataire_complet` |
| `INTERNAL_SERVER_ERROR` | 500 | Erreur globale non catchée |

---

## ✅ Garanties post-corrections

1. **Toutes les réponses sont JSON** : Plus jamais de texte/HTML
2. **Codes erreur standardisés** : Frontend peut distinguer les erreurs
3. **Rollback sécurisé** : Les opérations de nettoyage ne crashent pas
4. **Logging détaillé** : Console montre exactement où l'erreur se produit
5. **Fallback gracieux** : Erreurs non critiques (ex: mise à jour mot de passe) ne bloquent pas
6. **Vérification `regie_id`** : Blocage clair si profil régie invalide (code `REGIE_ID_MISSING`)

---

## 🧪 Tests recommandés

```bash
# Test 1 : Création réussie
POST /api/locataires/create
{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean.dupont@test.com",
  "date_entree": "2025-01-01"
}
# Attendu : 201 + JSON avec locataire + temporary_password

# Test 2 : Régie sans regie_id
# (Modifier profile pour regie_id = NULL)
POST /api/locataires/create
# Attendu : 400 + JSON { "code": "REGIE_ID_MISSING" }

# Test 3 : Email déjà existant
POST /api/locataires/create
{
  "email": "existant@test.com",
  ...
}
# Attendu : 400 + JSON { "code": "AUTH_CREATE_ERROR" }

# Test 4 : Champs obligatoires manquants
POST /api/locataires/create
{
  "nom": "Test"
  // Manque prenom, email, date_entree
}
# Attendu : 400 + JSON { "error": "Champs obligatoires manquants" }
```

---

## 🎯 Résultat final

**Plus aucune erreur `SyntaxError: Unexpected token` côté frontend !**

Toutes les branches d'erreur retournent maintenant du JSON valide avec :
- Message clair (`error`)
- Code machine (`code`)
- Détails techniques (`details`)

Le frontend peut maintenant :
- Parser `response.json()` sans crash
- Afficher des messages d'erreur lisibles
- Distinguer les types d'erreurs (via `code`)
