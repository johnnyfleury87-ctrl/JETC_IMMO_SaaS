-- =====================================================
-- NETTOYAGE FONCTIONS RPC - creer_locataire_complet
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Supprimer surcharges obsolètes + garder UNE version canonique
-- Problème : ERROR 42725 "function name is not unique"
-- =====================================================

-- =====================================================
-- ÉTAPE 0 : AUDIT DES FONCTIONS EXISTANTES
-- =====================================================
-- Exécuter d'abord pour identifier toutes les versions :
/*
SELECT 
  oid,
  proname,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid) AS result
FROM pg_proc
WHERE proname = 'creer_locataire_complet'
  AND pronamespace = 'public'::regnamespace;
*/

-- =====================================================
-- RÉSULTAT ATTENDU DE L'AUDIT :
-- =====================================================
-- VERSION 1 (OBSOLÈTE) : 10 paramètres
-- creer_locataire_complet(
--   p_nom text,
--   p_prenom text,
--   p_email text,
--   p_profile_id uuid,
--   p_logement_id uuid,        -- Position 5 (PAS de p_regie_id)
--   p_date_entree date,
--   p_telephone text,
--   p_date_naissance date,
--   p_contact_urgence_nom text,
--   p_contact_urgence_telephone text
-- )
--
-- VERSION 2 (ACTUELLE - À GARDER) : 11 paramètres
-- creer_locataire_complet(
--   p_nom text,
--   p_prenom text,
--   p_email text,
--   p_profile_id uuid,
--   p_regie_id uuid,           -- Position 5 (AJOUTÉ)
--   p_logement_id uuid,        -- Position 6 (avec DEFAULT NULL)
--   p_date_entree date,
--   p_telephone text,
--   p_date_naissance date,
--   p_contact_urgence_nom text,
--   p_contact_urgence_telephone text
-- )

-- =====================================================
-- ÉTAPE 1 : SUPPRIMER VERSION OBSOLÈTE (10 paramètres)
-- =====================================================

-- Supprimer la version SANS p_regie_id (signature exacte)
DROP FUNCTION IF EXISTS creer_locataire_complet(
  text,    -- p_nom
  text,    -- p_prenom
  text,    -- p_email
  uuid,    -- p_profile_id
  uuid,    -- p_logement_id (position 5 dans ancienne version)
  date,    -- p_date_entree
  text,    -- p_telephone
  date,    -- p_date_naissance
  text,    -- p_contact_urgence_nom
  text     -- p_contact_urgence_telephone
);

-- =====================================================
-- ÉTAPE 2 : VÉRIFIER QU'IL RESTE UNE SEULE FONCTION
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'creer_locataire_complet'
    AND pronamespace = 'public'::regnamespace;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION '❌ ERREUR : Aucune fonction creer_locataire_complet ne reste. La bonne version a été supprimée par erreur.';
  ELSIF v_count = 1 THEN
    RAISE NOTICE '✅ OK : Une seule fonction creer_locataire_complet existe.';
  ELSE
    RAISE WARNING '⚠️  ATTENTION : % fonctions creer_locataire_complet existent encore. Il faut nettoyer davantage.', v_count;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 3 : AFFICHER SIGNATURE FONCTION RESTANTE
-- =====================================================

SELECT 
  proname AS function_name,
  pg_get_function_arguments(oid) AS signature_complete,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'creer_locataire_complet'
  AND pronamespace = 'public'::regnamespace;

-- =====================================================
-- ÉTAPE 4 : VALIDATION FINALE
-- =====================================================

DO $$
DECLARE
  v_signature TEXT;
BEGIN
  SELECT pg_get_function_arguments(oid) INTO v_signature
  FROM pg_proc
  WHERE proname = 'creer_locataire_complet'
    AND pronamespace = 'public'::regnamespace;
  
  -- Vérifier que p_regie_id est présent
  IF v_signature LIKE '%p_regie_id%' THEN
    RAISE NOTICE '✅ SIGNATURE CORRECTE : p_regie_id présent';
  ELSE
    RAISE EXCEPTION '❌ SIGNATURE INCORRECTE : p_regie_id manquant. La mauvaise fonction a été conservée.';
  END IF;
  
  -- Vérifier que p_logement_id a DEFAULT NULL
  IF v_signature LIKE '%p_logement_id uuid DEFAULT NULL%' THEN
    RAISE NOTICE '✅ PARAMÈTRE OPTIONNEL : p_logement_id DEFAULT NULL';
  ELSE
    RAISE WARNING '⚠️  p_logement_id sans DEFAULT NULL (peut être normal selon version PostgreSQL)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ NETTOYAGE TERMINÉ';
  RAISE NOTICE '';
  RAISE NOTICE 'Signature finale :';
  RAISE NOTICE '%', v_signature;
  RAISE NOTICE '';
  RAISE NOTICE 'Prochaine étape : Tester l''appel RPC';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================

-- Si le DROP échoue avec "function does not exist" :
-- 1. C'est que la signature exacte ne correspond pas
-- 2. Exécuter d'abord l'audit (ÉTAPE 0) pour voir la signature exacte
-- 3. Ajuster le DROP en conséquence

-- Si PLUSIEURS versions obsolètes existent :
-- 1. Identifier toutes les signatures avec l'audit
-- 2. Ajouter autant de DROP FUNCTION que nécessaire
-- 3. Vérifier qu'une seule reste (celle avec p_regie_id)

-- Signature attendue finale (11 paramètres) :
-- p_nom text, p_prenom text, p_email text, p_profile_id uuid,
-- p_regie_id uuid,                           ← Position 5
-- p_logement_id uuid DEFAULT NULL,           ← Position 6
-- p_date_entree date DEFAULT NULL, 
-- p_telephone text DEFAULT NULL, 
-- p_date_naissance date DEFAULT NULL, 
-- p_contact_urgence_nom text DEFAULT NULL, 
-- p_contact_urgence_telephone text DEFAULT NULL
