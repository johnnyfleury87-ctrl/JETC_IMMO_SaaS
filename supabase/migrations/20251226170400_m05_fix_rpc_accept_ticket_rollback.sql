-- ============================================================
-- ROLLBACK M05 - Restaurer ancienne version RPC accept_ticket_and_create_mission
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M05 - Retirer version corrigée, restaurer version cassée (avec check 'autorise')
-- Conséquence: RPC redevient cassée (référence colonne inexistante 'autorise')
-- ============================================================

-- Supprimer fonction corrigée
DROP FUNCTION IF EXISTS accept_ticket_and_create_mission(uuid, uuid) CASCADE;

-- ATTENTION: Impossible de restaurer ancienne version cassée automatiquement
-- La version pré-migration contenait un bug (référence colonne 'autorise' inexistante)
-- Pour rollback complet, restaurer manuellement depuis backup SQL pré-migration

-- Placeholder: Recréer version simplifiée (sans check mode_diffusion, version cassée)
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
BEGIN
  -- Version simplifiée cassée (pas de validation mode_diffusion)
  -- CETTE VERSION VA CRASHER EN PROD si exécutée sans corrections
  
  -- Créer mission directement (pas de vérifications)
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

  -- Mettre à jour ticket
  UPDATE tickets 
  SET statut = 'en_cours',
      locked_at = now(),
      entreprise_id = p_entreprise_id
  WHERE id = p_ticket_id;

  RETURN v_mission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_ticket_and_create_mission(uuid, uuid) TO authenticated;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier fonction restaurée (version cassée)
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'accept_ticket_and_create_mission';
-- Attendu: 1 ligne

-- VALIDATION 2: Comportement cassé attendu
-- API call: POST /rpc/accept_ticket_and_create_mission {...}
-- Attendu: Fonction exécute MAIS workflow tickets cassé (pas de validation mode_diffusion)

-- ============================================================
-- FIN ROLLBACK M05
-- ============================================================
