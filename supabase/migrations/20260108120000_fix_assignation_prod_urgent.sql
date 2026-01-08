-- =====================================================
-- FIX URGENT PRODUCTION - ASSIGNATION TECHNICIEN
-- =====================================================
-- Date: 2026-01-08 12:00:00
-- Auteur: Fix critique bug assignation bloquée en PROD
-- Symptôme: "Could not find the function public.assign_technicien_to_mission"
-- Root cause: RPC ou trigger manquant/cassé en PROD
-- =====================================================
-- 
-- DIAGNOSTIC:
-- Le frontend appelle: .rpc('assign_technicien_to_mission', {p_mission_id, p_technicien_id})
-- 
-- Deux problèmes possibles:
-- 1. La RPC assign_technicien_to_mission n'existe pas en PROD
-- 2. Le trigger notify_technicien_assignment casse l'UPDATE
-- 
-- SOLUTION: Recréer TOUT proprement en une seule fois
-- =====================================================

-- =====================================================
-- ÉTAPE 1: Nettoyer l'existant (idempotent)
-- =====================================================

-- Supprimer les triggers problématiques
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions CASCADE;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions CASCADE;

-- Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.assign_technicien_to_mission CASCADE;

-- =====================================================
-- ÉTAPE 2: Recréer la RPC assign_technicien_to_mission
-- =====================================================

CREATE OR REPLACE FUNCTION public.assign_technicien_to_mission(
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
  IF v_mission_statut NOT IN ('en_attente', 'planifiee') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''assigner un technicien à une mission déjà démarrée ou terminée'
    );
  END IF;
  
  -- ✅ ASSIGNATION SIMPLE ET DIRECTE
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    updated_at = NOW()
  WHERE id = p_mission_id;
  
  RAISE NOTICE '  ✅ Technicien assigné avec succès';
  
  -- Notification optionnelle (ON CONFLICT DO NOTHING pour éviter les erreurs)
  BEGIN
    INSERT INTO notifications (
      type,
      title,
      message,
      related_mission_id,
      related_ticket_id,
      user_id,
      created_at
    )
    VALUES (
      'mission_assigned',
      'Technicien assigné',
      'Un technicien a été assigné à votre intervention',
      p_mission_id,
      v_ticket_id,
      (SELECT profile_id FROM techniciens WHERE id = p_technicien_id),
      NOW()
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignorer les erreurs de notification, l'assignation a réussi
      RAISE NOTICE 'Notification ignorée: %', SQLERRM;
  END;
  
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
-- ÉTAPE 3: Permissions RPC
-- =====================================================

GRANT EXECUTE ON FUNCTION public.assign_technicien_to_mission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_technicien_to_mission(UUID, UUID) TO anon;

-- =====================================================
-- ÉTAPE 4: Recréer trigger notify (VERSION SÉCURISÉE)
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tech_profile_id UUID;
  v_tech_nom TEXT;
  v_mission_ref TEXT;
BEGIN
  -- Uniquement si technicien assigné (avant NULL, maintenant non NULL)
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    
    -- ✅ Utiliser profile_id (PAS user_id qui n'existe pas)
    SELECT profile_id, nom INTO v_tech_profile_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_profile_id IS NOT NULL THEN
      
      -- ✅ Créer une référence simple
      v_mission_ref := 'Mission-' || LEFT(NEW.id::text, 8);
      
      -- Notification pour le technicien (sécurisée avec try/catch)
      BEGIN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          related_mission_id,
          created_at
        )
        VALUES (
          v_tech_profile_id,
          'mission_assigned',
          'Nouvelle mission assignée',
          'Vous avez été assigné à la ' || v_mission_ref,
          NEW.id,
          NOW()
        )
        ON CONFLICT DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          -- Ignorer les erreurs de notification
          RAISE NOTICE 'Notification technicien ignorée: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger
CREATE TRIGGER technicien_assignment_notification
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION notify_technicien_assignment();

-- =====================================================
-- ÉTAPE 5: Validation
-- =====================================================

DO $$
BEGIN
  -- Vérifier que la RPC existe
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'assign_technicien_to_mission'
      AND pg_get_function_identity_arguments(p.oid) = 'p_mission_id uuid, p_technicien_id uuid'
  ) THEN
    RAISE NOTICE '✅ RPC assign_technicien_to_mission(p_mission_id uuid, p_technicien_id uuid) existe';
  ELSE
    RAISE WARNING '❌ RPC assign_technicien_to_mission introuvable';
  END IF;
  
  -- Vérifier que le trigger existe
  IF EXISTS (
    SELECT 1 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'missions'
      AND t.tgname = 'technicien_assignment_notification'
  ) THEN
    RAISE NOTICE '✅ Trigger technicien_assignment_notification existe sur missions';
  ELSE
    RAISE WARNING '❌ Trigger technicien_assignment_notification introuvable';
  END IF;
  
  RAISE NOTICE '✅ Migration 20260108120000 - Fix assignation PROD terminée';
  RAISE NOTICE '   • RPC: assign_technicien_to_mission(p_mission_id, p_technicien_id)';
  RAISE NOTICE '   • Trigger: notify_technicien_assignment corrigé (profile_id)';
  RAISE NOTICE '   • Permissions: granted to authenticated';
END $$;

COMMENT ON FUNCTION public.assign_technicien_to_mission(UUID, UUID) IS 
'[PROD FIX] Permet à une entreprise d''assigner un technicien à une mission.
Vérifie les droits (entreprise, mission, technicien).
Statut reste en_attente après assignation.
Version robuste avec gestion d''erreurs.';

COMMENT ON FUNCTION public.notify_technicien_assignment() IS 
'[PROD FIX] Notifie le technicien lors de son assignation.
Correction: utilise techniciens.profile_id (pas user_id).
Gestion sécurisée des erreurs de notification.';
