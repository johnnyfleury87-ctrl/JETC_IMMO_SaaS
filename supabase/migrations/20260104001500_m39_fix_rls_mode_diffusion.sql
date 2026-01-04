-- ============================================================
-- MIGRATION M39: Correction Policy RLS entreprise - Vérifier mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Harmonisation RLS avec mode_diffusion regies_entreprises
-- Objectif: Policy doit vérifier re.mode_diffusion='general' pour marketplace
-- Dépendances: M34 (policies RLS entreprise), M38 (RPC update mode)
-- Rollback: 20260104001500_m39_fix_rls_mode_diffusion_rollback.sql
-- ============================================================

-- CONTEXTE:
-- Policy M34 "Entreprise can view general tickets" ne vérifie PAS re.mode_diffusion.
-- Résultat: TOUTES les entreprises liées voient tickets marketplace (même si restreint).
-- Solution: Ajouter condition AND re.mode_diffusion = 'general' dans policy.

-- Supprimer policy actuelle
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;

-- Recréer policy avec vérification mode_diffusion
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise voit tickets en mode 'general'
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
      AND re.mode_diffusion = 'general'  -- ✅ AJOUT: Vérifier autorisation marketplace
  )
);

-- Commentaire mis à jour
COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Entreprise voit tickets diffusés en mode general UNIQUEMENT si autorisée par la régie.
Vérifie: regies_entreprises.mode_diffusion = general.
Permet marketplace contrôlé par la régie.
Statut en_attente, non verrouillés.';

-- Validation
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname = 'Entreprise can view general tickets';
  
  IF v_count = 1 THEN
    RAISE NOTICE '✅ M39: Policy RLS corrigée avec vérification mode_diffusion';
  ELSE
    RAISE EXCEPTION '❌ M39: Erreur lors de la mise à jour de la policy';
  END IF;
END $$;

-- ============================================================
-- FIN MIGRATION M39
-- ============================================================
