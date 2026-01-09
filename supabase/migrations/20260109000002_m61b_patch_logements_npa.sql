-- =====================================================
-- MIGRATION M61b : Patch contrainte NPA sur logements
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Corriger la contrainte check_npa_format sur 
--           logements (oubliée dans M61) pour accepter
--           codes postaux français (5 chiffres)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SUPPRIMER TOUTES LES CONTRAINTES NPA EXISTANTES
-- =====================================================

ALTER TABLE logements
  DROP CONSTRAINT IF EXISTS check_npa_format,
  DROP CONSTRAINT IF EXISTS check_logements_npa_format,
  DROP CONSTRAINT IF EXISTS check_logement_npa_format,
  DROP CONSTRAINT IF EXISTS check_logement_npa_multi_pays,
  DROP CONSTRAINT IF EXISTS check_logements_npa_multi_pays;

-- =====================================================
-- 2. AJOUTER CONTRAINTE FLEXIBLE (4 OU 5 CHIFFRES)
-- =====================================================

ALTER TABLE logements
  ADD CONSTRAINT check_logements_npa_multi_pays
  CHECK (npa ~ '^[0-9]{4,5}$');

-- Mise à jour commentaire colonne
COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- =====================================================
-- 3. LOG MIGRATION (AVANT COMMIT)
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000002_m61b_patch_logements_npa',
  'Patch M61b : Correction contrainte NPA sur logements - Support multi-pays (4-5 chiffres)'
);

COMMIT;

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_logements INTEGER;
  v_logements_npa_valide INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_logements FROM logements WHERE npa IS NOT NULL;
  SELECT COUNT(*) INTO v_logements_npa_valide FROM logements WHERE npa ~ '^[0-9]{4,5}$';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ M61b OK: logements.npa accepte 4 ou 5 chiffres';
  RAISE NOTICE '';
  RAISE NOTICE 'Total logements avec NPA : %', v_total_logements;
  RAISE NOTICE 'NPA valides (4-5 chiffres) : %', v_logements_npa_valide;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
