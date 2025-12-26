-- ============================================================
-- MIGRATION M06 - Corriger vue tickets_visibles_entreprise
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Corriger vue pour utiliser mode_diffusion + statut correct + locked_at
-- Dépendances: M01, M02, M03, M04, M05 (colonnes + RPCs)
-- Rollback: 20251226170500_m06_fix_view_tickets_visibles_entreprise_rollback.sql
-- ============================================================

-- Supprimer ancienne vue (CASCADE si d'autres objets en dépendent)
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Créer nouvelle vue corrigée
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

-- Créer index pour performances (si pas déjà existants via migrations colonnes)
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets(statut);
CREATE INDEX IF NOT EXISTS idx_tickets_locked_at ON tickets(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_entreprise_id ON tickets(entreprise_id) WHERE entreprise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regies_entreprises_entreprise_id ON regies_entreprises(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_regies_entreprises_regie_id ON regies_entreprises(regie_id);

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier vue créée
-- SELECT table_name, table_type 
-- FROM information_schema.views 
-- WHERE table_name = 'tickets_visibles_entreprise';
-- Attendu: 1 ligne (VIEW)

-- VALIDATION 2: Vérifier colonnes vue
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'tickets_visibles_entreprise';
-- Attendu: Toutes colonnes tickets + visible_par_entreprise_id + autorisation_mode

-- VALIDATION 3: Test visibilité mode public (staging)
-- Pré-requis: Ticket mode_diffusion='public', statut='en_attente', locked_at=NULL
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise 
--        WHERE id = '<ticket_id>' AND visible_par_entreprise_id = '<entreprise_autorisee_general>';
-- Attendu: 1 (entreprise autorisée voit ticket)

-- VALIDATION 4: Test invisibilité mode public pour entreprise restreinte
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise 
--        WHERE id = '<ticket_id>' AND visible_par_entreprise_id = '<entreprise_restreinte>';
-- Attendu: 0 (entreprise mode 'restreint' ne voit pas tickets publics)

-- VALIDATION 5: Test invisibilité ticket verrouillé
-- Pré-requis: Ticket locked_at NOT NULL
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise 
--        WHERE id = '<ticket_id>' AND visible_par_entreprise_id != entreprise_id;
-- Attendu: 0 (autres entreprises ne voient plus ticket verrouillé)

-- VALIDATION 6: Test visibilité mode assigné
-- Pré-requis: Ticket mode_diffusion='assigné', entreprise_id=<E1>
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise 
--        WHERE id = '<ticket_id>' AND visible_par_entreprise_id = '<E1>';
-- Attendu: 1 (entreprise assignée voit ticket)
-- Query: SELECT COUNT(*) FROM tickets_visibles_entreprise 
--        WHERE id = '<ticket_id>' AND visible_par_entreprise_id = '<E2>';
-- Attendu: 0 (autre entreprise ne voit pas)

-- ============================================================
-- FIN MIGRATION M06
-- ============================================================
