-- ============================================================
-- MIGRATION M10 - Créer trigger validation 3 disponibilités
-- ============================================================
-- Date: 2025-12-26
-- Phase: 2 (Enrichissement fonctionnel)
-- Objectif: Empêcher diffusion ticket sans exactement 3 créneaux disponibilité
-- Dépendances: M09 (table tickets_disponibilites)
-- Rollback: 20251226170900_m10_create_trigger_validate_disponibilites_rollback.sql
-- ============================================================

-- Créer fonction trigger validation 3 disponibilités
CREATE OR REPLACE FUNCTION check_disponibilites_before_diffusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_disponibilites integer;
BEGIN
  -- Vérifier uniquement si transition vers statut 'en_attente' (diffusion)
  IF NEW.statut = 'en_attente' AND (OLD.statut IS NULL OR OLD.statut != 'en_attente') THEN
    
    -- Compter créneaux disponibilité existants
    SELECT COUNT(*) INTO v_count_disponibilites
    FROM tickets_disponibilites
    WHERE ticket_id = NEW.id;
    
    -- Vérifier exactement 3 créneaux
    IF v_count_disponibilites != 3 THEN
      RAISE EXCEPTION 'Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : %)', v_count_disponibilites;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer trigger BEFORE UPDATE sur tickets
DROP TRIGGER IF EXISTS trigger_check_disponibilites_before_diffusion ON tickets;

CREATE TRIGGER trigger_check_disponibilites_before_diffusion
  BEFORE UPDATE OF statut ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_disponibilites_before_diffusion();

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier fonction créée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'check_disponibilites_before_diffusion';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier trigger créé
-- SELECT tgname, tgenabled FROM pg_trigger 
-- WHERE tgname = 'trigger_check_disponibilites_before_diffusion';
-- Attendu: 1 ligne avec tgenabled = 'O' (enabled)

-- VALIDATION 3: Test diffusion avec 3 disponibilités (doit réussir - staging uniquement)
-- Pré-requis: Ticket statut='ouvert' avec 3 créneaux
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_id_test>';
-- Attendu: 1 row updated (succès)
-- CLEANUP: UPDATE tickets SET statut = 'ouvert' WHERE id = '<ticket_id_test>';

-- VALIDATION 4: Test diffusion SANS disponibilités (doit échouer - staging uniquement)
-- Pré-requis: Ticket statut='ouvert' SANS créneaux
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_id_test_no_dispo>';
-- Attendu: ERROR - Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : 0)

-- VALIDATION 5: Test diffusion avec seulement 1 disponibilité (doit échouer - staging uniquement)
-- Pré-requis: Ticket statut='ouvert' avec 1 seul créneau
-- UPDATE tickets SET statut = 'en_attente' WHERE id = '<ticket_id_test_1_dispo>';
-- Attendu: ERROR - Un ticket doit avoir exactement 3 disponibilités avant diffusion (actuellement : 1)

-- VALIDATION 6: Test transition autre que diffusion (ne doit PAS trigger - staging uniquement)
-- Pré-requis: Ticket statut='nouveau' SANS créneaux
-- UPDATE tickets SET statut = 'ouvert' WHERE id = '<ticket_id_test>';
-- Attendu: 1 row updated (trigger ne bloque pas, transition autorisée)

-- VALIDATION 7: Test RPC diffuser_ticket avec 3 disponibilités (staging via API)
-- Pré-requis: Ticket statut='ouvert' avec 3 créneaux valides
-- API call: POST /rpc/diffuser_ticket 
-- Body: {"p_ticket_id": "<uuid>", "p_mode_diffusion": "public"}
-- Attendu: HTTP 200, ticket passe 'en_attente' (trigger valide en silence)

-- VALIDATION 8: Test RPC diffuser_ticket SANS disponibilités (staging via API)
-- Pré-requis: Ticket statut='ouvert' SANS créneaux
-- API call: POST /rpc/diffuser_ticket 
-- Body: {"p_ticket_id": "<uuid>", "p_mode_diffusion": "public"}
-- Attendu: ERROR 500 avec message "exactement 3 disponibilités"

-- ============================================================
-- FIN MIGRATION M10
-- ============================================================
