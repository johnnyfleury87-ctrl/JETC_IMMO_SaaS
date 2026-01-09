-- =====================================================
-- MIGRATION M63 : Multi-devises pour missions
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Autoriser CHF ET EUR pour missions France/Suisse
--           Remplace contrainte CHECK (devise = 'CHF')
--           par CHECK (devise IN ('CHF', 'EUR'))
-- Context : La création de mission échoue avec :
--           "new row violates check constraint 'check_mission_devise_chf'"
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SUPPRIMER CONTRAINTE CHF ONLY
-- =====================================================

ALTER TABLE missions
  DROP CONSTRAINT IF EXISTS check_mission_devise_chf;

-- =====================================================
-- 2. AJOUTER CONTRAINTE MULTI-DEVISES
-- =====================================================

ALTER TABLE missions
  ADD CONSTRAINT check_mission_devise_multi_pays
  CHECK (devise IN ('CHF', 'EUR'));

-- Mise à jour commentaire colonne
COMMENT ON COLUMN missions.devise IS 'Devise de la mission - CHF (Suisse) ou EUR (France)';

-- =====================================================
-- 3. TRIGGER : Héritage devise du ticket
-- =====================================================

CREATE OR REPLACE FUNCTION sync_mission_devise_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
  -- Si ticket_id fourni, hériter la devise du ticket
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.devise INTO NEW.devise
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;
  
  -- Valeur par défaut si devise toujours NULL
  IF NEW.devise IS NULL THEN
    NEW.devise := 'CHF';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer trigger existant si présent
DROP TRIGGER IF EXISTS trigger_sync_mission_devise ON missions;

-- Créer trigger BEFORE INSERT/UPDATE
CREATE TRIGGER trigger_sync_mission_devise
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_devise_from_ticket();

-- =====================================================
-- 4. LOG MIGRATION (AVANT COMMIT)
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20260109000004_m63_missions_multi_devise',
  'M63 : Support multi-devises missions - CHF et EUR autorisés + trigger héritage devise ticket'
);

COMMIT;

-- =====================================================
-- 5. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_missions INTEGER;
  v_missions_chf INTEGER;
  v_missions_eur INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_missions FROM missions WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_missions_chf FROM missions WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_missions_eur FROM missions WHERE devise = 'EUR';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ M63 OK: missions.devise accepte CHF et EUR';
  RAISE NOTICE '✅ Trigger sync_mission_devise créé';
  RAISE NOTICE '';
  RAISE NOTICE 'Total missions : %', v_total_missions;
  RAISE NOTICE 'Missions CHF : %', v_missions_chf;
  RAISE NOTICE 'Missions EUR : %', v_missions_eur;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
