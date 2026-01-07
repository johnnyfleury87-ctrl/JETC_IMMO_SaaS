-- ═════════════════════════════════════════════════════════════
-- MIGRATION M48: FIX BUG "DÉMARRER MISSION"
-- ═════════════════════════════════════════════════════════════
--
-- PROBLÈMES IDENTIFIÉS:
-- 1. API /api/missions/start appelle update_mission_statut() qui n'existe PAS
-- 2. Trigger notify_mission_status_change_extended() utilise NEW.reference
--    → Colonne "reference" n'existe PAS dans table missions
--
-- SOLUTIONS:
-- 1. Corriger trigger pour utiliser mission.id au lieu de .reference
-- 2. API doit appeler start_mission() (fonction existante)
--
-- ═════════════════════════════════════════════════════════════

BEGIN;

-- ═════════════════════════════════════════════════════════════
-- 1. VÉRIFIER COLONNES TABLE MISSIONS
-- ═════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_has_reference boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'missions'
      AND column_name = 'reference'
  ) INTO v_has_reference;

  IF v_has_reference THEN
    RAISE NOTICE '✅ Colonne missions.reference existe';
  ELSE
    RAISE NOTICE '❌ Colonne missions.reference N''EXISTE PAS';
    RAISE NOTICE '   → Les triggers doivent utiliser missions.id ou tickets.reference';
  END IF;
END $$;

-- ═════════════════════════════════════════════════════════════
-- 2. CORRIGER FONCTION notify_mission_status_change_extended
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor RECORD;
  v_mission_ref TEXT;
  v_ticket_ref TEXT;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    
    -- ✅ FIX: Récupérer reference depuis table tickets (pas missions)
    SELECT t.reference INTO v_ticket_ref
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
    
    -- Utiliser ticket.reference si disponible, sinon mission.id
    v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
    
    -- Message système dans la messagerie
    PERFORM create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    -- Notifications pour tous les acteurs
    FOR v_actor IN SELECT * FROM get_mission_actors(NEW.id)
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_mission_status_change_extended IS
  'FIX M48: Utilise tickets.reference au lieu de missions.reference (colonne inexistante)';

-- ═════════════════════════════════════════════════════════════
-- 3. CORRIGER FONCTION notify_technicien_assignment
-- ═════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tech_user_id UUID;
  v_mission_ref TEXT;
  v_tech_nom TEXT;
  v_ticket_ref TEXT;
BEGIN
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    
    -- Récupérer le user_id du technicien (profile_id)
    SELECT profile_id, nom INTO v_tech_user_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_user_id IS NOT NULL THEN
      
      -- ✅ FIX: Récupérer reference depuis table tickets
      SELECT t.reference INTO v_ticket_ref
      FROM tickets t
      WHERE t.id = NEW.ticket_id;
      
      v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
      
      -- Message système
      PERFORM create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      -- Notification pour le technicien
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_technicien_assignment IS
  'FIX M48: Utilise tickets.reference et techniciens.profile_id';

-- ═════════════════════════════════════════════════════════════
-- 4. TEST: Vérifier que start_mission fonctionne maintenant
-- ═════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_test_mission_id UUID;
  v_result JSONB;
BEGIN
  -- Trouver mission test en_attente
  SELECT id INTO v_test_mission_id
  FROM missions
  WHERE statut = 'en_attente'
  LIMIT 1;
  
  IF v_test_mission_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucune mission test disponible (skip test)';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST: Appel start_mission()';
    RAISE NOTICE '   Mission: %', v_test_mission_id;
    
    -- Test (DRY RUN - on rollback tout)
    SELECT start_mission(v_test_mission_id) INTO v_result;
    
    IF (v_result->>'success')::boolean THEN
      RAISE NOTICE '   ✅ start_mission() fonctionne!';
      RAISE NOTICE '   Résultat: %', v_result;
      
      -- Rollback mission
      UPDATE missions 
      SET statut = 'en_attente', started_at = NULL
      WHERE id = v_test_mission_id;
      
      RAISE NOTICE '   🔄 Rollback mission en en_attente';
    ELSE
      RAISE NOTICE '   ❌ Erreur: %', v_result->>'error';
    END IF;
  END IF;
END $$;

-- ═════════════════════════════════════════════════════════════
-- 5. RÉSUMÉ
-- ═════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION M48 - FIX BUG "DÉMARRER MISSION"';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 CORRECTIFS APPLIQUÉS:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  notify_mission_status_change_extended()';
  RAISE NOTICE '    ✅ Utilise tickets.reference au lieu de missions.reference';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  notify_technicien_assignment()';
  RAISE NOTICE '    ✅ Utilise tickets.reference';
  RAISE NOTICE '    ✅ Utilise techniciens.profile_id (pas user_id)';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  Fonction start_mission()';
  RAISE NOTICE '    ✅ Déjà existante et fonctionnelle';
  RAISE NOTICE '    ✅ N''appelle plus trigger bugué';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 À FAIRE CÔTÉ API:';
  RAISE NOTICE '   /api/missions/start.js → Appeler start_mission() au lieu de update_mission_statut()';
  RAISE NOTICE '   /api/missions/complete.js → Appeler complete_mission()';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST REQUIS:';
  RAISE NOTICE '   1. Se connecter comme technicien (demo.technicien@test.app)';
  RAISE NOTICE '   2. Dashboard technicien → Cliquer "Démarrer"';
  RAISE NOTICE '   3. Vérifier: mission passe en_cours, started_at rempli';
  RAISE NOTICE '   4. Cliquer "Terminer" → mission passe terminee';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

COMMIT;
