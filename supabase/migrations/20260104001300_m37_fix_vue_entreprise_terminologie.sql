-- ============================================================
-- MIGRATION M37: Correction terminologie vue tickets_visibles_entreprise
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Harmonisation terminologie suite M35
-- Objectif: Mettre à jour vue entreprise avec terminologie 'general'/'restreint'
-- Dépendances: M24 (vue tickets_visibles_entreprise), M35 (harmonisation)
-- Rollback: 20260104001300_m37_fix_vue_entreprise_terminologie_rollback.sql
-- ============================================================

-- CONTEXTE:
-- La vue tickets_visibles_entreprise (M24) utilise ancienne terminologie:
-- - 'public' au lieu de 'general'
-- - 'assigné' au lieu de 'restreint'
-- Migration M35 a harmonisé les données, mais pas la vue.
-- Résultat: Entreprises ne voient AUCUN ticket (WHERE ne match plus).

-- Supprimer vue actuelle
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Recréer vue avec terminologie corrigée
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  -- ===== COLONNES TICKETS (identifiants et métadonnées) =====
  t.id,
  t.regie_id,
  t.entreprise_id,
  t.technicien_id,
  
  -- ===== COLONNES UUIDs SENSIBLES (masquage conditionnel) =====
  -- Règle: NULL si mode_diffusion='general' ET locked_at IS NULL (avant acceptation)
  CASE
    WHEN t.mode_diffusion = 'general' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.locataire_id
  END AS locataire_id,
  
  CASE
    WHEN t.mode_diffusion = 'general' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.logement_id
  END AS logement_id,
  
  -- ===== COLONNES TICKETS (informations techniques) =====
  t.titre,
  t.description,
  t.categorie,
  t.sous_categorie,
  t.piece,
  t.priorite,
  t.statut,
  t.urgence,
  
  -- ===== COLONNES MÉTIER (diffusion et verrouillage) =====
  t.mode_diffusion,
  t.locked_at,
  t.plafond_intervention_chf,
  t.devise,
  
  -- ===== COLONNES DATES =====
  t.date_creation,
  t.date_cloture,
  t.date_limite,
  t.created_at,
  t.updated_at,
  
  -- ===== COLONNES MEDIA =====
  t.photos,
  
  -- ===== COLONNE VILLE (via JOIN immeubles) =====
  i.ville AS ville,
  
  -- ===== COLONNES VUE (métadonnées visibilité) =====
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode

FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
LEFT JOIN logements lg ON lg.id = t.logement_id
LEFT JOIN immeubles i ON i.id = lg.immeuble_id

WHERE
  -- Cas 1: Tickets diffusés en mode GENERAL (marketplace)
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'general'  -- ✅ Corrigé: 'public' → 'general'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  -- Cas 2: Tickets diffusés en mode RESTREINT à cette entreprise
  (
    t.mode_diffusion = 'restreint'  -- ✅ Corrigé: 'assigné' → 'restreint'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  -- Cas 3: Tickets acceptés par cette entreprise (historique)
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

-- Accorder permissions
GRANT SELECT ON tickets_visibles_entreprise TO authenticated;

-- Commentaire
COMMENT ON VIEW tickets_visibles_entreprise IS 
'Vue entreprise avec masquage RGPD et terminologie harmonisée (general/restreint).
Cas 1: mode_diffusion=general → marketplace (multiple entreprises).
Cas 2: mode_diffusion=restreint → assignation directe (une seule entreprise).
Cas 3: Tickets acceptés (historique missions).
Colonnes sensibles (locataire_id, logement_id) masquées en mode general avant acceptation.';

-- ============================================================
-- VALIDATION QUERIES
-- ============================================================

-- VALIDATION 1: Vérifier vue recréée
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'tickets_visibles_entreprise';
-- Attendu: 1 ligne (VIEW)

-- VALIDATION 2: Vérifier définition contient 'general' et 'restreint'
SELECT definition 
FROM pg_views 
WHERE viewname = 'tickets_visibles_entreprise';
-- Attendu: Contient "mode_diffusion = 'general'" et "mode_diffusion = 'restreint'"

-- VALIDATION 3: Test requête entreprise (remplacer <entreprise_id>)
-- SELECT COUNT(*) 
-- FROM tickets_visibles_entreprise 
-- WHERE visible_par_entreprise_id = '<entreprise_id>';
-- Attendu: Nombre de tickets visibles (> 0 si tickets en mode general existent)

-- ============================================================
-- FIN MIGRATION M37
-- ============================================================
