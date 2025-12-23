/**
 * MIGRATION COMPLÈTE - Table temporary_passwords
 * 
 * Date : 23 décembre 2025
 * Objectif : Créer la table manquante en production
 * 
 * VERSION SIMPLIFIÉE : password_clear (pas de bcrypt)
 * 
 * RÈGLES MÉTIER :
 * - Stockage en clair (Supabase Auth hashe dans auth.users)
 * - Table protégée par RLS
 * - Un seul mot de passe actif par locataire
 * - Expiration après 7 jours
 */

-- =====================================================
-- 1. CRÉATION TABLE (IF NOT EXISTS pour sécurité)
-- =====================================================

CREATE TABLE IF NOT EXISTS temporary_passwords (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  password_clear text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Commentaires
COMMENT ON TABLE temporary_passwords IS 
  'Mots de passe temporaires pour locataires (stockés en clair, protégés par RLS)';
COMMENT ON COLUMN temporary_passwords.profile_id IS 
  'Profile du locataire (clé primaire)';
COMMENT ON COLUMN temporary_passwords.password_clear IS 
  'Mot de passe en clair (Supabase Auth hashe dans auth.users)';
COMMENT ON COLUMN temporary_passwords.created_at IS 
  'Date de génération';
COMMENT ON COLUMN temporary_passwords.expires_at IS 
  'Date d''expiration (7 jours par défaut)';
COMMENT ON COLUMN temporary_passwords.is_used IS 
  'Marqué true après 1ère utilisation';
COMMENT ON COLUMN temporary_passwords.used_at IS 
  'Date de première utilisation';
COMMENT ON COLUMN temporary_passwords.created_by IS 
  'Régie qui a généré ce mot de passe';

-- =====================================================
-- 2. INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_temp_passwords_expires 
  ON temporary_passwords(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_created_by 
  ON temporary_passwords(created_by);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_is_used 
  ON temporary_passwords(is_used) WHERE is_used = false;

-- =====================================================
-- 3. RLS (Row Level Security)
-- =====================================================

ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Policy Admin JTEC : Voit tout
DROP POLICY IF EXISTS "Admin JTEC can manage temporary passwords" ON temporary_passwords;
CREATE POLICY "Admin JTEC can manage temporary passwords"
ON temporary_passwords
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_jtec'
  )
);

-- Policy Régie : Voit uniquement ses propres créations
DROP POLICY IF EXISTS "Regie can view own temporary passwords" ON temporary_passwords;
CREATE POLICY "Regie can view own temporary passwords"
ON temporary_passwords
FOR SELECT
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'regie'
  )
);

-- Policy Régie : Peut créer pour ses locataires
DROP POLICY IF EXISTS "Regie can create temporary passwords" ON temporary_passwords;
CREATE POLICY "Regie can create temporary passwords"
ON temporary_passwords
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'regie'
  )
);

-- =====================================================
-- 4. FONCTION NETTOYAGE AUTOMATIQUE
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_temporary_passwords()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM temporary_passwords
  WHERE expires_at < now()
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_temporary_passwords IS 
  'Supprime les mots de passe temporaires expirés. Retourne le nombre supprimé.';

-- =====================================================
-- 5. VALIDATION
-- =====================================================

DO $$
BEGIN
  -- Vérifier que la table existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'temporary_passwords'
  ) THEN
    RAISE EXCEPTION 'Table temporary_passwords non créée';
  END IF;

  -- Vérifier que RLS est activé
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'temporary_passwords' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS non activé sur temporary_passwords';
  END IF;

  RAISE NOTICE '✅ Table temporary_passwords créée avec succès';
END $$;
