-- =====================================================
-- AMÉLIORATION RPC: assign_technicien_to_mission
-- =====================================================
-- Ajoute des logs et validations strictes
-- =====================================================

CREATE OR REPLACE FUNCTION assign_technicien_to_mission(
  p_mission_id uuid,
  p_technicien_id uuid,
  p_date_intervention_prevue timestamptz default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_entreprise_id uuid;
  v_technicien_entreprise_id uuid;
  v_technicien_profile_id uuid;
  v_technicien_email text;
BEGIN
  -- LOG: Début assignation
  RAISE NOTICE '[ASSIGN] mission_id=%, technicien_id=%', p_mission_id, p_technicien_id;
  
  -- 1. Vérifier que la mission existe et récupérer son entreprise
  SELECT entreprise_id INTO v_mission_entreprise_id
  FROM missions
  WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[ASSIGN] ❌ Mission introuvable: %', p_mission_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  RAISE NOTICE '[ASSIGN] Mission entreprise_id=%', v_mission_entreprise_id;
  
  -- 2. Vérifier que le technicien existe et récupérer ses infos
  SELECT 
    entreprise_id,
    profile_id,
    email
  INTO 
    v_technicien_entreprise_id,
    v_technicien_profile_id,
    v_technicien_email
  FROM techniciens
  WHERE id = p_technicien_id
    AND actif = true;
  
  IF NOT FOUND THEN
    RAISE WARNING '[ASSIGN] ❌ Technicien introuvable ou inactif: %', p_technicien_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Technicien non trouvé ou inactif',
      'debug', jsonb_build_object(
        'technicien_id', p_technicien_id,
        'hint', 'Vérifier que techniciens.id existe et actif = true'
      )
    );
  END IF;
  
  RAISE NOTICE '[ASSIGN] Technicien: email=%, entreprise_id=%, profile_id=%',
    v_technicien_email, v_technicien_entreprise_id, v_technicien_profile_id;
  
  -- 3. ✅ VALIDATION STRICTE: technicien.id DOIT égaler profile_id
  IF p_technicien_id <> v_technicien_profile_id THEN
    RAISE WARNING '[ASSIGN] ❌ INCOHÉRENCE DÉTECTÉE: technicien.id (%) ≠ profile_id (%)',
      p_technicien_id, v_technicien_profile_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Incohérence données technicien (id ≠ profile_id)',
      'debug', jsonb_build_object(
        'technicien_id', p_technicien_id,
        'profile_id', v_technicien_profile_id,
        'action', 'Exécuter migration de correction'
      )
    );
  END IF;
  
  -- 4. Vérifier que le technicien appartient à la même entreprise
  IF v_mission_entreprise_id <> v_technicien_entreprise_id THEN
    RAISE WARNING '[ASSIGN] ❌ Entreprises différentes: mission=%, technicien=%',
      v_mission_entreprise_id, v_technicien_entreprise_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le technicien n''appartient pas à l''entreprise de la mission'
    );
  END IF;
  
  -- 5. Assigner le technicien à la mission
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    date_intervention_prevue = COALESCE(p_date_intervention_prevue, date_intervention_prevue),
    updated_at = now()
  WHERE id = p_mission_id;
  
  RAISE NOTICE '[ASSIGN] ✅ SUCCESS: Mission % assignée à %', p_mission_id, v_technicien_email;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'technicien', jsonb_build_object(
      'id', p_technicien_id,
      'email', v_technicien_email
    )
  );
END;
$$;

COMMENT ON FUNCTION assign_technicien_to_mission IS 
  'Assigne un technicien à une mission avec validations strictes (entreprise + cohérence id/profile_id)';

-- ✅ TEST
DO $$
BEGIN
  RAISE NOTICE '✅ RPC assign_technicien_to_mission amélioré avec logs et validations';
END $$;
