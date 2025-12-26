-- ============================================================
-- ROLLBACK M06 - Restaurer ancienne vue tickets_visibles_entreprise
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M06 - Restaurer ancienne version cassée de la vue
-- Conséquence: Tickets redeviennent invisibles pour entreprises (bug workflow)
-- ============================================================

-- Supprimer vue corrigée
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- ATTENTION: Recréer ancienne version cassée (filtrait statut='ouvert' au lieu de 'en_attente')
-- Version pré-migration utilisait mauvais statut, ne gérait pas mode_diffusion
-- Pour rollback complet, restaurer depuis backup SQL pré-migration

-- Placeholder: Recréer version simplifiée cassée
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  t.*,
  re.entreprise_id AS visible_par_entreprise_id
FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
WHERE
  -- VERSION CASSÉE: filtre statut='ouvert' au lieu de 'en_attente'
  t.statut = 'ouvert'  -- ❌ BUG: tickets diffusés sont en 'en_attente', pas 'ouvert'
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re2
    WHERE re2.regie_id = t.regie_id
    AND re2.entreprise_id = re.entreprise_id
  );

GRANT SELECT ON tickets_visibles_entreprise TO authenticated;

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier vue restaurée (version cassée)
-- SELECT table_name FROM information_schema.views 
-- WHERE table_name = 'tickets_visibles_entreprise';
-- Attendu: 1 ligne

-- VALIDATION 2: Comportement cassé attendu
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise WHERE statut = 'en_attente';
-- Attendu: 0 (bug: vue ne retourne aucun ticket diffusé)

-- VALIDATION 3: Régression workflow confirmée
-- Workflow tickets cassé (entreprises ne voient plus tickets disponibles)

-- ============================================================
-- FIN ROLLBACK M06
-- ============================================================
