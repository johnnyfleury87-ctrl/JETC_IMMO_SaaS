/**
 * MIGRATION - Table temporary_passwords
 * 
 * Date : 20 décembre 2025
 * Objectif : Stocker les mots de passe temporaires générés pour les locataires
 * 
 * RÈGLES MÉTIER :
 * - Un mot de passe temporaire est généré automatiquement à la création du locataire
 * - Le mot de passe est hashé (bcrypt) avant stockage
 * - Expiration automatique après 7 jours (configurable)
 * - Un seul mot de passe temporaire actif par locataire
 * - Invalidation à chaque régénération
 * 
 * FLUX :
 * 1. Régie crée locataire → Backend génère mot de passe → Stocké hashé
 * 2. Locataire utilise "Mot de passe oublié" → Nouveau mot de passe généré → Ancien invalidé
 * 3. Locataire change son mot de passe → Mot de passe temporaire supprimé
 * 
 * SÉCURITÉ :
 * - Mot de passe JAMAIS stocké en clair
 * - Hash bcrypt avec salt
 * - Expiration obligatoire
 * - RLS : Admin JTEC + Régie propriétaire uniquement
 */

-- =====================================================
-- 1. CRÉATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS temporary_passwords (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_by uuid REFERENCES profiles(id), -- Régie qui a créé/régénéré
  
  -- Métadonnées
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE temporary_passwords IS 'Mots de passe temporaires pour locataires (hashés bcrypt)';
COMMENT ON COLUMN temporary_passwords.profile_id IS 'Profile du locataire (clé primaire)';
COMMENT ON COLUMN temporary_passwords.password_hash IS 'Hash bcrypt du mot de passe temporaire';
COMMENT ON COLUMN temporary_passwords.created_at IS 'Date de génération';
COMMENT ON COLUMN temporary_passwords.expires_at IS 'Date d''expiration (7 jours par défaut)';
COMMENT ON COLUMN temporary_passwords.is_used IS 'Marqué true après 1ère utilisation';
COMMENT ON COLUMN temporary_passwords.used_at IS 'Date de première utilisation';
COMMENT ON COLUMN temporary_passwords.created_by IS 'Régie qui a généré ce mot de passe';

-- =====================================================
-- 2. INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_temp_passwords_expires ON temporary_passwords(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_created_by ON temporary_passwords(created_by);

-- =====================================================
-- 3. FONCTION NETTOYAGE AUTOMATIQUE
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_temporary_passwords()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM temporary_passwords
  WHERE expires_at < now();
  
  RAISE NOTICE 'Mots de passe temporaires expirés supprimés';
END;
$$;

COMMENT ON FUNCTION cleanup_expired_temporary_passwords IS 
  'Supprime les mots de passe temporaires expirés (à exécuter via cron)';

-- =====================================================
-- 4. RLS
-- =====================================================

ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Policy Admin JTEC : Voit tout
CREATE POLICY "Admin JTEC can view all temporary passwords"
ON temporary_passwords FOR SELECT
USING (public.is_admin_jtec());

-- Policy Régie : Voit uniquement ses locataires
CREATE POLICY "Regie can view own locataires temporary passwords"
ON temporary_passwords FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN locataires l ON l.profile_id = p.id
    JOIN logements lg ON lg.id = l.logement_id
    JOIN immeubles i ON i.id = lg.immeuble_id
    WHERE p.id = temporary_passwords.profile_id
      AND i.regie_id = get_user_regie_id()
  )
);

-- Policy Régie : Peut créer/modifier pour ses locataires
CREATE POLICY "Regie can manage own locataires temporary passwords"
ON temporary_passwords FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN locataires l ON l.profile_id = p.id
    JOIN logements lg ON lg.id = l.logement_id
    JOIN immeubles i ON i.id = lg.immeuble_id
    WHERE p.id = temporary_passwords.profile_id
      AND i.regie_id = get_user_regie_id()
  )
);

-- =====================================================
-- 5. TRIGGER UPDATED_AT
-- =====================================================

CREATE TRIGGER set_updated_at_temporary_passwords
  BEFORE UPDATE ON temporary_passwords
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =====================================================
-- 6. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '2025-12-20_temporary_passwords',
  'Création table temporary_passwords pour stocker mots de passe temporaires locataires (hashés bcrypt)'
);
