-- ============================================================
-- MIGRATION M40: Correction Policy RLS tickets_disponibilites entreprise
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Amélioration performance et cohérence RLS disponibilités
-- Objectif: Entreprise voit disponibilités pour tickets visibles (general + restreint)
-- Dépendances: M09 (table tickets_disponibilites), M39 (policy tickets)
-- Rollback: 20260104001600_m40_fix_rls_disponibilites_rollback.sql
-- ============================================================

-- CONTEXTE:
-- Policy M09 "Entreprise can view disponibilites for visible tickets" utilise vue.
-- Problème: Sous-requête sur vue peut être lente ou ne pas retourner résultats.
-- Solution: Réécrire policy avec même logique que tickets (M39).

-- Supprimer policy actuelle
DROP POLICY IF EXISTS "Entreprise can view disponibilites for visible tickets" ON tickets_disponibilites;

-- Recréer policy avec logique optimisée
CREATE POLICY "Entreprise can view disponibilites for visible tickets"
ON tickets_disponibilites FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM tickets t
    JOIN regies_entreprises re ON re.regie_id = t.regie_id
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE t.id = tickets_disponibilites.ticket_id
      AND e.profile_id = auth.uid()
      AND (
        -- Cas 1: Ticket mode GENERAL + entreprise autorisée marketplace
        (
          t.mode_diffusion = 'general'
          AND t.statut = 'en_attente'
          AND t.locked_at IS NULL
          AND re.mode_diffusion = 'general'
        )
        OR
        -- Cas 2: Ticket mode RESTREINT assigné à cette entreprise
        (
          t.mode_diffusion = 'restreint'
          AND t.entreprise_id = e.id
          AND t.statut IN ('en_attente', 'en_cours', 'termine')
        )
        OR
        -- Cas 3: Ticket accepté par cette entreprise (historique)
        (
          t.entreprise_id = e.id
          AND t.statut IN ('en_cours', 'termine', 'clos')
        )
      )
  )
);

-- Commentaire mis à jour
COMMENT ON POLICY "Entreprise can view disponibilites for visible tickets" ON tickets_disponibilites IS
'Entreprise voit disponibilités pour tickets visibles selon mode_diffusion.
Cas 1: mode general + entreprise autorisée (re.mode_diffusion=general).
Cas 2: mode restreint assigné à cette entreprise.
Cas 3: tickets acceptés (historique missions).
Logique alignée avec policy tickets M39.';

-- Validation
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'tickets_disponibilites'
    AND policyname = 'Entreprise can view disponibilites for visible tickets';
  
  IF v_count = 1 THEN
    RAISE NOTICE '✅ M40: Policy RLS disponibilités corrigée';
  ELSE
    RAISE EXCEPTION '❌ M40: Erreur lors de la mise à jour de la policy';
  END IF;
END $$;

-- ============================================================
-- FIN MIGRATION M40
-- ============================================================
