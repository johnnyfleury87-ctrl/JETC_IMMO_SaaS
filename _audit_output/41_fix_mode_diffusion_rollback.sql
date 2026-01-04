-- ============================================================
-- ROLLBACK MIGRATION CORRECTIVE: Fix mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Type: ROLLBACK
-- Forward: 41_fix_mode_diffusion.sql
-- ============================================================
--
-- ⚠️ ATTENTION:
-- Ce rollback RESTAURE l'état AVANT la migration corrective.
-- Cela signifie que le bug "Mode diffusion invalide: general" REVIENDRA.
-- À n'utiliser QUE si la migration corrective cause des problèmes.
--
-- ============================================================

-- ============================================================
-- PARTIE 1: SUPPRIMER POLICIES RLS ENTREPRISES
-- ============================================================

DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

RAISE NOTICE '✅ Rollback: Policies RLS entreprises supprimées';


-- ============================================================
-- PARTIE 2: RESTAURER RPC ORIGINALE (VERSION M05)
-- ============================================================

-- NOTE: Nous ne connaissons PAS l'état exact de la RPC avant migration.
-- Ce rollback restaure une version M05 "probable" basée sur les migrations.
-- ALTERNATIVE: Restaurer depuis backup DB si disponible.

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

  -- Vérifier statut
  IF v_ticket_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être au statut en_attente (actuel: %)', v_ticket_statut;
  END IF;

  -- Vérifier verrouillage
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé';
  END IF;

  -- VALIDATION MODE DIFFUSION (VERSION M05 - TERMINOLOGIE OBSOLÈTE)
  IF v_mode_diffusion = 'public' THEN
    -- Mode public (ancien nom)
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
        AND entreprise_id = p_entreprise_id
    ) THEN
      RAISE EXCEPTION 'Entreprise non autorisée';
    END IF;
    
  ELSIF v_mode_diffusion = 'assigné' THEN
    -- Mode assigné (ancien nom)
    IF v_entreprise_assignee IS NULL THEN
      RAISE EXCEPTION 'Ticket assigné mais aucune entreprise';
    END IF;
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise';
    END IF;
    
  ELSE
    -- ⚠️ CETTE LIGNE CAUSE LE BUG SI mode_diffusion = 'general'
    RAISE EXCEPTION 'Mode diffusion invalide ou NULL: % (attendu: public ou assigné)', 
      COALESCE(v_mode_diffusion, 'NULL');
  END IF;

  -- Verrouiller ticket
  UPDATE tickets 
  SET locked_at = now(),
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut
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

  RETURN v_mission_id;
END;
$$;

COMMENT ON FUNCTION accept_ticket_and_create_mission IS
'Version M05 (rollback) - Attend mode_diffusion: public/assigné (OBSOLÈTE)';

RAISE NOTICE '✅ Rollback: RPC restaurée à version M05 (obsolète)';


-- ============================================================
-- PARTIE 3: SUPPRIMER CONTRAINTE CHECK
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.tickets'::regclass 
      AND conname = 'check_mode_diffusion'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT check_mode_diffusion;
    RAISE NOTICE '✅ Rollback: Contrainte check_mode_diffusion supprimée';
  ELSE
    RAISE NOTICE '⚠️ Rollback: Contrainte check_mode_diffusion déjà absente (skip)';
  END IF;
END $$;


-- ============================================================
-- PARTIE 4: ROLLBACK DONNÉES (OPTIONNEL - DANGEREUX)
-- ============================================================

-- ⚠️ DÉCOMMENTER UNIQUEMENT SI NÉCESSAIRE
-- Cette partie INVERSE la migration de données (general → public, restreint → assigné)
-- DANGER: Perte de cohérence si d'autres données ont été créées entre-temps

/*
UPDATE tickets
SET mode_diffusion = 'public', updated_at = now()
WHERE mode_diffusion = 'general';

UPDATE tickets
SET mode_diffusion = 'assigné', updated_at = now()
WHERE mode_diffusion = 'restreint';

RAISE NOTICE '⚠️ Rollback: Données restaurées à terminologie obsolète (public/assigné)';
*/

-- Par défaut: NE PAS ROLLBACK LES DONNÉES
RAISE NOTICE '⚠️ Rollback données: SKIP (décommenter si nécessaire)';


-- ============================================================
-- VALIDATION ROLLBACK
-- ============================================================

DO $$
DECLARE
  v_count_policies int;
  v_count_constraint int;
  v_rpc_exists boolean;
BEGIN
  -- Vérifier policies supprimées
  SELECT COUNT(*) INTO v_count_policies
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  -- Vérifier contrainte supprimée
  SELECT COUNT(*) INTO v_count_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.tickets'::regclass
    AND conname = 'check_mode_diffusion';
  
  -- Vérifier RPC restaurée
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'accept_ticket_and_create_mission'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_rpc_exists;
  
  RAISE NOTICE '╔═══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║ VALIDATION ROLLBACK                                           ║';
  RAISE NOTICE '╠═══════════════════════════════════════════════════════════════╣';
  
  IF v_count_policies = 0 THEN
    RAISE NOTICE '║ ✅ Policies entreprises: supprimées                           ║';
  ELSE
    RAISE WARNING '║ ⚠️ Policies: % restantes (attendu 0)                         ║', v_count_policies;
  END IF;
  
  IF v_count_constraint = 0 THEN
    RAISE NOTICE '║ ✅ Contrainte CHECK: supprimée                                ║';
  ELSE
    RAISE WARNING '║ ⚠️ Contrainte: toujours présente                             ║';
  END IF;
  
  IF v_rpc_exists THEN
    RAISE NOTICE '║ ✅ RPC accept_ticket_and_create_mission: restaurée            ║';
  ELSE
    RAISE WARNING '║ ❌ RPC: absente                                               ║';
  END IF;
  
  RAISE NOTICE '╚═══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '⚠️ ROLLBACK TERMINÉ: Bug "Mode diffusion invalide" REVIENT';
  RAISE NOTICE '👉 Réappliquer 41_fix_mode_diffusion.sql pour corriger';
END $$;

-- ============================================================
-- FIN ROLLBACK
-- ============================================================
