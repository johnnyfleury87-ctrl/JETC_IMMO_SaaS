-- =====================================================
-- 🚀 DÉPLOIEMENT FINAL - CONTRAINTES & PROTECTIONS
-- =====================================================
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- ═══════════════════════════════════════════════════
-- ÉTAPE 1: VÉRIFIER ÉTAT ACTUEL
-- ═══════════════════════════════════════════════════

-- Vérifier techniciens cohérents
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE id = profile_id) as coherents,
  COUNT(*) FILTER (WHERE id <> profile_id) as incoherents
FROM techniciens;

-- Résultat attendu: total=3, coherents=3, incoherents=0

-- ═══════════════════════════════════════════════════
-- ÉTAPE 2: AJOUTER CONTRAINTE CHECK (id = profile_id)
-- ═══════════════════════════════════════════════════

-- Supprimer si existe (idempotent)
ALTER TABLE techniciens 
  DROP CONSTRAINT IF EXISTS techniciens_id_equals_profile_id;

-- Ajouter contrainte stricte
ALTER TABLE techniciens 
  ADD CONSTRAINT techniciens_id_equals_profile_id
  CHECK (id = profile_id);

-- ✅ Message attendu: ALTER TABLE

-- Test: tenter de violer la contrainte (devrait échouer)
-- DO $$
-- BEGIN
--   INSERT INTO techniciens (id, profile_id, entreprise_id, nom, prenom, email, actif)
--   VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     '00000000-0000-0000-0000-000000000002',  -- Différent de id
--     (SELECT id FROM entreprises LIMIT 1),
--     'Test', 'Test', 'test@test.com', true
--   );
-- EXCEPTION
--   WHEN check_violation THEN
--     RAISE NOTICE '✅ Contrainte CHECK fonctionne: insertion bloquée';
-- END $$;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 3: VÉRIFIER FK missions → techniciens
-- ═══════════════════════════════════════════════════

-- Lister les FK existantes
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'missions'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'technicien_id';

-- Résultat attendu:
-- missions | missions_technicien_id_fkey | technicien_id | techniciens | id

-- Si FK absente, l'ajouter:
-- ALTER TABLE missions 
--   ADD CONSTRAINT missions_technicien_id_fkey
--   FOREIGN KEY (technicien_id)
--   REFERENCES techniciens(id)
--   ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 4: DÉPLOYER RPC AMÉLIORÉ
-- ═══════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════
-- ÉTAPE 5: VÉRIFICATION FINALE
-- ═══════════════════════════════════════════════════

-- Test contrainte CHECK
DO $$
DECLARE
  v_error_detected boolean := false;
BEGIN
  -- Tenter une insertion invalide
  BEGIN
    INSERT INTO techniciens (
      id, 
      profile_id, 
      entreprise_id, 
      nom, prenom, email, actif
    )
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',  -- ≠ id
      (SELECT id FROM entreprises LIMIT 1),
      'Test', 'Violation', 'test@violation.com', true
    );
  EXCEPTION
    WHEN check_violation THEN
      v_error_detected := true;
      RAISE NOTICE '✅ Contrainte CHECK bloque bien les insertions invalides';
  END;
  
  IF NOT v_error_detected THEN
    RAISE WARNING '⚠️ Contrainte CHECK non appliquée !';
  END IF;
END $$;

-- Test RPC
DO $$
DECLARE
  v_result jsonb;
  v_mission_id uuid;
  v_technicien_id uuid;
BEGIN
  -- Récupérer une mission et un technicien
  SELECT id INTO v_mission_id FROM missions LIMIT 1;
  SELECT id INTO v_technicien_id FROM techniciens WHERE actif = true LIMIT 1;
  
  IF v_mission_id IS NOT NULL AND v_technicien_id IS NOT NULL THEN
    -- Tester assignation
    v_result := assign_technicien_to_mission(v_mission_id, v_technicien_id);
    
    IF v_result->>'success' = 'true' THEN
      RAISE NOTICE '✅ RPC assign_technicien_to_mission fonctionne';
    ELSE
      RAISE WARNING '⚠️ RPC a échoué: %', v_result->>'error';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ Pas de mission/technicien pour tester RPC';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- ✅ RÉSUMÉ DÉPLOIEMENT
-- ═══════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DÉPLOIEMENT TERMINÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Actions réalisées:';
  RAISE NOTICE '  ✓ Contrainte CHECK: techniciens.id = profile_id';
  RAISE NOTICE '  ✓ RPC assign_technicien_to_mission amélioré';
  RAISE NOTICE '  ✓ Validations strictes activées';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Résultat:';
  RAISE NOTICE '  ✓ Impossible de créer technicien avec id ≠ profile_id';
  RAISE NOTICE '  ✓ Impossible d''assigner mission à technicien invalide';
  RAISE NOTICE '  ✓ Logs détaillés pour debug';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Tests à faire:';
  RAISE NOTICE '  1. Créer un nouveau technicien via UI entreprise';
  RAISE NOTICE '  2. Assigner une mission à ce technicien';
  RAISE NOTICE '  3. Login avec le compte technicien';
  RAISE NOTICE '  4. Vérifier que la mission est visible';
  RAISE NOTICE '';
END $$;
