-- ============================================
-- MIGRATION M60: MULTI-DEVISE EUR/CHF
-- Date: 2026-01-09T11:22:12.081Z
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ÉTAPE 1: Ajout currency sur regies
ALTER TABLE regies 
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR' 
      CHECK (currency IN ('EUR', 'CHF'));;

-- ÉTAPE 2: Ajout currency sur entreprises
ALTER TABLE entreprises 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));;

-- ÉTAPE 3: Ajout currency sur locataires
ALTER TABLE locataires 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));;

-- ÉTAPE 4: Ajout currency sur factures
ALTER TABLE factures 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));;

-- ÉTAPE 5: Ajout regie_id sur entreprises
ALTER TABLE entreprises 
      ADD COLUMN IF NOT EXISTS regie_id UUID REFERENCES regies(id);;

-- ÉTAPE 6: Index entreprises.regie_id
CREATE INDEX IF NOT EXISTS idx_entreprises_regie_id ON entreprises(regie_id);;

-- ÉTAPE 7: Index entreprises.currency
CREATE INDEX IF NOT EXISTS idx_entreprises_currency ON entreprises(currency);;

-- ÉTAPE 8: Index factures.currency
CREATE INDEX IF NOT EXISTS idx_factures_currency ON factures(currency);;

-- ÉTAPE 9: Index regies.currency
CREATE INDEX IF NOT EXISTS idx_regies_currency ON regies(currency);;

-- ÉTAPE 10: Renommer montant_reel_chf
DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'missions' AND column_name = 'montant_reel_chf'
        ) THEN
          ALTER TABLE missions RENAME COLUMN montant_reel_chf TO montant_reel;
        END IF;
      END $$;;

-- ÉTAPE 11: Initialiser currency des régies
UPDATE regies 
      SET currency = CASE 
        WHEN ville IN ('Lausanne', 'Genève', 'Zurich', 'Berne', 'Bâle', 'Lucerne', 'Lugano', 'Neuchâtel', 'Fribourg', 'Sion')
        THEN 'CHF'
        WHEN ville IN ('Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille')
        THEN 'EUR'
        WHEN EXISTS (
          SELECT 1 FROM missions m
          JOIN tickets t ON t.id = m.ticket_id
          WHERE t.regie_id = regies.id AND m.devise = 'CHF'
        )
        THEN 'CHF'
        ELSE 'EUR'
      END
      WHERE currency IS NULL;;

-- ÉTAPE 12: Lier entreprises aux régies
UPDATE entreprises e
      SET regie_id = (
        SELECT DISTINCT t.regie_id
        FROM missions m
        JOIN tickets t ON t.id = m.ticket_id
        WHERE m.entreprise_id = e.id
        LIMIT 1
      )
      WHERE regie_id IS NULL;;

-- ÉTAPE 13: Initialiser currency des entreprises
UPDATE entreprises e
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = e.regie_id),
        (SELECT m.devise FROM missions m WHERE m.entreprise_id = e.id LIMIT 1),
        'EUR'
      )
      WHERE currency IS NULL;;

-- ÉTAPE 14: Initialiser currency des locataires
UPDATE locataires l
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = l.regie_id),
        'EUR'
      )
      WHERE currency IS NULL;;

-- ÉTAPE 15: Initialiser currency des factures
UPDATE factures f
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = f.regie_id),
        (SELECT m.devise FROM missions m WHERE m.id = f.mission_id),
        'EUR'
      )
      WHERE currency IS NULL;;

-- ============================================
-- TRIGGERS DE PROPAGATION
-- ============================================

-- Trigger: Entreprise hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_entreprise_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  IF NEW.regie_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
    IF NEW.currency != (SELECT currency FROM regies WHERE id = NEW.regie_id) THEN
      RAISE EXCEPTION 'La devise de l''entreprise ne correspond pas à celle de la régie';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_entreprise_currency ON entreprises;
CREATE TRIGGER trigger_sync_entreprise_currency
BEFORE INSERT OR UPDATE OF regie_id ON entreprises
FOR EACH ROW
EXECUTE FUNCTION sync_entreprise_currency();

-- Trigger: Locataire hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_locataire_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_locataire_currency ON locataires;
CREATE TRIGGER trigger_sync_locataire_currency
BEFORE INSERT OR UPDATE OF regie_id ON locataires
FOR EACH ROW
EXECUTE FUNCTION sync_locataire_currency();

-- Trigger: Ticket hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_ticket_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.devise
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_ticket_currency ON tickets;
CREATE TRIGGER trigger_sync_ticket_currency
BEFORE INSERT OR UPDATE OF regie_id ON tickets
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_currency();

-- Trigger: Mission hérite devise du ticket
CREATE OR REPLACE FUNCTION sync_mission_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.devise INTO NEW.devise
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_mission_currency ON missions;
CREATE TRIGGER trigger_sync_mission_currency
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_currency();

-- Trigger: Facture hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_facture_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  IF NEW.mission_id IS NOT NULL AND NEW.currency IS NULL THEN
    SELECT m.devise INTO NEW.currency
    FROM missions m
    WHERE m.id = NEW.mission_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_facture_currency ON factures;
CREATE TRIGGER trigger_sync_facture_currency
BEFORE INSERT OR UPDATE OF regie_id, mission_id ON factures
FOR EACH ROW
EXECUTE FUNCTION sync_facture_currency();

-- ============================================
-- VUE DE COHÉRENCE
-- ============================================

CREATE OR REPLACE VIEW v_currency_coherence AS
SELECT 
  r.id AS regie_id,
  r.nom AS regie_nom,
  r.currency AS regie_currency,
  COUNT(DISTINCT e.id) FILTER (WHERE e.currency = r.currency) AS entreprises_ok,
  COUNT(DISTINCT e.id) FILTER (WHERE e.currency != r.currency) AS entreprises_ko,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency = r.currency) AS locataires_ok,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency != r.currency) AS locataires_ko,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency = r.currency) AS factures_ok,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency != r.currency) AS factures_ko
FROM regies r
LEFT JOIN entreprises e ON e.regie_id = r.id
LEFT JOIN locataires l ON l.regie_id = r.id
LEFT JOIN factures f ON f.regie_id = r.id
GROUP BY r.id, r.nom, r.currency;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
