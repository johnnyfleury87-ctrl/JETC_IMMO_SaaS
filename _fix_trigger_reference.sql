-- =====================================================
-- CORRECTIF COMPLET : Triggers défectueux sur table missions
-- =====================================================
-- Problème 1 : notify_mission_status_change_extended() et notify_technicien_assignment()
--              tentent d'accéder à NEW.reference (colonne inexistante)
-- Problème 2 : log_mission_statut_change() utilise COALESCE(auth.uid(), '0000...')
--              qui viole la FK vers users quand auth.uid() est NULL
-- Solution :
--   1. Remplacer NEW.reference par génération dynamique de référence
--   2. Rendre mission_historique_statuts.change_par nullable
--   3. Supprimer le fallback UUID fake dans log_mission_statut_change()
-- =====================================================

-- =====================================================
-- PARTIE 1 : Corriger trigger historique (PRIORITAIRE)
-- =====================================================

-- 1.1 : Rendre change_par nullable
ALTER TABLE mission_historique_statuts 
ALTER COLUMN change_par DROP NOT NULL;

COMMENT ON COLUMN mission_historique_statuts.change_par IS 
'ID utilisateur qui a effectué le changement (NULL si système/service_role)';

-- 1.2 : Corriger la fonction log_mission_statut_change
CREATE OR REPLACE FUNCTION log_mission_statut_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    INSERT INTO mission_historique_statuts (
      mission_id,
      ancien_statut,
      nouveau_statut,
      change_par,
      created_at
    )
    VALUES (
      NEW.id,
      OLD.statut,
      NEW.statut,
      auth.uid(),  -- NULL si pas de contexte JWT
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- PARTIE 2 : Corriger triggers notifications
-- =====================================================

-- 2.0 : DROP les triggers existants AVANT de les recréer
DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;

-- 2.1 : Corriger notify_mission_status_change_extended
-- =====================================================

CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
returns trigger
language plpgsql
as $$
declare
  v_actor record;
  v_mission_ref text;
begin
  if OLD.statut is distinct from NEW.statut then
    -- Utiliser l'ID comme référence (premiers 8 caractères)
    v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
    
    -- Message système dans la messagerie
    perform create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    -- Notifications pour tous les acteurs
    for v_actor in select * from get_mission_actors(NEW.id)
    loop
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    end loop;
  end if;
  
  return NEW;
end;
$$;

comment on function notify_mission_status_change_extended is 'Trigger : notifications lors du changement de statut mission';

-- Recréer le trigger
CREATE TRIGGER mission_status_change_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_mission_status_change_extended();

-- =====================================================
-- 2.2 : Corriger notify_technicien_assignment
-- =====================================================

CREATE OR REPLACE FUNCTION notify_technicien_assignment()
returns trigger
language plpgsql
as $$
declare
  v_tech_user_id uuid;
  v_mission_ref text;
  v_tech_nom text;
begin
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  if OLD.technicien_id is null and NEW.technicien_id is not null then
    -- Récupérer le user_id du technicien
    select user_id, nom into v_tech_user_id, v_tech_nom
    from techniciens
    where id = NEW.technicien_id;
    
    if v_tech_user_id is not null then
      -- Utiliser l'ID comme référence
      v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
      
      -- Message système
      perform create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      -- Notification pour le technicien
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    end if;
  end if;
  
  return NEW;
end;
$$;

comment on function notify_technicien_assignment is 'Trigger : notification lors de l''assignation d''un technicien';

-- Recréer le trigger
CREATE TRIGGER trigger_mission_technicien_assignment
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

-- Vérifier que le trigger log_mission_statut_change est bien attaché
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_log_mission_statut_change'
  ) THEN
    CREATE TRIGGER trigger_log_mission_statut_change
      AFTER UPDATE ON missions
      FOR EACH ROW
      EXECUTE FUNCTION log_mission_statut_change();
  END IF;
END $$;

-- =====================================================
-- RÉSUMÉ DES CORRECTIFS
-- =====================================================
-- ✅ mission_historique_statuts.change_par → NULLABLE
-- ✅ log_mission_statut_change() → Supprimé fallback UUID fake
-- ✅ notify_mission_status_change_extended() → Utilise ID comme référence
-- ✅ notify_technicien_assignment() → Utilise ID comme référence
-- ✅ Tous les triggers recréés
-- 
-- TEST : node _test_apres_correctif.js
-- =====================================================
