-- ============================================================
-- MIGRATION M31: Ajout colonnes traçabilité validation/diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit workflow tickets régie-entreprise
-- Objectif: Tracer QUI et QUAND a validé/diffusé un ticket
-- ============================================================

-- Ajout colonnes traçabilité
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_valide_par uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plafond_valide_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_par uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Commentaires
COMMENT ON COLUMN tickets.plafond_valide_par IS 'Profile ID de la régie qui a validé le plafond';
COMMENT ON COLUMN tickets.plafond_valide_at IS 'Date/heure validation du plafond';
COMMENT ON COLUMN tickets.diffuse_at IS 'Date/heure diffusion/assignation aux entreprises';
COMMENT ON COLUMN tickets.diffuse_par IS 'Profile ID de la régie qui a diffusé';

-- Index pour reporting
CREATE INDEX IF NOT EXISTS idx_tickets_plafond_valide_par ON tickets(plafond_valide_par);
CREATE INDEX IF NOT EXISTS idx_tickets_diffuse_par ON tickets(diffuse_par);

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets'
      AND column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_at', 'diffuse_par')
  ) THEN
    RAISE NOTICE '✅ M31: Colonnes traçabilité ajoutées avec succès';
  ELSE
    RAISE EXCEPTION '❌ M31: Erreur lors de l''ajout des colonnes';
  END IF;
END $$;
