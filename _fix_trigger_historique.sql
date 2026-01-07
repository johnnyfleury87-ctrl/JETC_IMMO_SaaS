-- =====================================================
-- CORRECTIF : Trigger log_mission_statut_change FK violation
-- =====================================================
-- Problème : Le trigger log_mission_statut_change() utilise
--            COALESCE(auth.uid(), '00000000-...') qui viole la FK
--            vers users quand auth.uid() est NULL
-- Solution : 
--   1. Rendre change_par nullable
--   2. Supprimer le fallback UUID fake dans le trigger
-- =====================================================

-- ÉTAPE 1 : Rendre la colonne change_par nullable
-- =====================================================

ALTER TABLE mission_historique_statuts 
ALTER COLUMN change_par DROP NOT NULL;

COMMENT ON COLUMN mission_historique_statuts.change_par IS 
'ID de l''utilisateur qui a effectué le changement (NULL si système/service_role)';

-- =====================================================
-- ÉTAPE 2 : Corriger la fonction trigger
-- =====================================================

CREATE OR REPLACE FUNCTION log_mission_statut_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insérer dans l'historique uniquement si le statut change
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
      auth.uid(),  -- NULL si pas de contexte JWT (au lieu d'un UUID fake)
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION log_mission_statut_change IS 
'Trigger : enregistre l''historique des changements de statut mission (change_par peut être NULL)';

-- =====================================================
-- ÉTAPE 3 : Vérifier que le trigger est bien attaché
-- =====================================================

-- Si le trigger n'existe pas, le créer
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
