-- ============================================================
-- MIGRATION M58: Fix Vue tickets_visibles_entreprise - Statut en_attente
-- ============================================================
-- Date: 2026-01-09
-- Auteur: Fix tickets publics invisibles pour entreprises affiliées
-- Objectif: Vue doit filtrer statut='en_attente' (pas 'ouvert')
-- Issue: Vue filtre 'ouvert' mais tickets diffusés sont 'en_attente'
-- Rollback: 20260109010003_m58_fix_vue_tickets_entreprise_rollback.sql
-- ============================================================

-- CONTEXTE:
-- La vue tickets_visibles_entreprise filtre sur t.statut = 'ouvert'
-- MAIS les tickets diffusés par la régie passent en statut 'en_attente'
-- Résultat: Vue retourne ZÉRO ticket (aucun ticket n'a statut='ouvert' après diffusion)
--
-- EXEMPLE RÉEL IDENTIFIÉ:
-- - Ticket: statut='en_attente' (après diffusion par régie)
-- - Entreprise "Toutpourpout": liée à Régie B avec mode_diffusion='general'
-- - Vue filtre: re.mode_diffusion='general' AND t.statut='ouvert' → NO MATCH
-- - ATTENDU: re.mode_diffusion='general' AND t.statut='en_attente' → MATCH

-- ============================================================
-- ÉTAPE 1: Supprimer et recréer vue avec correction statut
-- ============================================================

-- Supprimer vue existante (nécessaire car on change les colonnes)
DROP VIEW IF EXISTS tickets_visibles_entreprise;

-- Recréer vue corrigée
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  -- Ticket
  t.id,
  t.titre,
  t.description,
  t.categorie,
  t.priorite,
  t.statut,
  t.mode_diffusion,
  t.locked_at,
  t.created_at,
  t.updated_at,
  t.locataire_id,
  t.logement_id,
  t.regie_id,
  t.entreprise_id,

  -- Champ pour filtrage frontend
  re.entreprise_id AS visible_par_entreprise_id,

  -- Infos régie/entreprise
  re.mode_diffusion AS entreprise_mode_diffusion,

  -- Locataire
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom,

  -- Logement
  log.numero AS logement_numero,

  -- Immeuble
  imm.nom AS immeuble_nom,
  imm.adresse AS immeuble_adresse,
  imm.ville AS immeuble_ville

FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id
LEFT JOIN locataires loc ON t.locataire_id = loc.id
LEFT JOIN logements log ON t.logement_id = log.id
LEFT JOIN immeubles imm ON log.immeuble_id = imm.id

WHERE
  -- CAS 1: Mode GENERAL (marketplace)
  -- Entreprise voit tickets publics de sa régie autorisée
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'general'      -- ✅ Ticket publié en general
    AND t.statut = 'en_attente'            -- ✅ CORRECTION: en_attente (pas ouvert)
    AND t.locked_at IS NULL                -- ✅ Pas encore accepté
  )
  OR
  -- CAS 2: Mode RESTREINT (assignation directe)
  -- Entreprise voit UNIQUEMENT tickets assignés directement
  (
    re.mode_diffusion = 'restreint'
    AND t.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id -- ✅ Assigné à cette entreprise
  )
  OR
  -- CAS 3: Tickets acceptés/en cours par cette entreprise
  -- Historique missions (tous modes)
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

-- ============================================================
-- ÉTAPE 2: Commentaire explicatif
-- ============================================================

COMMENT ON VIEW tickets_visibles_entreprise IS
'[M58] Vue tickets visibles par entreprise selon règles diffusion.
CAS 1: Mode general → tickets publics (en_attente, non lockés)
CAS 2: Mode restreint → tickets assignés directement
CAS 3: Historique missions (tous statuts après en_attente)
CORRECTION: Filtre statut=en_attente au lieu de ouvert (bug M17 originel)';

-- ============================================================
-- ÉTAPE 3: Validation
-- ============================================================

DO $$
DECLARE
  v_view_exists boolean;
  v_view_definition text;
BEGIN
  -- Vérifier que la vue existe
  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'tickets_visibles_entreprise'
  ) INTO v_view_exists;
  
  IF NOT v_view_exists THEN
    RAISE EXCEPTION '❌ M58: Vue tickets_visibles_entreprise introuvable';
  END IF;
  
  -- Vérifier que la vue contient le filtre en_attente
  SELECT definition INTO v_view_definition
  FROM pg_views
  WHERE schemaname = 'public'
    AND viewname = 'tickets_visibles_entreprise';
  
  IF v_view_definition NOT LIKE '%en_attente%' THEN
    RAISE WARNING '⚠️ M58: Vue créée mais filtre en_attente non détecté dans la définition';
  END IF;
  
  IF v_view_definition LIKE '%ouvert%' AND v_view_definition NOT LIKE '%en_attente%' THEN
    RAISE WARNING '⚠️ M58: Vue contient encore "ouvert" sans "en_attente"';
  END IF;
  
  RAISE NOTICE '✅ M58: Vue tickets_visibles_entreprise corrigée avec succès';
  RAISE NOTICE '   → Filtre maintenant sur statut=en_attente (tickets diffusés)';
  RAISE NOTICE '   → Vérifie mode_diffusion entreprise (general vs restreint)';
END $$;

-- ============================================================
-- FIN MIGRATION M58
-- ============================================================
