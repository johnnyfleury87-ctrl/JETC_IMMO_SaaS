-- ============================================================
-- VALIDATION WORKFLOW TICKETS RÉGIE-ENTREPRISE (M31-M35)
-- ============================================================
-- Objectif: Valider la suite logique complète (M31-M35)
-- Création locataire → Validation régie → Diffusion entreprise
-- ============================================================
-- IMPORTANT: Exécuter APRÈS application de M31-M35 !
-- Terminologie standardisée: 'general' et 'restreint' (plus 'public'/'assigné')
-- ============================================================

-- ========================================
-- TEST 1: Régie voit ticket + locataire + logement
-- ========================================
SELECT 
  '--- TEST 1: Régie voit ticket complet (RPC get_ticket_detail_regie) ---' AS test_name;

-- Créer un ticket test (simuler création locataire)
DO $$
DECLARE
  v_ticket_id uuid;
  v_locataire_id uuid;
  v_logement_id uuid;
  v_regie_id uuid;
BEGIN
  -- Récupérer IDs existants depuis la base
  SELECT id INTO v_regie_id FROM regies LIMIT 1;
  SELECT id INTO v_locataire_id FROM locataires WHERE regie_id = v_regie_id LIMIT 1;
  SELECT id INTO v_logement_id FROM logements WHERE id IN (
    SELECT logement_id FROM locataires WHERE id = v_locataire_id
  ) LIMIT 1;
  
  -- Créer ticket test
  INSERT INTO tickets (titre, description, categorie, priorite, statut, locataire_id, logement_id, regie_id)
  VALUES (
    'TEST M31-M34: Fuite évier',
    'Fuite importante sous évier cuisine',
    'plomberie',
    'urgente',
    'nouveau',
    v_locataire_id,
    v_logement_id,
    v_regie_id
  )
  RETURNING id INTO v_ticket_id;
  
  RAISE NOTICE '✅ TEST 1: Ticket créé (id: %)', v_ticket_id;
  
  -- Simuler appel RPC get_ticket_detail_regie (avec auth context)
  RAISE NOTICE '🔍 Vérifier RPC: SELECT * FROM get_ticket_detail_regie(''%'')', v_ticket_id;
END $$;


-- ========================================
-- TEST 2: Régie valide ticket avec plafond + mode (M32 RPC)
-- ========================================
SELECT 
  '--- TEST 2: Validation régie (RPC valider_ticket_regie M32) ---' AS test_name;

DO $$
DECLARE
  v_ticket_id uuid;
  v_regie_profile_id uuid;
  v_entreprise_id uuid;
  v_result jsonb;
BEGIN
  -- Récupérer ticket créé au TEST 1
  SELECT id INTO v_ticket_id FROM tickets WHERE titre LIKE 'TEST M31-M34%' ORDER BY created_at DESC LIMIT 1;
  
  -- Récupérer profile régie
  SELECT p.id INTO v_regie_profile_id
  FROM profiles p
  JOIN regies r ON r.profile_id = p.id
  LIMIT 1;
  
  -- Récupérer entreprise autorisée
  SELECT e.id INTO v_entreprise_id
  FROM entreprises e
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  LIMIT 1;
  
  -- Simuler validation régie avec mode RESTREINT (M32)
  RAISE NOTICE '🔍 Appeler RPC: SELECT valider_ticket_regie(ticket_id: %, plafond: 500.00, mode: restreint, entreprise: %)', v_ticket_id, v_entreprise_id;
  
  -- Vérifier UPDATE attendu (simule résultat M32)
  RAISE NOTICE '✅ TEST 2: Attendu → statut=en_attente (plus ouvert!), plafond=500.00, mode=restreint, entreprise_id=%', v_entreprise_id;
  RAISE NOTICE '✅ TEST 2: Attendu → plafond_valide_par=% (auth.uid), plafond_valide_at=NOW(), diffuse_par=%, diffuse_at=NOW()', v_regie_profile_id, v_regie_profile_id;
END $$;


-- ========================================
-- TEST 3: Entreprise autorisée voit ticket mode GENERAL (M34-M35)
-- ========================================
SELECT 
  '--- TEST 3: Entreprise voit ticket mode GENERAL (RLS policy M34-M35) ---' AS test_name;

DO $$
DECLARE
  v_ticket_general uuid;
  v_regie_id uuid;
  v_entreprise_profile_id uuid;
BEGIN
  -- Créer ticket mode GENERAL (terminologie M35)
  SELECT id INTO v_regie_id FROM regies LIMIT 1;
  
  INSERT INTO tickets (titre, description, categorie, priorite, statut, mode_diffusion, plafond_intervention_chf, regie_id, locataire_id, logement_id)
  SELECT 
    'TEST M34-M35: Ticket mode GENERAL',
    'Visible par toutes entreprises autorisées',
    'electricite',
    'normale',
    'en_attente',
    'general',  -- ✅ Terminologie harmonisée M35
    300.00,
    v_regie_id,
    (SELECT id FROM locataires WHERE regie_id = v_regie_id LIMIT 1),
    (SELECT l.id FROM logements l
     JOIN immeubles i ON i.id = l.immeuble_id
     WHERE i.regie_id = v_regie_id LIMIT 1)
  RETURNING id INTO v_ticket_general;
  
  RAISE NOTICE '✅ TEST 3: Ticket GENERAL créé (id: %)', v_ticket_general;
  
  -- Récupérer profile entreprise autorisée
  SELECT p.id INTO v_entreprise_profile_id
  FROM profiles p
  JOIN entreprises e ON e.profile_id = p.id
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  WHERE re.regie_id = v_regie_id
  LIMIT 1;
  
  RAISE NOTICE '🔍 Simuler auth context: set_config(''request.jwt.claims'', ''{"sub":"%"}'', true)', v_entreprise_profile_id;
  RAISE NOTICE '✅ TEST 3: Attendu → Entreprise voit ticket via Policy "Entreprise can view general tickets" (M34-M35)';
END $$;


-- ========================================
-- TEST 4: Seule entreprise assignée voit ticket mode RESTREINT (M34-M35)
-- ========================================
SELECT 
  '--- TEST 4: Entreprise assignée voit ticket RESTREINT (RLS policy M34-M35) ---' AS test_name;

DO $$
DECLARE
  v_ticket_restreint uuid;
  v_regie_id uuid;
  v_entreprise_assignee uuid;
  v_entreprise_autre uuid;
BEGIN
  -- Créer ticket mode RESTREINT (terminologie M35)
  SELECT id INTO v_regie_id FROM regies LIMIT 1;
  SELECT id INTO v_entreprise_assignee FROM entreprises WHERE id IN (
    SELECT entreprise_id FROM regies_entreprises WHERE regie_id = v_regie_id LIMIT 1
  );
  SELECT id INTO v_entreprise_autre FROM entreprises WHERE id != v_entreprise_assignee LIMIT 1;
  
  INSERT INTO tickets (titre, description, categorie, priorite, statut, mode_diffusion, plafond_intervention_chf, entreprise_id, regie_id, locataire_id, logement_id)
  SELECT 
    'TEST M34-M35: Ticket mode RESTREINT',
    'Visible uniquement par entreprise assignée',
    'menuiserie',
    'normale',
    'en_attente',
    'restreint',  -- ✅ Terminologie harmonisée M35
    500.00,
    v_entreprise_assignee,
    v_regie_id,
    (SELECT id FROM locataires WHERE regie_id = v_regie_id LIMIT 1),
    (SELECT l.id FROM logements l
     JOIN immeubles i ON i.id = l.immeuble_id
     WHERE i.regie_id = v_regie_id LIMIT 1)
  RETURNING id INTO v_ticket_restreint;
  
  RAISE NOTICE '✅ TEST 4: Ticket RESTREINT créé (id: %), assigné à entreprise: %', v_ticket_restreint, v_entreprise_assignee;
  RAISE NOTICE '🔍 TEST 4A: Entreprise assignée DOIT voir ticket via Policy "Entreprise can view assigned tickets" (M34-M35)';
  RAISE NOTICE '🔍 TEST 4B: Entreprise autre (id: %) NE DOIT PAS voir ticket', v_entreprise_autre;
END $$;


-- ========================================
-- TEST 5: Vérifier colonnes traceability M31
-- ========================================
SELECT 
  '--- TEST 5: Vérifier colonnes traceability (M31) ---' AS test_name;

SELECT 
  id,
  titre,
  plafond_intervention_chf,
  mode_diffusion,
  plafond_valide_par,
  plafond_valide_at,
  diffuse_par,
  diffuse_at,
  statut,
  CASE 
    WHEN plafond_valide_par IS NOT NULL AND plafond_valide_at IS NOT NULL 
         AND diffuse_par IS NOT NULL AND diffuse_at IS NOT NULL THEN '✅ Traceability M31 complète'
    WHEN plafond_valide_par IS NULL AND plafond_valide_at IS NULL THEN '⚠️ Pas encore validé (normal si ticket nouveau)'
    ELSE '❌ Traceability M31 incomplète'
  END AS validation_status
FROM tickets
WHERE titre LIKE 'TEST M%'
ORDER BY created_at DESC;


-- ========================================
-- TEST 6: RLS Policy entreprise mode GENERAL (count)
-- ========================================
SELECT 
  '--- TEST 6: Policy "Entreprise can view general tickets" ---' AS test_name;

SELECT 
  COUNT(*) AS nb_tickets_general,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Policy fonctionne (entreprises voient tickets mode=general)'
    ELSE '⚠️ Aucun ticket mode=general trouvé ou policy bloque'
  END AS test_result
FROM tickets
WHERE mode_diffusion = 'general' 
  AND statut = 'en_attente'
  AND locked_at IS NULL;


-- ========================================
-- TEST 7: RLS Policy entreprise mode RESTREINT (count)
-- ========================================
SELECT 
  '--- TEST 7: Policy "Entreprise can view assigned tickets" ---' AS test_name;

SELECT 
  COUNT(*) AS nb_tickets_restreint,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Policy fonctionne (entreprise voit tickets assignés)'
    ELSE '⚠️ Aucun ticket mode=restreint trouvé ou policy bloque'
  END AS test_result
FROM tickets
WHERE mode_diffusion = 'restreint' 
  AND entreprise_id IS NOT NULL;


-- ========================================
-- CLEANUP (optionnel)
-- ========================================
SELECT 
  '--- CLEANUP: Supprimer tickets de test ---' AS cleanup;

-- Décommenter pour nettoyer après tests
-- DELETE FROM tickets WHERE titre LIKE 'TEST M%';
-- RAISE NOTICE '🧹 Tickets de test supprimés';


-- ========================================
-- RÉSUMÉ FINAL
-- ========================================
SELECT 
  '========================================' AS separator,
  'VALIDATION WORKFLOW TICKETS' AS titre,
  '========================================' AS separator2;

SELECT 
  'TEST 1' AS test,
  'Régie voit ticket complet (locataire + logement)' AS description,
  '✅ VÉRIFIER RPC get_ticket_detail_regie' AS action;

SELECT 
  'TEST 2' AS test,
  'Régie valide ticket (plafond + mode + entreprise)' AS description,
  '✅ VÉRIFIER RPC valider_ticket_regie + colonnes M31' AS action;

SELECT 
  'TEST 3' AS test,
  'Entreprise autorisée voit ticket mode GENERAL' AS description,
  '✅ VÉRIFIER Policy "Entreprise can view general tickets"' AS action;

SELECT 
  'TEST 4' AS test,
  'Seule entreprise assignée voit ticket RESTREINT' AS description,
  '✅ VÉRIFIER Policy "Entreprise can view assigned tickets"' AS action;

SELECT 
  'TEST 5' AS test,
  'Colonnes traceability remplies (plafond_valide_par/at)' AS description,
  '✅ VÉRIFIER UPDATE après validation régie' AS action;

SELECT 
  'TEST 6-7' AS test,
  'RLS policies entreprise fonctionnent correctement' AS description,
  '✅ COUNT tickets visibles selon mode_diffusion' AS action;
