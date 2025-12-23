-- =====================================================
-- Migration : Ajouter FK sur profiles.regie_id
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Garantir intégrité référentielle profiles → regies
-- Impact : Empêche profiles orphelins, cascade delete
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
    RAISE NOTICE '   → Intégrité référentielle garantie';
    RAISE NOTICE '   → Cascade delete actif';
  ELSE
    RAISE EXCEPTION '❌ Échec création FK';
  END IF;
END $$;
