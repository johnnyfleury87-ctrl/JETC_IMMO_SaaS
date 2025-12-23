-- =====================================================
-- Migration : Garantir un seul locataire actif par logement
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Empêcher 2 locataires actifs sur même logement
-- Méthode : Exclusion constraint avec btree_gist
-- Impact : Erreur si tentative d'affecter 2 locataires actifs au même logement
-- =====================================================

BEGIN;

-- Activer extension btree_gist (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Contrainte d'exclusion
-- WHERE clause : s'applique uniquement aux locataires actifs (date_sortie = NULL)
-- et qui ont un logement (logement_id IS NOT NULL)
ALTER TABLE locataires
  ADD CONSTRAINT unique_active_locataire_per_logement
  EXCLUDE USING gist (
    logement_id WITH =
  ) WHERE (date_sortie IS NULL AND logement_id IS NOT NULL);

COMMENT ON CONSTRAINT unique_active_locataire_per_logement ON locataires IS
  'Un logement ne peut avoir qu''un seul locataire actif (date_sortie = NULL). Garantit cohérence métier au niveau DB.';

COMMIT;

-- Validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_active_locataire_per_logement'
  ) THEN
    RAISE NOTICE '✅ Contrainte unicité locataire actif créée avec succès';
    RAISE NOTICE '   → Impossible d''attribuer 2 locataires actifs au même logement';
    RAISE NOTICE '   → Les anciens locataires (date_sortie renseignée) ne sont pas concernés';
  ELSE
    RAISE EXCEPTION '❌ Échec création contrainte';
  END IF;
END $$;
