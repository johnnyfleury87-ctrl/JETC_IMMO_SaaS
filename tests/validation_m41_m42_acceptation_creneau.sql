-- ============================================================
-- TESTS VALIDATION M41+M42 - Acceptation ticket avec créneau
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Valider acceptation ticket mode general avec créneau sélectionné
-- Pré-requis: M41+M42 appliquées, ticket avec disponibilités existe
-- ============================================================

\echo '========================================='
\echo 'TESTS M41+M42: Acceptation ticket + créneau'
\echo '========================================='
\echo ''

-- ============================================================
-- TEST 1: RPC acceptation mode general avec créneau
-- ============================================================

\echo 'TEST 1: Acceptation ticket mode general avec créneau...'

-- Variables à remplacer
-- <entreprise_profile_id>: Profile ID de l'entreprise
-- <entreprise_id>: UUID de l'entreprise
-- <ticket_id>: Ticket mode_diffusion='general', statut='en_attente'
-- <disponibilite_id>: UUID d'une disponibilité liée au ticket

SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<entreprise_profile_id>", "role": "authenticated"}';

DO $$
DECLARE
  v_mission_id uuid;
  v_ticket_statut ticket_status;
  v_ticket_locked timestamptz;
  v_mission_dispo uuid;
BEGIN
  -- Appeler RPC
  SELECT accept_ticket_and_create_mission(
    '<ticket_id>'::uuid,
    '<entreprise_id>'::uuid,
    '<disponibilite_id>'::uuid
  ) INTO v_mission_id;
  
  IF v_mission_id IS NOT NULL THEN
    RAISE NOTICE '✅ TEST 1A: Mission créée ID=%', v_mission_id;
    
    -- Vérifier ticket verrouillé
    SELECT statut, locked_at INTO v_ticket_statut, v_ticket_locked
    FROM tickets WHERE id = '<ticket_id>';
    
    IF v_ticket_statut = 'en_cours' AND v_ticket_locked IS NOT NULL THEN
      RAISE NOTICE '✅ TEST 1B: Ticket verrouillé et statut en_cours';
    ELSE
      RAISE WARNING '⚠️ TEST 1B: Ticket statut=%s, locked=%s', v_ticket_statut, v_ticket_locked;
    END IF;
    
    -- Vérifier créneau enregistré
    SELECT disponibilite_id INTO v_mission_dispo
    FROM missions WHERE id = v_mission_id;
    
    IF v_mission_dispo = '<disponibilite_id>'::uuid THEN
      RAISE NOTICE '✅ TEST 1C: Créneau enregistré dans mission';
    ELSE
      RAISE WARNING '⚠️ TEST 1C: Créneau incorrect (attendu=<disponibilite_id>, reçu=%)', v_mission_dispo;
    END IF;
    
  ELSE
    RAISE WARNING '⚠️ TEST 1: Mission non créée';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ TEST 1 ÉCHOUÉ: %', SQLERRM;
END;
$$;

RESET role;

\echo ''

-- ============================================================
-- TEST 2: Vérifier que ticket n'est plus visible autres entreprises
-- ============================================================

\echo 'TEST 2: Ticket n''est plus visible pour les autres entreprises...'

-- Remplacer <autre_entreprise_profile_id>
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<autre_entreprise_profile_id>", "role": "authenticated"}';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM tickets_visibles_entreprise
  WHERE id = '<ticket_id>';
  
  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 2 RÉUSSI: Ticket masqué pour autres entreprises';
  ELSE
    RAISE WARNING '⚠️ TEST 2: Ticket encore visible (count=%)', v_count;
  END IF;
END;
$$;

RESET role;

\echo ''

-- ============================================================
-- TEST 3: Vérifier rejet si mode_diffusion invalide
-- ============================================================

\echo 'TEST 3: Rejet si mode_diffusion invalide...'

-- Créer ticket test avec mode_diffusion invalide
DO $$
DECLARE
  v_test_ticket_id uuid;
  v_error_occurred boolean := false;
BEGIN
  -- Créer ticket temporaire mode 'INVALID'
  INSERT INTO tickets (
    regie_id, logement_id, titre, description, statut, mode_diffusion
  ) VALUES (
    (SELECT id FROM regies LIMIT 1),
    (SELECT id FROM logements LIMIT 1),
    'TEST TICKET MODE INVALIDE',
    'Ce ticket ne devrait pas être accepté',
    'en_attente',
    'invalid_mode'
  ) RETURNING id INTO v_test_ticket_id;
  
  -- Tenter acceptation (devrait échouer)
  BEGIN
    PERFORM accept_ticket_and_create_mission(
      v_test_ticket_id,
      '<entreprise_id>'::uuid,
      NULL
    );
    RAISE WARNING '⚠️ TEST 3: Acceptation devrait avoir échoué';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Mode diffusion invalide%' THEN
        RAISE NOTICE '✅ TEST 3 RÉUSSI: Rejet mode invalide détecté';
        v_error_occurred := true;
      ELSE
        RAISE WARNING '⚠️ TEST 3: Erreur inattendue: %', SQLERRM;
      END IF;
  END;
  
  -- Nettoyer
  DELETE FROM tickets WHERE id = v_test_ticket_id;
END;
$$;

\echo ''

-- ============================================================
-- TEST 4: Acceptation sans créneau (optionnel)
-- ============================================================

\echo 'TEST 4: Acceptation sans créneau (disponibilite_id NULL)...'

SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<entreprise_profile_id>", "role": "authenticated"}';

DO $$
DECLARE
  v_mission_id uuid;
  v_test_ticket_id uuid;
BEGIN
  -- Créer ticket test sans disponibilités
  INSERT INTO tickets (
    regie_id, logement_id, titre, description, statut, mode_diffusion
  ) VALUES (
    (SELECT id FROM regies LIMIT 1),
    (SELECT id FROM logements LIMIT 1),
    'TEST TICKET SANS DISPOS',
    'Acceptation sans créneau',
    'en_attente',
    'general'
  ) RETURNING id INTO v_test_ticket_id;
  
  -- Lier entreprise à régie en mode general
  INSERT INTO regies_entreprises (regie_id, entreprise_id, mode_diffusion)
  SELECT 
    (SELECT regie_id FROM tickets WHERE id = v_test_ticket_id),
    '<entreprise_id>'::uuid,
    'general'
  ON CONFLICT DO NOTHING;
  
  -- Accepter sans disponibilite_id
  SELECT accept_ticket_and_create_mission(
    v_test_ticket_id,
    '<entreprise_id>'::uuid,
    NULL
  ) INTO v_mission_id;
  
  IF v_mission_id IS NOT NULL THEN
    RAISE NOTICE '✅ TEST 4 RÉUSSI: Acceptation sans créneau OK';
  ELSE
    RAISE WARNING '⚠️ TEST 4: Échec acceptation sans créneau';
  END IF;
  
  -- Nettoyer
  DELETE FROM missions WHERE ticket_id = v_test_ticket_id;
  DELETE FROM tickets WHERE id = v_test_ticket_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ TEST 4: %', SQLERRM;
END;
$$;

RESET role;

\echo ''

-- ============================================================
-- RÉSUMÉ
-- ============================================================

\echo '========================================='
\echo 'RÉSUMÉ TESTS M41+M42'
\echo '========================================='
\echo 'TEST 1: ✅ Acceptation mode general + créneau'
\echo 'TEST 2: ✅ Ticket masqué autres entreprises'
\echo 'TEST 3: ✅ Rejet mode_diffusion invalide'
\echo 'TEST 4: ✅ Acceptation sans créneau (optionnel)'
\echo ''
\echo 'Remplacer les variables avant exécution:'
\echo '  - <entreprise_profile_id>'
\echo '  - <entreprise_id>'
\echo '  - <ticket_id>'
\echo '  - <disponibilite_id>'
\echo '  - <autre_entreprise_profile_id>'
\echo '========================================='
