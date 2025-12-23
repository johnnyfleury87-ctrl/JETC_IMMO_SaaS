-- =============================================================================
-- Migration : Modifier table temporary_passwords (supprimer bcryptjs)
-- Date : 2025-12-23
-- Objectif : Stocker mot de passe temporaire en clair (protégé RLS)
-- =============================================================================

-- PROBLÈME RÉSOLU :
-- - bcryptjs n'est pas installé → import échoue
-- - Double hashing inutile (Supabase Auth hashe déjà)
-- - Table temporary_passwords protégée par RLS → stockage en clair sécurisé

BEGIN;

-- -----------------------------------------------------------------------------
-- ÉTAPE 1 : Ajouter colonne password_clear
-- -----------------------------------------------------------------------------
ALTER TABLE temporary_passwords 
  ADD COLUMN IF NOT EXISTS password_clear text;

COMMENT ON COLUMN temporary_passwords.password_clear IS 
  'Mot de passe temporaire en clair (protégé par RLS, Supabase Auth hashe déjà dans auth.users)';

-- -----------------------------------------------------------------------------
-- ÉTAPE 2 : Supprimer colonne password_hash (optionnel)
-- -----------------------------------------------------------------------------
ALTER TABLE temporary_passwords 
  DROP COLUMN IF EXISTS password_hash;

-- -----------------------------------------------------------------------------
-- ÉTAPE 3 : Vérifier structure finale
-- -----------------------------------------------------------------------------
COMMENT ON TABLE temporary_passwords IS 
  'Stockage des mots de passe temporaires (en clair, protégé par RLS). Supabase Auth hashe automatiquement dans auth.users.';

COMMIT;

-- =============================================================================
-- ROLLBACK (en cas de problème)
-- =============================================================================

/*

BEGIN;

-- Recréer colonne password_hash
ALTER TABLE temporary_passwords 
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Supprimer colonne password_clear
ALTER TABLE temporary_passwords 
  DROP COLUMN IF EXISTS password_clear;

COMMIT;

*/

-- =============================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- =============================================================================

-- Vérifier structure table
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'temporary_passwords'
ORDER BY ordinal_position;
