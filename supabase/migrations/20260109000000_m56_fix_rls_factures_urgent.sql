-- M56 : FIX URGENT RLS FACTURES + CONNEXION FRONTEND
-- Date: 2026-01-09
-- Description: Correction RLS policies obsolètes (profiles) + activation vues factures

-- ========================================
-- PARTIE 1: SYNCHRONISATION PROFILES (CRITIQUE)
-- ========================================

-- CONTEXT: profiles.entreprise_id et profiles.regie_id doivent être remplis
-- pour que les policies RLS fonctionnent.
-- Si ces colonnes sont NULL, les policies bloqueront TOUT.

-- Synchroniser entreprises
UPDATE profiles
SET entreprise_id = profiles.id
WHERE role = 'entreprise' 
  AND entreprise_id IS NULL;

-- Synchroniser régies  
UPDATE profiles
SET regie_id = profiles.id
WHERE role = 'regie'
  AND regie_id IS NULL;

-- ========================================
-- PARTIE 2: SUPPRESSION ANCIENNES POLICIES OBSOLÈTES
-- ========================================

-- Supprimer TOUTES les policies (anciennes ET nouvelles pour permettre réexécution)
DROP POLICY IF EXISTS factures_entreprise_select ON factures;
DROP POLICY IF EXISTS factures_regie_select ON factures;
DROP POLICY IF EXISTS factures_admin_jtec_all ON factures;
DROP POLICY IF EXISTS factures_entreprise_insert ON factures;
DROP POLICY IF EXISTS factures_update ON factures;
DROP POLICY IF EXISTS "Entreprise voit ses factures" ON factures;
DROP POLICY IF EXISTS "Entreprise édite factures brouillon" ON factures;
DROP POLICY IF EXISTS "Entreprise insère ses factures" ON factures;
DROP POLICY IF EXISTS "Régie voit factures envoyées" ON factures;
DROP POLICY IF EXISTS "Régie traite factures" ON factures;

-- ========================================
-- PARTIE 3: NOUVELLES POLICIES RLS CORRECTES
-- ========================================

-- RLS activé
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

-- ✅ ENTREPRISE : Voir ses factures
-- Utilise profiles.entreprise_id (pas auth.uid() direct)
CREATE POLICY "Entreprise voit ses factures"
  ON factures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'entreprise'
        AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- ✅ ENTREPRISE : Éditer ses factures (si brouillon)
CREATE POLICY "Entreprise édite factures brouillon"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (
    statut = 'brouillon'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'entreprise'
        AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- ✅ ENTREPRISE : Créer ses factures (via RPC generate_facture_from_mission)
CREATE POLICY "Entreprise insère ses factures"
  ON factures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'entreprise'
        AND profiles.entreprise_id = factures.entreprise_id
    )
  );

-- ✅ RÉGIE : Voir les factures envoyées sur ses biens
-- Utilise profiles.regie_id (pas auth.uid() direct)
CREATE POLICY "Régie voit factures envoyées"
  ON factures
  FOR SELECT
  TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'regie'
        AND profiles.regie_id = factures.regie_id
    )
  );

-- ✅ RÉGIE : Traiter les factures (changer statut)
CREATE POLICY "Régie traite factures"
  ON factures
  FOR UPDATE
  TO authenticated
  USING (
    statut IN ('envoyee', 'payee', 'refusee')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'regie'
        AND profiles.regie_id = factures.regie_id
    )
  );

-- ========================================
-- PARTIE 4: POLICIES SUR LA VUE missions_factures_complet
-- ========================================

-- La vue hérite des policies de la table factures via JOIN
-- Pas besoin de policies supplémentaires

-- ========================================
-- PARTIE 5: VÉRIFIER EXISTENCE VUE
-- ========================================

-- La vue missions_factures_complet doit exister (créée dans M50)
-- Pas de DROP/RECREATE ici, on la garde telle quelle

-- ========================================
-- PARTIE 6: PERMISSIONS EXPLICITES
-- ========================================

-- S'assurer que authenticated peut accéder aux factures
GRANT SELECT, INSERT, UPDATE ON factures TO authenticated;
GRANT SELECT ON missions_factures_complet TO authenticated;

-- ========================================
-- PARTIE 7: TESTER LES POLICIES
-- ========================================

-- Test Entreprise (remplacer UUID par vraie entreprise)
-- SELECT * FROM factures WHERE entreprise_id = '<UUID_ENTREPRISE>';

-- Test Régie (remplacer UUID par vraie régie)
-- SELECT * FROM factures WHERE regie_id = '<UUID_REGIE>' AND statut IN ('envoyee', 'payee', 'refusee');

-- FIN M56
