-- ============================================================
-- ROLLBACK M24 - Restaurer vue M06 sans masquage
-- ============================================================
-- Restaure vue tickets_visibles_entreprise état M06 (SELECT t.*)
-- À utiliser SI bugs détectés après déploiement M24
-- ============================================================

-- Supprimer vue M24
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Recréer vue M06 originale (SANS masquage)
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  t.*,
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE
  -- Cas 1: Tickets diffusés en mode PUBLIC
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  -- Cas 2: Tickets diffusés en mode ASSIGNÉ à cette entreprise
  (
    t.mode_diffusion = 'assigné'
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

-- ⚠️ ATTENTION: Rollback retire masquage sécurité
-- UUIDs locataire_id/logement_id redeviennent visibles mode public
-- Colonne ville disparaît (nécessite JOIN immeubles manuellement)

-- ============================================================
-- FIN ROLLBACK M24
-- ============================================================
