-- =====================================================
-- APPLICATION IMMÉDIATE EN PROD - VERSION MINIMALE
-- =====================================================
-- Fix bug: column "user_id" does not exist
-- Fonction: notify_technicien_assignment
-- VERSION SIMPLIFIÉE: Juste l'assignation, SANS notification
-- =====================================================

DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne fait rien, juste pour que le trigger ne casse pas
  -- L'assignation technicien fonctionne via UPDATE direct
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;

CREATE TRIGGER technicien_assignment_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();
