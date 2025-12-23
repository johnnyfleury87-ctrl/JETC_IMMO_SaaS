-- =============================================================================
-- Migration : Ajout de regie_id dans la table locataires
-- Date : 2025-12-23
-- Objectif : Garantir l'isolation multi-tenant et permettre le filtrage direct
-- =============================================================================

-- PROBLÈME RÉSOLU :
-- - Aucune colonne regie_id dans locataires
-- - Impossible de filtrer les locataires par régie
-- - Frontend requiert .eq('regie_id', regieId) qui échouait
-- - Aucune isolation multi-tenant garantie

BEGIN;

-- -----------------------------------------------------------------------------
-- ÉTAPE 1 : Ajouter la colonne regie_id (temporairement nullable)
-- -----------------------------------------------------------------------------
ALTER TABLE locataires 
  ADD COLUMN regie_id uuid;

COMMENT ON COLUMN locataires.regie_id IS 
  'Régie qui gère ce locataire (obligatoire pour isolation multi-tenant)';

-- -----------------------------------------------------------------------------
-- ÉTAPE 2 : Migrer les données existantes
-- -----------------------------------------------------------------------------

-- CAS 1 : Locataires avec logement → récupérer regie_id via immeuble
UPDATE locataires l
SET regie_id = (
  SELECT im.regie_id
  FROM logements lg
  JOIN immeubles im ON im.id = lg.immeuble_id
  WHERE lg.id = l.logement_id
)
WHERE l.logement_id IS NOT NULL
  AND l.regie_id IS NULL;

-- CAS 2 : Locataires sans logement → récupérer regie_id via profile
UPDATE locataires l
SET regie_id = (
  SELECT p.regie_id
  FROM profiles p
  WHERE p.id = l.profile_id
)
WHERE l.regie_id IS NULL;

-- -----------------------------------------------------------------------------
-- ÉTAPE 3 : Identifier les locataires orphelins (regie_id toujours NULL)
-- -----------------------------------------------------------------------------

-- Vérifier s'il existe des locataires sans regie_id après migration
DO $$
DECLARE
  orphan_count INTEGER;
  r RECORD;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM locataires
  WHERE regie_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Attention : % locataire(s) sans regie_id après migration. Vérifier manuellement.', orphan_count;
    
    -- Logger les locataires orphelins pour investigation
    RAISE NOTICE 'Locataires orphelins :';
    FOR r IN (SELECT id, nom, prenom, email FROM locataires WHERE regie_id IS NULL) LOOP
      RAISE NOTICE '  - ID: %, Nom: % %, Email: %', r.id, r.prenom, r.nom, r.email;
    END LOOP;
  ELSE
    RAISE NOTICE 'Migration OK : tous les locataires ont un regie_id';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- ÉTAPE 4 : Rendre la colonne NOT NULL + ajouter contrainte FK
-- -----------------------------------------------------------------------------

-- Transformer la colonne en NOT NULL (échouera s'il reste des NULL)
ALTER TABLE locataires 
  ALTER COLUMN regie_id SET NOT NULL;

-- Ajouter la contrainte de clé étrangère avec CASCADE DELETE
ALTER TABLE locataires
  ADD CONSTRAINT fk_locataires_regie
  FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- ÉTAPE 5 : Créer index pour les performances
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_locataires_regie_id 
  ON locataires(regie_id);

-- Index composite pour les requêtes courantes (régie + tri par date)
CREATE INDEX IF NOT EXISTS idx_locataires_regie_created 
  ON locataires(regie_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- ÉTAPE 6 : Mettre à jour les politiques RLS (si nécessaire)
-- -----------------------------------------------------------------------------

-- Supprimer l'ancienne politique basée sur profile_id
DROP POLICY IF EXISTS locataires_select_policy ON locataires;

-- Nouvelle politique : utilisateur régie peut voir ses locataires
CREATE POLICY locataires_select_regie_policy ON locataires
  FOR SELECT
  USING (
    regie_id IN (
      SELECT regie_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Politique insertion : régie peut créer ses locataires
CREATE POLICY locataires_insert_regie_policy ON locataires
  FOR INSERT
  WITH CHECK (
    regie_id IN (
      SELECT regie_id 
      FROM profiles 
      WHERE id = auth.uid() 
        AND role = 'regie'
    )
  );

-- Politique update : régie peut modifier ses locataires
CREATE POLICY locataires_update_regie_policy ON locataires
  FOR UPDATE
  USING (
    regie_id IN (
      SELECT regie_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    regie_id IN (
      SELECT regie_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Politique delete : régie peut supprimer ses locataires
CREATE POLICY locataires_delete_regie_policy ON locataires
  FOR DELETE
  USING (
    regie_id IN (
      SELECT regie_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Politique pour les locataires : voir leur propre profil
CREATE POLICY locataires_select_self_policy ON locataires
  FOR SELECT
  USING (profile_id = auth.uid());

COMMIT;

-- =============================================================================
-- ROLLBACK (en cas de problème)
-- =============================================================================

/*

BEGIN;

-- Supprimer les nouvelles politiques RLS
DROP POLICY IF EXISTS locataires_select_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_insert_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_update_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_delete_regie_policy ON locataires;
DROP POLICY IF EXISTS locataires_select_self_policy ON locataires;

-- Recréer l'ancienne politique (si elle existait)
-- CREATE POLICY locataires_select_policy ON locataires
--   FOR SELECT
--   USING (...);

-- Supprimer les index
DROP INDEX IF EXISTS idx_locataires_regie_created;
DROP INDEX IF EXISTS idx_locataires_regie_id;

-- Supprimer la contrainte FK
ALTER TABLE locataires
  DROP CONSTRAINT IF EXISTS fk_locataires_regie;

-- Supprimer la colonne regie_id
ALTER TABLE locataires 
  DROP COLUMN IF EXISTS regie_id;

COMMIT;

*/

-- =============================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- =============================================================================

-- Vérifier que tous les locataires ont un regie_id
SELECT 
  COUNT(*) as total_locataires,
  COUNT(regie_id) as avec_regie_id,
  COUNT(*) - COUNT(regie_id) as sans_regie_id
FROM locataires;

-- Vérifier la distribution par régie
SELECT 
  r.nom as regie,
  COUNT(l.id) as nb_locataires
FROM regies r
LEFT JOIN locataires l ON l.regie_id = r.id
GROUP BY r.id, r.nom
ORDER BY nb_locataires DESC;

-- Vérifier les index créés
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'locataires'
  AND indexname LIKE 'idx_locataires_regie%';
