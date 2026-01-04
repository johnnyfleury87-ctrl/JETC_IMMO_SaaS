-- ============================================================
-- ROLLBACK M37: Restaurer vue avec ancienne terminologie
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Rollback migration M37
-- Objectif: Rétablir vue tickets_visibles_entreprise M24 (public/assigné)
-- ============================================================

-- Supprimer vue actuelle
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Recréer vue avec terminologie M24 originale
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  t.id,
  t.regie_id,
  t.entreprise_id,
  t.technicien_id,
  
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.locataire_id
  END AS locataire_id,
  
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.logement_id
  END AS logement_id,
  
  t.titre,
  t.description,
  t.categorie,
  t.sous_categorie,
  t.piece,
  t.priorite,
  t.statut,
  t.urgence,
  t.mode_diffusion,
  t.locked_at,
  t.plafond_intervention_chf,
  t.devise,
  t.date_creation,
  t.date_cloture,
  t.date_limite,
  t.created_at,
  t.updated_at,
  t.photos,
  i.ville AS ville,
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode

FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
LEFT JOIN logements lg ON lg.id = t.logement_id
LEFT JOIN immeubles i ON i.id = lg.immeuble_id

WHERE
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  (
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

GRANT SELECT ON tickets_visibles_entreprise TO authenticated;

-- ============================================================
-- FIN ROLLBACK M37
-- ============================================================
