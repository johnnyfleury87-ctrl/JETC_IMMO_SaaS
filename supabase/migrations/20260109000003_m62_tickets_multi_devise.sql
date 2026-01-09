-- =====================================================
-- MIGRATION M62 : Multi-devises pour tickets
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Autoriser CHF ET EUR pour tickets France/Suisse
--           Remplace contrainte CHECK (devise = 'CHF')
--           par CHECK (devise IN ('CHF', 'EUR'))
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SUPPRIMER CONTRAINTE CHF ONLY
-- =====================================================

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS check_devise_chf;

-- =====================================================
-- 2. AJOUTER CONTRAINTE MULTI-DEVISES
-- =====================================================

ALTER TABLE tickets
  ADD CONSTRAINT check_devise_multi_pays
  CHECK (devise IN ('CHF', 'EUR'));

-- Mise à jour commentaire colonne
COMMENT ON COLUMN tickets.devise IS 'Devise du ticket - CHF (Suisse) ou EUR (France)';

-- =====================================================
-- 3. LOG MIGRATION (AVANT COMMIT)
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000003_m62_tickets_multi_devise',
  'M62 : Support multi-devises tickets - CHF et EUR autorisés'
);

COMMIT;

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_tickets INTEGER;
  v_tickets_chf INTEGER;
  v_tickets_eur INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_tickets FROM tickets WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_tickets_chf FROM tickets WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_tickets_eur FROM tickets WHERE devise = 'EUR';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ M62 OK: tickets.devise accepte CHF et EUR';
  RAISE NOTICE '';
  RAISE NOTICE 'Total tickets : %', v_total_tickets;
  RAISE NOTICE 'Tickets CHF : %', v_tickets_chf;
  RAISE NOTICE 'Tickets EUR : %', v_tickets_eur;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
