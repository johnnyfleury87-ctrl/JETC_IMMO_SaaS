-- ============================================================
-- ROLLBACK M39: Restaurer policy M34 sans vérification mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Rollback migration M39
-- Objectif: Rétablir policy M34 originale
-- ============================================================

DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;

CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
    -- Pas de vérification re.mode_diffusion (policy M34 originale)
  )
);

COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Entreprise voit tickets diffusés en mode general de ses régies autorisées (statut en_attente, non verrouillés).
Permet à plusieurs entreprises de voir le même ticket en mode marketplace.';

-- ============================================================
-- FIN ROLLBACK M39
-- ============================================================
