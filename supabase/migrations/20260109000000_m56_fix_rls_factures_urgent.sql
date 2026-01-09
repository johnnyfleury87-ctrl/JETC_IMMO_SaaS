-- M56 : FIX URGENT RLS FACTURES + CONNEXION FRONTEND
-- Date: 2026-01-09
-- Description: Correction RLS policies obsolètes (profiles) + activation vues factures

-- ========================================
-- PARTIE 1: SUPPRESSION ANCIENNES POLICIES OBSOLÈTES
-- ========================================

-- Ces policies utilisent une table 'profiles' qui n'existe pas/plus
DROP POLICY IF EXISTS factures_entreprise_select ON factures;
DROP POLICY IF EXISTS factures_regie_select ON factures;
DROP POLICY IF EXISTS factures_admin_jtec_all ON factures;
DROP POLICY IF EXISTS factures_entreprise_insert ON factures;
DROP POLICY IF EXISTS factures_update ON factures;

-- ========================================
-- PARTIE 2: NOUVELLES POLICIES RLS CORRECTES
-- ========================================

-- RLS activé
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

-- ✅ ENTREPRISE : Voir ses factures
-- auth.uid() = entreprise_id directement
CREATE POLICY "Entreprise voit ses factures"
  ON factures
  FOR SELECT
  TO authenticated
  USING (entreprise_id = auth.uid());

-- ✅ ENTREPRISE : Éditer ses factures (si brouillon)
CREATE POLICY "Entreprise édite factures brouillon"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (entreprise_id = auth.uid() AND statut = 'brouillon');

-- ✅ ENTREPRISE : Créer ses factures (via RPC generate_facture_from_mission)
CREATE POLICY "Entreprise insère ses factures"
  ON factures
  FOR INSERT
  TO authenticated
  WITH CHECK (entreprise_id = auth.uid());

-- ✅ RÉGIE : Voir les factures envoyées sur ses biens
-- auth.uid() = regie_id directement
CREATE POLICY "Régie voit factures envoyées"
  ON factures
  FOR SELECT
  TO authenticated
  USING (
    regie_id = auth.uid()
    AND statut IN ('envoyee', 'payee', 'refusee')
  );

-- ✅ RÉGIE : Traiter les factures (changer statut)
CREATE POLICY "Régie traite factures"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (
    regie_id = auth.uid()
    AND statut IN ('envoyee', 'payee', 'refusee')
  );

-- ========================================
-- PARTIE 3: POLICIES SUR LA VUE missions_factures_complet
-- ========================================

-- La vue hérite des policies de la table factures via JOIN
-- Pas besoin de policies supplémentaires

-- ========================================
-- PARTIE 4: VÉRIFIER EXISTENCE VUE
-- ========================================

-- La vue missions_factures_complet doit exister (créée dans M50)
-- Pas de DROP/RECREATE ici, on la garde telle quelle

-- ========================================
-- PARTIE 5: PERMISSIONS EXPLICITES
-- ========================================

-- S'assurer que authenticated peut accéder aux factures
GRANT SELECT, INSERT, UPDATE ON factures TO authenticated;
GRANT SELECT ON missions_factures_complet TO authenticated;

-- ========================================
-- PARTIE 6: TESTER LES POLICIES
-- ========================================

-- Test Entreprise (remplacer UUID par vraie entreprise)
-- SELECT * FROM factures WHERE entreprise_id = '<UUID_ENTREPRISE>';

-- Test Régie (remplacer UUID par vraie régie)
-- SELECT * FROM factures WHERE regie_id = '<UUID_REGIE>' AND statut IN ('envoyee', 'payee', 'refusee');

-- FIN M56
