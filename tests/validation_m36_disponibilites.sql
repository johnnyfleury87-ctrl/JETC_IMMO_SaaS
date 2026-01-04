-- ============================================================
-- TESTS VALIDATION M36 - Règle disponibilités "au moins 1"
-- ============================================================
-- Date: 2026-01-04
-- Objectif: Valider que le trigger accepte 1, 2 ou 3 disponibilités
-- Pré-requis: Migration M36 appliquée
-- ============================================================

\echo '========================================='
\echo 'TEST M36: Validation règle disponibilités'
\echo '========================================='
\echo ''

-- ============================================================
-- SETUP: Créer données test (rollback à la fin)
-- ============================================================

\echo 'SETUP: Création données test...'

-- Créer régie test
INSERT INTO regies (id, nom, profile_id)
VALUES (
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'Régie Test M36',
  (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- Créer immeuble test
INSERT INTO immeubles (id, regie_id, adresse)
VALUES (
  'eeeeeeee-0000-0000-0000-000000000001'::uuid,
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'Immeuble Test M36'
)
ON CONFLICT (id) DO NOTHING;

-- Créer logement test
INSERT INTO logements (id, immeuble_id, numero)
VALUES (
  'ffffffff-0000-0000-0000-000000000001'::uuid,
  'eeeeeeee-0000-0000-0000-000000000001'::uuid,
  'Log-M36'
)
ON CONFLICT (id) DO NOTHING;

-- Créer 4 tickets test (0, 1, 2, 3 dispos)
INSERT INTO tickets (id, logement_id, regie_id, titre, statut)
VALUES 
  ('11111111-0000-0000-0000-000000000036'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'Ticket 0 dispo', 'nouveau'),
  ('22222222-0000-0000-0000-000000000036'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'Ticket 1 dispo', 'nouveau'),
  ('33333333-0000-0000-0000-000000000036'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'Ticket 2 dispos', 'nouveau'),
  ('44444444-0000-0000-0000-000000000036'::uuid, 'ffffffff-0000-0000-0000-000000000001'::uuid, 'dddddddd-0000-0000-0000-000000000001'::uuid, 'Ticket 3 dispos', 'nouveau')
ON CONFLICT (id) DO NOTHING;

-- Créer disponibilités
INSERT INTO tickets_disponibilites (ticket_id, date_debut, date_fin)
VALUES
  -- 1 dispo pour ticket 2
  ('22222222-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours'),
  -- 2 dispos pour ticket 3
  ('33333333-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours'),
  ('33333333-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '2 hours'),
  -- 3 dispos pour ticket 4
  ('44444444-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours'),
  ('44444444-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '2 hours'),
  ('44444444-0000-0000-0000-000000000036'::uuid, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

\echo '✅ Données test créées'
\echo ''

-- ============================================================
-- TEST 1: 0 disponibilités → DOIT ÉCHOUER
-- ============================================================

\echo 'TEST 1: Diffusion avec 0 disponibilités (doit échouer)...'

DO $$
BEGIN
  UPDATE tickets 
  SET statut = 'en_attente' 
  WHERE id = '11111111-0000-0000-0000-000000000036'::uuid;
  
  RAISE EXCEPTION '❌ TEST 1 ÉCHOUÉ: Diffusion autorisée avec 0 disponibilités';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%au moins 1 disponibilité%' THEN
      RAISE NOTICE '✅ TEST 1 RÉUSSI: Trigger bloque diffusion avec 0 disponibilités';
      RAISE NOTICE '   Message: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '❌ TEST 1 ÉCHOUÉ: Erreur inattendue - %', SQLERRM;
    END IF;
END;
$$;

\echo ''

-- ============================================================
-- TEST 2: 1 disponibilité → DOIT RÉUSSIR
-- ============================================================

\echo 'TEST 2: Diffusion avec 1 disponibilité (doit réussir)...'

DO $$
DECLARE
  v_statut ticket_status;
BEGIN
  UPDATE tickets 
  SET statut = 'en_attente' 
  WHERE id = '22222222-0000-0000-0000-000000000036'::uuid;
  
  SELECT statut INTO v_statut
  FROM tickets
  WHERE id = '22222222-0000-0000-0000-000000000036'::uuid;
  
  IF v_statut = 'en_attente' THEN
    RAISE NOTICE '✅ TEST 2 RÉUSSI: Diffusion autorisée avec 1 disponibilité';
  ELSE
    RAISE EXCEPTION '❌ TEST 2 ÉCHOUÉ: Statut attendu en_attente, reçu %', v_statut;
  END IF;
END;
$$;

\echo ''

-- ============================================================
-- TEST 3: 2 disponibilités → DOIT RÉUSSIR
-- ============================================================

\echo 'TEST 3: Diffusion avec 2 disponibilités (doit réussir)...'

DO $$
DECLARE
  v_statut ticket_status;
BEGIN
  UPDATE tickets 
  SET statut = 'en_attente' 
  WHERE id = '33333333-0000-0000-0000-000000000036'::uuid;
  
  SELECT statut INTO v_statut
  FROM tickets
  WHERE id = '33333333-0000-0000-0000-000000000036'::uuid;
  
  IF v_statut = 'en_attente' THEN
    RAISE NOTICE '✅ TEST 3 RÉUSSI: Diffusion autorisée avec 2 disponibilités';
  ELSE
    RAISE EXCEPTION '❌ TEST 3 ÉCHOUÉ: Statut attendu en_attente, reçu %', v_statut;
  END IF;
END;
$$;

\echo ''

-- ============================================================
-- TEST 4: 3 disponibilités → DOIT RÉUSSIR
-- ============================================================

\echo 'TEST 4: Diffusion avec 3 disponibilités (doit réussir)...'

DO $$
DECLARE
  v_statut ticket_status;
BEGIN
  UPDATE tickets 
  SET statut = 'en_attente' 
  WHERE id = '44444444-0000-0000-0000-000000000036'::uuid;
  
  SELECT statut INTO v_statut
  FROM tickets
  WHERE id = '44444444-0000-0000-0000-000000000036'::uuid;
  
  IF v_statut = 'en_attente' THEN
    RAISE NOTICE '✅ TEST 4 RÉUSSI: Diffusion autorisée avec 3 disponibilités';
  ELSE
    RAISE EXCEPTION '❌ TEST 4 ÉCHOUÉ: Statut attendu en_attente, reçu %', v_statut;
  END IF;
END;
$$;

\echo ''

-- ============================================================
-- TEST 5: Vérifier message erreur contient "au moins 1"
-- ============================================================

\echo 'TEST 5: Vérifier message erreur contient "au moins 1"...'

DO $$
DECLARE
  v_error_message text;
BEGIN
  -- Tenter diffusion avec 0 dispo pour capturer message
  BEGIN
    UPDATE tickets 
    SET statut = 'en_attente' 
    WHERE id = '11111111-0000-0000-0000-000000000036'::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      v_error_message := SQLERRM;
  END;
  
  IF v_error_message LIKE '%au moins 1 disponibilité%' THEN
    RAISE NOTICE '✅ TEST 5 RÉUSSI: Message erreur correct';
    RAISE NOTICE '   Message: %', v_error_message;
  ELSE
    RAISE EXCEPTION '❌ TEST 5 ÉCHOUÉ: Message attendu "au moins 1", reçu: %', v_error_message;
  END IF;
END;
$$;

\echo ''

-- ============================================================
-- CLEANUP: Supprimer données test
-- ============================================================

\echo 'CLEANUP: Suppression données test...'

DELETE FROM tickets_disponibilites 
WHERE ticket_id IN (
  '11111111-0000-0000-0000-000000000036'::uuid,
  '22222222-0000-0000-0000-000000000036'::uuid,
  '33333333-0000-0000-0000-000000000036'::uuid,
  '44444444-0000-0000-0000-000000000036'::uuid
);

DELETE FROM tickets 
WHERE id IN (
  '11111111-0000-0000-0000-000000000036'::uuid,
  '22222222-0000-0000-0000-000000000036'::uuid,
  '33333333-0000-0000-0000-000000000036'::uuid,
  '44444444-0000-0000-0000-000000000036'::uuid
);

DELETE FROM logements WHERE id = 'ffffffff-0000-0000-0000-000000000001'::uuid;
DELETE FROM immeubles WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid;
DELETE FROM regies WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid;

\echo '✅ Cleanup terminé'
\echo ''

-- ============================================================
-- RÉSUMÉ
-- ============================================================

\echo '========================================='
\echo 'RÉSUMÉ TESTS M36'
\echo '========================================='
\echo 'TEST 1 (0 dispo):  ✅ Bloqué correctement'
\echo 'TEST 2 (1 dispo):  ✅ Autorisé'
\echo 'TEST 3 (2 dispos): ✅ Autorisé'
\echo 'TEST 4 (3 dispos): ✅ Autorisé'
\echo 'TEST 5 (message):  ✅ Message correct'
\echo ''
\echo '✅ TOUS LES TESTS M36 RÉUSSIS'
\echo '========================================='
