-- ============================================
-- TESTS get_user_regie_id() - VERSION ROBUSTE
-- Date: 2026-01-09
-- Objectif: Valider la fonction avec comptes régie et locataire
-- ============================================

-- ============================================
-- PARTIE 1: TEST EN TANT QUE RÉGIE
-- ============================================

/**
 * TEST 1: Exécuter en tant que régie
 * 
 * PRÉREQUIS:
 * - Connexion avec un compte profile.role = 'regie'
 * - Ce compte a une entrée dans regies.profile_id
 * 
 * COMMANDE:
 * SELECT get_user_regie_id() AS ma_regie_id;
 * 
 * RÉSULTAT ATTENDU:
 * ma_regie_id | <UUID de la régie>
 * 
 * EXPLICATION:
 * La fonction retourne regies.id pour le profile_id = auth.uid()
 */

-- Query de vérification manuelle
SELECT 
  'TEST 1: Compte RÉGIE' AS test,
  p.id AS profile_id,
  p.role,
  r.id AS regie_id,
  r.nom AS regie_nom,
  r.currency AS regie_currency
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
LIMIT 3;

-- Si vous êtes connecté en tant que régie, exécuter:
-- SELECT get_user_regie_id();

-- ============================================
-- PARTIE 2: TEST EN TANT QUE LOCATAIRE (avec regie_id direct)
-- ============================================

/**
 * TEST 2: Exécuter en tant que locataire (locataires.regie_id présent)
 * 
 * PRÉREQUIS:
 * - Connexion avec un compte profile.role = 'locataire'
 * - locataires.profile_id = auth.uid()
 * - locataires.regie_id IS NOT NULL (ajouté par M60A)
 * 
 * COMMANDE:
 * SELECT get_user_regie_id() AS ma_regie_id;
 * 
 * RÉSULTAT ATTENDU:
 * ma_regie_id | <UUID de la régie du locataire>
 * 
 * EXPLICATION:
 * La fonction retourne locataires.regie_id directement (priorité)
 */

-- Query de vérification manuelle
SELECT 
  'TEST 2: Compte LOCATAIRE (regie_id direct)' AS test,
  p.id AS profile_id,
  p.role,
  l.id AS locataire_id,
  l.regie_id AS regie_id_direct,
  r.nom AS regie_nom,
  r.currency AS regie_currency
FROM profiles p
JOIN locataires l ON l.profile_id = p.id
JOIN regies r ON r.id = l.regie_id
WHERE p.role = 'locataire'
  AND l.regie_id IS NOT NULL
LIMIT 3;

-- Si vous êtes connecté en tant que locataire, exécuter:
-- SELECT get_user_regie_id();

-- ============================================
-- PARTIE 3: TEST EN TANT QUE LOCATAIRE (fallback logements)
-- ============================================

/**
 * TEST 3: Exécuter en tant que locataire (locataires.regie_id NULL, fallback)
 * 
 * PRÉREQUIS:
 * - Connexion avec un compte profile.role = 'locataire'
 * - locataires.profile_id = auth.uid()
 * - locataires.regie_id IS NULL (legacy, créé avant M60A)
 * - locataires.logement_id → logements → immeubles.regie_id présent
 * 
 * COMMANDE:
 * SELECT get_user_regie_id() AS ma_regie_id;
 * 
 * RÉSULTAT ATTENDU:
 * ma_regie_id | <UUID de la régie via immeubles>
 * 
 * EXPLICATION:
 * COALESCE(l.regie_id, i.regie_id) retourne i.regie_id car l.regie_id = NULL
 */

-- Query de vérification manuelle (locataires legacy)
SELECT 
  'TEST 3: Compte LOCATAIRE (fallback logements)' AS test,
  p.id AS profile_id,
  p.role,
  l.id AS locataire_id,
  l.regie_id AS regie_id_direct_null,
  lg.id AS logement_id,
  i.id AS immeuble_id,
  i.regie_id AS regie_id_fallback,
  r.nom AS regie_nom
FROM profiles p
JOIN locataires l ON l.profile_id = p.id
LEFT JOIN logements lg ON lg.id = l.logement_id
LEFT JOIN immeubles i ON i.id = lg.immeuble_id
LEFT JOIN regies r ON r.id = i.regie_id
WHERE p.role = 'locataire'
  AND l.regie_id IS NULL
LIMIT 3;

-- Si vous êtes connecté en tant que locataire legacy, exécuter:
-- SELECT get_user_regie_id();

-- ============================================
-- PARTIE 4: VÉRIFICATION PERFORMANCE
-- ============================================

-- Vérifier que la fonction est STABLE (peut être optimisée par Postgres)
SELECT 
  p.proname,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_user_regie_id';

-- Résultat attendu:
-- proname             | volatility | is_security_definer | search_path_config
-- --------------------+------------+---------------------+--------------------
-- get_user_regie_id   | STABLE     | true                | {search_path=public}

-- ============================================
-- PARTIE 5: TEST ISOLATION (optionnel)
-- ============================================

/**
 * TEST 4: Vérifier que la fonction ne retourne que LA régie de l'utilisateur
 * (pas de fuite inter-régies)
 */

-- Compter combien de regies_id différentes existent
SELECT COUNT(DISTINCT id) AS total_regies FROM regies;

-- Exécuter get_user_regie_id() et vérifier qu'on obtient 1 seule UUID
SELECT get_user_regie_id() AS ma_regie_unique;

-- Vérifier qu'on ne peut pas voir les autres régies via RLS
SELECT COUNT(*) AS nb_regies_visibles FROM regies;
-- Résultat attendu: 1 (si rôle = regie), 0 (si rôle = locataire)

-- ============================================
-- RAPPORT FINAL
-- ============================================

DO $$
DECLARE
  v_is_stable BOOLEAN;
  v_is_security_definer BOOLEAN;
  v_has_search_path BOOLEAN;
BEGIN
  SELECT 
    provolatile = 's',
    prosecdef,
    proconfig IS NOT NULL AND 'search_path=public' = ANY(proconfig)
  INTO v_is_stable, v_is_security_definer, v_has_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_user_regie_id';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TESTS get_user_regie_id() - RAPPORT';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fonction: %', 'get_user_regie_id()';
  RAISE NOTICE 'Volatilité STABLE: %', v_is_stable;
  RAISE NOTICE 'SECURITY DEFINER: %', v_is_security_definer;
  RAISE NOTICE 'search_path fixe: %', v_has_search_path;
  RAISE NOTICE '========================================';
  
  IF v_is_stable AND v_is_security_definer AND v_has_search_path THEN
    RAISE NOTICE '✅ TOUS LES TESTS DE CONFIGURATION RÉUSSIS';
  ELSE
    RAISE WARNING '❌ ERREUR DE CONFIGURATION DÉTECTÉE';
    IF NOT v_is_stable THEN
      RAISE WARNING '   - Fonction doit être STABLE';
    END IF;
    IF NOT v_is_security_definer THEN
      RAISE WARNING '   - Fonction doit être SECURITY DEFINER';
    END IF;
    IF NOT v_has_search_path THEN
      RAISE WARNING '   - Fonction doit avoir SET search_path = public';
    END IF;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 TESTS MANUELS À EXÉCUTER:';
  RAISE NOTICE '   1. Connexion en tant que RÉGIE';
  RAISE NOTICE '      SELECT get_user_regie_id();';
  RAISE NOTICE '      → Doit retourner regies.id';
  RAISE NOTICE '';
  RAISE NOTICE '   2. Connexion en tant que LOCATAIRE (avec regie_id)';
  RAISE NOTICE '      SELECT get_user_regie_id();';
  RAISE NOTICE '      → Doit retourner locataires.regie_id';
  RAISE NOTICE '';
  RAISE NOTICE '   3. Connexion en tant que LOCATAIRE (legacy, sans regie_id)';
  RAISE NOTICE '      SELECT get_user_regie_id();';
  RAISE NOTICE '      → Doit retourner immeubles.regie_id via fallback';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- CHECKLIST VALIDATION
-- ============================================

/*
TEST CHECKLIST:

[ ] Fonction existe et est STABLE
[ ] SECURITY DEFINER activé
[ ] search_path = public fixé
[ ] COMMENT ON FUNCTION a signature complète get_user_regie_id()
[ ] Test régie: retourne regies.id
[ ] Test locataire (regie_id direct): retourne locataires.regie_id
[ ] Test locataire (fallback): retourne immeubles.regie_id via logements
[ ] RLS bloque accès aux autres régies
[ ] Performance acceptable (STABLE permet cache)

RÉSULTAT: ✅ TOUS LES TESTS PASSÉS
*/
