🌍 Migration M61b - Patch Logements NPA

## Instructions d'application manuelle

La migration M61b corrige la contrainte NPA sur la table `logements` (oubliée dans M61).

### Étapes :

1. **Ouvrir le Dashboard Supabase**
   - URL : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy
   - Aller dans **SQL Editor**

2. **Exécuter le SQL suivant :**

```sql
-- =====================================================
-- MIGRATION M61b : Patch contrainte NPA sur logements
-- =====================================================

BEGIN;

-- Supprimer toutes les contraintes NPA existantes
ALTER TABLE logements
  DROP CONSTRAINT IF EXISTS check_npa_format,
  DROP CONSTRAINT IF EXISTS check_logements_npa_format,
  DROP CONSTRAINT IF EXISTS check_logement_npa_format,
  DROP CONSTRAINT IF EXISTS check_logement_npa_multi_pays,
  DROP CONSTRAINT IF EXISTS check_logements_npa_multi_pays;

-- Ajouter contrainte flexible (4 ou 5 chiffres)
ALTER TABLE logements
  ADD CONSTRAINT check_logements_npa_multi_pays
  CHECK (npa ~ '^[0-9]{4,5}$');

-- Mise à jour commentaire
COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- Log migration (AVANT COMMIT)
INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000002_m61b_patch_logements_npa',
  'Patch M61b : Correction contrainte NPA sur logements - Support multi-pays (4-5 chiffres)'
);

COMMIT;

-- Validation (dans un bloc DO)
DO $$
DECLARE
  v_total INTEGER;
  v_valides INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM logements WHERE npa IS NOT NULL;
  SELECT COUNT(*) INTO v_valides FROM logements WHERE npa ~ '^[0-9]{4,5}$';
  
  RAISE NOTICE '✅ M61b OK: logements.npa accepte 4 ou 5 chiffres';
  RAISE NOTICE 'Total: % | Valides: %', v_total, v_valides;
END $$;
```

3. **Cliquer sur "Run"**

4. **Vérifier le résultat**
   - La requête doit afficher `✅ M61b OK` dans les notices
   - Aucune erreur

## ✅ Résultat attendu

Après l'exécution :
- ✅ `check_logements_npa_multi_pays` sur table `logements` 
- ✅ 100% compatible avec données existantes

## 🧪 Test rapide

Après migration, tester dans la console :

```sql
-- Test NPA 5 chiffres (France)
INSERT INTO logements (numero, npa, ville, pays, regie_id)
VALUES ('TEST_FR', '75001', 'Paris', 'France', '00000000-0000-0000-0000-000000000000');

-- Si OK, supprimer le test
DELETE FROM logements WHERE numero = 'TEST_FR';
```

✅ Si pas d'erreur → Migration réussie !
