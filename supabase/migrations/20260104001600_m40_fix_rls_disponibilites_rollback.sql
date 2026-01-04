-- ============================================================
-- ROLLBACK M40: Restaurer policy M09 originale
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Rollback migration M40
-- Objectif: Rétablir policy tickets_disponibilites M09
-- ============================================================

DROP POLICY IF EXISTS "Entreprise can view disponibilites for visible tickets" ON tickets_disponibilites;

CREATE POLICY "Entreprise can view disponibilites for visible tickets"
ON tickets_disponibilites FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND ticket_id IN (
    SELECT id FROM tickets_visibles_entreprise 
    WHERE visible_par_entreprise_id = (
      SELECT id FROM entreprises WHERE profile_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "Entreprise can view disponibilites for visible tickets" ON tickets_disponibilites IS
'Entreprise voit créneaux tickets visibles (diffusés).';

-- ============================================================
-- FIN ROLLBACK M40
-- ============================================================
