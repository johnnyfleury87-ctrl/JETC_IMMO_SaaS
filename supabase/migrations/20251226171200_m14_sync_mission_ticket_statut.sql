-- ============================================================
-- MIGRATION M14 - Synchronisation mission → ticket statut
-- ============================================================
-- Date: 2025-12-26
-- Phase: 3 (Sécurisation & Cohérence workflow)
-- Objectif: Synchroniser automatiquement statut ticket quand mission change
-- Dépendances: PHASE 1 (table missions + RPC update_ticket_statut)
-- Rollback: 20251226171200_m14_sync_mission_ticket_statut_rollback.sql
-- ============================================================

-- Créer fonction trigger synchronisation mission → ticket
CREATE OR REPLACE FUNCTION sync_ticket_statut_from_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_ticket_statut ticket_status;
BEGIN
  -- Synchroniser uniquement si statut mission a changé
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    
    -- Déterminer nouveau statut ticket selon statut mission
    CASE NEW.statut
      -- Mission 'en_cours' → Ticket 'en_cours'
      WHEN 'en_cours' THEN
        v_new_ticket_statut := 'en_cours';
      
      -- Mission 'terminee' → Ticket 'termine'
      WHEN 'terminee' THEN
        v_new_ticket_statut := 'termine';
      
      -- Mission 'validee' → Ticket 'clos'
      WHEN 'validee' THEN
        v_new_ticket_statut := 'clos';
      
      -- Autres statuts mission : pas de synchronisation
      ELSE
        RETURN NEW;
    END CASE;
    
    -- Mettre à jour statut ticket (évite boucle infinie : pas de trigger sur UPDATE tickets.statut pour sync inverse)
    UPDATE tickets
    SET 
      statut = v_new_ticket_statut,
      updated_at = now()
    WHERE id = NEW.ticket_id
    AND statut != v_new_ticket_statut;  -- Update uniquement si changement nécessaire
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer trigger AFTER UPDATE sur missions.statut
DROP TRIGGER IF EXISTS trigger_sync_ticket_statut_from_mission ON missions;

CREATE TRIGGER trigger_sync_ticket_statut_from_mission
  AFTER UPDATE OF statut ON missions
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_statut_from_mission();

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier fonction créée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'sync_ticket_statut_from_mission';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier trigger créé
-- SELECT tgname, tgenabled FROM pg_trigger 
-- WHERE tgname = 'trigger_sync_ticket_statut_from_mission';
-- Attendu: 1 ligne avec tgenabled = 'O' (enabled)

-- VALIDATION 3: Test synchronisation mission 'en_cours' → ticket 'en_cours' (staging uniquement)
-- Pré-requis: Mission statut='acceptee', ticket statut='en_attente'
-- UPDATE missions SET statut = 'en_cours' WHERE id = '<mission_id>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut = 'en_cours' (synchronisé automatiquement)

-- VALIDATION 4: Test synchronisation mission 'terminee' → ticket 'termine' (staging uniquement)
-- Pré-requis: Mission statut='en_cours', ticket statut='en_cours'
-- UPDATE missions SET statut = 'terminee' WHERE id = '<mission_id>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut = 'termine' (synchronisé automatiquement)

-- VALIDATION 5: Test synchronisation mission 'validee' → ticket 'clos' (staging uniquement)
-- Pré-requis: Mission statut='terminee', ticket statut='termine'
-- UPDATE missions SET statut = 'validee' WHERE id = '<mission_id>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut = 'clos' (synchronisé automatiquement)

-- VALIDATION 6: Test pas de synchronisation statut mission non concerné (staging uniquement)
-- Pré-requis: Mission statut='acceptee', ticket statut='en_attente'
-- UPDATE missions SET statut = 'annulee' WHERE id = '<mission_id>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut = 'en_attente' (pas de changement, annulee non synchronisé)

-- VALIDATION 7: Test idempotence (pas de boucle) (staging uniquement)
-- Pré-requis: Mission statut='en_cours', ticket statut='en_cours' (déjà synchronisés)
-- UPDATE missions SET statut = 'en_cours' WHERE id = '<mission_id>'; (même statut)
-- Attendu: Aucune erreur, tickets.updated_at inchangé (condition AND statut != v_new_ticket_statut évite UPDATE inutile)

-- VALIDATION 8: Test via RPC accept_ticket_and_create_mission (staging API)
-- Pré-requis: Ticket statut='en_attente' en mode public
-- API call: POST /rpc/accept_ticket_and_create_mission
-- Body: {"p_ticket_id": "<uuid>", "p_montant_estime_chf": 200}
-- Headers: Authorization Bearer <jwt_entreprise>
-- Attendu: HTTP 200, mission créée statut='acceptee', ticket passe 'en_cours' (synchronisation trigger)

-- VALIDATION 9: Test transaction rollback (staging SQL - avancé)
-- Pré-requis: Mission avec ticket
-- BEGIN;
--   UPDATE missions SET statut = 'terminee' WHERE id = '<mission_id>';
--   -- Vérifier sync intermédiaire
--   SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
--   -- Attendu: 'termine'
-- ROLLBACK;
-- -- Vérifier rollback complet
-- SELECT statut FROM tickets WHERE id = (SELECT ticket_id FROM missions WHERE id = '<mission_id>');
-- Attendu: statut original (pas 'termine'), transaction rollback a annulé sync

-- VALIDATION 10: Test multiple missions sur même ticket (staging - cas limite)
-- Pré-requis: Ticket avec 2 missions (cas exceptionnel si workflow permet)
-- UPDATE missions SET statut = 'en_cours' WHERE id = '<mission_id_1>';
-- UPDATE missions SET statut = 'terminee' WHERE id = '<mission_id_2>';
-- VALIDATION: SELECT statut FROM tickets WHERE id = '<ticket_id>';
-- Attendu: statut = 'termine' (dernière mise à jour l'emporte)

-- ============================================================
-- FIN MIGRATION M14
-- ============================================================
