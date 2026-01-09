-- =====================================================
-- MIGRATION M64 : Correction trigger devise missions
-- =====================================================
-- Date : 9 janvier 2026
-- Objectif : Sécuriser le trigger sync_mission_devise_from_ticket
--           pour ne PAS écraser une devise déjà fournie
-- Context : M63 a levé le blocage CHF-only (✅ OK)
--           mais le trigger écrase systématiquement la devise
-- =====================================================

BEGIN;

-- =====================================================
-- 1. AJOUTER DEFAULT 'CHF' SUR missions.devise
-- =====================================================

-- Sécurité : garantir qu'aucune mission n'est créée avec devise NULL
ALTER TABLE missions 
  ALTER COLUMN devise SET DEFAULT 'CHF';

COMMENT ON COLUMN missions.devise IS 'Devise de la mission - CHF (Suisse) ou EUR (France) - Héritée du ticket ou CHF par défaut';

-- =====================================================
-- 2. CORRIGER TRIGGER : Respecter devise déjà fournie
-- =====================================================

CREATE OR REPLACE FUNCTION sync_mission_devise_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
  -- CORRECTION : Hériter devise du ticket UNIQUEMENT si NEW.devise IS NULL
  -- Si devise déjà fournie par le backend → respectée
  IF NEW.devise IS NULL AND NEW.ticket_id IS NOT NULL THEN
    SELECT t.devise INTO NEW.devise
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;
  
  -- Fallback CHF si toujours NULL (mission sans ticket + sans devise)
  -- Note : DEFAULT 'CHF' devrait déjà gérer ce cas, mais double sécurité
  IF NEW.devise IS NULL THEN
    NEW.devise := 'CHF';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger déjà créé par M63, juste mettre à jour la fonction
COMMENT ON FUNCTION sync_mission_devise_from_ticket() IS 
'Hérite la devise du ticket UNIQUEMENT si NEW.devise IS NULL - Ne pas écraser devise explicitement fournie';

-- =====================================================
-- 3. LOG MIGRATION (AVANT COMMIT)
-- =====================================================

-- Vérifier si migration_logs existe avant d'insérer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'migration_logs'
  ) THEN
    INSERT INTO migration_logs (migration_name, description)
    VALUES (
      '20260109000005_m64_fix_trigger_mission_devise',
      'M64 : Correction trigger missions.devise - Respecte devise fournie + DEFAULT CHF ajouté'
    );
  END IF;
END $$;

COMMIT;

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_missions INTEGER;
  v_missions_chf INTEGER;
  v_missions_eur INTEGER;
  v_default_value TEXT;
BEGIN
  -- Compteurs
  SELECT COUNT(*) INTO v_total_missions FROM missions WHERE devise IS NOT NULL;
  SELECT COUNT(*) INTO v_missions_chf FROM missions WHERE devise = 'CHF';
  SELECT COUNT(*) INTO v_missions_eur FROM missions WHERE devise = 'EUR';
  
  -- Vérifier DEFAULT
  SELECT column_default INTO v_default_value
  FROM information_schema.columns
  WHERE table_name = 'missions' AND column_name = 'devise';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ M64 OK: Trigger mission devise corrigé';
  RAISE NOTICE '✅ DEFAULT CHF ajouté sur missions.devise';
  RAISE NOTICE '';
  RAISE NOTICE 'DEFAULT value: %', v_default_value;
  RAISE NOTICE 'Total missions : %', v_total_missions;
  RAISE NOTICE 'Missions CHF : %', v_missions_chf;
  RAISE NOTICE 'Missions EUR : %', v_missions_eur;
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Trigger respecte devise fournie';
  RAISE NOTICE '🔒 Hérite uniquement si devise IS NULL';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
