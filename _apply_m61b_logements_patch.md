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

-- Supprimer les anciennes contraintes strictes
ALTER TABLE logements DROP CONSTRAINT IF EXISTS check_npa_format;
ALTER TABLE logements DROP CONSTRAINT IF EXISTS check_logements_npa_format;
ALTER TABLE logements DROP CONSTRAINT IF EXISTS check_logement_npa_format;

-- Ajouter nouvelle contrainte flexible (4 ou 5 chiffres)
ALTER TABLE logements
ADD CONSTRAINT check_logement_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

-- Mise à jour commentaire
COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- Log
INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000002_m61b_patch_logements_npa',
  'Patch M61b : Correction contrainte NPA sur logements - Support multi-pays (4-5 chiffres)'
);

COMMIT;

-- Vérification
SELECT 
  constraint_name, 
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%npa%'
ORDER BY constraint_name;
```

3. **Cliquer sur "Run"**

4. **Vérifier le résultat**
   - La requête doit retourner `check_logement_npa_multi_pays` avec clause `npa ~ '^[0-9]{4,5}$'`
   - Aucune erreur

## ✅ Résultat attendu

Après l'exécution :
- ✅ `check_logement_npa_multi_pays` sur table `logements`
- ✅ Accepte 4 ou 5 chiffres
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
