-- =====================================================
-- ROLLBACK M51: Supprimer RPC assign_technicien_to_mission
-- =====================================================

DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID);
