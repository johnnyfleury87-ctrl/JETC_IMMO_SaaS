# ✅ CHECKLIST POST-CLEANUP RPC

**Date** : 24 décembre 2025  
**Objectif** : Vérifier qu'une seule fonction `creer_locataire_complet` existe et fonctionne

---

## 📋 ÉTAPE 1 : VÉRIFICATION SIGNATURE SQL

### Commande à exécuter dans Supabase SQL Editor :

```sql
SELECT 
  proname AS function_name,
  pg_get_function_arguments(oid) AS signature,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'creer_locataire_complet'
  AND pronamespace = 'public'::regnamespace;
```

### ✅ Résultat attendu :

**Une seule ligne** avec :
```
function_name: creer_locataire_complet
signature: p_nom text, p_prenom text, p_email text, p_profile_id uuid, 
           p_regie_id uuid, p_logement_id uuid DEFAULT NULL, 
           p_date_entree date DEFAULT NULL, p_telephone text DEFAULT NULL, 
           p_date_naissance date DEFAULT NULL, 
           p_contact_urgence_nom text DEFAULT NULL, 
           p_contact_urgence_telephone text DEFAULT NULL
return_type: json
```

### ❌ Si plusieurs lignes :

- [ ] Il reste des surcharges obsolètes
- [ ] Identifier les signatures exactes
- [ ] Ajouter des `DROP FUNCTION` supplémentaires dans `CLEANUP_RPC_FUNCTIONS.sql`
- [ ] Réexécuter le cleanup

---

## 📋 ÉTAPE 2 : COMPTAGE FONCTIONS

### Commande :

```sql
SELECT COUNT(*) AS nb_fonctions
FROM pg_proc
WHERE proname = 'creer_locataire_complet'
  AND pronamespace = 'public'::regnamespace;
```

### ✅ Résultat attendu :

```
nb_fonctions: 1
```

### ❌ Si nb_fonctions ≠ 1 :

- [ ] Exécuter audit complet :
  ```sql
  SELECT oid, pg_get_function_identity_arguments(oid) 
  FROM pg_proc 
  WHERE proname = 'creer_locataire_complet';
  ```
- [ ] Supprimer surcharges une par une avec signature exacte

---

## 📋 ÉTAPE 3 : TEST RPC SQL DIRECT

### Commande (avec données fictives) :

```sql
SELECT creer_locataire_complet(
  p_nom := 'Test',
  p_prenom := 'Cleanup',
  p_email := 'test.cleanup@example.com',
  p_profile_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_regie_id := (SELECT id FROM regies LIMIT 1),  -- Régie existante
  p_logement_id := NULL,  -- Test SANS logement
  p_date_entree := CURRENT_DATE
);
```

### ✅ Résultat attendu :

```json
{
  "success": true,
  "locataire_id": "...",
  "profile_id": "00000000-0000-0000-0000-000000000000",
  "email": "test.cleanup@example.com",
  "logement": null,
  "message": "Locataire créé avec succès"
}
```

### ❌ Si erreur "function name is not unique" :

- [ ] Cleanup incomplet, retour ÉTAPE 1

### ❌ Si erreur "function does not exist" :

- [ ] La bonne fonction a été supprimée par erreur
- [ ] Réexécuter migration `2025-12-21_fix_locataire_sans_logement.sql`

---

## 📋 ÉTAPE 4 : TEST BACKEND API

### Requête HTTP POST :

```bash
POST https://votre-app.vercel.app/api/locataires/create
Authorization: Bearer <token_regie>
Content-Type: application/json

{
  "nom": "Dupont",
  "prenom": "Marie",
  "email": "marie.dupont.cleanup@test.com",
  "date_entree": "2025-01-01",
  "logement_id": "",
  "telephone": "",
  "date_naissance": "",
  "contact_urgence_nom": "",
  "contact_urgence_telephone": ""
}
```

### ✅ Résultat attendu :

**Status** : `201 Created`

```json
{
  "success": true,
  "locataire": {
    "id": "...",
    "nom": "Dupont",
    "prenom": "Marie",
    "email": "marie.dupont.cleanup@test.com",
    "profile_id": "...",
    "logement": null
  },
  "temporary_password": {
    "password": "Test1234!",
    "expires_at": "...",
    "expires_in_days": 7
  },
  "message": "Locataire Marie Dupont créé avec succès"
}
```

### ❌ Si erreur "Could not find the function" :

- [ ] Vérifier que le backend passe les paramètres dans le bon ordre
- [ ] Comparer avec signature SQL (ÉTAPE 1)

---

## 📋 ÉTAPE 5 : TEST FRONTEND

### Scénario utilisateur :

1. [ ] Se connecter comme **régie** (role='regie')
2. [ ] Accéder à `/regie/locataires`
3. [ ] Vérifier chargement page (pas d'erreur console)
4. [ ] Cliquer "Nouveau locataire"
5. [ ] Remplir formulaire **SANS logement** :
   - Nom : `Cleanup`
   - Prénom : `Test`
   - Email : `test.frontend@example.com`
   - Date entrée : `2025-01-01`
   - Logement : **Laisser vide**
6. [ ] Soumettre le formulaire
7. [ ] Vérifier succès :
   - Message "Locataire créé avec succès"
   - Mot de passe temporaire affiché
   - Locataire apparaît dans la liste

### ✅ Résultat attendu :

- Création réussie
- Aucune erreur console
- Locataire visible dans liste avec :
  - Nom/Prénom
  - Email
  - Logement : "N/A"
  - Badge "Actif"

### ❌ Si erreur réseau :

- [ ] Ouvrir console DevTools (F12)
- [ ] Onglet Network → voir détail requête POST
- [ ] Copier erreur exacte pour diagnostic

---

## 📋 ÉTAPE 6 : VÉRIFICATION ISOLATION MULTI-TENANT

### Commande SQL :

```sql
SELECT 
  id, 
  nom, 
  prenom, 
  email, 
  regie_id,
  logement_id
FROM locataires
WHERE email LIKE '%cleanup%' OR email LIKE '%test%'
ORDER BY created_at DESC
LIMIT 5;
```

### ✅ Résultat attendu :

Tous les locataires de test doivent avoir :
- `regie_id` : **NON NULL**
- `logement_id` : **NULL** (si créés sans logement)

### ❌ Si regie_id NULL :

- [ ] La fonction insère toujours sans `regie_id`
- [ ] Vérifier le code source de la fonction (section INSERT)

---

## 📋 ÉTAPE 7 : NETTOYAGE DONNÉES DE TEST

### Supprimer locataires de test :

```sql
-- Supprimer profiles + auth.users (cascade automatique vers locataires)
DELETE FROM profiles
WHERE email LIKE '%test%' OR email LIKE '%cleanup%';

-- Vérifier suppression
SELECT COUNT(*) FROM locataires
WHERE email LIKE '%test%' OR email LIKE '%cleanup%';
-- Attendu : 0
```

---

## 🎯 VERDICT FINAL

### ✅ Tous les tests passent

**Conclusion** : Cleanup réussi, fonction RPC opérationnelle

**Actions suivantes** :
- [ ] Documenter version canonique dans README
- [ ] Tester création avec logement
- [ ] Tester libération logement
- [ ] Déployer en production si test en staging

---

### ❌ Au moins un test échoue

**Actions** :

1. [ ] Noter quel test échoue (numéro étape)
2. [ ] Copier message d'erreur exact
3. [ ] Vérifier signature fonction (ÉTAPE 1)
4. [ ] Si ambiguïté persiste : ré-exécuter `CLEANUP_RPC_FUNCTIONS.sql`
5. [ ] Si fonction manquante : ré-exécuter `2025-12-21_fix_locataire_sans_logement.sql`

---

## 📊 RÉCAPITULATIF SIGNATURES

### ❌ ANCIENNE (à supprimer)

```
(text, text, text, uuid, uuid, date, text, date, text, text)
 ↑                       ↑    ↑
 p_nom                   |    p_logement_id (position 5)
                         p_profile_id
```

**10 paramètres** | Pas de `p_regie_id` | `p_logement_id` obligatoire

---

### ✅ NOUVELLE (à garder)

```
(text, text, text, uuid, uuid, uuid, date, text, date, text, text)
 ↑                       ↑    ↑    ↑
 p_nom                   |    |    p_logement_id (position 6, DEFAULT NULL)
                         |    p_regie_id (position 5, OBLIGATOIRE)
                         p_profile_id
```

**11 paramètres** | `p_regie_id` en position 5 | `p_logement_id` DEFAULT NULL

---

## 🔗 RÉFÉRENCES

- Script cleanup : `supabase/CLEANUP_RPC_FUNCTIONS.sql`
- Migration source : `supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql`
- Diagnostic complet : `DIAGNOSTIC_MISMATCH_RPC.md`
- Appel backend : `api/locataires/create.js` lignes 195-207

---

**Checklist générée le** : 24 décembre 2025  
**Statut** : ⏳ En attente d'exécution cleanup  
**Durée estimée** : 10 minutes (7 étapes)
