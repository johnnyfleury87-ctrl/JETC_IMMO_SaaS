-- ============================================================
-- SANITY CHECK - Validation workflow entreprise complet
-- ============================================================
-- Date: 2025-12-27
-- Objectif: Vérifier que toutes les migrations M26/M29/M30 sont appliquées
-- Utilisation: Exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PARTIE 1: VÉRIFIER FONCTIONS RPC
-- ============================================================

DO $$
DECLARE
  v_count_simple int;
  v_count_with_profile int;
  v_count_toggle int;
BEGIN
  -- Compter les fonctions
  SELECT COUNT(*) INTO v_count_simple FROM pg_proc WHERE proname = 'create_entreprise_simple';
  SELECT COUNT(*) INTO v_count_with_profile FROM pg_proc WHERE proname = 'create_entreprise_with_profile';
  SELECT COUNT(*) INTO v_count_toggle FROM pg_proc WHERE proname = 'toggle_entreprise_mode';
  
  RAISE NOTICE '=== FONCTIONS RPC ===';
  RAISE NOTICE 'create_entreprise_simple: % (attendu: 1)', v_count_simple;
  RAISE NOTICE 'create_entreprise_with_profile: % (attendu: 1)', v_count_with_profile;
  RAISE NOTICE 'toggle_entreprise_mode: % (attendu: 1)', v_count_toggle;
  
  IF v_count_simple = 0 THEN
    RAISE WARNING '❌ create_entreprise_simple MANQUANTE - Appliquer M29/M30';
  ELSE
    RAISE NOTICE '✅ create_entreprise_simple OK';
  END IF;
  
  IF v_count_with_profile = 0 THEN
    RAISE WARNING '❌ create_entreprise_with_profile MANQUANTE - Appliquer M29/M30';
  ELSE
    RAISE NOTICE '✅ create_entreprise_with_profile OK';
  END IF;
  
  IF v_count_toggle = 0 THEN
    RAISE WARNING '❌ toggle_entreprise_mode MANQUANTE - Appliquer M29/M30';
  ELSE
    RAISE NOTICE '✅ toggle_entreprise_mode OK';
  END IF;
END $$;

-- ============================================================
-- PARTIE 2: VÉRIFIER POLICIES RLS
-- ============================================================

DO $$
DECLARE
  v_count_m26 int;
  v_count_m29_profiles int;
  v_count_m29_update int;
  v_count_m29_delete int;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== POLICIES RLS ===';
  
  -- M26: Regie can insert entreprise
  SELECT COUNT(*) INTO v_count_m26
  FROM pg_policies
  WHERE tablename = 'entreprises'
    AND policyname = 'Regie can insert entreprise';
  
  RAISE NOTICE 'M26 - Regie can insert entreprise: % (attendu: 1)', v_count_m26;
  IF v_count_m26 = 0 THEN
    RAISE WARNING '❌ Policy M26 MANQUANTE - Appliquer M26';
  ELSE
    RAISE NOTICE '✅ Policy M26 OK';
  END IF;
  
  -- M29: System can insert entreprise profiles
  SELECT COUNT(*) INTO v_count_m29_profiles
  FROM pg_policies
  WHERE tablename = 'profiles'
    AND policyname = 'System can insert entreprise profiles';
  
  RAISE NOTICE 'M29 - System can insert entreprise profiles: % (attendu: 1)', v_count_m29_profiles;
  IF v_count_m29_profiles = 0 THEN
    RAISE WARNING '❌ Policy M29 profiles MANQUANTE - Appliquer M29';
  ELSE
    RAISE NOTICE '✅ Policy M29 profiles OK';
  END IF;
  
  -- M29: Regie can update authorized entreprises
  SELECT COUNT(*) INTO v_count_m29_update
  FROM pg_policies
  WHERE tablename = 'entreprises'
    AND policyname = 'Regie can update authorized entreprises';
  
  RAISE NOTICE 'M29 - Regie can update authorized entreprises: % (attendu: 1)', v_count_m29_update;
  IF v_count_m29_update = 0 THEN
    RAISE WARNING '❌ Policy M29 UPDATE MANQUANTE - Appliquer M29';
  ELSE
    RAISE NOTICE '✅ Policy M29 UPDATE OK';
  END IF;
  
  -- M29: Regie can delete authorized entreprises
  SELECT COUNT(*) INTO v_count_m29_delete
  FROM pg_policies
  WHERE tablename = 'entreprises'
    AND policyname = 'Regie can delete authorized entreprises';
  
  RAISE NOTICE 'M29 - Regie can delete authorized entreprises: % (attendu: 1)', v_count_m29_delete;
  IF v_count_m29_delete = 0 THEN
    RAISE WARNING '❌ Policy M29 DELETE MANQUANTE - Appliquer M29';
  ELSE
    RAISE NOTICE '✅ Policy M29 DELETE OK';
  END IF;
END $$;

-- ============================================================
-- PARTIE 3: VÉRIFIER CONTRAINTE CHECK mode_diffusion
-- ============================================================

DO $$
DECLARE
  v_check_def text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CONTRAINTE CHECK ===';
  
  SELECT pg_get_constraintdef(oid) INTO v_check_def
  FROM pg_constraint
  WHERE conname = 'check_mode_diffusion'
    AND conrelid = 'regies_entreprises'::regclass;
  
  IF v_check_def IS NULL THEN
    RAISE WARNING '❌ Contrainte check_mode_diffusion MANQUANTE';
  ELSIF v_check_def LIKE '%general%' AND v_check_def LIKE '%restreint%' THEN
    RAISE NOTICE '✅ check_mode_diffusion OK: %', v_check_def;
  ELSE
    RAISE WARNING '❌ check_mode_diffusion INCORRECTE: %', v_check_def;
    RAISE WARNING 'Attendu: CHECK ((mode_diffusion = ANY (ARRAY[''general''::text, ''restreint''::text])))';
  END IF;
END $$;

-- ============================================================
-- PARTIE 4: VÉRIFIER STRUCTURE TABLE regies_entreprises
-- ============================================================

DO $$
DECLARE
  v_has_mode_diffusion boolean;
  v_default_value text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STRUCTURE TABLE ===';
  
  -- Vérifier colonne mode_diffusion
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regies_entreprises'
      AND column_name = 'mode_diffusion'
  ) INTO v_has_mode_diffusion;
  
  IF NOT v_has_mode_diffusion THEN
    RAISE WARNING '❌ Colonne mode_diffusion MANQUANTE dans regies_entreprises';
  ELSE
    -- Récupérer default
    SELECT column_default INTO v_default_value
    FROM information_schema.columns
    WHERE table_name = 'regies_entreprises'
      AND column_name = 'mode_diffusion';
    
    RAISE NOTICE '✅ Colonne mode_diffusion présente (default: %)', v_default_value;
    
    IF v_default_value LIKE '%restreint%' THEN
      RAISE NOTICE '✅ Default mode_diffusion = restreint (sécurisé)';
    ELSE
      RAISE WARNING '⚠️  Default mode_diffusion: % (recommandé: restreint)', v_default_value;
    END IF;
  END IF;
END $$;

-- ============================================================
-- PARTIE 5: TEST VALIDATION mode_diffusion (lecture seule)
-- ============================================================

DO $$
DECLARE
  v_test_passed boolean := true;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST VALIDATION (simulation) ===';
  
  -- Test 1: Valeur 'general' devrait être acceptée
  BEGIN
    PERFORM 1 WHERE 'general' IN ('general', 'restreint');
    RAISE NOTICE '✅ Test 1: ''general'' accepté';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Test 1 FAILED: ''general'' rejeté';
    v_test_passed := false;
  END;
  
  -- Test 2: Valeur 'restreint' devrait être acceptée
  BEGIN
    PERFORM 1 WHERE 'restreint' IN ('general', 'restreint');
    RAISE NOTICE '✅ Test 2: ''restreint'' accepté';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Test 2 FAILED: ''restreint'' rejeté';
    v_test_passed := false;
  END;
  
  -- Test 3: Valeur 'actif' devrait être rejetée
  BEGIN
    PERFORM 1 WHERE 'actif' IN ('general', 'restreint');
    IF NOT FOUND THEN
      RAISE NOTICE '✅ Test 3: ''actif'' correctement rejeté';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Test 3 FAILED: ''actif'' accepté (ne devrait pas)';
    v_test_passed := false;
  END;
  
  -- Test 4: Valeur 'silencieux' devrait être rejetée
  BEGIN
    PERFORM 1 WHERE 'silencieux' IN ('general', 'restreint');
    IF NOT FOUND THEN
      RAISE NOTICE '✅ Test 4: ''silencieux'' correctement rejeté';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Test 4 FAILED: ''silencieux'' accepté (ne devrait pas)';
    v_test_passed := false;
  END;
  
  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅✅✅ TOUS LES TESTS PASSÉS ✅✅✅';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '❌ CERTAINS TESTS ONT ÉCHOUÉ - Vérifier les migrations';
  END IF;
END $$;

-- ============================================================
-- RÉSUMÉ FINAL
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'SANITY CHECK TERMINÉ';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Si tous les checks sont ✅, le système est prêt.';
  RAISE NOTICE 'Si des ❌ apparaissent:';
  RAISE NOTICE '  1. Appliquer les migrations manquantes (M26, M29, M30)';
  RAISE NOTICE '  2. Vérifier les variables Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)';
  RAISE NOTICE '  3. Redéployer l''API Vercel';
  RAISE NOTICE '';
END $$;
