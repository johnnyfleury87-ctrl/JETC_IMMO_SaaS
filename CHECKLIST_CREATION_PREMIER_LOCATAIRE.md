# ✅ CHECKLIST CRÉATION PREMIER LOCATAIRE - FLUX COMPLET

**Date** : 23 décembre 2025  
**Contexte** : Aucun locataire actif en production (confirmé)  
**Objectif** : Rendre possible la création complète d'un locataire de bout en bout

---

## 🎯 ORDRE D'EXÉCUTION STRICT

### ÉTAPE 1 : VÉRIFIER L'ÉTAT ACTUEL DB

**Fichier à exécuter** : `supabase/VALIDATION_DB_PROD.sql`

**Où** : Supabase SQL Editor → Nouveau query → Coller → Run

**Ce qu'il fait** :
- Vérifie tables critiques (profiles, regies, locataires, logements, immeubles)
- Vérifie colonne `locataires.regie_id`
- Vérifie RPC `creer_locataire_complet()` avec paramètre `p_regie_id`

**Résultat attendu** :
```
✅ BASE DE DONNÉES VALIDE
Toutes les tables et colonnes critiques sont présentes
```

**Si ❌ manquant** : Noter quoi exactement, passer à ÉTAPE 2

---

### ÉTAPE 2 : VÉRIFIER LES CONTRAINTES FK (NOUVELLES VÉRIFICATIONS)

**Fichier à exécuter** : `scripts/verifier_contraintes_fk.sql` (ci-dessous)

**Copier dans Supabase SQL Editor** :
```sql
-- Vérifier contraintes FK critiques
SELECT 
  '1. profiles.regie_id → regies(id)' AS verification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK existe'
    ELSE '❌ FK MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'profiles' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%regie%';

SELECT 
  '2. locataires.regie_id → regies(id)' AS verification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK existe'
    ELSE '❌ FK MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'locataires' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%regie%';

SELECT 
  '3. locataires.logement_id → logements(id)' AS verification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK existe'
    ELSE '❌ FK MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'locataires' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%logement%';

SELECT 
  '4. logements.immeuble_id → immeubles(id)' AS verification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK existe'
    ELSE '❌ FK MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'logements' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%immeuble%';

SELECT 
  '5. immeubles.regie_id → regies(id)' AS verification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ FK existe'
    ELSE '❌ FK MANQUANTE'
  END AS status
FROM information_schema.table_constraints
WHERE table_name = 'immeubles' 
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%regie%';
```

**Résultat attendu** : Toutes lignes `✅ FK existe`

**Si ❌ manquant** : Passer à ÉTAPE 3

---

### ÉTAPE 3 : APPLIQUER LES MIGRATIONS MANQUANTES

#### Migration 1 : `locataires.regie_id` (si colonne manque)

**Fichier** : `supabase/migrations/20251223000000_add_regie_id_to_locataires.sql`

**État** : ✅ Déjà créé dans le repo

**Action** : 
1. Ouvrir Supabase Dashboard → SQL Editor
2. Copier TOUT le contenu du fichier
3. Exécuter
4. Attendre message `COMMIT` réussi

**Validation post-exécution** :
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'locataires' AND column_name = 'regie_id';
-- Doit retourner : regie_id | uuid | NO
```

---

#### Migration 2 : RPC `creer_locataire_complet()` avec `p_regie_id`

**Fichier** : `supabase/migrations/2025-12-21_fix_locataire_sans_logement.sql`

**État** : ✅ Déjà créé dans le repo

**Action** : 
1. Supabase Dashboard → SQL Editor
2. Copier TOUT le contenu du fichier
3. Exécuter

**Validation post-exécution** :
```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
WHERE p.proname = 'creer_locataire_complet';
-- Doit contenir : p_regie_id uuid
```

---

#### Migration 3 : FK `profiles.regie_id` (NOUVEAU - CRITIQUE)

**Fichier** : `supabase/migrations/20251223000001_add_fk_profiles_regie_id.sql` (à créer)

**Contenu** :
```sql
-- =====================================================
-- Migration : Ajouter FK sur profiles.regie_id
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Garantir intégrité référentielle profiles → regies
-- =====================================================

BEGIN;

-- Nettoyer les regie_id invalides (si existants)
UPDATE profiles
SET regie_id = NULL
WHERE regie_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM regies WHERE id = profiles.regie_id);

-- Ajouter FK avec cascade delete
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_regie
  FOREIGN KEY (regie_id) 
  REFERENCES regies(id) 
  ON DELETE CASCADE;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_profiles_regie_id_fk
  ON profiles(regie_id) 
  WHERE regie_id IS NOT NULL;

COMMIT;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'fk_profiles_regie'
  ) THEN
    RAISE NOTICE '✅ FK profiles.regie_id → regies(id) créée avec succès';
  ELSE
    RAISE EXCEPTION '❌ Échec création FK';
  END IF;
END $$;
```

**Action** : Copier dans Supabase SQL Editor → Exécuter

---

#### Migration 4 : Trigger validation "ticket nécessite logement" (NOUVEAU - CRITIQUE)

**Fichier** : `supabase/migrations/20251223000002_add_trigger_ticket_requires_logement.sql` (à créer)

**Contenu** :
```sql
-- =====================================================
-- Migration : Garantir règle métier "ticket = logement obligatoire"
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Bloquer création ticket si locataire sans logement
-- Niveau : BASE DE DONNÉES (pas contournable)
-- =====================================================

BEGIN;

-- Fonction de validation
CREATE OR REPLACE FUNCTION check_locataire_has_logement_for_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logement_id uuid;
BEGIN
  -- Récupérer logement_id du locataire
  SELECT logement_id INTO v_logement_id
  FROM locataires
  WHERE id = NEW.locataire_id;

  -- Vérifier que le locataire a un logement
  IF v_logement_id IS NULL THEN
    RAISE EXCEPTION 'RÈGLE MÉTIER VIOLÉE : Le locataire % doit avoir un logement assigné pour créer un ticket. Demandez à votre régie de vous attribuer un logement.', NEW.locataire_id
      USING HINT = 'Contactez votre régie pour être rattaché à un logement avant de créer un ticket';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_locataire_has_logement_for_ticket IS
  'RÈGLE MÉTIER CRITIQUE : Seul un locataire avec logement peut créer un ticket. Impossible de contourner.';

-- Trigger BEFORE INSERT
CREATE TRIGGER ensure_locataire_has_logement_before_ticket
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_locataire_has_logement_for_ticket();

COMMENT ON TRIGGER ensure_locataire_has_logement_before_ticket ON tickets IS
  'Bloque création ticket si locataire sans logement (règle métier niveau DB)';

COMMIT;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ensure_locataire_has_logement_before_ticket'
  ) THEN
    RAISE NOTICE '✅ Trigger validation tickets créé avec succès';
    RAISE NOTICE '   → Locataire SANS logement ne pourra plus créer de ticket';
  ELSE
    RAISE EXCEPTION '❌ Échec création trigger';
  END IF;
END $$;
```

**Action** : Copier dans Supabase SQL Editor → Exécuter

---

#### Migration 5 : Contrainte unicité locataire actif par logement (NOUVEAU - IMPORTANT)

**Fichier** : `supabase/migrations/20251223000003_add_unique_active_locataire.sql` (à créer)

**Contenu** :
```sql
-- =====================================================
-- Migration : Garantir un seul locataire actif par logement
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Empêcher 2 locataires actifs sur même logement
-- Méthode : Exclusion constraint
-- =====================================================

BEGIN;

-- Activer extension btree_gist (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Contrainte d'exclusion
ALTER TABLE locataires
  ADD CONSTRAINT unique_active_locataire_per_logement
  EXCLUDE USING gist (
    logement_id WITH =
  ) WHERE (date_sortie IS NULL AND logement_id IS NOT NULL);

COMMENT ON CONSTRAINT unique_active_locataire_per_logement ON locataires IS
  'Un logement ne peut avoir qu''un seul locataire actif (date_sortie = NULL)';

COMMIT;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_active_locataire_per_logement'
  ) THEN
    RAISE NOTICE '✅ Contrainte unicité locataire actif créée avec succès';
    RAISE NOTICE '   → Impossible d''attribuer 2 locataires actifs au même logement';
  ELSE
    RAISE EXCEPTION '❌ Échec création contrainte';
  END IF;
END $$;
```

**Action** : Copier dans Supabase SQL Editor → Exécuter

---

### ÉTAPE 4 : VALIDER STRUCTURE DB FINALE

**Exécuter ce script de validation finale** :

```sql
-- =====================================================
-- VALIDATION FINALE - Structure DB complète
-- =====================================================

DO $$
DECLARE
  missing_count integer := 0;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'VALIDATION FINALE - FLUX LOCATAIRE';
  RAISE NOTICE '═══════════════════════════════════════';
  
  -- 1. Colonne locataires.regie_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locataires' AND column_name = 'regie_id'
  ) THEN
    RAISE WARNING '❌ locataires.regie_id MANQUANTE';
    missing_count := missing_count + 1;
  ELSE
    RAISE NOTICE '✅ locataires.regie_id existe';
  END IF;

  -- 2. FK profiles.regie_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'fk_profiles_regie'
  ) THEN
    RAISE WARNING '❌ FK profiles.regie_id MANQUANTE';
    missing_count := missing_count + 1;
  ELSE
    RAISE NOTICE '✅ FK profiles.regie_id → regies(id)';
  END IF;

  -- 3. FK locataires.regie_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'locataires' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%regie%'
  ) THEN
    RAISE WARNING '❌ FK locataires.regie_id MANQUANTE';
    missing_count := missing_count + 1;
  ELSE
    RAISE NOTICE '✅ FK locataires.regie_id → regies(id)';
  END IF;

  -- 4. RPC avec p_regie_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'creer_locataire_complet'
  ) THEN
    RAISE WARNING '❌ RPC creer_locataire_complet MANQUANTE';
    missing_count := missing_count + 1;
  ELSE
    RAISE NOTICE '✅ RPC creer_locataire_complet existe';
  END IF;

  -- 5. Trigger validation tickets
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ensure_locataire_has_logement_before_ticket'
  ) THEN
    RAISE WARNING '⚠️  Trigger validation tickets MANQUANT (IMPORTANT)';
  ELSE
    RAISE NOTICE '✅ Trigger validation tickets actif';
  END IF;

  -- 6. Contrainte unicité locataire actif
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_active_locataire_per_logement'
  ) THEN
    RAISE NOTICE '⚠️  Contrainte unicité locataire MANQUANTE (IMPORTANT)';
  ELSE
    RAISE NOTICE '✅ Contrainte unicité locataire actif';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  
  IF missing_count = 0 THEN
    RAISE NOTICE '✅ STRUCTURE DB VALIDE POUR CRÉATION LOCATAIRE';
  ELSE
    RAISE WARNING '❌ % éléments critiques manquants', missing_count;
    RAISE WARNING 'Exécuter migrations manquantes avant de continuer';
  END IF;
  
END $$;
```

**Résultat attendu** :
```
✅ STRUCTURE DB VALIDE POUR CRÉATION LOCATAIRE
```

---

### ÉTAPE 5 : VÉRIFIER BACKEND

**Fichier** : `api/locataires/create.js`

**Vérifications** :
- [x] Nettoyage empty string → null (lignes 88-93) ✅ FAIT
- [x] Appel RPC avec `p_regie_id` (ligne 186) ✅ FAIT
- [x] Gestion erreur si `profiles.regie_id` invalide (ligne 60) ✅ FAIT
- [x] Retour mot de passe Test1234! si `temporary_passwords` absente ✅ FAIT

**Fichier** : `api/services/passwordService.js`

**Vérifications** :
- [x] Suppression dépendance `bcryptjs` ✅ FAIT
- [x] Fonction `generateTempPassword()` retourne `Test1234!` ✅ FAIT
- [x] Try/catch sur table `temporary_passwords` ✅ FAIT

**Verdict backend** : ✅ PRÊT

---

### ÉTAPE 6 : TESTER CRÉATION PREMIER LOCATAIRE

#### Test 1 : Locataire AVEC logement

**URL** : `https://votre-domaine.vercel.app/regie/locataires.html`

**Action** :
1. Se connecter en tant que régie
2. Cliquer "Ajouter un locataire"
3. Remplir formulaire :
   - Nom : `Test`
   - Prénom : `Locataire1`
   - Email : `locataire1@test.com`
   - Date d'entrée : `2025-12-23`
   - **Logement : Sélectionner un logement**
   - Téléphone : `0612345678` (optionnel)
   - Date naissance : `1990-01-01` (optionnel)
4. Soumettre

**Résultat attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "uuid-xxx",
    "nom": "Test",
    "prenom": "Locataire1",
    "email": "locataire1@test.com",
    "regie_id": "uuid-regie",
    "logement_id": "uuid-logement",
    "date_entree": "2025-12-23"
  },
  "credentials": {
    "email": "locataire1@test.com",
    "temporary_password": "Test1234!"
  }
}
```

**Vérifications DB** :
```sql
-- Vérifier utilisateur créé
SELECT id, email FROM auth.users WHERE email = 'locataire1@test.com';

-- Vérifier profile créé
SELECT id, role, regie_id, logement_id FROM profiles WHERE email = 'locataire1@test.com';

-- Vérifier locataire créé
SELECT id, nom, prenom, regie_id, logement_id FROM locataires WHERE email = 'locataire1@test.com';

-- Vérifier cohérence
SELECT 
  l.nom, 
  l.prenom, 
  l.regie_id AS loc_regie,
  lo.id AS logement,
  i.regie_id AS immeuble_regie
FROM locataires l
LEFT JOIN logements lo ON l.logement_id = lo.id
LEFT JOIN immeubles i ON lo.immeuble_id = i.id
WHERE l.email = 'locataire1@test.com';
-- loc_regie doit = immeuble_regie
```

**✅ Test 1 RÉUSSI si** :
- auth.users contient 1 ligne
- profiles contient 1 ligne avec `role = 'locataire'`
- locataires contient 1 ligne avec `regie_id` renseigné
- locataires.regie_id = immeubles.regie_id

---

#### Test 2 : Locataire SANS logement

**Action** :
1. Se connecter en tant que régie
2. Cliquer "Ajouter un locataire"
3. Remplir formulaire :
   - Nom : `Test`
   - Prénom : `Locataire2`
   - Email : `locataire2@test.com`
   - Date d'entrée : `2025-12-23`
   - **Logement : Laisser vide**
4. Soumettre

**Résultat attendu** :
```json
{
  "success": true,
  "locataire": {
    "id": "uuid-xxx",
    "nom": "Test",
    "prenom": "Locataire2",
    "email": "locataire2@test.com",
    "regie_id": "uuid-regie",
    "logement_id": null,
    "date_entree": "2025-12-23"
  },
  "credentials": {
    "email": "locataire2@test.com",
    "temporary_password": "Test1234!"
  }
}
```

**Vérifications DB** :
```sql
SELECT id, nom, prenom, regie_id, logement_id 
FROM locataires 
WHERE email = 'locataire2@test.com';
-- logement_id doit être NULL
-- regie_id doit être renseigné
```

**✅ Test 2 RÉUSSI si** :
- Locataire créé avec `logement_id = NULL`
- `regie_id` quand même renseigné

---

#### Test 3 : Locataire SANS logement tente créer ticket (DOIT ÉCHOUER)

**Action** :
1. Se connecter avec `locataire2@test.com` / `Test1234!`
2. Aller sur page tickets
3. Tenter de créer un ticket

**Résultat attendu** :
```json
{
  "message": "Vous devez être rattaché à un logement pour créer un ticket"
}
```

**OU (si trigger DB activé)** :
```
RÈGLE MÉTIER VIOLÉE : Le locataire xxx doit avoir un logement assigné pour créer un ticket
```

**✅ Test 3 RÉUSSI si** :
- Backend retourne erreur 400
- Ticket NON créé dans DB

---

#### Test 4 : Locataire AVEC logement tente créer ticket (DOIT RÉUSSIR)

**Action** :
1. Se connecter avec `locataire1@test.com` / `Test1234!`
2. Aller sur page tickets
3. Créer un ticket :
   - Titre : `Test ticket`
   - Description : `Description test`
   - Priorité : `normale`
   - Catégorie : `plomberie`
4. Soumettre

**Résultat attendu** :
```json
{
  "success": true,
  "ticket": {
    "id": "uuid-xxx",
    "titre": "Test ticket",
    "locataire_id": "uuid-locataire1",
    "logement_id": "uuid-logement",
    "regie_id": "uuid-regie"
  }
}
```

**Vérifications DB** :
```sql
SELECT 
  t.id, 
  t.titre, 
  t.locataire_id, 
  t.logement_id, 
  t.regie_id,
  l.regie_id AS loc_regie,
  lo.immeuble_id,
  i.regie_id AS immeuble_regie
FROM tickets t
JOIN locataires l ON t.locataire_id = l.id
JOIN logements lo ON t.logement_id = lo.id
JOIN immeubles i ON lo.immeuble_id = i.id
WHERE t.titre = 'Test ticket';
-- Vérifier : t.regie_id = l.regie_id = i.regie_id
```

**✅ Test 4 RÉUSSI si** :
- Ticket créé
- `tickets.regie_id` calculé automatiquement par trigger
- Cohérence : tickets.regie_id = locataires.regie_id = immeubles.regie_id

---

### ÉTAPE 7 : TESTER RÈGLES MÉTIER SUPPLÉMENTAIRES

#### Test 5 : Attribuer 2 locataires actifs sur même logement (DOIT ÉCHOUER)

**Action** :
1. Créer `locataire3@test.com` avec le MÊME logement que `locataire1`
2. Ne pas renseigner `date_sortie` pour les 2

**Résultat attendu** :
```
Erreur : duplicate key value violates unique constraint "unique_active_locataire_per_logement"
```

**✅ Test 5 RÉUSSI si** :
- Backend retourne erreur
- 2ème locataire NON créé

---

#### Test 6 : Supprimer une régie qui a des locataires (CASCADE)

**Action** :
1. Supprimer la régie (SQL direct ou interface admin)

**Résultat attendu** :
- Tous locataires de cette régie supprimés automatiquement (CASCADE)
- Tous profiles de cette régie supprimés automatiquement (CASCADE)
- Tous immeubles de cette régie supprimés automatiquement (CASCADE)

**Vérifications DB** :
```sql
-- Après suppression régie
SELECT COUNT(*) FROM locataires WHERE regie_id = 'uuid-regie-supprimee';
-- Doit retourner 0

SELECT COUNT(*) FROM profiles WHERE regie_id = 'uuid-regie-supprimee';
-- Doit retourner 0
```

**✅ Test 6 RÉUSSI si** :
- Données orphelines = 0

---

## 🎯 VERDICT FINAL

### ✅ SYSTÈME PRÊT si :

- [ ] ÉTAPE 1 : Script validation = ✅ BASE DE DONNÉES VALIDE
- [ ] ÉTAPE 2 : Toutes FK = ✅ existe
- [ ] ÉTAPE 3 : Toutes migrations exécutées sans erreur
- [ ] ÉTAPE 4 : Validation finale = ✅ STRUCTURE DB VALIDE
- [ ] ÉTAPE 5 : Backend vérifié = ✅ PRÊT
- [ ] ÉTAPE 6 : Test 1 (avec logement) = ✅ RÉUSSI
- [ ] ÉTAPE 6 : Test 2 (sans logement) = ✅ RÉUSSI
- [ ] ÉTAPE 6 : Test 3 (ticket sans logement) = ❌ BLOQUÉ (attendu)
- [ ] ÉTAPE 6 : Test 4 (ticket avec logement) = ✅ RÉUSSI
- [ ] ÉTAPE 7 : Test 5 (doublon locataire) = ❌ BLOQUÉ (attendu)
- [ ] ÉTAPE 7 : Test 6 (cascade delete) = ✅ RÉUSSI

**Si TOUS les tests passent** :

```
╔═══════════════════════════════════════════════════════════╗
║  ✅ LE SYSTÈME PEUT MAINTENANT CRÉER SON PREMIER         ║
║     LOCATAIRE VALIDE DE BOUT EN BOUT                     ║
╚═══════════════════════════════════════════════════════════╝

- Flux Régie → Locataire : ✅ FONCTIONNEL
- Intégrité référentielle : ✅ GARANTIE
- Règles métier : ✅ NIVEAU DB
- Isolation multi-tenant : ✅ SÉCURISÉE
- Données orphelines : ❌ IMPOSSIBLES
```

---

## 📋 RÉCAPITULATIF MIGRATIONS À EXÉCUTER

Si VALIDATION_DB_PROD.sql retourne des ❌, exécuter dans l'ordre :

1. **20251223000000_add_regie_id_to_locataires.sql** (si locataires.regie_id manque)
2. **2025-12-21_fix_locataire_sans_logement.sql** (si RPC sans p_regie_id)
3. **20251223000001_add_fk_profiles_regie_id.sql** (NOUVEAU - FK profiles)
4. **20251223000002_add_trigger_ticket_requires_logement.sql** (NOUVEAU - trigger tickets)
5. **20251223000003_add_unique_active_locataire.sql** (NOUVEAU - unicité locataire)

**Temps estimé** : 10-15 minutes (avec validations)

---

## 🚨 SI ÉCHEC

### Symptôme : Colonne `locataires.regie_id` manque toujours

**Solution** : Exécuter manuellement dans SQL Editor :
```sql
ALTER TABLE locataires ADD COLUMN regie_id uuid;
UPDATE locataires l SET regie_id = i.regie_id
FROM logements lo
JOIN immeubles i ON lo.immeuble_id = i.id
WHERE l.logement_id = lo.id;
ALTER TABLE locataires ALTER COLUMN regie_id SET NOT NULL;
ALTER TABLE locataires ADD CONSTRAINT fk_locataires_regie FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE CASCADE;
```

---

### Symptôme : RPC retourne erreur "function does not exist"

**Solution** : Vérifier signature exacte dans SQL Editor :
```sql
SELECT pg_get_function_arguments(p.oid)
FROM pg_proc p
WHERE p.proname = 'creer_locataire_complet';
```

Si `p_regie_id` absent → exécuter migration `2025-12-21_fix_locataire_sans_logement.sql`

---

### Symptôme : Backend crash "profiles.regie_id is null"

**Solution** : Profil régie mal configuré
```sql
-- Vérifier profil régie
SELECT id, email, role, regie_id FROM profiles WHERE role = 'regie';

-- Si regie_id NULL, mettre à jour
UPDATE profiles
SET regie_id = (SELECT id FROM regies WHERE profile_id = profiles.id)
WHERE role = 'regie' AND regie_id IS NULL;
```

---

**Prochaine action** : Exécuter ÉTAPE 1 (VALIDATION_DB_PROD.sql) et reporter résultats ici.
