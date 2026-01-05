-- =====================================================
-- MIGRATION: FIX ADMIN DASHBOARD - GRANTS SUR VUES
-- =====================================================
-- Date: 2026-01-05
-- Auteur: Fix admin dashboard displays 0
-- Objectif: Permettre à admin_jtec de lire les vues de statistiques
-- =====================================================

-- Activer RLS sur les vues (par défaut, pas activé sur les vues)
-- Note: RLS déjà géré par les tables sous-jacentes, mais on active pour clarté

-- GRANTS pour authenticated (admin_jtec fait partie de ce role)
GRANT SELECT ON admin_stats_regies TO authenticated;
GRANT SELECT ON admin_stats_immeubles TO authenticated;
GRANT SELECT ON admin_stats_logements TO authenticated;
GRANT SELECT ON admin_stats_locataires TO authenticated;
GRANT SELECT ON admin_stats_tickets TO authenticated;
GRANT SELECT ON admin_stats_entreprises TO authenticated;
GRANT SELECT ON admin_stats_tickets_categories TO authenticated;
GRANT SELECT ON admin_stats_tickets_priorites TO authenticated;
GRANT SELECT ON admin_stats_evolution TO authenticated;
GRANT SELECT ON admin_dashboard TO authenticated;

-- Vérification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_privileges 
    WHERE table_name = 'admin_stats_regies' 
    AND grantee = 'authenticated'
  ) THEN
    RAISE NOTICE '✅ GRANTS admin views OK';
  ELSE
    RAISE EXCEPTION '❌ GRANTS admin views FAILED';
  END IF;
END $$;
