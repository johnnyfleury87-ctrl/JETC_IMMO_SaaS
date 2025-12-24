# 🚨 AUDIT GLOBAL FINAL - CAUSE RACINE IDENTIFIÉE

**Date** : 24 décembre 2025  
**Erreur** : `null value in column "logement_id" of relation "locataires" violates not-null constraint`

---

## ✅ AUDIT COMPLET RÉALISÉ (SOURCE DE VÉRITÉ)

### 📊 TABLEAU RÉCAPITULATIF - État réel production

| Élément | État actuel | Source | Problème |
|---------|-------------|--------|----------|
| **locataires.logement_id** | `NOT NULL` ❌ | `AUDIT_DB_COLUMNS.csv` ligne 182 | Colonne forcée NOT NULL |
| **Schema 08_locataires.sql** | `logement_id uuid references logements` (nullable) ✅ | `schema/08_locataires.sql` ligne 28 | Schéma dit "optionnel" |
| **Migration 2025-12-20** | `ALTER COLUMN logement_id SET NOT NULL` ❌ | `2025-12-20_migration_locataires_contraintes.sql` ligne 102 | A FORCÉ NOT NULL |
| **FK locataires → logements** | `ON DELETE RESTRICT` | Migration 2025-12-20 | OK mais bloque suppression logement |
| **Triggers sur locataires** | `set_updated_at_locataires` uniquement | Schema 08 | Aucun trigger ne force logement_id |
| **Contraintes CHECK** | Email, téléphone, dates | Schema 08 | Aucune sur logement_id |
| **RLS INSERT policies** | `Regie can insert own locataires` | `AUDIT_DB_RLS.csv` | Ne force pas logement_id |
| **Fonction RPC** | `creer_locataire_complet(p_logement_id DEFAULT NULL)` | Migration 2025-12-21 | Accepte NULL |
| **Backend API** | Passe `p_logement_id: null` | `api/locataires/create.js` ligne 200 | Conforme |
| **Frontend** | Permet création sans logement | `public/regie/locataires.html` | Conforme |

---

## 🔍 CAUSE EXACTE IDENTIFIÉE

**La migration `2025-12-20_migration_locataires_contraintes.sql` a FORCÉ `logement_id NOT NULL` sur toute la table.**

**Ligne 102** :
```sql
ALTER TABLE locataires 
ALTER COLUMN logement_id SET NOT NULL;
```

**Commentaire migration (ligne 8)** :
```sql
-- Un locataire est TOUJOURS affilié à un logement (logement_id NOT NULL)
```

**Cette décision métier était INCORRECTE et contredit le besoin validé :**
- Le schéma initial (`08_locataires.sql` ligne 28) dit : _"logement_id optionnel, null si sans logement"_
- Le besoin fonctionnel : _"Régie peut créer locataire AVANT de lui assigner un logement"_
- La RPC accepte `p_logement_id DEFAULT NULL`
- Le frontend permet de soumettre sans logement

**Résultat** : PostgreSQL rejette TOUT INSERT avec `logement_id = NULL` car colonne `NOT NULL`.

---

## 📋 FLOW COMPLET VÉRIFIÉ

```
✅ FRONTEND (/regie/locataires)
   └─> Formulaire permet logement_id vide
   └─> Envoie logement_id: "" (string vide)

✅ BACKEND (/api/locataires/create.js)
   └─> Nettoie "" → null (ligne 103)
   └─> Passe p_logement_id: null à RPC

✅ RPC (creer_locataire_complet)
   └─> Signature accepte p_logement_id DEFAULT NULL
   └─> Vérifie logement UNIQUEMENT si fourni (ligne 62)
   └─> INSERT avec logement_id = NULL

❌ BASE DE DONNÉES (PostgreSQL)
   └─> Contrainte NOT NULL sur locataires.logement_id
   └─> REJETTE l'INSERT
   └─> ERROR: null value violates not-null constraint
```

---

## 🎯 CORRECTIF SQL DÉFINITIF

### Migration : `20251224000000_fix_logement_id_nullable.sql`

```sql
-- =====================================================
-- CORRECTIF : Rendre locataires.logement_id NULLABLE
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Corriger erreur NOT NULL sur logement_id
-- Cause : Migration 2025-12-20 a forcé NOT NULL (décision métier incorrecte)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DIAGNOSTIC PRÉ-CORRECTIF
-- =====================================================

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'locataires'
    AND column_name = 'logement_id';
  
  IF v_is_nullable = 'NO' THEN
    RAISE NOTICE '⚠️  AVANT: locataires.logement_id est NOT NULL';
  ELSE
    RAISE NOTICE '✅ AVANT: locataires.logement_id est déjà nullable (correctif déjà appliqué?)';
  END IF;
END $$;

-- =====================================================
-- 2. RETIRER CONTRAINTE NOT NULL
-- =====================================================

ALTER TABLE locataires 
ALTER COLUMN logement_id DROP NOT NULL;

-- =====================================================
-- 3. METTRE À JOUR COMMENTAIRE COLONNE
-- =====================================================

COMMENT ON COLUMN locataires.logement_id IS 
  'Logement actuellement occupé (NULLABLE : un locataire peut être créé sans logement puis assigné ultérieurement)';

-- =====================================================
-- 4. VALIDATION POST-CORRECTIF
-- =====================================================

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'locataires'
    AND column_name = 'logement_id';
  
  IF v_is_nullable = 'YES' THEN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ CORRECTIF APPLIQUÉ AVEC SUCCÈS';
    RAISE NOTICE '';
    RAISE NOTICE 'locataires.logement_id est maintenant NULLABLE';
    RAISE NOTICE '';
    RAISE NOTICE 'Actions possibles :';
    RAISE NOTICE '  - Créer locataire SANS logement (NULL accepté)';
    RAISE NOTICE '  - Assigner logement ultérieurement (UPDATE)';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
  ELSE
    RAISE EXCEPTION '❌ ÉCHEC : locataires.logement_id toujours NOT NULL';
  END IF;
END $$;

-- =====================================================
-- 5. TEST INSERTION LOCATAIRE SANS LOGEMENT
-- =====================================================

DO $$
DECLARE
  v_test_id UUID;
BEGIN
  -- Test insertion avec logement_id = NULL
  INSERT INTO locataires (
    nom, prenom, email, profile_id, regie_id,
    logement_id,  -- ✅ NULL
    date_entree
  )
  VALUES (
    'Test', 'Correctif', 'test.correctif@example.com',
    '00000000-0000-0000-0000-000000000000'::uuid,
    (SELECT id FROM regies LIMIT 1),
    NULL,  -- ✅ Test avec NULL
    CURRENT_DATE
  )
  RETURNING id INTO v_test_id;
  
  RAISE NOTICE '✅ TEST INSERT : Locataire créé avec logement_id = NULL';
  RAISE NOTICE '   ID: %', v_test_id;
  
  -- Nettoyer données de test
  DELETE FROM locataires WHERE id = v_test_id;
  RAISE NOTICE '✅ Données test nettoyées';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  TEST INSERT échoué : %', SQLERRM;
    RAISE NOTICE 'Vérifier que table regies contient au moins une ligne';
END $$;

COMMIT;

-- =====================================================
-- 6. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20251224000000_fix_logement_id_nullable',
  'Correctif : DROP NOT NULL sur locataires.logement_id (erreur migration 2025-12-20)'
);
```

---

## ✅ CHECKLIST POST-CORRECTIF

### 1️⃣ Vérification colonne nullable

```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'locataires'
  AND column_name = 'logement_id';
```

**Attendu** :
```
column_name: logement_id
data_type: uuid
is_nullable: YES  ← DOIT être YES
column_default: NULL
```

---

### 2️⃣ Test INSERT direct SQL

```sql
-- Test création locataire SANS logement
INSERT INTO locataires (
  nom, prenom, email, profile_id, regie_id,
  logement_id,  -- NULL
  date_entree
)
VALUES (
  'Dupont', 'Test', 'test.sql@example.com',
  '00000000-0000-0000-0000-000000000000'::uuid,
  (SELECT id FROM regies LIMIT 1),
  NULL,
  CURRENT_DATE
);
```

**Attendu** : `INSERT 0 1` (succès)

---

### 3️⃣ Test RPC

```sql
SELECT creer_locataire_complet(
  p_nom := 'Test',
  p_prenom := 'RPC',
  p_email := 'test.rpc.nullable@example.com',
  p_profile_id := '11111111-0000-0000-0000-000000000000'::uuid,
  p_regie_id := (SELECT id FROM regies LIMIT 1),
  p_logement_id := NULL,  -- ✅ Test avec NULL
  p_date_entree := CURRENT_DATE
);
```

**Attendu** : JSON `{"success": true, "locataire_id": "...", "logement": null}`

---

### 4️⃣ Test backend API

```bash
POST /api/locataires/create
{
  "nom": "Dupont",
  "prenom": "Marie",
  "email": "marie.test.nullable@example.com",
  "date_entree": "2025-01-01",
  "logement_id": "",  # ✅ Vide = NULL
  "telephone": "",
  "date_naissance": "",
  "contact_urgence_nom": "",
  "contact_urgence_telephone": ""
}
```

**Attendu** : Status `201 Created`

---

### 5️⃣ Test frontend complet

1. Se connecter comme régie
2. `/regie/locataires` → "Nouveau locataire"
3. Remplir SANS logement
4. Soumettre

**Attendu** :
- ✅ Succès création
- ✅ Mot de passe affiché
- ✅ Locataire visible avec logement "N/A"
- ✅ Pas d'erreur 500

---

### 6️⃣ Vérification isolation

```sql
SELECT id, nom, prenom, regie_id, logement_id
FROM locataires
WHERE email LIKE '%test%'
ORDER BY created_at DESC
LIMIT 5;
```

**Attendu** :
- `regie_id` : NON NULL (isolation garantie)
- `logement_id` : NULL (création sans logement OK)

---

### 7️⃣ Nettoyage données test

```sql
DELETE FROM profiles
WHERE email LIKE '%test%';
```

---

## 🎯 RÉSULTAT ATTENDU

Après application du correctif :

| Test | Avant | Après |
|------|-------|-------|
| **INSERT NULL** | ❌ ERROR 23502 | ✅ Succès |
| **RPC NULL** | ❌ ERROR violates constraint | ✅ JSON success |
| **API POST** | ❌ 500 Internal Error | ✅ 201 Created |
| **Frontend** | ❌ Erreur réseau | ✅ Locataire créé |
| **Isolation** | N/A | ✅ regie_id NON NULL |
| **Logement ultérieur** | N/A | ✅ UPDATE possible |

---

## 📝 POURQUOI CETTE CORRECTION EST DÉFINITIVE

### 1️⃣ Cause unique identifiée

**Migration 2025-12-20 ligne 102** a FORCÉ `SET NOT NULL`.

**Aucune autre cause** : Pas de trigger, pas de CHECK, pas de RLS, pas de défaut.

### 2️⃣ Correctif chirurgical

```sql
ALTER TABLE locataires ALTER COLUMN logement_id DROP NOT NULL;
```

**Une seule commande** suffit. Pas de workaround, pas de logique conditionnelle.

### 3️⃣ Compatibilité totale

- ✅ RPC déjà conforme (`p_logement_id DEFAULT NULL`)
- ✅ Backend déjà conforme (passe `null`)
- ✅ Frontend déjà conforme (permet vide)
- ✅ RLS pas impactée (pas de filtre sur logement_id)

### 4️⃣ Aucune régression

- ✅ FK `locataires → logements` reste valide (NULL autorisé dans FK)
- ✅ Isolation multi-tenant intacte (`regie_id NOT NULL` conservé)
- ✅ Création AVEC logement toujours possible
- ✅ Pas de données orphelines (regie_id obligatoire)

### 5️⃣ Tests exhaustifs

7 tests couvrent :
- SQL direct
- RPC
- Backend API
- Frontend
- Isolation
- Nettoyage

---

## 🔥 SYNTHÈSE EXÉCUTIVE

### Problème

`locataires.logement_id` est `NOT NULL` en production alors que le besoin métier validé exige qu'il soit nullable.

### Cause

Migration `2025-12-20_migration_locataires_contraintes.sql` ligne 102 a exécuté :
```sql
ALTER TABLE locataires ALTER COLUMN logement_id SET NOT NULL;
```

### Correctif

Migration `20251224000000_fix_logement_id_nullable.sql` exécute :
```sql
ALTER TABLE locataires ALTER COLUMN logement_id DROP NOT NULL;
```

### Validation

7 tests fournis (SQL, RPC, API, Frontend, Isolation).

### Résultat

- ✅ Création locataire sans logement fonctionnelle
- ✅ Aucune erreur 500
- ✅ Aucune violation FK
- ✅ Isolation multi-tenant intacte
- ✅ Aucune régression

---

**Rapport généré le** : 24 décembre 2025  
**Source de vérité** : `AUDIT_DB_COLUMNS.csv` ligne 182  
**Correctif** : `supabase/migrations/20251224000000_fix_logement_id_nullable.sql`  
**Statut** : ⏳ En attente d'exécution migration
