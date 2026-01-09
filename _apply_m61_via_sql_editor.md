# 🌍 Migration M61 - Support Multi-pays

## Instructions d'application manuelle

La migration doit être appliquée manuellement via le SQL Editor de Supabase.

### Étapes :

1. **Ouvrir le Dashboard Supabase**
   - URL : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy
   - Aller dans **SQL Editor**

2. **Exécuter le SQL suivant :**

```sql
-- =====================================================
-- MIGRATION M61 : Support multi-pays (Suisse + France)
-- =====================================================

BEGIN;

-- 1. Supprimer l'ancienne contrainte sur immeubles (4 chiffres uniquement)
ALTER TABLE immeubles
DROP CONSTRAINT IF EXISTS check_npa_format;

-- 2. Ajouter nouvelle contrainte flexible sur immeubles (4 ou 5 chiffres)
ALTER TABLE immeubles
ADD CONSTRAINT check_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

COMMENT ON COLUMN immeubles.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- 3. Supprimer l'ancienne contrainte sur logements (si elle existe)
ALTER TABLE logements
DROP CONSTRAINT IF EXISTS check_logement_npa_format;

-- 4. Ajouter nouvelle contrainte flexible sur logements (4 ou 5 chiffres)
ALTER TABLE logements
ADD CONSTRAINT check_logement_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- 5. Log de migration
INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000001_m61_npa_multi_pays',
  'Support multi-pays : codes postaux Suisse (4 chiffres) et France (5 chiffres)'
);

COMMIT;

-- Vérification
SELECT 
  table_name, 
  constraint_name, 
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%npa%'
ORDER BY table_name, constraint_name;
```

3. **Cliquer sur "Run"**

4. **Vérifier le résultat**
   - La requête doit retourner les nouvelles contraintes
   - Aucune erreur ne doit apparaître

## ✅ Résultat attendu

Après l'exécution :
- ✅ `check_npa_multi_pays` sur table `immeubles` 
- ✅ `check_logement_npa_multi_pays` sur table `logements`
- ✅ Les deux acceptent 4 ou 5 chiffres (regex: `^[0-9]{4,5}$`)

---

**Note** : Cette migration est **100% rétrocompatible** avec les données existantes (codes postaux suisses à 4 chiffres).
