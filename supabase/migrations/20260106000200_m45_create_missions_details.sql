-- =====================================================
-- MIGRATION M45: Création vue missions_details
-- =====================================================
-- Date: 2026-01-06
-- Auteur: Audit complet vues/logins
-- Objectif: Créer vue missions_details manquante (définie dans schema mais jamais migrée)
-- Dépendances: Tables missions, tickets, entreprises, locataires, logements, immeubles, regies
-- Rollback: 20260106000200_m45_create_missions_details_rollback.sql
-- =====================================================

-- CONTEXTE:
-- Vue missions_details est définie dans supabase/schema/13_missions.sql (ligne 289)
-- mais n'a jamais été créée par une migration.
-- Frontend utilise des joins manuels, mais la vue simplifiera les requêtes.

-- =====================================================
-- 1. CRÉER VUE MISSIONS_DETAILS
-- =====================================================

CREATE OR REPLACE VIEW missions_details AS
SELECT
  -- Colonnes mission
  m.id AS mission_id,
  m.ticket_id,
  m.entreprise_id,
  m.technicien_id,
  m.statut AS mission_statut,
  m.created_at AS mission_created_at,
  m.started_at,
  m.completed_at,
  m.validated_at,
  m.notes,
  m.devis_url,
  m.facture_url,
  m.rapport_url,
  m.montant_reel_chf AS montant,
  m.devise,
  m.disponibilite_id,
  
  -- Informations ticket
  t.titre AS ticket_titre,
  t.description AS ticket_description,
  t.categorie AS ticket_categorie,
  t.sous_categorie AS ticket_sous_categorie,
  t.piece AS ticket_piece,
  t.priorite AS ticket_priorite,
  t.statut AS ticket_statut,
  t.urgence AS ticket_urgence,
  t.locked_at AS ticket_locked_at,
  t.plafond_intervention_chf,
  t.date_creation AS ticket_date_creation,
  
  -- Informations entreprise
  e.nom AS entreprise_nom,
  e.siret AS entreprise_siret,
  e.telephone AS entreprise_telephone,
  e.email AS entreprise_email,
  
  -- Informations technicien (si assigné)
  tech.nom AS technicien_nom,
  tech.prenom AS technicien_prenom,
  tech.telephone AS technicien_telephone,
  
  -- Informations locataire
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom,
  loc.telephone AS locataire_telephone,
  
  -- Informations logement
  log.numero AS logement_numero,
  log.etage AS logement_etage,
  
  -- Informations immeuble
  imm.nom AS immeuble_nom,
  imm.adresse AS immeuble_adresse,
  imm.code_postal AS immeuble_code_postal,
  imm.ville AS immeuble_ville,
  
  -- Informations régie
  r.id AS regie_id,
  r.nom AS regie_nom,
  r.telephone AS regie_telephone,
  r.email AS regie_email

FROM missions m
INNER JOIN tickets t ON m.ticket_id = t.id
INNER JOIN entreprises e ON m.entreprise_id = e.id
INNER JOIN locataires loc ON t.locataire_id = loc.id
INNER JOIN logements log ON t.logement_id = log.id
INNER JOIN immeubles imm ON log.immeuble_id = imm.id
INNER JOIN regies r ON t.regie_id = r.id
LEFT JOIN techniciens tech ON m.technicien_id = tech.id;

-- =====================================================
-- 2. COMMENTAIRE
-- =====================================================

COMMENT ON VIEW missions_details IS 
'Vue complète des missions avec toutes les informations associées (ticket, entreprise, technicien, locataire, logement, immeuble, régie).
Simpllifie les requêtes frontend/backend en évitant les joins manuels.
Créée par M45 (2026-01-06).';

-- =====================================================
-- 3. PERMISSIONS
-- =====================================================

-- Accès authentifié (RLS héritera des policies missions)
GRANT SELECT ON missions_details TO authenticated;

-- =====================================================
-- 4. VALIDATION
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'missions_details' 
    AND table_type = 'VIEW'
  ) THEN
    RAISE NOTICE '✅ M45: Vue missions_details créée avec succès';
  ELSE
    RAISE EXCEPTION '❌ M45: Erreur lors de la création de missions_details';
  END IF;
END $$;

-- =====================================================
-- FIN MIGRATION M45
-- =====================================================
