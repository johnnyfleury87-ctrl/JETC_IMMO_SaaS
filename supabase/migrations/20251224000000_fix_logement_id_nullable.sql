-- =====================================================
-- CORRECTIF : Rendre locataires.logement_id NULLABLE
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Corriger erreur NOT NULL sur logement_id
-- Cause : Migration 2025-12-20 a forcé NOT NULL (décision métier incorrecte)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DIAGNOSTIC PRÉ-CORRECTIF
-- =====================================================

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'locataires'
    AND column_name = 'logement_id';
  
  IF v_is_nullable = 'NO' THEN
    RAISE NOTICE '⚠️  AVANT: locataires.logement_id est NOT NULL';
  ELSE
    RAISE NOTICE '✅ AVANT: locataires.logement_id est déjà nullable (correctif déjà appliqué?)';
  END IF;
END $$;

-- =====================================================
-- 2. RETIRER CONTRAINTE NOT NULL
-- =====================================================

ALTER TABLE locataires 
ALTER COLUMN logement_id DROP NOT NULL;

-- =====================================================
-- 3. METTRE À JOUR COMMENTAIRE COLONNE
-- =====================================================

COMMENT ON COLUMN locataires.logement_id IS 
  'Logement actuellement occupé (NULLABLE : un locataire peut être créé sans logement puis assigné ultérieurement)';

-- =====================================================
-- 4. VALIDATION POST-CORRECTIF
-- =====================================================

DO $$
DECLARE
  v_is_nullable TEXT;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'locataires'
    AND column_name = 'logement_id';
  
  IF v_is_nullable = 'YES' THEN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ CORRECTIF APPLIQUÉ AVEC SUCCÈS';
    RAISE NOTICE '';
    RAISE NOTICE 'locataires.logement_id est maintenant NULLABLE';
    RAISE NOTICE '';
    RAISE NOTICE 'Actions possibles :';
    RAISE NOTICE '  - Créer locataire SANS logement (NULL accepté)';
    RAISE NOTICE '  - Assigner logement ultérieurement (UPDATE)';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
  ELSE
    RAISE EXCEPTION '❌ ÉCHEC : locataires.logement_id toujours NOT NULL';
  END IF;
END $$;

-- =====================================================
-- 5. TEST INSERTION LOCATAIRE SANS LOGEMENT
-- =====================================================

DO $$
DECLARE
  v_test_id UUID;
BEGIN
  -- Test insertion avec logement_id = NULL
  INSERT INTO locataires (
    nom, prenom, email, profile_id, regie_id,
    logement_id,  -- ✅ NULL
    date_entree
  )
  VALUES (
    'Test', 'Correctif', 'test.correctif@example.com',
    '00000000-0000-0000-0000-000000000000'::uuid,
    (SELECT id FROM regies LIMIT 1),
    NULL,  -- ✅ Test avec NULL
    CURRENT_DATE
  )
  RETURNING id INTO v_test_id;
  
  RAISE NOTICE '✅ TEST INSERT : Locataire créé avec logement_id = NULL';
  RAISE NOTICE '   ID: %', v_test_id;
  
  -- Nettoyer données de test
  DELETE FROM locataires WHERE id = v_test_id;
  RAISE NOTICE '✅ Données test nettoyées';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  TEST INSERT échoué : %', SQLERRM;
    RAISE NOTICE 'Vérifier que table regies contient au moins une ligne';
END $$;

COMMIT;

-- =====================================================
-- 6. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20251224000000_fix_logement_id_nullable',
  'Correctif : DROP NOT NULL sur locataires.logement_id (erreur migration 2025-12-20)'
);
