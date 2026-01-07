-- =====================================================
-- MIGRATION M51: Créer RPC assign_technicien_to_mission
-- =====================================================
-- Date: 2026-01-07
-- Auteur: Fix bug assignation technicien depuis dashboard entreprise
-- Objectif: Créer RPC sécurisé pour assigner un technicien à une mission
-- Bug résolu: RPC manquant, erreur "function does not exist"
-- =====================================================

-- =====================================================
-- RPC: assign_technicien_to_mission
-- =====================================================
-- Permet à une entreprise d'assigner un de SES techniciens à UNE de SES missions

-- Supprimer toutes les versions existantes de la fonction
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID);
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.assign_technicien_to_mission;

-- Créer la fonction
CREATE FUNCTION assign_technicien_to_mission(
  p_mission_id UUID,
  p_technicien_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entreprise_id UUID;
  v_mission_entreprise_id UUID;
  v_technicien_entreprise_id UUID;
  v_mission_statut TEXT;
  v_ticket_id UUID;
BEGIN
  RAISE NOTICE '🔧 assign_technicien_to_mission: mission=%, technicien=%', p_mission_id, p_technicien_id;
  
  -- Vérification 1: Récupérer l'entreprise connectée
  SELECT id INTO v_entreprise_id
  FROM entreprises
  WHERE profile_id = auth.uid();
  
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous devez être connecté en tant qu''entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Entreprise connectée: %', v_entreprise_id;
  
  -- Vérification 2: La mission appartient bien à cette entreprise
  SELECT entreprise_id, statut, ticket_id 
  INTO v_mission_entreprise_id, v_mission_statut, v_ticket_id
  FROM missions
  WHERE id = p_mission_id;
  
  IF v_mission_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission introuvable'
    );
  END IF;
  
  IF v_mission_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas modifier une mission qui ne vous appartient pas'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Mission appartient à l''entreprise (statut: %)', v_mission_statut;
  
  -- Vérification 3: Le technicien appartient bien à cette entreprise
  SELECT entreprise_id INTO v_technicien_entreprise_id
  FROM techniciens
  WHERE id = p_technicien_id;
  
  IF v_technicien_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Technicien introuvable'
    );
  END IF;
  
  IF v_technicien_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas assigner un technicien d''une autre entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Technicien appartient à l''entreprise';
  
  -- Vérification 4: Mission en statut compatible
  IF v_mission_statut NOT IN ('en_attente', 'planifiee') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''assigner un technicien à une mission en cours ou terminée'
    );
  END IF;
  
  -- Assignation
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    statut = CASE 
      WHEN statut = 'en_attente' THEN 'planifiee'
      ELSE statut 
    END,
    updated_at = NOW()
  WHERE id = p_mission_id;
  
  RAISE NOTICE '  ✅ Technicien assigné (statut changé en planifiee si nécessaire)';
  
  -- Historique (optionnel - si table historique_statuts existe)
  INSERT INTO historique_statuts (mission_id, ancien_statut, nouveau_statut, auteur, details)
  VALUES (
    p_mission_id,
    v_mission_statut,
    'planifiee',
    v_entreprise_id::text,
    'Technicien assigné'
  )
  ON CONFLICT DO NOTHING;
  
  -- Notification (optionnel - si table notifications existe)
  INSERT INTO notifications (
    type,
    titre,
    message,
    mission_id,
    ticket_id,
    user_id,
    created_at
  )
  VALUES (
    'technicien_assigne',
    'Technicien assigné',
    'Un technicien a été assigné à votre intervention',
    p_mission_id,
    v_ticket_id,
    (SELECT profile_id FROM techniciens WHERE id = p_technicien_id),
    NOW()
  )
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'technicien_id', p_technicien_id,
    'message', 'Technicien assigné avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erreur assign_technicien_to_mission: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- Permissions
-- =====================================================

-- Permettre aux entreprises d'appeler cette fonction
GRANT EXECUTE ON FUNCTION assign_technicien_to_mission TO authenticated;

-- =====================================================
-- TESTS DE VALIDATION
-- =====================================================

-- Test 1: Vérifier que la fonction existe
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'assign_technicien_to_mission';
-- Attendu: 1 ligne

-- Test 2: Appel en tant qu'entreprise (remplacer UUIDs)
-- SELECT assign_technicien_to_mission(
--   '<mission_id>',
--   '<technicien_id>'
-- );
-- Attendu: {"success": true, ...}

COMMENT ON FUNCTION assign_technicien_to_mission IS 
'Permet à une entreprise d''assigner un technicien à une mission. 
Vérifie que la mission et le technicien appartiennent bien à l''entreprise connectée.
Change automatiquement le statut de la mission en "planifiee".';
