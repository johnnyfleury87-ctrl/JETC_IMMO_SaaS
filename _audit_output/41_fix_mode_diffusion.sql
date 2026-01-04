-- ============================================================
-- MIGRATION CORRECTIVE: Fix mode_diffusion tickets entreprises
-- ============================================================
-- Date: 2026-01-04
-- Type: CORRECTIF BLOCKER
-- Objectif: Résoudre erreur "Mode diffusion invalide: general" lors acceptation ticket
-- Root cause: M02/M35/M41 non appliquées → incohérence terminologie mode_diffusion
-- Rollback: 41_fix_mode_diffusion_rollback.sql
-- ============================================================
--
-- CONTEXTE:
-- - RPC accept_ticket_and_create_mission() version obsolète (M05) en production
-- - Attend valeurs 'public'/'assigné' MAIS tickets contiennent 'general'/'restreint'
-- - Policies RLS entreprises ABSENTES (M35 non appliquée)
-- - Contrainte CHECK sur tickets.mode_diffusion ABSENTE
--
-- SOLUTION MINIMALE:
-- 1. Standardiser valeurs tickets.mode_diffusion existantes
-- 2. Ajouter contrainte CHECK si absente
-- 3. Remplacer RPC accept_ticket_and_create_mission() (M41)
-- 4. Créer policies RLS entreprises manquantes (M35 partiel)
--
-- ============================================================

-- ============================================================
-- PARTIE 1: STANDARDISER VALEURS EXISTANTES
-- ============================================================

-- Log état avant migration
DO $$
DECLARE
  v_count_total int;
  v_count_null int;
  v_count_general int;
  v_count_restreint int;
  v_count_public int;
  v_count_assigne int;
  v_count_other int;
BEGIN
  SELECT COUNT(*) INTO v_count_total FROM tickets;
  SELECT COUNT(*) INTO v_count_null FROM tickets WHERE mode_diffusion IS NULL;
  SELECT COUNT(*) INTO v_count_general FROM tickets WHERE mode_diffusion = 'general';
  SELECT COUNT(*) INTO v_count_restreint FROM tickets WHERE mode_diffusion = 'restreint';
  SELECT COUNT(*) INTO v_count_public FROM tickets WHERE mode_diffusion = 'public';
  SELECT COUNT(*) INTO v_count_assigne FROM tickets WHERE mode_diffusion = 'assigné';
  SELECT COUNT(*) INTO v_count_other FROM tickets 
    WHERE mode_diffusion NOT IN ('general', 'restreint', 'public', 'assigné')
      AND mode_diffusion IS NOT NULL;
  
  RAISE NOTICE '📊 État avant migration:';
  RAISE NOTICE '  Total tickets: %', v_count_total;
  RAISE NOTICE '  NULL: %', v_count_null;
  RAISE NOTICE '  general: %', v_count_general;
  RAISE NOTICE '  restreint: %', v_count_restreint;
  RAISE NOTICE '  public (obsolète): %', v_count_public;
  RAISE NOTICE '  assigné (obsolète): %', v_count_assigne;
  RAISE NOTICE '  autres valeurs: %', v_count_other;
END $$;

-- Migration données: terminologie obsolète → nouvelle (M35)
UPDATE tickets
SET mode_diffusion = 'general', updated_at = now()
WHERE mode_diffusion = 'public';

UPDATE tickets
SET mode_diffusion = 'restreint', updated_at = now()
WHERE mode_diffusion = 'assigné';

-- Log résultat migration
DO $$
DECLARE
  v_count_migrated int;
BEGIN
  SELECT COUNT(*) INTO v_count_migrated 
  FROM tickets 
  WHERE mode_diffusion IN ('general', 'restreint');
  
  RAISE NOTICE '✅ Migration données: % tickets standardisés (general/restreint)', v_count_migrated;
END $$;


-- ============================================================
-- PARTIE 2: AJOUTER CONTRAINTE CHECK SI ABSENTE
-- ============================================================

DO $$
BEGIN
  -- Vérifier si contrainte existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.tickets'::regclass 
      AND conname = 'check_mode_diffusion'
  ) THEN
    -- Ajouter contrainte (valeurs standardisées + NULL autorisé)
    ALTER TABLE tickets 
    ADD CONSTRAINT check_mode_diffusion 
    CHECK (mode_diffusion IS NULL OR mode_diffusion IN ('general', 'restreint'));
    
    RAISE NOTICE '✅ Contrainte CHECK créée: tickets.mode_diffusion IN (general, restreint, NULL)';
  ELSE
    RAISE NOTICE '⚠️ Contrainte check_mode_diffusion existe déjà (skip)';
  END IF;
END $$;


-- ============================================================
-- PARTIE 3: REMPLACER RPC accept_ticket_and_create_mission (M41)
-- ============================================================

CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid,
  p_disponibilite_id uuid DEFAULT NULL
) RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_mission_id uuid;
  v_ticket_statut ticket_status;
  v_mode_diffusion text;
  v_entreprise_assignee uuid;
  v_locked_at timestamptz;
  v_regie_id uuid;
BEGIN
  -- Récupérer infos ticket
  SELECT statut, mode_diffusion, entreprise_id, locked_at, regie_id 
  INTO v_ticket_statut, v_mode_diffusion, v_entreprise_assignee, v_locked_at, v_regie_id
  FROM tickets 
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; 
  END IF;

  -- Vérifier statut ticket
  IF v_ticket_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être au statut en_attente (actuel: %)', v_ticket_statut;
  END IF;

  -- Vérifier verrouillage
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)';
  END IF;

  -- VALIDATION MODE DIFFUSION (TERMINOLOGIE STANDARDISÉE)
  IF v_mode_diffusion = 'general' THEN
    -- Mode general (marketplace): Vérifier autorisation régie
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
        AND entreprise_id = p_entreprise_id 
        AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée pour tickets marketplace de régie %', 
        p_entreprise_id, v_regie_id;
    END IF;
    
  ELSIF v_mode_diffusion = 'restreint' THEN
    -- Mode restreint (assignation): Vérifier entreprise assignée
    IF v_entreprise_assignee IS NULL THEN
      RAISE EXCEPTION 'Ticket en mode restreint mais aucune entreprise assignée';
    END IF;
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à entreprise % (tentative: %)', 
        v_entreprise_assignee, p_entreprise_id;
    END IF;
    
  ELSE
    -- NULL ou valeur invalide
    RAISE EXCEPTION 'Mode diffusion invalide ou NULL: % (attendu: general ou restreint)', 
      COALESCE(v_mode_diffusion, 'NULL');
  END IF;

  -- Verrouiller ticket
  UPDATE tickets 
  SET locked_at = now(),
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut en_attente → en_cours
  PERFORM update_ticket_statut(p_ticket_id, 'en_cours');

  -- Créer mission
  INSERT INTO missions (
    id,
    ticket_id, 
    entreprise_id,
    disponibilite_id,
    statut,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_ticket_id,
    p_entreprise_id,
    p_disponibilite_id,
    'en_attente',
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  RAISE NOTICE '✅ Ticket % accepté par entreprise % → mission %', 
    p_ticket_id, p_entreprise_id, v_mission_id;

  RETURN v_mission_id;
END;
$$;

COMMENT ON FUNCTION accept_ticket_and_create_mission IS
'Accepte ticket entreprise et crée mission associée.
Valide mode_diffusion: general (marketplace) ou restreint (assignation).
Terminologie standardisée M41 (2026-01-04).';


-- ============================================================
-- PARTIE 4: CRÉER POLICIES RLS ENTREPRISES (M35 PARTIEL)
-- ============================================================

-- Supprimer policies obsolètes/incorrectes si présentes
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- Policy 1: Mode GENERAL (marketplace régie)
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise authentifiée
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  -- Ticket mode general, disponible
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND
  -- Entreprise autorisée par régie pour mode general
  EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
      AND re.mode_diffusion = 'general'  -- ✅ M39: Vérification mode
  )
);

-- Policy 2: Mode RESTREINT (assignation directe)
CREATE POLICY "Entreprise can view assigned tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise authentifiée
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  -- Ticket assigné directement à cette entreprise
  mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
);

-- Commentaires
COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Mode GENERAL: Entreprise voit tickets marketplace (mode=general) de ses régies autorisées.
Statut en_attente, non verrouillés. Terminologie standardisée M35+M39.';

COMMENT ON POLICY "Entreprise can view assigned tickets" ON tickets IS
'Mode RESTREINT: Entreprise voit UNIQUEMENT tickets assignés directement.
Tous statuts mission. Terminologie standardisée M35.';


-- ============================================================
-- VALIDATION FINALE
-- ============================================================

DO $$
DECLARE
  v_count_policies int;
  v_count_constraint int;
  v_count_obsolete int;
  v_rpc_exists boolean;
BEGIN
  -- 1. Vérifier policies créées
  SELECT COUNT(*) INTO v_count_policies
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  -- 2. Vérifier contrainte CHECK
  SELECT COUNT(*) INTO v_count_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.tickets'::regclass
    AND conname = 'check_mode_diffusion';
  
  -- 3. Vérifier valeurs obsolètes restantes
  SELECT COUNT(*) INTO v_count_obsolete
  FROM tickets
  WHERE mode_diffusion IN ('public', 'assigné');
  
  -- 4. Vérifier RPC mise à jour
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'accept_ticket_and_create_mission'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_rpc_exists;
  
  -- Afficher résultats
  RAISE NOTICE '╔═══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║ VALIDATION MIGRATION CORRECTIVE                               ║';
  RAISE NOTICE '╠═══════════════════════════════════════════════════════════════╣';
  
  IF v_count_policies = 2 THEN
    RAISE NOTICE '║ ✅ Policies RLS entreprises: 2/2 créées                       ║';
  ELSE
    RAISE WARNING '║ ❌ Policies RLS: % sur 2 attendues                           ║', v_count_policies;
  END IF;
  
  IF v_count_constraint = 1 THEN
    RAISE NOTICE '║ ✅ Contrainte CHECK mode_diffusion: OK                        ║';
  ELSE
    RAISE WARNING '║ ⚠️ Contrainte CHECK: absente                                 ║';
  END IF;
  
  IF v_count_obsolete = 0 THEN
    RAISE NOTICE '║ ✅ Migration données: aucune valeur obsolète                  ║';
  ELSE
    RAISE WARNING '║ ⚠️ Valeurs obsolètes restantes: %                            ║', v_count_obsolete;
  END IF;
  
  IF v_rpc_exists THEN
    RAISE NOTICE '║ ✅ RPC accept_ticket_and_create_mission: mise à jour          ║';
  ELSE
    RAISE WARNING '║ ❌ RPC accept_ticket_and_create_mission: absent               ║';
  END IF;
  
  RAISE NOTICE '╚═══════════════════════════════════════════════════════════════╝';
  
  -- Exception si validation échoue
  IF v_count_policies != 2 OR NOT v_rpc_exists THEN
    RAISE EXCEPTION 'Migration ÉCHOUÉE: vérifier logs ci-dessus';
  END IF;
  
  RAISE NOTICE '✅ Migration corrective terminée avec succès';
  RAISE NOTICE '👉 Tester acceptation ticket entreprise pour confirmer fix';
END $$;

-- ============================================================
-- INSTRUCTIONS POST-MIGRATION
-- ============================================================

-- 1. ACTIVER RLS SUR TICKETS (NON FAIT ICI - HORS PÉRIMÈTRE)
--    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
--    ⚠️ À faire séparément car affecte TOUTES les tables

-- 2. TESTER ACCEPTATION TICKET
--    SELECT accept_ticket_and_create_mission(
--      '<ticket_id_test>',
--      '<entreprise_id_test>',
--      '<disponibilite_id_test>'
--    );
--    Attendu: Retourne mission_id (success) au lieu de EXCEPTION

-- 3. VÉRIFIER LOGS MIGRATION
--    SELECT migration_name, executed_at, description
--    FROM migration_logs
--    ORDER BY executed_at DESC
--    LIMIT 5;

-- ============================================================
-- FIN MIGRATION CORRECTIVE
-- ============================================================
