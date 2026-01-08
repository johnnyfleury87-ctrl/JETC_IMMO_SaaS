-- =====================================================
-- FIX FINAL - DÉSACTIVER TOUT CE QUI CASSE
-- =====================================================
-- Supprime tous les triggers et fonctions problématiques
-- L'assignation fonctionnera via UPDATE direct
-- =====================================================

-- 1. SUPPRIMER LE TRIGGER notify_technicien_assignment
DROP TRIGGER IF EXISTS technicien_assignment_notification ON missions CASCADE;
DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions CASCADE;
DROP FUNCTION IF EXISTS notify_technicien_assignment() CASCADE;

-- 2. SUPPRIMER LA RPC assign_technicien_to_mission (elle a des bugs)
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID) CASCADE;

-- 3. L'assignation se fera via un simple UPDATE depuis le frontend
-- UPDATE missions SET technicien_id = '<technicien_id>' WHERE id = '<mission_id>'

-- Fin - Plus rien ne peut casser maintenant
