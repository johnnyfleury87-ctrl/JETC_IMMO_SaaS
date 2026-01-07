-- M50 : WORKFLOW FACTURATION - VERSION CORRIGÉE (DROP explicites)
-- Application : Copier/coller dans Supabase SQL Editor

-- 1. Ajouter colonne IBAN
ALTER TABLE factures ADD COLUMN IF NOT EXISTS iban TEXT;

-- 2. Ajouter colonne durée calculée
ALTER TABLE missions DROP COLUMN IF EXISTS duree_minutes;
ALTER TABLE missions ADD COLUMN duree_minutes INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
    ELSE NULL
  END
) STORED;

-- 3. RPC start_mission
DROP FUNCTION IF EXISTS start_mission(UUID);
DROP FUNCTION IF EXISTS start_mission(UUID, UUID);
DROP FUNCTION IF EXISTS start_mission;

CREATE OR REPLACE FUNCTION start_mission(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_mission RECORD;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission non trouvée');
  END IF;
  IF v_mission.statut != 'en_attente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La mission doit être en attente');
  END IF;
  IF v_mission.technicien_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un technicien doit être assigné');
  END IF;
  UPDATE missions SET statut = 'en_cours', started_at = NOW() WHERE id = p_mission_id;
  UPDATE tickets SET statut = 'en_cours' WHERE id = v_mission.ticket_id;
  RETURN jsonb_build_object('success', true, 'mission_id', p_mission_id);
END;
$$;

-- 4. RPC complete_mission
DROP FUNCTION IF EXISTS complete_mission(UUID);
DROP FUNCTION IF EXISTS complete_mission(UUID, UUID);
DROP FUNCTION IF EXISTS complete_mission(UUID, TEXT);
DROP FUNCTION IF EXISTS complete_mission;

CREATE OR REPLACE FUNCTION complete_mission(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_mission RECORD;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission non trouvée');
  END IF;
  IF v_mission.statut != 'en_cours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La mission doit être en cours');
  END IF;
  UPDATE missions SET statut = 'terminee', completed_at = NOW() WHERE id = p_mission_id;
  UPDATE tickets SET statut = 'termine' WHERE id = v_mission.ticket_id;
  RETURN jsonb_build_object('success', true, 'mission_id', p_mission_id);
END;
$$;

-- 5. RPC generate_facture_from_mission
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID);
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID, DECIMAL);
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID, DECIMAL, DATE);
DROP FUNCTION IF EXISTS generate_facture_from_mission(UUID, DECIMAL, DATE, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS generate_facture_from_mission;

CREATE OR REPLACE FUNCTION generate_facture_from_mission(
  p_mission_id UUID,
  p_montant_ht DECIMAL DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
  v_facture_id UUID;
  v_numero TEXT;
  v_year TEXT;
  v_seq INT;
  v_regie_id UUID;
  v_montant DECIMAL;
BEGIN
  SELECT m.* INTO v_mission FROM missions m WHERE m.id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission non trouvée');
  END IF;
  IF v_mission.statut != 'terminee' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La mission doit être terminée');
  END IF;
  IF EXISTS (SELECT 1 FROM factures WHERE mission_id = p_mission_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture déjà existante');
  END IF;
  
  SELECT i.regie_id INTO v_regie_id
  FROM tickets t
  JOIN logements l ON t.logement_id = l.id
  JOIN immeubles i ON l.immeuble_id = i.id
  WHERE t.id = v_mission.ticket_id;
  
  v_montant := COALESCE(p_montant_ht, v_mission.montant_reel_chf, 0);
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero ~ '^FAC-[0-9]{4}-[0-9]+$' 
      THEN CAST(SUBSTRING(numero FROM 'FAC-[0-9]{4}-([0-9]+)') AS INT)
      ELSE 0
    END
  ), 0) + 1 INTO v_seq FROM factures WHERE numero LIKE 'FAC-' || v_year || '-%';
  
  v_numero := 'FAC-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  INSERT INTO factures (
    mission_id, entreprise_id, regie_id, numero,
    montant_ht, taux_tva, taux_commission, date_echeance,
    statut, notes, iban
  ) VALUES (
    p_mission_id, v_mission.entreprise_id, v_regie_id, v_numero,
    v_montant, 20.00, 10.00, CURRENT_DATE + INTERVAL '30 days',
    'brouillon', p_description, p_iban
  ) RETURNING id INTO v_facture_id;
  
  RETURN jsonb_build_object('success', true, 'facture_id', v_facture_id, 'numero', v_numero);
END;
$$;

-- 6. RPC update_facture_status
DROP FUNCTION IF EXISTS update_facture_status(UUID, TEXT);
DROP FUNCTION IF EXISTS update_facture_status(UUID);
DROP FUNCTION IF EXISTS update_facture_status;

CREATE OR REPLACE FUNCTION update_facture_status(
  p_facture_id UUID,
  p_nouveau_statut TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture RECORD;
  v_mission_id UUID;
  v_ticket_id UUID;
BEGIN
  SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Facture non trouvée');
  END IF;
  IF p_nouveau_statut NOT IN ('brouillon', 'envoyee', 'payee', 'refusee') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide');
  END IF;
  
  UPDATE factures
  SET 
    statut = p_nouveau_statut,
    date_envoi = CASE WHEN p_nouveau_statut = 'envoyee' AND date_envoi IS NULL THEN NOW() ELSE date_envoi END,
    date_paiement = CASE WHEN p_nouveau_statut = 'payee' AND date_paiement IS NULL THEN NOW() ELSE date_paiement END
  WHERE id = p_facture_id
  RETURNING mission_id INTO v_mission_id;
  
  IF p_nouveau_statut = 'payee' THEN
    SELECT ticket_id INTO v_ticket_id FROM missions WHERE id = v_mission_id;
    UPDATE missions SET statut = 'validee', validated_at = NOW() WHERE id = v_mission_id;
    UPDATE tickets SET statut = 'clos', date_cloture = NOW() WHERE id = v_ticket_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'facture_id', p_facture_id, 'cloture_auto', p_nouveau_statut = 'payee');
END;
$$;

-- 7. Trigger auto-génération facture
DROP FUNCTION IF EXISTS auto_generate_facture_on_mission_complete() CASCADE;

CREATE OR REPLACE FUNCTION auto_generate_facture_on_mission_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NEW.statut = 'terminee' AND OLD.statut != 'terminee' THEN
    IF NOT EXISTS (SELECT 1 FROM factures WHERE mission_id = NEW.id) THEN
      SELECT generate_facture_from_mission(NEW.id, NEW.montant_reel_chf, 'Facture générée automatiquement', NULL) INTO v_result;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_facture ON missions;
CREATE TRIGGER trigger_auto_generate_facture
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_facture_on_mission_complete();

-- 8. Vue missions_factures_complet
DROP VIEW IF EXISTS missions_factures_complet;
CREATE VIEW missions_factures_complet AS
SELECT
  m.id AS mission_id, m.statut AS mission_statut,
  m.created_at AS mission_created_at, m.started_at AS mission_started_at,
  m.completed_at AS mission_completed_at, m.validated_at AS mission_validated_at,
  m.duree_minutes AS mission_duree_minutes, m.notes AS mission_notes,
  m.rapport_url AS mission_rapport_url, m.montant_reel_chf AS mission_montant,
  m.photos_urls AS mission_photos,
  t.id AS ticket_id, t.titre AS ticket_titre, t.description AS ticket_description,
  t.categorie AS ticket_categorie, t.statut AS ticket_statut,
  e.id AS entreprise_id, e.nom AS entreprise_nom, e.siret AS entreprise_siret,
  tech.id AS technicien_id, tech.nom AS technicien_nom, tech.prenom AS technicien_prenom,
  loc.id AS locataire_id, loc.nom AS locataire_nom, loc.prenom AS locataire_prenom,
  log.id AS logement_id, log.numero AS logement_numero,
  imm.id AS immeuble_id, imm.nom AS immeuble_nom, imm.adresse AS immeuble_adresse,
  r.id AS regie_id, r.nom AS regie_nom,
  f.id AS facture_id, f.numero AS facture_numero,
  f.montant_ht AS facture_montant_ht, f.montant_ttc AS facture_montant_ttc,
  f.montant_commission AS facture_commission,
  f.statut AS facture_statut, f.date_emission AS facture_date_emission,
  f.date_paiement AS facture_date_paiement, f.iban AS facture_iban
FROM missions m
JOIN tickets t ON m.ticket_id = t.id
JOIN entreprises e ON m.entreprise_id = e.id
LEFT JOIN techniciens tech ON m.technicien_id = tech.id
JOIN locataires loc ON t.locataire_id = loc.id
JOIN logements log ON t.logement_id = log.id
JOIN immeubles imm ON log.immeuble_id = imm.id
JOIN regies r ON imm.regie_id = r.id
LEFT JOIN factures f ON f.mission_id = m.id;

-- 9. Permissions
GRANT EXECUTE ON FUNCTION start_mission TO authenticated;
GRANT EXECUTE ON FUNCTION complete_mission TO authenticated;
GRANT EXECUTE ON FUNCTION generate_facture_from_mission TO authenticated;
GRANT EXECUTE ON FUNCTION update_facture_status TO authenticated;
GRANT SELECT ON missions_factures_complet TO authenticated;

-- FIN M50
