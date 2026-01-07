-- =====================================================
-- M50 : WORKFLOW COMPLET MISSION → FACTURATION
-- =====================================================
-- Date : 2026-01-07
-- Objectif : Finaliser le workflow entreprise → facture → régie/admin
--
-- Actions :
-- 1. Créer/corriger RPC start_mission & complete_mission
-- 2. Ajouter colonne iban à table factures
-- 3. Créer RPC generate_facture_from_mission
-- 4. Créer RPC update_facture_status avec clôture auto
-- 5. Créer trigger auto-génération facture
-- 6. Créer vue missions_factures_complet
-- =====================================================

-- =====================================================
-- PARTIE 1 : COLONNES MANQUANTES
-- =====================================================

-- Ajouter colonne IBAN à table factures (si manquante)
ALTER TABLE factures
ADD COLUMN IF NOT EXISTS iban TEXT;

COMMENT ON COLUMN factures.iban IS 'IBAN de l''entreprise pour le paiement';

-- Ajouter colonnes calculées durée mission
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS duree_minutes INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
    ELSE NULL
  END
) STORED;

COMMENT ON COLUMN missions.duree_minutes IS 'Durée de la mission en minutes (calculée automatiquement)';

-- =====================================================
-- PARTIE 2 : RPC start_mission
-- =====================================================

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS start_mission(UUID);
DROP FUNCTION IF EXISTS start_mission(UUID, UUID);
DROP FUNCTION IF EXISTS start_mission;

CREATE OR REPLACE FUNCTION start_mission(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
BEGIN
  -- Vérifier que la mission existe
  SELECT * INTO v_mission
  FROM missions
  WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  -- Vérifier que la mission est en attente
  IF v_mission.statut != 'en_attente' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La mission doit être en attente pour être démarrée (statut actuel: ' || v_mission.statut || ')'
    );
  END IF;
  
  -- Vérifier qu'un technicien est assigné
  IF v_mission.technicien_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un technicien doit être assigné avant de démarrer la mission'
    );
  END IF;
  
  -- Démarrer la mission
  UPDATE missions
  SET 
    statut = 'en_cours',
    started_at = NOW()
  WHERE id = p_mission_id;
  
  -- Mettre à jour le ticket associé
  UPDATE tickets
  SET statut = 'en_cours'
  WHERE id = v_mission.ticket_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'started_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION start_mission IS 'Démarre une mission (passe de en_attente à en_cours)';

-- =====================================================
-- PARTIE 3 : RPC complete_mission
-- =====================================================

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS complete_mission(UUID);
DROP FUNCTION IF EXISTS complete_mission(UUID, UUID);
DROP FUNCTION IF EXISTS complete_mission(UUID, TEXT);
DROP FUNCTION IF EXISTS complete_mission;

CREATE OR REPLACE FUNCTION complete_mission(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
BEGIN
  -- Vérifier que la mission existe
  SELECT * INTO v_mission
  FROM missions
  WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  -- Vérifier que la mission est en cours
  IF v_mission.statut != 'en_cours' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La mission doit être en cours pour être terminée (statut actuel: ' || v_mission.statut || ')'
    );
  END IF;
  
  -- Terminer la mission
  UPDATE missions
  SET 
    statut = 'terminee',
    completed_at = NOW()
  WHERE id = p_mission_id;
  
  -- Mettre à jour le ticket associé
  UPDATE tickets
  SET statut = 'termine'
  WHERE id = v_mission.ticket_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'completed_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION complete_mission IS 'Termine une mission (passe de en_cours à terminee)';

-- =====================================================
-- PARTIE 4 : RPC generate_facture_from_mission
-- =====================================================

-- Supprimer toutes les versions existantes
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
  -- Récupérer la mission avec ses infos
  SELECT 
    m.*,
    t.id as ticket_id_full
  INTO v_mission
  FROM missions m
  JOIN tickets t ON m.ticket_id = t.id
  WHERE m.id = p_mission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission non trouvée'
    );
  END IF;
  
  -- Vérifier que la mission est terminée
  IF v_mission.statut != 'terminee' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La mission doit être terminée pour générer une facture'
    );
  END IF;
  
  -- Vérifier qu'aucune facture n'existe déjà
  IF EXISTS (SELECT 1 FROM factures WHERE mission_id = p_mission_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Une facture existe déjà pour cette mission'
    );
  END IF;
  
  -- Récupérer la régie via ticket → logement → immeuble
  SELECT i.regie_id INTO v_regie_id
  FROM tickets t
  JOIN logements l ON t.logement_id = l.id
  JOIN immeubles i ON l.immeuble_id = i.id
  WHERE t.id = v_mission.ticket_id;
  
  IF v_regie_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible de déterminer la régie pour cette mission'
    );
  END IF;
  
  -- Utiliser le montant fourni ou celui de la mission
  v_montant := COALESCE(p_montant_ht, v_mission.montant_reel_chf, 0);
  
  -- Générer le numéro de facture (format: FAC-YYYY-NNNN)
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN numero ~ '^FAC-[0-9]{4}-[0-9]+$' 
      THEN CAST(SUBSTRING(numero FROM 'FAC-[0-9]{4}-([0-9]+)') AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM factures
  WHERE numero LIKE 'FAC-' || v_year || '-%';
  
  v_numero := 'FAC-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  -- Créer la facture
  INSERT INTO factures (
    mission_id,
    entreprise_id,
    regie_id,
    numero,
    montant_ht,
    taux_tva,
    taux_commission,
    date_echeance,
    statut,
    notes,
    iban
  )
  VALUES (
    p_mission_id,
    v_mission.entreprise_id,
    v_regie_id,
    v_numero,
    v_montant,
    20.00, -- TVA par défaut 20%
    10.00, -- Commission JTEC par défaut 10%
    CURRENT_DATE + INTERVAL '30 days',
    'brouillon',
    p_description,
    p_iban
  )
  RETURNING id INTO v_facture_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', v_facture_id,
    'numero', v_numero
  );
END;
$$;

COMMENT ON FUNCTION generate_facture_from_mission IS 'Génère une facture pour une mission terminée';

-- =====================================================
-- PARTIE 5 : RPC update_facture_status avec clôture auto
-- =====================================================

-- Supprimer toutes les versions existantes
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
  -- Récupérer la facture
  SELECT * INTO v_facture
  FROM factures
  WHERE id = p_facture_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Facture non trouvée'
    );
  END IF;
  
  -- Vérifier que le nouveau statut est valide
  IF p_nouveau_statut NOT IN ('brouillon', 'envoyee', 'payee', 'refusee') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Statut invalide: ' || p_nouveau_statut
    );
  END IF;
  
  -- Mettre à jour la facture
  UPDATE factures
  SET 
    statut = p_nouveau_statut,
    date_envoi = CASE 
      WHEN p_nouveau_statut = 'envoyee' AND date_envoi IS NULL 
      THEN NOW() 
      ELSE date_envoi 
    END,
    date_paiement = CASE 
      WHEN p_nouveau_statut = 'payee' AND date_paiement IS NULL 
      THEN NOW() 
      ELSE date_paiement 
    END
  WHERE id = p_facture_id
  RETURNING mission_id INTO v_mission_id;
  
  -- Si facture PAYÉE → Clôturer automatiquement ticket + mission
  IF p_nouveau_statut = 'payee' THEN
    -- Récupérer le ticket_id
    SELECT ticket_id INTO v_ticket_id
    FROM missions
    WHERE id = v_mission_id;
    
    -- Clôturer la mission
    UPDATE missions
    SET 
      statut = 'validee',
      validated_at = NOW()
    WHERE id = v_mission_id;
    
    -- Clôturer le ticket
    UPDATE tickets
    SET 
      statut = 'clos',
      date_cloture = NOW()
    WHERE id = v_ticket_id;
  END IF;
  
  -- Si facture REFUSÉE → Ne rien clôturer, laisser ouvert
  
  RETURN jsonb_build_object(
    'success', true,
    'facture_id', p_facture_id,
    'nouveau_statut', p_nouveau_statut,
    'cloture_auto', p_nouveau_statut = 'payee'
  );
END;
$$;

COMMENT ON FUNCTION update_facture_status IS 'Met à jour le statut d''une facture avec clôture automatique si payée';

-- =====================================================
-- PARTIE 6 : TRIGGER auto-génération facture
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_facture_on_mission_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Si la mission passe à "terminee"
  IF NEW.statut = 'terminee' AND OLD.statut != 'terminee' THEN
    
    -- Vérifier si facture existe déjà
    IF NOT EXISTS (SELECT 1 FROM factures WHERE mission_id = NEW.id) THEN
      
      -- Générer facture automatiquement
      SELECT generate_facture_from_mission(
        NEW.id,
        NEW.montant_reel_chf,
        'Facture générée automatiquement suite à la fin de mission',
        NULL -- IBAN sera renseigné par l'entreprise
      ) INTO v_result;
      
      -- Logger en cas d'erreur
      IF (v_result->>'success')::BOOLEAN = FALSE THEN
        RAISE WARNING 'Échec génération auto facture pour mission %: %', NEW.id, v_result->>'error';
      END IF;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_generate_facture_on_mission_complete IS 'Trigger : génère automatiquement une facture quand mission terminée';

-- Créer le trigger (DROP si existe déjà)
DROP TRIGGER IF EXISTS trigger_auto_generate_facture ON missions;

CREATE TRIGGER trigger_auto_generate_facture
  AFTER UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_facture_on_mission_complete();

-- =====================================================
-- PARTIE 7 : VUE missions_factures_complet
-- =====================================================

CREATE OR REPLACE VIEW missions_factures_complet AS
SELECT
  -- Mission
  m.id AS mission_id,
  m.statut AS mission_statut,
  m.created_at AS mission_created_at,
  m.started_at AS mission_started_at,
  m.completed_at AS mission_completed_at,
  m.validated_at AS mission_validated_at,
  m.duree_minutes AS mission_duree_minutes,
  m.notes AS mission_notes,
  m.rapport_url AS mission_rapport_url,
  m.montant_reel_chf AS mission_montant,
  m.photos_urls AS mission_photos,
  
  -- Ticket
  t.id AS ticket_id,
  t.titre AS ticket_titre,
  t.description AS ticket_description,
  t.categorie AS ticket_categorie,
  t.statut AS ticket_statut,
  t.priorite AS ticket_priorite,
  
  -- Entreprise
  e.id AS entreprise_id,
  e.nom AS entreprise_nom,
  e.siret AS entreprise_siret,
  e.email AS entreprise_email,
  e.telephone AS entreprise_telephone,
  e.adresse AS entreprise_adresse,
  
  -- Technicien
  tech.id AS technicien_id,
  tech.nom AS technicien_nom,
  tech.prenom AS technicien_prenom,
  tech.telephone AS technicien_telephone,
  
  -- Locataire
  loc.id AS locataire_id,
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom,
  loc.telephone AS locataire_telephone,
  
  -- Logement
  log.id AS logement_id,
  log.numero AS logement_numero,
  log.etage AS logement_etage,
  
  -- Immeuble
  imm.id AS immeuble_id,
  imm.nom AS immeuble_nom,
  imm.adresse AS immeuble_adresse,
  imm.ville AS immeuble_ville,
  
  -- Régie
  r.id AS regie_id,
  r.nom AS regie_nom,
  
  -- Facture
  f.id AS facture_id,
  f.numero AS facture_numero,
  f.montant_ht AS facture_montant_ht,
  f.montant_ttc AS facture_montant_ttc,
  f.montant_commission AS facture_commission,
  f.statut AS facture_statut,
  f.date_emission AS facture_date_emission,
  f.date_echeance AS facture_date_echeance,
  f.date_paiement AS facture_date_paiement,
  f.iban AS facture_iban,
  f.notes AS facture_notes

FROM missions m
JOIN tickets t ON m.ticket_id = t.id
JOIN entreprises e ON m.entreprise_id = e.id
LEFT JOIN techniciens tech ON m.technicien_id = tech.id
JOIN locataires loc ON t.locataire_id = loc.id
JOIN logements log ON t.logement_id = log.id
JOIN immeubles imm ON log.immeuble_id = imm.id
JOIN regies r ON imm.regie_id = r.id
LEFT JOIN factures f ON f.mission_id = m.id;

COMMENT ON VIEW missions_factures_complet IS 'Vue complète missions + factures pour dashboards entreprise/régie/admin';

-- =====================================================
-- PARTIE 8 : GRANTS (permissions)
-- =====================================================

-- Accorder l'exécution des RPC à authenticated
GRANT EXECUTE ON FUNCTION start_mission TO authenticated;
GRANT EXECUTE ON FUNCTION complete_mission TO authenticated;
GRANT EXECUTE ON FUNCTION generate_facture_from_mission TO authenticated;
GRANT EXECUTE ON FUNCTION update_facture_status TO authenticated;

-- Accorder lecture vue complète
GRANT SELECT ON missions_factures_complet TO authenticated;

-- =====================================================
-- RÉSUMÉ DES CORRECTIFS
-- =====================================================
-- ✅ Colonne iban ajoutée à factures
-- ✅ Colonne duree_minutes calculée automatiquement
-- ✅ RPC start_mission créé
-- ✅ RPC complete_mission créé  
-- ✅ RPC generate_facture_from_mission créé
-- ✅ RPC update_facture_status créé avec clôture auto
-- ✅ Trigger auto-génération facture créé
-- ✅ Vue missions_factures_complet créée
-- 
-- PROCHAINES ÉTAPES :
-- 1. Appliquer migration : psql $DATABASE_URL < ce_fichier.sql
-- 2. Tester workflow complet
-- 3. Adapter frontend pour afficher rapport + édition facture
-- =====================================================
