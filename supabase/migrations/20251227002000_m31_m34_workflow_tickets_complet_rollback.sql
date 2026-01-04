-- ============================================================
-- ROLLBACK COMPLET M31-M34
-- ============================================================

-- M34: Supprimer policies RLS entreprise
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- M33: Supprimer RPC get_entreprises_autorisees
DROP FUNCTION IF EXISTS public.get_entreprises_autorisees();

-- M32: Supprimer RPC valider_ticket_regie
DROP FUNCTION IF EXISTS public.valider_ticket_regie(uuid, numeric, text, uuid);

-- M31: Supprimer colonnes + indexes
DROP INDEX IF EXISTS idx_tickets_plafond_valide_par;
DROP INDEX IF EXISTS idx_tickets_diffuse_par;

ALTER TABLE tickets DROP COLUMN IF EXISTS diffuse_at;
ALTER TABLE tickets DROP COLUMN IF EXISTS diffuse_par;
ALTER TABLE tickets DROP COLUMN IF EXISTS plafond_valide_at;
ALTER TABLE tickets DROP COLUMN IF EXISTS plafond_valide_par;

-- Validation rollback
DO $$
DECLARE
  v_count_columns int;
  v_count_rpc int;
  v_count_policies int;
BEGIN
  -- Vérifier colonnes supprimées
  SELECT COUNT(*) INTO v_count_columns
  FROM information_schema.columns
  WHERE table_name = 'tickets'
    AND column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_par', 'diffuse_at');
  
  IF v_count_columns != 0 THEN
    RAISE WARNING '⚠️ ROLLBACK M31: % colonnes restent (attendu: 0)', v_count_columns;
  END IF;
  
  -- Vérifier RPC supprimées
  SELECT COUNT(*) INTO v_count_rpc
  FROM pg_proc
  WHERE proname IN ('valider_ticket_regie', 'get_entreprises_autorisees');
  
  IF v_count_rpc != 0 THEN
    RAISE WARNING '⚠️ ROLLBACK M32-M33: % RPC restent (attendu: 0)', v_count_rpc;
  END IF;
  
  -- Vérifier policies supprimées
  SELECT COUNT(*) INTO v_count_policies
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  IF v_count_policies != 0 THEN
    RAISE WARNING '⚠️ ROLLBACK M34: % policies restent (attendu: 0)', v_count_policies;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ROLLBACK COMPLET: M31-M34 annulées';
  RAISE NOTICE '========================================';
END $$;
