-- ============================================================
-- MIGRATION M03 - Créer RPC update_ticket_statut
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Créer fonction RPC pour transitions statut tickets avec validation métier
-- Correction: Transitions autorisées pour 'regie' ET 'admin_jtec'
-- Dépendances: M01, M02 (colonnes budget et mode_diffusion)
-- Rollback: 20251226170200_m03_create_rpc_update_ticket_statut_rollback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION update_ticket_statut(
  p_ticket_id uuid,
  p_nouveau_statut ticket_status
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_statut_actuel ticket_status;
  v_user_role text;
BEGIN
  -- Récupérer statut actuel
  SELECT statut INTO v_statut_actuel 
  FROM tickets 
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; 
  END IF;

  -- Récupérer rôle utilisateur connecté
  SELECT role INTO v_user_role 
  FROM profiles 
  WHERE id = auth.uid();

  -- Si statut inchangé, ne rien faire
  IF v_statut_actuel = p_nouveau_statut THEN 
    RETURN; 
  END IF;

  -- Validation transitions selon statut actuel et rôle
  -- CORRECTION: 'regie' ET 'admin_jtec' peuvent gérer transitions
  IF v_statut_actuel = 'nouveau' 
     AND p_nouveau_statut = 'ouvert' 
     AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- Transition nouveau → ouvert (validation par régie/admin)
    NULL; -- OK
    
  ELSIF v_statut_actuel = 'ouvert' 
        AND p_nouveau_statut = 'en_attente' 
        AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- Transition ouvert → en_attente (diffusion par régie/admin)
    NULL; -- OK
    
  ELSIF v_statut_actuel = 'en_attente' 
        AND p_nouveau_statut = 'en_cours' THEN
    -- Transition en_attente → en_cours (acceptation entreprise)
    NULL; -- OK (tout rôle peut tenter, RLS filtrera)
    
  ELSIF v_statut_actuel = 'en_cours' 
        AND p_nouveau_statut = 'termine' THEN
    -- Transition en_cours → termine (terminaison intervention)
    NULL; -- OK
    
  ELSIF v_statut_actuel = 'termine' 
        AND p_nouveau_statut = 'clos' 
        AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- Transition termine → clos (validation finale régie/admin)
    NULL; -- OK
    
  ELSIF p_nouveau_statut = 'annule' 
        AND v_user_role IN ('regie', 'admin_jtec') THEN
    -- Transition vers annule depuis n'importe quel statut (régie/admin)
    NULL; -- OK
    
  ELSE
    -- Transition interdite
    RAISE EXCEPTION 'Transition interdite : % → % pour rôle %', 
      v_statut_actuel, p_nouveau_statut, COALESCE(v_user_role, 'non authentifié');
  END IF;

  -- Appliquer transition
  UPDATE tickets 
  SET statut = p_nouveau_statut, 
      updated_at = now(),
      date_cloture = CASE 
        WHEN p_nouveau_statut = 'clos' THEN now() 
        ELSE date_cloture 
      END
  WHERE id = p_ticket_id;
END;
$$;

-- Accorder permissions
GRANT EXECUTE ON FUNCTION update_ticket_statut(uuid, ticket_status) TO authenticated;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier fonction créée
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name = 'update_ticket_statut';
-- Attendu: 1 ligne (FUNCTION)

-- VALIDATION 2: Vérifier signature fonction
-- SELECT pg_catalog.pg_get_function_arguments(p.oid) AS args
-- FROM pg_proc p WHERE p.proname = 'update_ticket_statut';
-- Attendu: p_ticket_id uuid, p_nouveau_statut ticket_status

-- VALIDATION 3: Test transition valide (staging via API avec JWT régie)
-- Pré-requis: Créer ticket test statut='nouveau'
-- API call: POST /rpc/update_ticket_statut 
-- Body: {"p_ticket_id": "<uuid>", "p_nouveau_statut": "ouvert"}
-- Attendu: Statut passe 'nouveau' → 'ouvert', HTTP 200

-- VALIDATION 4: Test transition interdite (staging via API)
-- Pré-requis: Ticket statut='nouveau'
-- API call: POST /rpc/update_ticket_statut 
-- Body: {"p_ticket_id": "<uuid>", "p_nouveau_statut": "clos"}
-- Attendu: ERROR 500 avec message "Transition interdite"

-- VALIDATION 5: Test ticket inexistant
-- SELECT update_ticket_statut('00000000-0000-0000-0000-000000000000', 'ouvert');
-- Attendu: ERROR - Ticket ... non trouvé

-- ============================================================
-- FIN MIGRATION M03
-- ============================================================
