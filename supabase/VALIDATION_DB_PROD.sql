-- =====================================================
-- SCRIPT DE VALIDATION DB - Tables requises par backend
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Vérifier que toutes les tables nécessaires existent
-- Usage : Exécuter dans Supabase SQL Editor
-- =====================================================

DO $$
DECLARE
  missing_tables text[] := ARRAY[]::text[];
  missing_count integer := 0;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'VALIDATION DB - Tables Backend JETC IMMO SaaS';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- =====================================================
  -- 1. TABLES CRITIQUES (BLOQUANTES)
  -- =====================================================
  
  RAISE NOTICE '1️⃣ TABLES CRITIQUES (obligatoires)';
  RAISE NOTICE '---------------------------------------------------';
  
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    missing_tables := array_append(missing_tables, 'profiles');
    missing_count := missing_count + 1;
    RAISE WARNING '❌ CRITIQUE : Table profiles MANQUANTE';
  ELSE
    RAISE NOTICE '✅ profiles';
  END IF;

  -- regies
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'regies') THEN
    missing_tables := array_append(missing_tables, 'regies');
    missing_count := missing_count + 1;
    RAISE WARNING '❌ CRITIQUE : Table regies MANQUANTE';
  ELSE
    RAISE NOTICE '✅ regies';
  END IF;

  -- locataires
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locataires') THEN
    missing_tables := array_append(missing_tables, 'locataires');
    missing_count := missing_count + 1;
    RAISE WARNING '❌ CRITIQUE : Table locataires MANQUANTE';
  ELSE
    RAISE NOTICE '✅ locataires';
  END IF;

  -- logements
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logements') THEN
    missing_tables := array_append(missing_tables, 'logements');
    missing_count := missing_count + 1;
    RAISE WARNING '❌ CRITIQUE : Table logements MANQUANTE';
  ELSE
    RAISE NOTICE '✅ logements';
  END IF;

  -- immeubles
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'immeubles') THEN
    missing_tables := array_append(missing_tables, 'immeubles');
    missing_count := missing_count + 1;
    RAISE WARNING '❌ CRITIQUE : Table immeubles MANQUANTE';
  ELSE
    RAISE NOTICE '✅ immeubles';
  END IF;

  RAISE NOTICE '';
  
  -- =====================================================
  -- 2. TABLES OPTIONNELLES (NON BLOQUANTES)
  -- =====================================================
  
  RAISE NOTICE '2️⃣ TABLES OPTIONNELLES (recommandées)';
  RAISE NOTICE '---------------------------------------------------';
  
  -- temporary_passwords
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temporary_passwords') THEN
    RAISE NOTICE '⚠️  temporary_passwords ABSENTE (non bloquant)';
    RAISE NOTICE '   Backend fonctionne sans stockage des mots de passe temporaires';
  ELSE
    RAISE NOTICE '✅ temporary_passwords';
  END IF;

  -- tickets
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    RAISE NOTICE '⚠️  tickets ABSENTE (non bloquant si module tickets non utilisé)';
  ELSE
    RAISE NOTICE '✅ tickets';
  END IF;

  -- messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    RAISE NOTICE '⚠️  messages ABSENTE (non bloquant si messagerie non utilisée)';
  ELSE
    RAISE NOTICE '✅ messages';
  END IF;

  RAISE NOTICE '';
  
  -- =====================================================
  -- 3. VÉRIFICATION COLONNES CRITIQUES
  -- =====================================================
  
  RAISE NOTICE '3️⃣ COLONNES CRITIQUES';
  RAISE NOTICE '---------------------------------------------------';
  
  -- locataires.regie_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locataires') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'locataires' AND column_name = 'regie_id'
    ) THEN
      RAISE WARNING '❌ CRITIQUE : Colonne locataires.regie_id MANQUANTE';
      RAISE WARNING '   Migration 20251223000000_add_regie_id_to_locataires.sql NON appliquée';
      missing_count := missing_count + 1;
    ELSE
      RAISE NOTICE '✅ locataires.regie_id';
    END IF;
  END IF;

  -- profiles.regie_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'regie_id'
    ) THEN
      RAISE NOTICE '⚠️  profiles.regie_id absente (vérifier si nécessaire)';
    ELSE
      RAISE NOTICE '✅ profiles.regie_id';
    END IF;
  END IF;

  RAISE NOTICE '';
  
  -- =====================================================
  -- 4. VÉRIFICATION RPC
  -- =====================================================
  
  RAISE NOTICE '4️⃣ FONCTIONS RPC';
  RAISE NOTICE '---------------------------------------------------';
  
  -- creer_locataire_complet
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'creer_locataire_complet'
  ) THEN
    RAISE WARNING '❌ CRITIQUE : RPC creer_locataire_complet MANQUANTE';
    missing_count := missing_count + 1;
  ELSE
    RAISE NOTICE '✅ creer_locataire_complet()';
    
    -- Vérifier paramètre p_regie_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.parameters
      WHERE specific_name IN (
        SELECT p.oid::regprocedure::text
        FROM pg_proc p
        WHERE p.proname = 'creer_locataire_complet'
      )
      AND parameter_name = 'p_regie_id'
    ) THEN
      RAISE WARNING '⚠️  RPC creer_locataire_complet sans paramètre p_regie_id';
      RAISE WARNING '   Migration 2025-12-21_fix_locataire_sans_logement.sql non appliquée';
    ELSE
      RAISE NOTICE '   ✅ avec paramètre p_regie_id';
    END IF;
  END IF;

  RAISE NOTICE '';
  
  -- =====================================================
  -- 5. RÉSULTAT FINAL
  -- =====================================================
  
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'RÉSULTAT VALIDATION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  IF missing_count = 0 THEN
    RAISE NOTICE '✅ BASE DE DONNÉES VALIDE';
    RAISE NOTICE 'Toutes les tables et colonnes critiques sont présentes';
  ELSE
    RAISE WARNING '❌ BASE DE DONNÉES INCOMPLÈTE';
    RAISE WARNING 'Nombre d''éléments critiques manquants : %', missing_count;
    RAISE WARNING '';
    RAISE WARNING 'ACTIONS REQUISES :';
    RAISE WARNING '1. Vérifier que toutes les migrations ont été appliquées';
    RAISE WARNING '2. Exécuter les migrations manquantes dans l''ordre chronologique';
    RAISE WARNING '3. Re-exécuter ce script de validation';
    
    IF array_length(missing_tables, 1) > 0 THEN
      RAISE WARNING '';
      RAISE WARNING 'Tables manquantes : %', array_to_string(missing_tables, ', ');
    END IF;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📋 CHECKLIST DÉPLOIEMENT :';
  RAISE NOTICE '   [ ] Toutes les migrations appliquées';
  RAISE NOTICE '   [ ] Table temporary_passwords créée (optionnelle)';
  RAISE NOTICE '   [ ] RPC creer_locataire_complet avec p_regie_id';
  RAISE NOTICE '   [ ] Backend Vercel démarre sans erreur';
  RAISE NOTICE '   [ ] API POST /api/locataires/create testée';
  RAISE NOTICE '';
  
END $$;
