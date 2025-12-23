-- =====================================================
-- DIAGNOSTIC COMPLET BASE DE DONNÉES PRODUCTION
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Identifier EXACTEMENT ce qui manque en prod
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '🔍 DIAGNOSTIC PRODUCTION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- =====================================================
  -- 1. TABLES CRITIQUES
  -- =====================================================
  
  RAISE NOTICE '📊 TABLES :';
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'locataires') THEN
    RAISE NOTICE '   ✅ Table locataires existe';
    
    -- Vérifier colonnes critiques
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locataires' AND column_name = 'regie_id') THEN
      RAISE NOTICE '      ✅ Colonne locataires.regie_id existe';
    ELSE
      RAISE WARNING '      ❌ BLOQUANT : locataires.regie_id MANQUANT';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locataires' AND column_name = 'logement_id') THEN
      RAISE NOTICE '      ✅ Colonne locataires.logement_id existe';
    ELSE
      RAISE WARNING '      ⚠️  locataires.logement_id manquant';
    END IF;
  ELSE
    RAISE WARNING '   ❌ CRITIQUE : Table locataires MANQUANTE';
  END IF;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- 2. FONCTIONS RPC CRITIQUES
  -- =====================================================
  
  RAISE NOTICE '⚙️  FONCTIONS RPC :';
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_locataire_complet') THEN
    RAISE NOTICE '   ✅ Fonction creer_locataire_complet existe';
    
    -- Vérifier signature
    DECLARE
      v_signature text;
    BEGIN
      SELECT pg_get_function_identity_arguments(p.oid) INTO v_signature
      FROM pg_proc p
      WHERE p.proname = 'creer_locataire_complet'
      LIMIT 1;
      
      RAISE NOTICE '      Signature : %', v_signature;
      
      -- Vérifier présence paramètre p_regie_id
      IF v_signature LIKE '%p_regie_id%' THEN
        RAISE NOTICE '      ✅ Paramètre p_regie_id présent';
      ELSE
        RAISE WARNING '      ❌ BLOQUANT : paramètre p_regie_id MANQUANT';
        RAISE NOTICE '      → Fonction probablement version ancienne';
        RAISE NOTICE '      → Migration 2025-12-21_fix_locataire_sans_logement.sql NON DEPLOYEE';
      END IF;
    END;
  ELSE
    RAISE WARNING '   ❌ CRITIQUE : Fonction creer_locataire_complet MANQUANTE';
    RAISE NOTICE '      → Migration 2025-12-20_rpc_creer_locataire.sql NON DEPLOYEE';
  END IF;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- 3. POLICIES RLS
  -- =====================================================
  
  RAISE NOTICE '🔒 POLICIES RLS :';
  
  DECLARE
    v_immeubles_count int;
    v_logements_count int;
    v_locataires_count int;
    v_locataire_self_count int;
  BEGIN
    SELECT COUNT(*) INTO v_immeubles_count FROM pg_policies WHERE tablename = 'immeubles';
    SELECT COUNT(*) INTO v_logements_count FROM pg_policies WHERE tablename = 'logements';
    SELECT COUNT(*) INTO v_locataires_count FROM pg_policies WHERE tablename = 'locataires';
    
    -- Compter policies locataire frontend (ne devraient PAS exister en Phase 1)
    SELECT COUNT(*) INTO v_locataire_self_count 
    FROM pg_policies 
    WHERE tablename IN ('immeubles', 'logements', 'locataires')
      AND (policyname LIKE '%Locataire can%' OR policyname LIKE '%locataire_self%');
    
    RAISE NOTICE '   immeubles : % policies', v_immeubles_count;
    RAISE NOTICE '   logements : % policies', v_logements_count;
    RAISE NOTICE '   locataires : % policies', v_locataires_count;
    RAISE NOTICE '';
    
    IF v_locataire_self_count > 0 THEN
      RAISE WARNING '   ⚠️  % policies locataire frontend actives (ne devraient pas exister Phase 1)', v_locataire_self_count;
      RAISE NOTICE '      → RESET_RLS_REGIE_ONLY.sql NON EXECUTE';
    ELSE
      RAISE NOTICE '   ✅ Pas de policies locataire frontend (Phase 1 OK)';
    END IF;
    
    IF v_immeubles_count = 3 AND v_logements_count = 3 AND v_locataires_count = 5 THEN
      RAISE NOTICE '   ✅ Nombre policies correct (3+3+5=11)';
    ELSE
      RAISE WARNING '   ⚠️  Nombre policies incorrect (attendu 3+3+5, reçu %+%+%)', v_immeubles_count, v_logements_count, v_locataires_count;
      RAISE NOTICE '      → RESET_RLS_REGIE_ONLY.sql NON EXECUTE ou incomplet';
    END IF;
  END;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- 4. TRIGGERS CRITIQUES
  -- =====================================================
  
  RAISE NOTICE '⚡ TRIGGERS :';
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_ticket_without_logement') THEN
    RAISE NOTICE '   ✅ Trigger prevent_ticket_without_logement existe';
  ELSE
    RAISE NOTICE '   ℹ️  Trigger prevent_ticket_without_logement absent (optionnel)';
  END IF;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- 5. CONTRAINTES CRITIQUES
  -- =====================================================
  
  RAISE NOTICE '🔗 CONTRAINTES :';
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'locataires' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%regie%'
  ) THEN
    RAISE NOTICE '   ✅ FK locataires.regie_id existe';
  ELSE
    RAISE NOTICE '   ℹ️  FK locataires.regie_id absente (optionnel, peut fonctionner sans)';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'locataires' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%unique_active_locataire%'
  ) THEN
    RAISE NOTICE '   ✅ Contrainte unique_active_locataire_per_logement existe';
  ELSE
    RAISE NOTICE '   ℹ️  Contrainte unique_active_locataire_per_logement absente (optionnel)';
  END IF;
  
  RAISE NOTICE '';
  
  -- =====================================================
  -- VERDICT FINAL
  -- =====================================================
  
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '🎯 VERDICT :';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  DECLARE
    v_has_locataires bool;
    v_has_regie_id bool;
    v_has_rpc bool;
    v_has_rpc_regie_param bool;
    v_policies_ok bool;
  BEGIN
    -- Tests critiques
    v_has_locataires := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'locataires');
    v_has_regie_id := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locataires' AND column_name = 'regie_id');
    v_has_rpc := EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_locataire_complet');
    
    IF v_has_rpc THEN
      SELECT pg_get_function_identity_arguments(p.oid) LIKE '%p_regie_id%' INTO v_has_rpc_regie_param
      FROM pg_proc p
      WHERE p.proname = 'creer_locataire_complet'
      LIMIT 1;
    ELSE
      v_has_rpc_regie_param := FALSE;
    END IF;
    
    SELECT (
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'immeubles') = 3 AND
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'logements') = 3 AND
      (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'locataires') = 5
    ) INTO v_policies_ok;
    
    IF v_has_locataires AND v_has_regie_id AND v_has_rpc AND v_has_rpc_regie_param AND v_policies_ok THEN
      RAISE NOTICE '✅✅✅ BASE CONFORME PHASE 1 - CRÉATION LOCATAIRE POSSIBLE';
      RAISE NOTICE '';
      RAISE NOTICE 'Actions possibles :';
      RAISE NOTICE '  1. Se connecter comme régie';
      RAISE NOTICE '  2. Aller sur /regie/locataires';
      RAISE NOTICE '  3. Créer locataire SANS logement';
    ELSE
      RAISE WARNING '❌❌❌ BASE NON CONFORME - MIGRATIONS MANQUANTES';
      RAISE NOTICE '';
      RAISE NOTICE 'ACTIONS REQUISES :';
      
      IF NOT v_has_locataires OR NOT v_has_regie_id THEN
        RAISE NOTICE '  1. Déployer migration : 20251223000000_add_regie_id_to_locataires.sql';
      END IF;
      
      IF NOT v_has_rpc THEN
        RAISE NOTICE '  2. Déployer migration : 2025-12-20_rpc_creer_locataire.sql';
      END IF;
      
      IF v_has_rpc AND NOT v_has_rpc_regie_param THEN
        RAISE NOTICE '  3. Déployer migration : 2025-12-21_fix_locataire_sans_logement.sql';
      END IF;
      
      IF NOT v_policies_ok THEN
        RAISE NOTICE '  4. Exécuter script : RESET_RLS_REGIE_ONLY.sql';
      END IF;
      
      RAISE NOTICE '';
      RAISE NOTICE 'Ordre recommandé :';
      RAISE NOTICE '  1. Migrations SQL → 2. RESET_RLS → 3. Test frontend';
    END IF;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
