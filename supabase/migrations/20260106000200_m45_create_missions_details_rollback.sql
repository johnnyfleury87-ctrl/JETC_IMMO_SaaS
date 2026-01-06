-- =====================================================
-- ROLLBACK M45: Supprimer vue missions_details
-- =====================================================

DROP VIEW IF EXISTS missions_details CASCADE;

-- Validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'missions_details'
  ) THEN
    RAISE NOTICE '✅ ROLLBACK M45: Vue missions_details supprimée';
  ELSE
    RAISE EXCEPTION '❌ ROLLBACK M45: Vue missions_details existe encore';
  END IF;
END $$;
