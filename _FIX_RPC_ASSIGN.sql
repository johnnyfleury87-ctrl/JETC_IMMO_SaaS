-- =====================================================
-- RECRÉER LA RPC assign_technicien_to_mission
-- =====================================================
-- Forcer la recréation de la fonction pour s'assurer
-- qu'elle n'utilise pas user_id quelque part
-- =====================================================

-- Supprimer la fonction existante (toutes les signatures)
DROP FUNCTION IF EXISTS assign_technicien_to_mission(uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS assign_technicien_to_mission(uuid, uuid);

-- Recréer la fonction avec le code correct
CREATE OR REPLACE FUNCTION assign_technicien_to_mission(
  p_mission_id uuid,
  p_technicien_id uuid,
  p_date_intervention_prevue timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_entreprise_id uuid;
  v_technicien_entreprise_id uuid;
BEGIN
  -- 1. Vérifier que la mission existe et récupérer son entreprise
  SELECT entreprise_id INTO v_mission_entreprise_id
  FROM missions
  WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  -- 2. Vérifier que le technicien existe et récupérer son entreprise
  SELECT entreprise_id INTO v_technicien_entreprise_id
  FROM techniciens
  WHERE id = p_technicien_id
  AND actif = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Technicien non trouvé ou inactif'
    );
  END IF;
  
  -- 3. Vérifier que le technicien appartient à la même entreprise
  IF v_mission_entreprise_id != v_technicien_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le technicien n''appartient pas à l''entreprise de la mission'
    );
  END IF;
  
  -- 4. Assigner le technicien à la mission
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    date_intervention_prevue = COALESCE(p_date_intervention_prevue, date_intervention_prevue)
  WHERE id = p_mission_id;
  
  RETURN jsonb_build_object(
    'success', true
  );
END;
$$;

COMMENT ON FUNCTION assign_technicien_to_mission IS 'Assigne un technicien à une mission (vérifie qu''ils appartiennent à la même entreprise)';

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RPC assign_technicien_to_mission recréée';
  
  -- Vérifier que la fonction existe
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'assign_technicien_to_mission'
  ) THEN
    RAISE NOTICE '✅ Fonction existe dans pg_proc';
  ELSE
    RAISE EXCEPTION '❌ Fonction introuvable après création';
  END IF;
END $$;
