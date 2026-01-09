-- M57.2 : FIX CRITIQUE RLS FACTURES - OWNERSHIP VIA PROFILES
-- Date: 2026-01-09
-- Description: Correction policies RLS factures (utiliser profiles.entreprise_id/regie_id au lieu de auth.uid() direct)

-- ========================================
-- CONTEXTE DU BUG
-- ========================================
-- M56 comparait : factures.entreprise_id = auth.uid()
-- C'est FAUX car :
--   - auth.uid() = profiles.id (UUID du compte utilisateur)
--   - factures.entreprise_id = entreprises.id (UUID de l'entité entreprise)
-- Ces IDs ne correspondent PAS.
--
-- Correction : comparer via profiles.entreprise_id et profiles.regie_id

-- ========================================
-- PARTIE 1: REFAIRE POLICIES FACTURES
-- ========================================

-- Supprimer anciennes policies incorrectes
DROP POLICY IF EXISTS "Entreprise voit ses factures" ON factures;
DROP POLICY IF EXISTS "Entreprise édite factures brouillon" ON factures;
DROP POLICY IF EXISTS "Entreprise insère ses factures" ON factures;
DROP POLICY IF EXISTS "Régie voit factures envoyées" ON factures;
DROP POLICY IF EXISTS "Régie traite factures" ON factures;

-- Policy 1: Entreprise voit ses factures (via profiles.entreprise_id)
CREATE POLICY "factures_entreprise_select"
  ON factures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- Policy 2: Entreprise édite factures brouillon (via profiles.entreprise_id)
CREATE POLICY "factures_entreprise_update"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (
    statut = 'brouillon'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- Policy 3: Entreprise insère ses factures (via profiles.entreprise_id)
CREATE POLICY "factures_entreprise_insert"
  ON factures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- Policy 4: Régie voit factures envoyées (via profiles.regie_id)
CREATE POLICY "factures_regie_select"
  ON factures
  FOR SELECT
  TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.regie_id = factures.regie_id
    )
  );

-- Policy 5: Régie traite factures (via profiles.regie_id)
CREATE POLICY "factures_regie_update"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.regie_id = factures.regie_id
    )
  );

-- Policy 6: Admin JTEC voit tout
CREATE POLICY "factures_admin_all"
  ON factures
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- ========================================
-- PARTIE 2: POLICIES FACTURE_LIGNES
-- ========================================

ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes policies si elles existent
DROP POLICY IF EXISTS "facture_lignes_select" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_insert" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_update" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_delete" ON facture_lignes;

-- Policy 1: SELECT via ownership facture
CREATE POLICY "facture_lignes_select"
  ON facture_lignes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND (
        -- Entreprise propriétaire
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.entreprise_id = factures.entreprise_id
        )
        OR
        -- Régie concernée (factures envoyées)
        (
          factures.statut IN ('envoyee', 'payee', 'refusee')
          AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.regie_id = factures.regie_id
          )
        )
        OR
        -- Admin
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin_jtec'
        )
      )
    )
  );

-- Policy 2: INSERT via ownership facture (brouillon)
CREATE POLICY "facture_lignes_insert"
  ON facture_lignes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

-- Policy 3: UPDATE via ownership facture (brouillon)
CREATE POLICY "facture_lignes_update"
  ON facture_lignes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

-- Policy 4: DELETE via ownership facture (brouillon)
CREATE POLICY "facture_lignes_delete"
  ON facture_lignes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND factures.statut = 'brouillon'
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.entreprise_id = factures.entreprise_id
      )
    )
  );

-- ========================================
-- PARTIE 3: VÉRIFIER DONNÉES PROFILES
-- ========================================

-- S'assurer que entreprise_id/regie_id sont remplis
-- (normalement fait à la création compte, mais on vérifie)

-- Synchroniser profiles.entreprise_id pour entreprises existantes
UPDATE profiles
SET entreprise_id = profiles.id
WHERE role = 'entreprise'
  AND entreprise_id IS NULL
  AND EXISTS (SELECT 1 FROM entreprises WHERE entreprises.id = profiles.id);

-- Synchroniser profiles.regie_id pour régies existantes (déjà fait en M57.1 mais on répète)
UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie'
  AND regie_id IS NULL
  AND EXISTS (SELECT 1 FROM regies WHERE regies.id = profiles.id);

-- ========================================
-- PARTIE 4: FONCTION DEBUG OWNERSHIP
-- ========================================

CREATE OR REPLACE FUNCTION debug_facture_ownership(p_facture_id UUID)
RETURNS TABLE(
  facture_id UUID,
  facture_entreprise_id UUID,
  facture_regie_id UUID,
  user_id UUID,
  user_role TEXT,
  user_entreprise_id UUID,
  user_regie_id UUID,
  can_read BOOLEAN,
  can_update BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    f.id AS facture_id,
    f.entreprise_id AS facture_entreprise_id,
    f.regie_id AS facture_regie_id,
    auth.uid() AS user_id,
    p.role AS user_role,
    p.entreprise_id AS user_entreprise_id,
    p.regie_id AS user_regie_id,
    (
      -- Entreprise propriétaire
      (p.entreprise_id = f.entreprise_id)
      OR
      -- Régie concernée (factures envoyées)
      (p.regie_id = f.regie_id AND f.statut IN ('envoyee', 'payee', 'refusee'))
      OR
      -- Admin
      (p.role = 'admin_jtec')
    ) AS can_read,
    (
      -- Entreprise propriétaire (brouillon)
      (p.entreprise_id = f.entreprise_id AND f.statut = 'brouillon')
      OR
      -- Régie concernée (envoyées)
      (p.regie_id = f.regie_id AND f.statut IN ('envoyee', 'payee', 'refusee'))
      OR
      -- Admin
      (p.role = 'admin_jtec')
    ) AS can_update
  FROM factures f
  CROSS JOIN profiles p
  WHERE f.id = p_facture_id
    AND p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION debug_facture_ownership TO authenticated;

-- FIN M57.2
