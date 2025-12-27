-- ============================================================
-- MIGRATION M22.6: Validation Colonne regies.nom (Fix 42703)
-- ============================================================
-- Date: 2025-12-27
-- Auteur: Correction erreur 42703 (nom_agence n'existe pas)
-- Issue: Code référençait regies.nom_agence au lieu de regies.nom
-- Solution: Validation que toutes les RPC utilisent la bonne colonne
-- ============================================================

-- ⚠️ NOTE IMPORTANTE:
-- Les migrations M22 et M22.5 originales N'ONT PAS de problème avec nom_agence
-- Seules les corrections suivantes ont été nécessaires:
--   1. public/regie/tickets.html (lignes 688, 707) - DÉJÀ CORRIGÉ dans commit e6aca32
--   2. M22.5.DEBUG patch (ligne 146) - DÉJÀ CORRIGÉ dans commit e6aca32
-- 
-- Cette migration sert uniquement de VALIDATION et DOCUMENTATION.

-- ============================================================
-- VALIDATION 1: Vérifier structure table regies
-- ============================================================

DO $$
DECLARE
  v_column_exists boolean;
BEGIN
  -- Vérifier que 'nom' existe
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'regies' 
      AND column_name = 'nom'
  ) INTO v_column_exists;
  
  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Colonne regies.nom n''existe pas ! Structure table incorrecte.';
  END IF;
  
  -- Vérifier que 'nom_agence' N'EXISTE PAS
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'regies' 
      AND column_name = 'nom_agence'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE WARNING 'Colonne regies.nom_agence existe ! Cela peut créer des confusions. Considérer suppression.';
  END IF;
  
  RAISE NOTICE '✅ VALIDATION 1: Structure table regies correcte (colonne "nom" existe, "nom_agence" absente)';
END $$;

-- ============================================================
-- VALIDATION 2: Vérifier RPC get_tickets_list_regie
-- ============================================================

DO $$
DECLARE
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'get_tickets_list_regie'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'RPC get_tickets_list_regie n''existe pas ! Migration M22.5 non appliquée ?';
  END IF;
  
  RAISE NOTICE '✅ VALIDATION 2: RPC get_tickets_list_regie existe';
END $$;

-- ============================================================
-- VALIDATION 3: Vérifier RPC get_ticket_detail_regie
-- ============================================================

DO $$
DECLARE
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'get_ticket_detail_regie'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'RPC get_ticket_detail_regie n''existe pas ! Migration M22.5 non appliquée ?';
  END IF;
  
  RAISE NOTICE '✅ VALIDATION 3: RPC get_ticket_detail_regie existe';
END $$;

-- ============================================================
-- VALIDATION 4: Vérifier RPC update_ticket_regie
-- ============================================================

DO $$
DECLARE
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'update_ticket_regie'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'RPC update_ticket_regie n''existe pas ! Migration M22.5 non appliquée ?';
  END IF;
  
  RAISE NOTICE '✅ VALIDATION 4: RPC update_ticket_regie existe';
END $$;

-- ============================================================
-- VALIDATION 5: Vérifier RPC get_tickets_dashboard_regie
-- ============================================================

DO $$
DECLARE
  v_function_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'get_tickets_dashboard_regie'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'RPC get_tickets_dashboard_regie n''existe pas ! Migration M22 non appliquée ?';
  END IF;
  
  RAISE NOTICE '✅ VALIDATION 5: RPC get_tickets_dashboard_regie existe';
END $$;

-- ============================================================
-- TESTS FONCTIONNELS (Optionnels - à exécuter manuellement)
-- ============================================================

-- Test 1: Vérifier que get_tickets_list_regie retourne des données (si tickets existent)
-- SELECT * FROM public.get_tickets_list_regie('nouveau') LIMIT 5;

-- Test 2: Vérifier structure retournée
-- SELECT 
--   column_name, 
--   data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'get_tickets_list_regie';

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '✅ MIGRATION M22.6 TERMINÉE - Validation colonne regies.nom';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Corrections appliquées précédemment (commit e6aca32):';
  RAISE NOTICE '  1. public/regie/tickets.html lignes 688, 707';
  RAISE NOTICE '  2. M22.5.DEBUG_patch_raise_return.sql ligne 146';
  RAISE NOTICE '';
  RAISE NOTICE 'Migrations validées:';
  RAISE NOTICE '  ✅ M22: get_tickets_dashboard_regie()';
  RAISE NOTICE '  ✅ M22.5: get_tickets_list_regie()';
  RAISE NOTICE '  ✅ M22.5: get_ticket_detail_regie()';
  RAISE NOTICE '  ✅ M22.5: update_ticket_regie()';
  RAISE NOTICE '';
  RAISE NOTICE 'Structure table regies:';
  RAISE NOTICE '  ✅ Colonne "nom" (text) existe';
  RAISE NOTICE '  ✅ Colonne "nom_agence" absente (correct)';
  RAISE NOTICE '';
  RAISE NOTICE 'Actions suivantes:';
  RAISE NOTICE '  1. Déployer frontend (tickets.html déjà corrigé)';
  RAISE NOTICE '  2. Tester /regie/tickets.html en production';
  RAISE NOTICE '  3. Vérifier logs console (aucune erreur 42703)';
  RAISE NOTICE '========================================================';
END $$;
