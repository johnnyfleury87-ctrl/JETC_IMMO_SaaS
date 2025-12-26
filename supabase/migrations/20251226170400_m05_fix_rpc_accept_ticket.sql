-- ============================================================
-- MIGRATION M05 - Corriger RPC accept_ticket_and_create_mission
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Corriger RPC acceptation ticket (retirer check colonne 'autorise' inexistante, ajouter logique mode_diffusion)
-- Dépendances: M01, M02, M03, M04 (colonnes + RPCs)
-- Rollback: 20251226170400_m05_fix_rpc_accept_ticket_rollback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission(
  p_ticket_id uuid,
  p_entreprise_id uuid
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

  -- Vérifier que ticket est au statut 'en_attente'
  IF v_ticket_statut != 'en_attente' THEN
    RAISE EXCEPTION 'Ticket doit être au statut en_attente (statut actuel: %)', v_ticket_statut;
  END IF;

  -- Vérifier que ticket n'est pas déjà verrouillé (accepté par autre entreprise)
  IF v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket déjà verrouillé (accepté par une autre entreprise)';
  END IF;

  -- Validation selon mode diffusion
  IF v_mode_diffusion = 'public' THEN
    -- Mode public: Vérifier que entreprise est autorisée en mode 'general'
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
      AND entreprise_id = p_entreprise_id 
      AND mode_diffusion = 'general'
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée pour tickets publics de régie %', p_entreprise_id, v_regie_id;
    END IF;
    
  ELSIF v_mode_diffusion = 'assigné' THEN
    -- Mode assigné: Vérifier que entreprise correspond à celle assignée
    IF v_entreprise_assignee IS NULL THEN
      RAISE EXCEPTION 'Ticket en mode assigné mais aucune entreprise assignée (données incohérentes)';
    END IF;
    IF v_entreprise_assignee != p_entreprise_id THEN
      RAISE EXCEPTION 'Ticket assigné à une autre entreprise (assignée: %, tentée: %)', v_entreprise_assignee, p_entreprise_id;
    END IF;
    
  ELSE
    RAISE EXCEPTION 'Mode diffusion invalide ou NULL: %', COALESCE(v_mode_diffusion, 'NULL');
  END IF;

  -- Verrouiller ticket (locked_at + entreprise_id si pas déjà rempli en mode assigné)
  UPDATE tickets 
  SET locked_at = now(),
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut en_attente → en_cours via RPC
  PERFORM update_ticket_statut(p_ticket_id, 'en_cours');

  -- Créer mission (contrainte UNIQUE sur ticket_id empêche doublons)
  INSERT INTO missions (
    id,
    ticket_id, 
    entreprise_id, 
    statut,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_ticket_id,
    p_entreprise_id,
    'en_attente',
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  RETURN v_mission_id;
END;
$$;

-- Accorder permissions
GRANT EXECUTE ON FUNCTION accept_ticket_and_create_mission(uuid, uuid) TO authenticated;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier fonction modifiée
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name = 'accept_ticket_and_create_mission';
-- Attendu: 1 ligne (FUNCTION)

-- VALIDATION 2: Vérifier signature fonction
-- SELECT pg_catalog.pg_get_function_arguments(p.oid) AS args
-- FROM pg_proc p WHERE p.proname = 'accept_ticket_and_create_mission';
-- Attendu: p_ticket_id uuid, p_entreprise_id uuid

-- VALIDATION 3: Test acceptation mode public (staging via API avec JWT entreprise)
-- Pré-requis: Ticket statut='en_attente', mode_diffusion='public', entreprise autorisée 'general'
-- API call: POST /rpc/accept_ticket_and_create_mission 
-- Body: {"p_ticket_id": "<uuid>", "p_entreprise_id": "<uuid>"}
-- Attendu: Mission créée, ticket passe 'en_cours', locked_at rempli, HTTP 200 avec mission_id

-- VALIDATION 4: Test acceptation mode assigné (staging via API)
-- Pré-requis: Ticket mode_diffusion='assigné', entreprise_id correct
-- API call: POST /rpc/accept_ticket_and_create_mission {...}
-- Attendu: Mission créée, ticket passe 'en_cours', HTTP 200

-- VALIDATION 5: Test acceptation déjà verrouillé (doit échouer)
-- Pré-requis: Ticket locked_at NOT NULL
-- API call: POST /rpc/accept_ticket_and_create_mission {...}
-- Attendu: ERROR - Ticket déjà verrouillé

-- VALIDATION 6: Test mode assigné mauvaise entreprise (doit échouer)
-- Pré-requis: Ticket assigné à entreprise A, tentative entreprise B
-- API call: POST /rpc/accept_ticket_and_create_mission {"p_entreprise_id": "<entreprise_B>"}
-- Attendu: ERROR - Ticket assigné à une autre entreprise

-- VALIDATION 7: Test doublon mission (doit échouer via contrainte UNIQUE)
-- Pré-requis: Mission déjà existante pour ticket_id
-- API call: POST /rpc/accept_ticket_and_create_mission {...}
-- Attendu: ERROR - duplicate key value violates unique constraint

-- ============================================================
-- FIN MIGRATION M05
-- ============================================================
