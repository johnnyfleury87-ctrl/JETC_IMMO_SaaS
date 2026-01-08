-- =====================================================
-- MIGRATION M53: Fix notify_technicien_assignment - Erreur user_id
-- =====================================================
-- Date: 2026-01-08
-- Auteur: Fix bug bloquant PROD assignation technicien
-- Objectif: Corriger fonction trigger notify_technicien_assignment
-- Bug résolu: column "user_id" does not exist
-- Root cause: La fonction trigger utilise techniciens.user_id et missions.reference qui n'existent pas
-- =====================================================

-- DIAGNOSTIC DU BUG EN PROD:
-- 
-- Triggers impactés:
--   - technicien_assignment_notification (sur missions)
--   - trigger_mission_technicien_assignment (sur missions)
-- 
-- Fonction appelée: public.notify_technicien_assignment (OID 41819)
-- 
-- ERREURS DANS LA FONCTION ACTUELLE:
--   1. Ligne 372: SELECT user_id FROM techniciens
--      ❌ La colonne user_id n'existe pas, c'est profile_id
--   
--   2. Ligne 378: v_mission_ref := NEW.reference
--      ❌ La table missions n'a pas de colonne reference
--      ✅ Doit récupérer tickets.reference via NEW.ticket_id
-- 
-- IMPACT:
--   - Assignation technicien depuis dashboard entreprise → ❌ BLOQUÉ
--   - Erreur: column "user_id" does not exist

-- =====================================================
-- CORRECTION: Recréer notify_technicien_assignment
-- =====================================================

DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tech_user_id UUID;
  v_mission_ref TEXT;
  v_tech_nom TEXT;
BEGIN
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    
    -- ✅ FIX 1: Utiliser profile_id (PAS user_id)
    SELECT profile_id, nom INTO v_tech_user_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_user_id IS NOT NULL THEN
      
      -- ✅ FIX 2: Utiliser l'ID de la mission comme référence
      v_mission_ref := 'Mission ' || LEFT(NEW.id::text, 8);
      
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

-- =====================================================
-- Recréer les triggers
-- =====================================================

-- Supprimer les anciens triggers (au cas où)
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;

-- Recréer le trigger principal
CREATE TRIGGER technicien_assignment_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();

-- =====================================================
-- Permissions
-- =====================================================

-- La fonction est SECURITY DEFINER donc elle s'exécute avec les privilèges du créateur

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ M53: notify_technicien_assignment corrigée';
  RAISE NOTICE '   FIX 1: techniciens.user_id → techniciens.profile_id';
  RAISE NOTICE '   FIX 2: missions.reference → tickets.reference (via JOIN)';
  RAISE NOTICE '   Trigger: technicien_assignment_notification recréé';
  
  -- Vérifier que la fonction existe
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_technicien_assignment'
  ) THEN
    RAISE NOTICE '   ✅ Fonction notify_technicien_assignment existe';
  ELSE
    RAISE WARNING '   ❌ Fonction notify_technicien_assignment introuvable';
  END IF;
  
  -- Vérifier que le trigger existe
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'missions'
      AND t.tgname = 'technicien_assignment_notification'
  ) THEN
    RAISE NOTICE '   ✅ Trigger technicien_assignment_notification existe sur missions';
  ELSE
    RAISE WARNING '   ❌ Trigger technicien_assignment_notification introuvable';
  END IF;
END $$;

COMMENT ON FUNCTION notify_technicien_assignment IS 
'[M53 - FIXED] Notifie le technicien lors de son assignation à une mission.
FIX: Utilise techniciens.profile_id au lieu de user_id inexistant.
FIX: Récupère tickets.reference au lieu de missions.reference inexistant.
Se déclenche via trigger AFTER UPDATE sur missions.';

-- =====================================================
-- TESTS DE VALIDATION EN PROD
-- =====================================================

-- Test 1: Vérifier la définition de la fonction
-- SELECT pg_get_functiondef('public.notify_technicien_assignment'::regprocedure);
-- Attendu: Doit contenir "profile_id" et "tickets.reference"
-- Ne doit PAS contenir "user_id" ni "missions.reference"

-- Test 2: Tester l'assignation
-- 1. Se connecter en tant qu'entreprise
-- 2. Ouvrir une mission en statut "en_attente"
-- 3. Assigner un technicien
-- Attendu: ✅ Succès sans erreur

-- Test 3: Vérifier la notification créée
-- SELECT * FROM notifications 
-- WHERE type = 'mission_assigned' 
-- ORDER BY created_at DESC 
-- LIMIT 1;
-- Attendu: Une notification avec le bon user_id (profile_id du technicien)
