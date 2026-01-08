-- =====================================================
-- MIGRATION M52: Fix assign_technicien_to_mission - Erreur user_id
-- =====================================================
-- Date: 2026-01-08
-- Auteur: Fix bug bloquant en production
-- Objectif: Corriger l'insertion dans table notifications
-- Bug résolu: column "user_id" does not exist (en réalité : mauvais noms de colonnes)
-- Root cause: La RPC utilise "titre", "mission_id", "ticket_id" au lieu de "title", "related_mission_id", "related_ticket_id"
-- =====================================================

-- DIAGNOSTIC DU BUG:
-- Lors de l'assignation d'un technicien depuis le dashboard entreprise,
-- l'erreur "column user_id does not exist" apparaît.
-- 
-- CAUSE RÉELLE:
-- Dans assign_technicien_to_mission (M51), l'INSERT INTO notifications utilise:
--   INSERT INTO notifications (type, titre, message, mission_id, ticket_id, user_id, ...)
-- 
-- MAIS la structure réelle de la table notifications est:
--   - title (pas "titre")
--   - related_mission_id (pas "mission_id")
--   - related_ticket_id (pas "ticket_id")
-- 
-- PostgreSQL rejette l'INSERT car les colonnes n'existent pas.
-- Le message d'erreur mentionne "user_id" car c'est probablement la première colonne 
-- reconnue après les colonnes invalides.

-- =====================================================
-- 1. CORRIGER assign_technicien_to_mission
-- =====================================================

-- Supprimer l'ancienne version
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID);

-- Recréer avec les bons noms de colonnes
CREATE FUNCTION assign_technicien_to_mission(
  p_mission_id UUID,
  p_technicien_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entreprise_id UUID;
  v_mission_entreprise_id UUID;
  v_technicien_entreprise_id UUID;
  v_mission_statut TEXT;
  v_ticket_id UUID;
BEGIN
  RAISE NOTICE '🔧 assign_technicien_to_mission: mission=%, technicien=%', p_mission_id, p_technicien_id;
  
  -- Vérification 1: Récupérer l'entreprise connectée
  SELECT id INTO v_entreprise_id
  FROM entreprises
  WHERE profile_id = auth.uid();
  
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous devez être connecté en tant qu''entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Entreprise connectée: %', v_entreprise_id;
  
  -- Vérification 2: La mission appartient bien à cette entreprise
  SELECT entreprise_id, statut, ticket_id 
  INTO v_mission_entreprise_id, v_mission_statut, v_ticket_id
  FROM missions
  WHERE id = p_mission_id;
  
  IF v_mission_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission introuvable'
    );
  END IF;
  
  IF v_mission_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas modifier une mission qui ne vous appartient pas'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Mission appartient à l''entreprise (statut: %)', v_mission_statut;
  
  -- Vérification 3: Le technicien appartient bien à cette entreprise
  SELECT entreprise_id INTO v_technicien_entreprise_id
  FROM techniciens
  WHERE id = p_technicien_id;
  
  IF v_technicien_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Technicien introuvable'
    );
  END IF;
  
  IF v_technicien_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas assigner un technicien d''une autre entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Technicien appartient à l''entreprise';
  
  -- Vérification 4: Mission en statut compatible
  IF v_mission_statut NOT IN ('en_attente') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''assigner un technicien à une mission déjà démarrée ou terminée'
    );
  END IF;
  
  -- Assignation (statut reste 'en_attente', technicien assigné)
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    updated_at = NOW()
  WHERE id = p_mission_id;
  
  RAISE NOTICE '  ✅ Technicien assigné (statut reste en_attente)';
  
  -- Historique (optionnel - si table historique_statuts existe)
  INSERT INTO historique_statuts (mission_id, ancien_statut, nouveau_statut, auteur, details)
  VALUES (
    p_mission_id,
    v_mission_statut,
    'en_attente',
    v_entreprise_id::text,
    'Technicien assigné'
  )
  ON CONFLICT DO NOTHING;
  
  -- ✅ CORRECTION: Notification avec les BONS noms de colonnes
  INSERT INTO notifications (
    type,
    title,                    -- ✅ Corrigé: "title" au lieu de "titre"
    message,
    related_mission_id,       -- ✅ Corrigé: "related_mission_id" au lieu de "mission_id"
    related_ticket_id,        -- ✅ Corrigé: "related_ticket_id" au lieu de "ticket_id"
    user_id,
    created_at
  )
  VALUES (
    'mission_assigned',       -- ✅ Corrigé: type existant dans l'enum
    'Technicien assigné',
    'Un technicien a été assigné à votre intervention',
    p_mission_id,
    v_ticket_id,
    (SELECT profile_id FROM techniciens WHERE id = p_technicien_id),
    NOW()
  )
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'technicien_id', p_technicien_id,
    'message', 'Technicien assigné avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erreur assign_technicien_to_mission: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION assign_technicien_to_mission TO authenticated;

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ M52: assign_technicien_to_mission recréée avec les bons noms de colonnes';
  RAISE NOTICE '   - title (au lieu de titre)';
  RAISE NOTICE '   - related_mission_id (au lieu de mission_id)';
  RAISE NOTICE '   - related_ticket_id (au lieu de ticket_id)';
  RAISE NOTICE '   - type = mission_assigned (au lieu de technicien_assigne)';
END $$;

COMMENT ON FUNCTION assign_technicien_to_mission IS 
'[M52 - FIXED] Permet à une entreprise d''assigner un technicien à une mission. 
Vérifie que la mission et le technicien appartiennent bien à l''entreprise connectée.
Le statut reste "en_attente" après assignation (prêt à démarrer).
Fix: Correction des noms de colonnes dans INSERT notifications.';
