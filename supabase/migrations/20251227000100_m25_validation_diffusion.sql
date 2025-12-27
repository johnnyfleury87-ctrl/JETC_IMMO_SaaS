-- ============================================================
-- MIGRATION M25 - Validation priorité/plafond avant diffusion
-- ============================================================
-- Date: 2025-12-27
-- Phase: Sécurité métier
-- Objectif: Bloquer diffusion ticket si priorité OU plafond_intervention_chf NULL
-- Dépendances: M04 (RPC diffuser_ticket)
-- Règle métier: Priorité + plafond OBLIGATOIRES avant diffusion
-- Rollback: 20251227000100_m25_validation_diffusion_rollback.sql
-- ============================================================

-- Remplacer RPC diffuser_ticket avec validation priorité/plafond
CREATE OR REPLACE FUNCTION diffuser_ticket(
  p_ticket_id uuid,
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_statut_actuel ticket_status;
  v_regie_id uuid;
  v_priorite text;
  v_plafond numeric;
BEGIN
  -- Vérifier que l'utilisateur est bien associé à une régie
  SELECT get_user_regie_id() INTO v_regie_id;
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non associé à une régie';
  END IF;

  -- Récupérer statut actuel + priorité + plafond du ticket
  SELECT statut, priorite, plafond_intervention_chf 
  INTO v_statut_actuel, v_priorite, v_plafond
  FROM tickets 
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Ticket % non trouvé', p_ticket_id; 
  END IF;

  -- Vérifier que le ticket est au statut 'ouvert' (prêt à diffuser)
  IF v_statut_actuel != 'ouvert' THEN
    RAISE EXCEPTION 'Ticket doit être au statut ouvert pour diffusion (statut actuel: %)', v_statut_actuel;
  END IF;

  -- 🔴 NOUVELLE VALIDATION: Priorité obligatoire
  IF v_priorite IS NULL THEN
    RAISE EXCEPTION 'Priorité manquante: ticket doit avoir une priorité avant diffusion';
  END IF;

  -- 🔴 NOUVELLE VALIDATION: Plafond obligatoire
  IF v_plafond IS NULL THEN
    RAISE EXCEPTION 'Plafond intervention manquant: ticket doit avoir un plafond CHF avant diffusion';
  END IF;

  -- Validation mode diffusion
  IF p_mode_diffusion NOT IN ('public', 'assigné') THEN
    RAISE EXCEPTION 'Mode diffusion invalide: % (attendu: public ou assigné)', p_mode_diffusion;
  END IF;

  -- Si mode assigné, entreprise_id obligatoire
  IF p_mode_diffusion = 'assigné' AND p_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Mode assigné nécessite entreprise_id';
  END IF;

  -- Si mode public, entreprise_id doit être NULL
  IF p_mode_diffusion = 'public' AND p_entreprise_id IS NOT NULL THEN
    RAISE EXCEPTION 'Mode public ne peut pas avoir entreprise_id assignée';
  END IF;

  -- Si mode assigné, vérifier que l'entreprise est autorisée par cette régie
  IF p_mode_diffusion = 'assigné' THEN
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises 
      WHERE regie_id = v_regie_id 
      AND entreprise_id = p_entreprise_id
    ) THEN
      RAISE EXCEPTION 'Entreprise % non autorisée par régie %', p_entreprise_id, v_regie_id;
    END IF;
  END IF;

  -- Appliquer diffusion
  UPDATE tickets 
  SET mode_diffusion = p_mode_diffusion,
      entreprise_id = p_entreprise_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Changer statut ouvert → en_attente via RPC update_ticket_statut
  PERFORM update_ticket_statut(p_ticket_id, 'en_attente');
END;
$$;

-- Permissions déjà accordées M04 (pas de duplication)
-- GRANT EXECUTE ON FUNCTION diffuser_ticket(uuid, text, uuid) TO authenticated;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Test diffusion ticket AVEC priorité + plafond
-- Pré-requis: Ticket statut='ouvert', priorite='haute', plafond=2000
-- Query:
-- SELECT diffuser_ticket(
--   '<ticket_id_complet>'::uuid,
--   'public',
--   NULL
-- );
-- Attendu: SUCCESS, ticket passe en_attente

-- VALIDATION 2: Test diffusion ticket SANS priorité
-- Pré-requis: Ticket statut='ouvert', priorite=NULL, plafond=2000
-- Query:
-- SELECT diffuser_ticket(
--   '<ticket_id_sans_priorite>'::uuid,
--   'public',
--   NULL
-- );
-- Attendu: ERREUR "Priorité manquante: ticket doit avoir une priorité avant diffusion"

-- VALIDATION 3: Test diffusion ticket SANS plafond
-- Pré-requis: Ticket statut='ouvert', priorite='moyenne', plafond=NULL
-- Query:
-- SELECT diffuser_ticket(
--   '<ticket_id_sans_plafond>'::uuid,
--   'public',
--   NULL
-- );
-- Attendu: ERREUR "Plafond intervention manquant: ticket doit avoir un plafond CHF avant diffusion"

-- VALIDATION 4: Test diffusion ticket SANS priorité NI plafond
-- Pré-requis: Ticket statut='ouvert', priorite=NULL, plafond=NULL
-- Query:
-- SELECT diffuser_ticket(
--   '<ticket_id_incomplet>'::uuid,
--   'assigné',
--   '<entreprise_id>'::uuid
-- );
-- Attendu: ERREUR "Priorité manquante..." (priorité vérifiée AVANT plafond)

-- ============================================================
-- NOTES TECHNIQUE
-- ============================================================

-- 1. Ordre vérifications:
--    1. Utilisateur autorisé (régie_id)
--    2. Ticket existe
--    3. Statut = ouvert
--    4. ✅ Priorité NOT NULL (NOUVEAU)
--    5. ✅ Plafond NOT NULL (NOUVEAU)
--    6. Mode diffusion valide
--    7. Entreprise autorisée (si assigné)
--    8. UPDATE + transition statut

-- 2. Messages erreur explicites:
--    - Frontend peut afficher message utilisateur
--    - Distingue "priorité manquante" vs "plafond manquant"
--    - Permet correction ciblée avant retry

-- 3. Compatibilité:
--    - Signature fonction identique (pas de breaking change)
--    - Tests existants M04 DOIVENT être mis à jour
--    - Tickets historiques déjà diffusés non affectés

-- 4. Enforcement:
--    - Couche DB (pas frontend)
--    - Impossible contourner via API directe
--    - RAISE EXCEPTION bloque transaction

-- 5. Performance:
--    - +2 vérifications NULL (coût négligeable)
--    - Pas de JOIN supplémentaire
--    - SELECT déjà nécessaire pour statut

-- ============================================================
-- FIN MIGRATION M25
-- ============================================================
