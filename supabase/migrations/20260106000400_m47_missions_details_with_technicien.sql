-- =====================================================
-- MIGRATION M47: Améliorer vue missions_details avec technicien
-- =====================================================
-- Date: 2026-01-06
-- Auteur: Amélioration affichage missions entreprise
-- Objectif: Ajouter infos technicien dans missions_details
-- Impact: Dashboard entreprise pourra afficher nom du technicien assigné
-- =====================================================

-- CONTEXTE:
-- Vue missions_details existe mais ne contient PAS les informations du technicien
-- Entreprise ne peut pas voir à quel technicien elle a confié la mission
-- Pattern: Aligner avec planning_technicien qui contient les infos technicien

-- =====================================================
-- 1. RECRÉER VUE missions_details avec infos technicien
-- =====================================================

DROP VIEW IF EXISTS missions_details CASCADE;

CREATE OR REPLACE VIEW missions_details AS
SELECT
  -- ============================================================
  -- MISSION
  -- ============================================================
  m.id AS mission_id,
  m.ticket_id,
  m.entreprise_id,
  m.technicien_id,
  m.statut AS mission_statut,
  m.created_at AS mission_created_at,
  m.started_at AS mission_started_at,
  m.completed_at AS mission_completed_at,
  m.validated_at AS mission_validated_at,
  m.date_intervention_prevue,
  m.date_intervention_realisee,
  m.notes AS mission_notes,
  m.devis_url,
  m.facture_url,
  m.rapport_url,
  m.montant_reel_chf AS mission_montant,
  m.devise,
  
  -- ============================================================
  -- TECHNICIEN (si assigné)
  -- ============================================================
  tech.id AS technicien_id_full,
  tech.nom AS technicien_nom,
  tech.prenom AS technicien_prenom,
  tech.telephone AS technicien_telephone,
  tech.email AS technicien_email,
  tech.actif AS technicien_actif,
  tech.profile_id AS technicien_profile_id,
  
  -- ============================================================
  -- TICKET
  -- ============================================================
  t.id AS ticket_id_full,
  t.titre AS ticket_titre,
  t.description AS ticket_description,
  t.categorie AS ticket_categorie,
  t.priorite AS ticket_priorite,
  t.statut AS ticket_statut,
  t.urgence AS ticket_urgence,
  t.locked_at AS ticket_locked_at,
  t.date_creation AS ticket_date_creation,
  t.date_cloture AS ticket_date_cloture,
  t.date_limite AS ticket_date_limite,
  
  -- ============================================================
  -- ENTREPRISE
  -- ============================================================
  e.id AS entreprise_id_full,
  e.nom AS entreprise_nom,
  e.siret AS entreprise_siret,
  e.adresse AS entreprise_adresse,
  e.code_postal AS entreprise_code_postal,
  e.ville AS entreprise_ville,
  e.telephone AS entreprise_telephone,
  e.email AS entreprise_email,
  e.profile_id AS entreprise_profile_id,
  
  -- ============================================================
  -- LOCATAIRE
  -- ============================================================
  loc.id AS locataire_id,
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom,
  loc.telephone AS locataire_telephone,
  loc.email AS locataire_email,
  
  -- ============================================================
  -- LOGEMENT
  -- ============================================================
  log.id AS logement_id,
  log.numero AS logement_numero,
  log.etage AS logement_etage,
  log.superficie AS logement_surface,
  log.nombre_pieces AS logement_nb_pieces,
  
  -- ============================================================
  -- IMMEUBLE
  -- ============================================================
  imm.id AS immeuble_id,
  imm.nom AS immeuble_nom,
  imm.adresse AS immeuble_adresse,
  imm.npa AS immeuble_code_postal,
  imm.ville AS immeuble_ville,
  
  -- ============================================================
  -- RÉGIE
  -- ============================================================
  r.id AS regie_id,
  r.nom AS regie_nom,
  r.adresse AS regie_adresse,
  r.code_postal AS regie_code_postal,
  r.ville AS regie_ville,
  r.telephone AS regie_telephone,
  r.email AS regie_email

FROM missions m

-- Joins obligatoires
INNER JOIN tickets t ON m.ticket_id = t.id
INNER JOIN entreprises e ON m.entreprise_id = e.id
INNER JOIN locataires loc ON t.locataire_id = loc.id
INNER JOIN logements log ON t.logement_id = log.id
INNER JOIN immeubles imm ON log.immeuble_id = imm.id
INNER JOIN regies r ON imm.regie_id = r.id

-- Technicien optionnel (LEFT JOIN car peut ne pas être assigné)
LEFT JOIN techniciens tech ON m.technicien_id = tech.id;

COMMENT ON VIEW missions_details IS 
'Vue complète des missions avec toutes les informations associées (ticket, entreprise, technicien, locataire, logement, immeuble, régie).
✅ Inclut infos technicien (nom, prénom, téléphone) pour affichage par entreprise.
Créée par M47 (2026-01-06).';

-- =====================================================
-- 2. PERMISSIONS
-- =====================================================

-- Accès authentifié (RLS héritera des policies missions)
GRANT SELECT ON missions_details TO authenticated;

-- =====================================================
-- 3. VALIDATION
-- =====================================================

DO $$
DECLARE
  v_count_columns integer;
  v_has_technicien boolean;
BEGIN
  RAISE NOTICE '✅ VALIDATION M47';
  RAISE NOTICE '===========================================';
  
  -- Compter colonnes de la vue
  SELECT COUNT(*) INTO v_count_columns
  FROM information_schema.columns
  WHERE table_name = 'missions_details';
  
  RAISE NOTICE 'Colonnes missions_details: %', v_count_columns;
  
  IF v_count_columns < 40 THEN
    RAISE WARNING '⚠️  Nombre de colonnes faible (attendu: 50+)';
  END IF;
  
  -- Vérifier présence colonnes technicien
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'missions_details'
    AND column_name = 'technicien_nom'
  ) INTO v_has_technicien;
  
  IF NOT v_has_technicien THEN
    RAISE EXCEPTION '❌ M47: Colonne technicien_nom manquante';
  END IF;
  
  RAISE NOTICE '✅ Colonne technicien_nom présente';
  RAISE NOTICE '✅ M47: Vue missions_details mise à jour avec succès';
  RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- FIN MIGRATION M47
-- =====================================================
