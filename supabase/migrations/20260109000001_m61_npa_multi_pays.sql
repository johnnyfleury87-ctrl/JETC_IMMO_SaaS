-- =====================================================
-- MIGRATION M61 : Support multi-pays (Suisse + France)
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Permettre codes postaux français (5 chiffres) 
--           tout en conservant le support suisse (4 chiffres)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SUPPRIMER CONTRAINTE STRICTE NPA 4 CHIFFRES
-- =====================================================

-- Supprimer l'ancienne contrainte qui force 4 chiffres uniquement
ALTER TABLE immeubles
DROP CONSTRAINT IF EXISTS check_npa_format;

COMMENT ON COLUMN immeubles.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- =====================================================
-- 2. AJOUTER NOUVELLE CONTRAINTE FLEXIBLE
-- =====================================================

-- Accepter 4 OU 5 chiffres pour supporter Suisse et France
ALTER TABLE immeubles
ADD CONSTRAINT check_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

-- =====================================================
-- 3. MÊME MODIFICATION POUR TABLE LOGEMENTS
-- =====================================================

-- Vérifier si une contrainte existe sur logements.npa
ALTER TABLE logements
DROP CONSTRAINT IF EXISTS check_logement_npa_format;

COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

-- Ajouter contrainte flexible pour logements
ALTER TABLE logements
ADD CONSTRAINT check_logement_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_immeubles INTEGER;
  v_immeubles_npa_ok INTEGER;
  v_total_logements INTEGER;
  v_logements_npa_ok INTEGER;
BEGIN
  -- Compteurs immeubles
  SELECT COUNT(*) INTO v_total_immeubles FROM immeubles;
  SELECT COUNT(*) INTO v_immeubles_npa_ok FROM immeubles WHERE npa ~ '^[0-9]{4,5}$';
  
  -- Compteurs logements
  SELECT COUNT(*) INTO v_total_logements FROM logements WHERE npa IS NOT NULL;
  SELECT COUNT(*) INTO v_logements_npa_ok FROM logements WHERE npa ~ '^[0-9]{4,5}$';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION M61 - SUPPORT MULTI-PAYS COMPLÈTE';
  RAISE NOTICE '';
  RAISE NOTICE '📊 IMMEUBLES';
  RAISE NOTICE '  Total : %', v_total_immeubles;
  RAISE NOTICE '  NPA valide (4-5 chiffres) : %', v_immeubles_npa_ok;
  RAISE NOTICE '';
  RAISE NOTICE '📊 LOGEMENTS';
  RAISE NOTICE '  Total avec NPA : %', v_total_logements;
  RAISE NOTICE '  NPA valide (4-5 chiffres) : %', v_logements_npa_ok;
  RAISE NOTICE '';
  RAISE NOTICE '🌍 Modifications :';
  RAISE NOTICE '  - Contrainte NPA : 4 chiffres (Suisse) OU 5 chiffres (France)';
  RAISE NOTICE '  - Tables affectées : immeubles, logements';
  RAISE NOTICE '  - Compatibilité : 100%% rétrocompatible avec données existantes';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- =====================================================
-- 5. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000001_m61_npa_multi_pays',
  'Support multi-pays : codes postaux Suisse (4 chiffres) et France (5 chiffres) - Tables immeubles et logements'
);
