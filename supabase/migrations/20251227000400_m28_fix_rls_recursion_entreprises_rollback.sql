-- ============================================================
-- ROLLBACK M28 - Restaurer ancienne policy RLS regies_entreprises
-- ============================================================

-- Supprimer fonction helper
DROP FUNCTION IF EXISTS is_user_entreprise_owner(uuid);

-- Supprimer policy M28
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;

-- Restaurer policy originale (avec récursion)
CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM entreprises
    WHERE entreprises.id = regies_entreprises.entreprise_id
      AND entreprises.profile_id = auth.uid()
  )
);

-- Vérification:
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'regies_entreprises'
--   AND policyname = 'Entreprise can view own authorizations';
-- Attendu: 1 ligne (policy restaurée)

-- ============================================================
-- FIN ROLLBACK M28
-- ============================================================
