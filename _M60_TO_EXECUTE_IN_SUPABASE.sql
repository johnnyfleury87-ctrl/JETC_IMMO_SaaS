-- MIGRATION M60 - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- Date: 2026-01-09T11:21:15.113Z

-- ============================================
-- MIGRATION M60: MULTI-DEVISE EUR/CHF
-- Date: 2026-01-09
-- Objectif: Ajouter gestion complète des devises
-- ============================================

-- ============================================
-- PARTIE 1: AJOUT DES CHAMPS CURRENCY
-- ============================================

-- 1.1 REGIES (source de vérité)
ALTER TABLE regies 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR' 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN regies.currency IS 'Devise de la régie - Source de vérité pour toute la chaîne';

-- 1.2 ENTREPRISES
ALTER TABLE entreprises 
ADD COLUMN IF NOT EXISTS currency TEXT 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN entreprises.currency IS 'Devise héritée de la régie';

-- 1.3 LOCATAIRES
ALTER TABLE locataires 
ADD COLUMN IF NOT EXISTS currency TEXT 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN locataires.currency IS 'Devise héritée de la régie';

-- 1.4 FACTURES (CRITIQUE!)
ALTER TABLE factures 
ADD COLUMN IF NOT EXISTS currency TEXT 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN factures.currency IS 'Devise de la facture - doit correspondre à la régie';

-- Note: tickets.devise et missions.devise existent déjà ✓

-- ============================================
-- PARTIE 2: AJOUT RELATION ENTREPRISES → REGIES
-- ============================================

-- 2.1 Ajouter la FK manquante
ALTER TABLE entreprises 
ADD COLUMN IF NOT EXISTS regie_id UUID REFERENCES regies(id);

COMMENT ON COLUMN entreprises.regie_id IS 'Régie de rattachement - permet héritage devise';

-- 2.2 Index pour performance
CREATE INDEX IF NOT EXISTS idx_entreprises_regie_id ON entreprises(regie_id);
CREATE INDEX IF NOT EXISTS idx_entreprises_currency ON entreprises(currency);
CREATE INDEX IF NOT EXISTS idx_factures_currency ON factures(currency);
CREATE INDEX IF NOT EXISTS idx_regies_currency ON regies(currency);

-- ============================================
-- PARTIE 3: RENOMMER CHAMPS SPÉCIFIQUES CHF
-- ============================================

-- 3.1 Renommer montant_reel_chf pour être agnostique
ALTER TABLE missions RENAME COLUMN montant_reel_chf TO montant_reel;

COMMENT ON COLUMN missions.montant_reel IS 'Montant réel de l''intervention (devise dans missions.devise)';

-- ============================================
-- PARTIE 4: INITIALISATION DES DONNÉES
-- ============================================

-- 4.1 Détecter la devise des régies existantes
-- Stratégie: Si ville suisse → CHF, sinon EUR
UPDATE regies 
SET currency = CASE 
  WHEN ville IN ('Lausanne', 'Genève', 'Zurich', 'Berne', 'Bâle', 'Lucerne', 'Lugano', 'Neuchâtel', 'Fribourg', 'Sion')
  THEN 'CHF'
  WHEN ville IN ('Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille')
  THEN 'EUR'
  -- Par défaut: regarder si des missions/tickets en CHF existent
  WHEN EXISTS (
    SELECT 1 FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    WHERE t.regie_id = regies.id AND m.devise = 'CHF'
  )
  THEN 'CHF'
  ELSE 'EUR'
END
WHERE currency IS NULL;

-- 4.2 Propager la devise aux entreprises via regie_id existante ou via missions
UPDATE entreprises e
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = e.regie_id),
  (SELECT m.devise FROM missions m WHERE m.entreprise_id = e.id LIMIT 1),
  'EUR'
)
WHERE currency IS NULL;

-- 4.3 Propager la devise aux locataires
UPDATE locataires l
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = l.regie_id),
  'EUR'
)
WHERE currency IS NULL;

-- 4.4 Propager la devise aux factures
UPDATE factures f
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = f.regie_id),
  (SELECT m.devise FROM missions m WHERE m.id = f.mission_id),
  'EUR'
)
WHERE currency IS NULL;

-- 4.5 Lier entreprises aux régies via les missions existantes
-- Si une entreprise n'a pas de regie_id, on le déduit des tickets/missions
UPDATE entreprises e
SET regie_id = (
  SELECT DISTINCT t.regie_id
  FROM missions m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE m.entreprise_id = e.id
  LIMIT 1
)
WHERE regie_id IS NULL;

-- ============================================
-- PARTIE 5: TRIGGERS DE PROPAGATION AUTOMATIQUE
-- ============================================

-- 5.1 Trigger: Entreprise hérite de la devise de sa régie
CREATE OR REPLACE FUNCTION sync_entreprise_currency()
RETURNS TRIGGER AS $$
BEGIN
  -- Si regie_id est défini, hériter de sa devise
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  -- Vérifier cohérence
  IF NEW.regie_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
    IF NEW.currency != (SELECT currency FROM regies WHERE id = NEW.regie_id) THEN
      RAISE EXCEPTION 'La devise de l''entreprise (%) ne correspond pas à celle de la régie (%)',
        NEW.currency,
        (SELECT currency FROM regies WHERE id = NEW.regie_id);
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

-- 5.2 Trigger: Locataire hérite de la devise de sa régie
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

-- 5.3 Trigger: Ticket hérite de la devise de sa régie
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

-- 5.4 Trigger: Mission hérite de la devise du ticket/régie
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

-- 5.5 Trigger: Facture hérite de la devise de la régie
CREATE OR REPLACE FUNCTION sync_facture_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  -- Double vérification via mission si disponible
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
-- PARTIE 6: CONTRAINTES DE SÉCURITÉ
-- ============================================

-- 6.1 Interdire changement de devise sur régie après création de données
CREATE OR REPLACE FUNCTION prevent_regie_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.currency != NEW.currency THEN
    -- Vérifier s'il existe des données liées
    IF EXISTS (
      SELECT 1 FROM entreprises WHERE regie_id = NEW.id
      UNION ALL
      SELECT 1 FROM locataires WHERE regie_id = NEW.id
      UNION ALL
      SELECT 1 FROM tickets WHERE regie_id = NEW.id
      UNION ALL
      SELECT 1 FROM factures WHERE regie_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Impossible de changer la devise d''une régie ayant des données liées';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_regie_currency_change ON regies;
CREATE TRIGGER trigger_prevent_regie_currency_change
BEFORE UPDATE OF currency ON regies
FOR EACH ROW
EXECUTE FUNCTION prevent_regie_currency_change();

-- ============================================
-- PARTIE 7: VUES UTILES
-- ============================================

-- 7.1 Vue: Cohérence des devises
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

COMMENT ON VIEW v_currency_coherence IS 'Vue de contrôle: vérification cohérence des devises par régie';

-- ============================================
-- PARTIE 8: VÉRIFICATIONS FINALES
-- ============================================

-- 8.1 Vérifier qu'aucune régie n'a currency NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM regies WHERE currency IS NULL) THEN
    RAISE WARNING 'ATTENTION: Des régies ont currency NULL';
  END IF;
END $$;

-- 8.2 Vérifier cohérence entreprises
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM entreprises e
    JOIN regies r ON r.id = e.regie_id
    WHERE e.currency != r.currency
  ) THEN
    RAISE WARNING 'ATTENTION: Incohérence devise entreprises/regies détectée';
  END IF;
END $$;

-- 8.3 Rapport de migration
DO $$
DECLARE
  nb_regies_eur INTEGER;
  nb_regies_chf INTEGER;
  nb_entreprises INTEGER;
  nb_factures INTEGER;
BEGIN
  SELECT COUNT(*) INTO nb_regies_eur FROM regies WHERE currency = 'EUR';
  SELECT COUNT(*) INTO nb_regies_chf FROM regies WHERE currency = 'CHF';
  SELECT COUNT(*) INTO nb_entreprises FROM entreprises WHERE currency IS NOT NULL;
  SELECT COUNT(*) INTO nb_factures FROM factures WHERE currency IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION M60 - RAPPORT FINAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Régies EUR: %', nb_regies_eur;
  RAISE NOTICE 'Régies CHF: %', nb_regies_chf;
  RAISE NOTICE 'Entreprises avec devise: %', nb_entreprises;
  RAISE NOTICE 'Factures avec devise: %', nb_factures;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- MIGRATION RÉUSSIE ✅
-- ============================================

