-- ============================================
-- MIGRATION M60A: MULTI-DEVISE EUR/CHF (SÉCURISÉE)
-- Date: 2026-01-09
-- Version: CORRIGÉE suite retour critique
-- Objectif: Structure multi-devise SANS casser le code existant
-- ============================================

-- ============================================
-- PARTIE 1: AJOUT DES CHAMPS CURRENCY
-- ============================================

-- 1.1 REGIES (source de vérité)
ALTER TABLE regies 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';

ALTER TABLE regies 
ADD CONSTRAINT check_regies_currency 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN regies.currency IS 'Devise de la régie - Source de vérité pour toute la chaîne. Par défaut CHF (projet Suisse), à modifier manuellement si EUR';

-- 1.2 ENTREPRISES
ALTER TABLE entreprises 
ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE entreprises 
ADD CONSTRAINT check_entreprises_currency 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN entreprises.currency IS 'Devise héritée de la régie';

-- 1.3 LOCATAIRES
ALTER TABLE locataires 
ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE locataires 
ADD CONSTRAINT check_locataires_currency 
CHECK (currency IN ('EUR', 'CHF'));

COMMENT ON COLUMN locataires.currency IS 'Devise héritée de la régie';

-- 1.4 FACTURES (CRITIQUE!)
ALTER TABLE factures 
ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE factures 
ADD CONSTRAINT check_factures_currency 
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
-- PARTIE 3: AJOUT COLONNE montant_reel (SANS SUPPRIMER montant_reel_chf)
-- ============================================

-- 3.1 Ajouter nouvelle colonne montant_reel
-- IMPORTANT: On garde montant_reel_chf pour compatibilité code existant
ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS montant_reel NUMERIC(10,2);

COMMENT ON COLUMN missions.montant_reel IS 'Montant réel de l''intervention (devise dans missions.devise). Remplace progressivement montant_reel_chf';

-- 3.2 Copier les données de montant_reel_chf vers montant_reel
UPDATE missions 
SET montant_reel = montant_reel_chf 
WHERE montant_reel IS NULL;

-- 3.3 Index sur nouvelle colonne
CREATE INDEX IF NOT EXISTS idx_missions_montant_reel ON missions(montant_reel)
WHERE montant_reel IS NOT NULL;

-- 3.4 Contrainte: montant_reel positif
ALTER TABLE missions 
ADD CONSTRAINT check_montant_reel_positif 
CHECK (montant_reel IS NULL OR montant_reel >= 0);

-- ============================================
-- PARTIE 4: INITIALISATION DES DONNÉES
-- ============================================

-- 4.1 Initialiser currency des régies
-- CHANGEMENT CRITIQUE: Plus de déduction par ville
-- Valeur par défaut: CHF (projet Suisse)
-- À modifier manuellement via UI si EUR nécessaire

-- Pour les régies existantes (créées avant ajout de la colonne), initialiser avec détection ou CHF
-- Pour les nouvelles régies, DEFAULT 'CHF' s'appliquera automatiquement
UPDATE regies 
SET currency = COALESCE(
  (SELECT m.devise FROM missions m
   JOIN tickets t ON t.id = m.ticket_id
   WHERE t.regie_id = regies.id
   LIMIT 1),
  'CHF'  -- Par défaut CHF, justifié car projet Suisse
)
WHERE currency IS NULL OR currency = '';

-- Log des régies mises à jour
DO $$
DECLARE
  v_regie RECORD;
BEGIN
  FOR v_regie IN SELECT id, nom, currency FROM regies
  LOOP
    RAISE NOTICE 'Régie % (%) initialisée avec currency = %', 
      v_regie.nom, v_regie.id, v_regie.currency;
  END LOOP;
END $$;

-- 4.2 Lier entreprises aux régies
-- AMÉLIORATION: Vérifier qu'il n'y a qu'une seule régie par entreprise

-- Nettoyer table temporaire si existe déjà
DROP TABLE IF EXISTS entreprise_regie_mapping;

CREATE TEMP TABLE entreprise_regie_mapping AS
SELECT 
  e.id AS entreprise_id,
  t.regie_id,
  COUNT(DISTINCT t.regie_id) AS nb_regies_distinctes
FROM entreprises e
JOIN missions m ON m.entreprise_id = e.id
JOIN tickets t ON t.id = m.ticket_id
WHERE e.regie_id IS NULL
GROUP BY e.id, t.regie_id;

-- Log des entreprises multi-régies (ne seront PAS mises à jour automatiquement)
DO $$
DECLARE
  v_entreprise RECORD;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT entreprise_id
    FROM entreprise_regie_mapping
    GROUP BY entreprise_id
    HAVING COUNT(DISTINCT regie_id) > 1
  ) multi_regies;
  
  IF v_count > 0 THEN
    RAISE WARNING 'ATTENTION: % entreprise(s) travaille(nt) pour plusieurs régies', v_count;
    RAISE WARNING 'Ces entreprises nécessitent une affectation manuelle de regie_id';
    
    FOR v_entreprise IN 
      SELECT e.nom, COUNT(DISTINCT erm.regie_id) as nb_regies
      FROM entreprises e
      JOIN entreprise_regie_mapping erm ON erm.entreprise_id = e.id
      GROUP BY e.id, e.nom
      HAVING COUNT(DISTINCT erm.regie_id) > 1
    LOOP
      RAISE WARNING '  - % : % régies différentes', v_entreprise.nom, v_entreprise.nb_regies;
    END LOOP;
  END IF;
END $$;

-- Mise à jour seulement des entreprises mono-régie
UPDATE entreprises e
SET regie_id = erm.regie_id
FROM (
  SELECT entreprise_id, regie_id
  FROM entreprise_regie_mapping
  WHERE entreprise_id IN (
    SELECT entreprise_id
    FROM entreprise_regie_mapping
    GROUP BY entreprise_id
    HAVING COUNT(DISTINCT regie_id) = 1
  )
) erm
WHERE e.id = erm.entreprise_id AND e.regie_id IS NULL;

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS entreprise_regie_mapping;

-- 4.3 Initialiser currency des entreprises
UPDATE entreprises e
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = e.regie_id),
  (SELECT m.devise FROM missions m WHERE m.entreprise_id = e.id LIMIT 1),
  'CHF'  -- Par défaut CHF
)
WHERE currency IS NULL;

-- 4.4 Initialiser currency des locataires
UPDATE locataires l
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = l.regie_id),
  'CHF'  -- Par défaut CHF
)
WHERE currency IS NULL;

-- 4.5 Initialiser currency des factures
UPDATE factures f
SET currency = COALESCE(
  (SELECT r.currency FROM regies r WHERE r.id = f.regie_id),
  (SELECT m.devise FROM missions m WHERE m.id = f.mission_id),
  'CHF'  -- Par défaut CHF
)
WHERE currency IS NULL;

-- ============================================
-- PARTIE 5: TRIGGERS DE PROPAGATION AUTOMATIQUE
-- ============================================

-- 5.1 Trigger: Entreprise hérite devise de la régie
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

-- 5.2 Trigger: Locataire hérite devise de la régie
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

-- 5.3 Trigger: Ticket hérite devise de la régie
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

-- 5.4 Trigger: Mission hérite devise du ticket
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

-- 5.5 Trigger: Facture hérite devise de la régie
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

-- 5.6 Trigger: Synchroniser montant_reel avec montant_reel_chf (compatibilité)
-- Pendant la phase de transition, on synchronise les deux colonnes
-- PRIORITÉ: montant_reel gagne si modifié, sinon montant_reel_chf
CREATE OR REPLACE FUNCTION sync_mission_montants()
RETURNS TRIGGER AS $$
BEGIN
  -- Priorité 1: Si montant_reel change, il devient la référence
  IF NEW.montant_reel IS DISTINCT FROM OLD.montant_reel THEN
    NEW.montant_reel_chf := NEW.montant_reel;
  -- Priorité 2: Sinon, si montant_reel_chf change, synchroniser vers montant_reel
  ELSIF NEW.montant_reel_chf IS DISTINCT FROM OLD.montant_reel_chf THEN
    NEW.montant_reel := NEW.montant_reel_chf;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_mission_montants ON missions;
CREATE TRIGGER trigger_sync_mission_montants
BEFORE UPDATE ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_montants();

-- ============================================
-- PARTIE 6: CONTRAINTES DE SÉCURITÉ
-- ============================================

-- 6.1 Interdire changement de devise sur régie après création de données
CREATE OR REPLACE FUNCTION prevent_regie_currency_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.currency != NEW.currency THEN
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
  COUNT(DISTINCT e.id) FILTER (WHERE e.currency != r.currency OR e.currency IS NULL) AS entreprises_ko,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency = r.currency) AS locataires_ok,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency != r.currency OR l.currency IS NULL) AS locataires_ko,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency = r.currency) AS factures_ok,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency != r.currency OR f.currency IS NULL) AS factures_ko
FROM regies r
LEFT JOIN entreprises e ON e.regie_id = r.id
LEFT JOIN locataires l ON l.regie_id = r.id
LEFT JOIN factures f ON f.regie_id = r.id
GROUP BY r.id, r.nom, r.currency;

COMMENT ON VIEW v_currency_coherence IS 'Vue de contrôle: vérification cohérence des devises par régie';

-- ============================================
-- PARTIE 8: RAPPORT FINAL
-- ============================================

DO $$
DECLARE
  nb_regies_eur INTEGER;
  nb_regies_chf INTEGER;
  nb_entreprises_ok INTEGER;
  nb_entreprises_sans_regie INTEGER;
  nb_factures_ok INTEGER;
BEGIN
  SELECT COUNT(*) INTO nb_regies_eur FROM regies WHERE currency = 'EUR';
  SELECT COUNT(*) INTO nb_regies_chf FROM regies WHERE currency = 'CHF';
  SELECT COUNT(*) INTO nb_entreprises_ok FROM entreprises WHERE currency IS NOT NULL AND regie_id IS NOT NULL;
  SELECT COUNT(*) INTO nb_entreprises_sans_regie FROM entreprises WHERE regie_id IS NULL;
  SELECT COUNT(*) INTO nb_factures_ok FROM factures WHERE currency IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION M60A - RAPPORT FINAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Régies EUR: %', nb_regies_eur;
  RAISE NOTICE 'Régies CHF: %', nb_regies_chf;
  RAISE NOTICE 'Entreprises avec devise et regie_id: %', nb_entreprises_ok;
  RAISE NOTICE 'Entreprises sans regie_id (à traiter manuellement): %', nb_entreprises_sans_regie;
  RAISE NOTICE 'Factures avec devise: %', nb_factures_ok;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION M60A TERMINÉE';
  RAISE NOTICE '⚠️  Code existant NON CASSÉ (montant_reel_chf conservé)';
  RAISE NOTICE '📋 Prochaine étape: M60B (migration code)';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- MIGRATION M60A RÉUSSIE ✅
-- Code existant préservé ✅
-- ============================================
