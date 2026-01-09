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
-- 1. DIAGNOSTIC PRÉ-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  -- Vérifier si la contrainte existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'logements' 
    AND constraint_name = 'check_npa_format'
  ) INTO v_constraint_exists;
  
  IF v_constraint_exists THEN
    RAISE NOTICE '🔍 Contrainte check_npa_format détectée sur logements';
    RAISE NOTICE '   → Cette contrainte bloque les codes postaux français (5 chiffres)';
  ELSE
    RAISE NOTICE 'ℹ️  Contrainte check_npa_format non trouvée';
  END IF;
END $$;

-- =====================================================
-- 2. SUPPRIMER CONTRAINTE STRICTE (4 CHIFFRES UNIQUEMENT)
-- =====================================================

-- Supprimer check_npa_format qui force exactement 4 chiffres
ALTER TABLE logements
DROP CONSTRAINT IF EXISTS check_npa_format;

-- Supprimer aussi check_logements_npa_format si elle existe
ALTER TABLE logements
DROP CONSTRAINT IF EXISTS check_logements_npa_format;

-- Supprimer check_logement_npa_format si elle existe
ALTER TABLE logements
DROP CONSTRAINT IF EXISTS check_logement_npa_format;

RAISE NOTICE '✅ Anciennes contraintes NPA supprimées';

-- =====================================================
-- 3. AJOUTER NOUVELLE CONTRAINTE FLEXIBLE (4 OU 5 CHIFFRES)
-- =====================================================

-- Accepter 4 OU 5 chiffres pour supporter Suisse et France
ALTER TABLE logements
ADD CONSTRAINT check_logement_npa_multi_pays 
CHECK (npa ~ '^[0-9]{4,5}$');

-- Mise à jour commentaire colonne
COMMENT ON COLUMN logements.npa IS 'Code postal / NPA - Suisse (4 chiffres) ou France (5 chiffres)';

RAISE NOTICE '✅ Nouvelle contrainte check_logement_npa_multi_pays ajoutée';
RAISE NOTICE '   → Accepte 4 ou 5 chiffres (regex: ^[0-9]{4,5}$)';

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_logements INTEGER;
  v_logements_npa_valide INTEGER;
  v_logements_npa_4 INTEGER;
  v_logements_npa_5 INTEGER;
BEGIN
  -- Compteurs
  SELECT COUNT(*) INTO v_total_logements FROM logements WHERE npa IS NOT NULL;
  SELECT COUNT(*) INTO v_logements_npa_valide FROM logements WHERE npa ~ '^[0-9]{4,5}$';
  SELECT COUNT(*) INTO v_logements_npa_4 FROM logements WHERE npa ~ '^[0-9]{4}$';
  SELECT COUNT(*) INTO v_logements_npa_5 FROM logements WHERE npa ~ '^[0-9]{5}$';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION M61b - PATCH LOGEMENTS COMPLÈTE';
  RAISE NOTICE '';
  RAISE NOTICE '📊 STATISTIQUES LOGEMENTS';
  RAISE NOTICE '  Total logements avec NPA : %', v_total_logements;
  RAISE NOTICE '  NPA valides (4-5 chiffres) : %', v_logements_npa_valide;
  RAISE NOTICE '  └─ NPA 4 chiffres (Suisse) : %', v_logements_npa_4;
  RAISE NOTICE '  └─ NPA 5 chiffres (France) : %', v_logements_npa_5;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Modifications appliquées :';
  RAISE NOTICE '  - Suppression : check_npa_format (stricte 4 chiffres)';
  RAISE NOTICE '  - Ajout : check_logement_npa_multi_pays (4 ou 5 chiffres)';
  RAISE NOTICE '  - Table : logements';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Compatibilité : 100%% rétrocompatible';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- =====================================================
-- 5. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000002_m61b_patch_logements_npa',
  'Patch M61b : Correction contrainte NPA sur logements - Support multi-pays (4-5 chiffres)'
);
