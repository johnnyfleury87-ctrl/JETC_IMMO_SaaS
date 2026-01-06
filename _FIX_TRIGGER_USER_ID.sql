-- =====================================================
-- FIX TRIGGER notify_technicien_assignment
-- =====================================================
-- Le trigger essaie de SELECT user_id depuis techniciens
-- mais la colonne s'appelle profile_id !
-- =====================================================

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions;
DROP FUNCTION IF EXISTS notify_technicien_assignment();

-- Recréer la fonction avec la bonne colonne
CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tech_profile_id uuid;  -- ✅ Renommé de user_id en profile_id
  v_mission_ref text;
  v_tech_nom text;
BEGIN
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    -- ✅ CORRECTION: Utiliser profile_id au lieu de user_id
    SELECT profile_id, nom INTO v_tech_profile_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_profile_id IS NOT NULL THEN
      v_mission_ref := COALESCE(NEW.id::text, 'N/A');
      
      -- Message système
      PERFORM create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      -- Notification pour le technicien
      INSERT INTO notifications (
        user_id,  -- ✅ Table notifications utilise user_id (correct)
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_tech_profile_id,  -- ✅ Utiliser profile_id récupéré
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

-- Recréer le trigger
CREATE TRIGGER technicien_assignment_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger notify_technicien_assignment recréé avec profile_id';
  
  -- Vérifier que le trigger existe
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'technicien_assignment_notification'
  ) THEN
    RAISE NOTICE '✅ Trigger existe dans pg_trigger';
  ELSE
    RAISE WARNING '⚠️  Trigger introuvable après création';
  END IF;
  
  -- Vérifier que la fonction existe
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_technicien_assignment'
  ) THEN
    RAISE NOTICE '✅ Fonction existe dans pg_proc';
  ELSE
    RAISE WARNING '⚠️  Fonction introuvable après création';
  END IF;
END $$;
