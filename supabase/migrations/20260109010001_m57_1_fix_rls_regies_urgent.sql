-- M57.1 : FIX CRITIQUE RLS REGIES + DEBUG AUTH
-- Date: 2026-01-09
-- Description: Correction RLS manquante sur table regies + ajout logs debug

-- ========================================
-- PARTIE 1: RLS SUR TABLE REGIES (CRITIQUE)
-- ========================================

-- Activer RLS sur table regies
ALTER TABLE regies ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes policies si elles existent
DROP POLICY IF EXISTS "Régie lit ses propres infos" ON regies;
DROP POLICY IF EXISTS "regies_read_self" ON regies;
DROP POLICY IF EXISTS "Admin JTEC peut lire toutes les régies" ON regies;
DROP POLICY IF EXISTS "Public peut lire régies validées" ON regies;

-- Policy 1: Régie peut lire SA PROPRE ligne (id = auth.uid())
CREATE POLICY "regies_read_self"
  ON regies
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Admin JTEC peut tout lire
CREATE POLICY "regies_admin_read_all"
  ON regies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- Policy 3: Entreprises peuvent lire régies validées (pour affichage dans tickets)
CREATE POLICY "regies_entreprise_read_validated"
  ON regies
  FOR SELECT
  TO authenticated
  USING (
    statut_validation = 'valide'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
    )
  );

-- Policy 4: Régie peut UPDATE sa propre ligne
CREATE POLICY "regies_update_self"
  ON regies
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========================================
-- PARTIE 2: VÉRIFIER COHÉRENCE PROFILES <-> REGIES
-- ========================================

-- Ajouter colonne regie_id dans profiles si manquante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'regie_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN regie_id UUID REFERENCES regies(id);
    COMMENT ON COLUMN profiles.regie_id IS 'ID de la régie si role=regie (doublon intentionnel pour faciliter requêtes)';
  END IF;
END $$;

-- Synchroniser profiles.regie_id avec regies.id pour les régies existantes
UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie'
  AND regie_id IS NULL
  AND EXISTS (SELECT 1 FROM regies WHERE regies.id = profiles.id);

-- ========================================
-- PARTIE 3: FONCTION HELPER DEBUG
-- ========================================

-- Fonction pour débugger les droits d'accès régie
CREATE OR REPLACE FUNCTION debug_regie_access()
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  profile_role TEXT,
  profile_regie_id UUID,
  regie_exists BOOLEAN,
  regie_nom TEXT,
  can_read_self BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    auth.uid() AS user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) AS user_email,
    p.role AS profile_role,
    p.regie_id AS profile_regie_id,
    (r.id IS NOT NULL) AS regie_exists,
    r.nom AS regie_nom,
    (r.id = auth.uid()) AS can_read_self
  FROM profiles p
  LEFT JOIN regies r ON r.id = auth.uid()
  WHERE p.id = auth.uid();
$$;

COMMENT ON FUNCTION debug_regie_access IS 'Debug: Vérifier les droits d''accès régie pour l''utilisateur courant';

-- ========================================
-- PARTIE 4: GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION debug_regie_access TO authenticated;

-- FIN M57.1
