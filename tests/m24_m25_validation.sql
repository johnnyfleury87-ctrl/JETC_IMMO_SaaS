-- ============================================================
-- TESTS VALIDATION M24 + M25
-- ============================================================
-- Objectif: Tester masquage colonnes sensibles + validation diffusion
-- Migrations: M24 (vue entreprise), M25 (RPC diffuser_ticket)
-- Exécution: Environnement staging UNIQUEMENT
-- ============================================================

-- ============================================================
-- PARTIE 1: TESTS M24 - MASQUAGE COLONNES SENSIBLES
-- ============================================================

-- TEST M24.1: Vérifier structure vue modifiée
-- Attendu: 27 colonnes (24 tickets + ville + 2 métadonnées vue)
SELECT 
  column_name, 
  data_type,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'tickets_visibles_entreprise'
ORDER BY ordinal_position;
-- Vérifier colonnes: locataire_id (uuid), logement_id (uuid), ville (text)


-- TEST M24.2: Masquage mode PUBLIC AVANT acceptation
-- Pré-requis: 
--   1. Créer ticket test: statut='en_attente', mode_diffusion='public', locked_at=NULL
--   2. Entreprise autorisée mode_diffusion='general'
-- Setup:
/*
INSERT INTO tickets (
  titre, description, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, mode_diffusion, locked_at,
  plafond_intervention_chf
) VALUES (
  'Test masquage public',
  'Description test',
  'plomberie',
  'moyenne',
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,  -- UUID valide logement
  '<locataire_id>'::uuid, -- UUID valide locataire
  'en_attente',
  'public',
  NULL, -- AVANT acceptation
  1500.00
) RETURNING id;
-- Noter ID retourné
*/

-- Query test:
SELECT 
  id, 
  titre, 
  locataire_id,  -- Attendu: NULL
  logement_id,   -- Attendu: NULL
  ville,         -- Attendu: "Genève" (ou ville immeuble)
  mode_diffusion,
  locked_at,
  visible_par_entreprise_id
FROM tickets_visibles_entreprise
WHERE id = '<ticket_id_test_m24_2>'
  AND visible_par_entreprise_id = '<entreprise_autorisee>';

-- ✅ SUCCESS SI: locataire_id IS NULL, logement_id IS NULL, ville NOT NULL
-- ❌ FAIL SI: locataire_id/logement_id exposés


-- TEST M24.3: Déverrouillage APRÈS acceptation mode PUBLIC
-- Pré-requis: Même ticket test M24.2 APRÈS acceptation
-- Setup:
/*
-- Accepter ticket via RPC M05
SELECT accept_ticket_and_create_mission(
  '<ticket_id_test_m24_2>'::uuid,
  '<entreprise_id>'::uuid
);
-- Ticket passe statut en_cours + locked_at=now()
*/

-- Query test:
SELECT 
  id, 
  titre, 
  locataire_id,  -- Attendu: UUID valide (DÉVERROUILLÉ)
  logement_id,   -- Attendu: UUID valide (DÉVERROUILLÉ)
  ville,
  mode_diffusion,
  locked_at,
  statut,
  entreprise_id
FROM tickets_visibles_entreprise
WHERE id = '<ticket_id_test_m24_2>'
  AND visible_par_entreprise_id = '<entreprise_acceptee>';

-- ✅ SUCCESS SI: locataire_id NOT NULL, logement_id NOT NULL, locked_at NOT NULL
-- ❌ FAIL SI: colonnes restent NULL après acceptation


-- TEST M24.4: Masquage mode ASSIGNÉ AVANT acceptation
-- Pré-requis: Ticket mode_diffusion='assigné', entreprise_id définie
-- Setup:
/*
INSERT INTO tickets (
  titre, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, mode_diffusion, entreprise_id, locked_at,
  plafond_intervention_chf
) VALUES (
  'Test assigné avant accept',
  'électricité',
  'haute',
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,
  '<locataire_id>'::uuid,
  'en_attente',
  'assigné',
  '<entreprise_assignee>'::uuid,
  NULL, -- AVANT acceptation
  2000.00
) RETURNING id;
*/

-- Query test:
SELECT 
  id, 
  locataire_id,  -- Attendu: NULL (mode assigné MAIS pas accepté)
  logement_id,   -- Attendu: NULL
  ville,
  mode_diffusion,
  entreprise_id,
  locked_at
FROM tickets_visibles_entreprise
WHERE id = '<ticket_id_test_m24_4>'
  AND visible_par_entreprise_id = '<entreprise_assignee>';

-- ⚠️ DÉCISION MÉTIER VALIDÉE: Assigné = engagement régie
-- Si règle finale = "assigné déverrouille tout", modifier CASE WHEN M24:
-- CASE WHEN t.locked_at IS NULL THEN NULL (retirer condition mode_diffusion)
-- ✅ SUCCESS SI: Comportement cohérent avec règle métier validée


-- TEST M24.5: Invisibilité pour autre entreprise
-- Pré-requis: Ticket accepté par entreprise E1
-- Query test:
SELECT COUNT(*)
FROM tickets_visibles_entreprise
WHERE id = '<ticket_id_accepte_par_e1>'
  AND visible_par_entreprise_id = '<entreprise_e2>';  -- Autre entreprise

-- ✅ SUCCESS SI: COUNT = 0 (autre entreprise ne voit PAS ticket)
-- ❌ FAIL SI: COUNT > 0


-- TEST M24.6: Colonne ville présente et correcte
-- Query test:
SELECT 
  t.id,
  t.ville,
  i.ville AS ville_reelle_immeuble
FROM tickets_visibles_entreprise t
INNER JOIN tickets ti ON ti.id = t.id
INNER JOIN logements lg ON lg.id = ti.logement_id
INNER JOIN immeubles i ON i.id = lg.immeuble_id
WHERE t.ville IS NOT NULL
LIMIT 5;

-- ✅ SUCCESS SI: t.ville = i.ville (cohérence JOIN)
-- ❌ FAIL SI: valeurs différentes ou ville NULL


-- ============================================================
-- PARTIE 2: TESTS M25 - VALIDATION DIFFUSION
-- ============================================================

-- TEST M25.1: Diffusion SUCCESS avec priorité + plafond
-- Pré-requis: Ticket statut='ouvert', priorite='haute', plafond=1500
-- Setup:
/*
INSERT INTO tickets (
  titre, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, plafond_intervention_chf
) VALUES (
  'Test diffusion valide',
  'chauffage',
  'haute',
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,
  '<locataire_id>'::uuid,
  'ouvert',
  1500.00
) RETURNING id;
*/

-- Query test:
BEGIN;
  SELECT diffuser_ticket(
    '<ticket_id_test_m25_1>'::uuid,
    'public',
    NULL
  );
  -- Vérifier transition
  SELECT statut, mode_diffusion 
  FROM tickets 
  WHERE id = '<ticket_id_test_m25_1>';
COMMIT;

-- ✅ SUCCESS SI: statut='en_attente', mode_diffusion='public'
-- ❌ FAIL SI: exception levée


-- TEST M25.2: Diffusion ÉCHEC sans priorité
-- Pré-requis: Ticket statut='ouvert', priorite=NULL, plafond=1500
-- Setup:
/*
INSERT INTO tickets (
  titre, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, plafond_intervention_chf
) VALUES (
  'Test sans priorité',
  'chauffage',
  NULL, -- MANQUANT
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,
  '<locataire_id>'::uuid,
  'ouvert',
  1500.00
) RETURNING id;
*/

-- Query test:
BEGIN;
  SELECT diffuser_ticket(
    '<ticket_id_test_m25_2>'::uuid,
    'public',
    NULL
  );
  -- Ne devrait pas arriver ici
  RAISE EXCEPTION 'Test échoué: diffusion autorisée sans priorité';
EXCEPTION
  WHEN OTHERS THEN
    -- Vérifier message erreur
    IF SQLERRM LIKE '%Priorité manquante%' THEN
      RAISE NOTICE 'Test M25.2 SUCCESS: %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'Test M25.2 FAIL: erreur inattendue: %', SQLERRM;
    END IF;
END;

-- ✅ SUCCESS SI: EXCEPTION "Priorité manquante: ticket doit avoir une priorité avant diffusion"
-- ❌ FAIL SI: aucune exception ou message différent


-- TEST M25.3: Diffusion ÉCHEC sans plafond
-- Pré-requis: Ticket statut='ouvert', priorite='moyenne', plafond=NULL
-- Setup:
/*
INSERT INTO tickets (
  titre, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, plafond_intervention_chf
) VALUES (
  'Test sans plafond',
  'serrurerie',
  'moyenne',
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,
  '<locataire_id>'::uuid,
  'ouvert',
  NULL -- MANQUANT
) RETURNING id;
*/

-- Query test:
BEGIN;
  SELECT diffuser_ticket(
    '<ticket_id_test_m25_3>'::uuid,
    'assigné',
    '<entreprise_id>'::uuid
  );
  RAISE EXCEPTION 'Test échoué: diffusion autorisée sans plafond';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Plafond intervention manquant%' THEN
      RAISE NOTICE 'Test M25.3 SUCCESS: %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'Test M25.3 FAIL: erreur inattendue: %', SQLERRM;
    END IF;
END;

-- ✅ SUCCESS SI: EXCEPTION "Plafond intervention manquant..."
-- ❌ FAIL SI: aucune exception ou message différent


-- TEST M25.4: Diffusion ÉCHEC sans priorité NI plafond
-- Setup:
/*
INSERT INTO tickets (
  titre, categorie, priorite, 
  regie_id, logement_id, locataire_id,
  statut, plafond_intervention_chf
) VALUES (
  'Test incomplet',
  'autre',
  NULL, -- MANQUANT
  '<regie_id>'::uuid,
  '<logement_id>'::uuid,
  '<locataire_id>'::uuid,
  'ouvert',
  NULL -- MANQUANT
) RETURNING id;
*/

-- Query test:
BEGIN;
  SELECT diffuser_ticket(
    '<ticket_id_test_m25_4>'::uuid,
    'public',
    NULL
  );
  RAISE EXCEPTION 'Test échoué: diffusion autorisée ticket incomplet';
EXCEPTION
  WHEN OTHERS THEN
    -- Priorité vérifiée AVANT plafond (ordre M25)
    IF SQLERRM LIKE '%Priorité manquante%' THEN
      RAISE NOTICE 'Test M25.4 SUCCESS: %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'Test M25.4 FAIL: devrait échouer sur priorité, erreur: %', SQLERRM;
    END IF;
END;

-- ✅ SUCCESS SI: EXCEPTION sur priorité (1ère vérification)
-- ❌ FAIL SI: exception plafond (ordre incorrect) ou aucune exception


-- ============================================================
-- PARTIE 3: TESTS RÉGRESSION
-- ============================================================

-- TEST REG.1: Vue ancienne fonctionnalité cas 2 (mode assigné)
-- Vérifier entreprise assignée voit toujours son ticket
SELECT COUNT(*)
FROM tickets_visibles_entreprise
WHERE mode_diffusion = 'assigné'
  AND entreprise_id = visible_par_entreprise_id;

-- ✅ SUCCESS SI: COUNT > 0 (si données existent)
-- ❌ FAIL SI: COUNT = 0 (régression filtrage lignes)


-- TEST REG.2: Vue ancienne fonctionnalité cas 3 (historique)
-- Vérifier entreprise voit tickets acceptés statut en_cours/terminé/clos
SELECT COUNT(*)
FROM tickets_visibles_entreprise
WHERE statut IN ('en_cours', 'termine', 'clos')
  AND entreprise_id = visible_par_entreprise_id;

-- ✅ SUCCESS SI: COUNT > 0 (si données existent)
-- ❌ FAIL SI: COUNT = 0 (régression WHERE clause)


-- TEST REG.3: RPC diffuser_ticket ancienne logique mode assigné
-- Vérifier validation entreprise autorisée toujours active
BEGIN;
  SELECT diffuser_ticket(
    '<ticket_id>'::uuid,
    'assigné',
    '<entreprise_non_autorisee>'::uuid  -- PAS dans regies_entreprises
  );
  RAISE EXCEPTION 'Test échoué: entreprise non autorisée acceptée';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%non autorisée par régie%' THEN
      RAISE NOTICE 'Test REG.3 SUCCESS: %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'Test REG.3 FAIL: erreur inattendue: %', SQLERRM;
    END IF;
END;

-- ✅ SUCCESS SI: EXCEPTION "Entreprise ... non autorisée par régie ..."
-- ❌ FAIL SI: aucune exception (régression validation M04)


-- ============================================================
-- RÉSUMÉ TESTS (à vérifier manuellement)
-- ============================================================

/*
CHECKLIST VALIDATION COMPLÈTE:

M24 (Masquage):
[ ] M24.1 - Structure vue 27 colonnes dont locataire_id/logement_id/ville
[ ] M24.2 - Mode public AVANT accept → UUIDs NULL
[ ] M24.3 - Mode public APRÈS accept → UUIDs visible
[ ] M24.4 - Mode assigné → UUIDs NULL si locked_at NULL (règle métier)
[ ] M24.5 - Autre entreprise → invisibilité ticket accepté
[ ] M24.6 - Colonne ville correcte (JOIN immeubles)

M25 (Validation):
[ ] M25.1 - Diffusion SUCCESS avec priorité + plafond
[ ] M25.2 - Diffusion ÉCHEC sans priorité
[ ] M25.3 - Diffusion ÉCHEC sans plafond
[ ] M25.4 - Diffusion ÉCHEC sans priorité ni plafond (ordre correct)

Régression:
[ ] REG.1 - Vue cas 2 (mode assigné) toujours fonctionnel
[ ] REG.2 - Vue cas 3 (historique) toujours fonctionnel
[ ] REG.3 - RPC validation entreprise autorisée toujours active

TOTAL: 13 tests
*/

-- ============================================================
-- FIN TESTS VALIDATION
-- ============================================================
