-- ============================================================
-- ROLLBACK M07 - Restaurer ancienne policy RLS entreprise
-- ============================================================
-- Date: 2025-12-26
-- Objectif: Annuler M07 - Restaurer ancienne policy cassée
-- Conséquence: RLS entreprise redevient cassée (filtre mauvais statut, pas de mode_diffusion)
-- ============================================================

-- Supprimer policy corrigée
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

-- ATTENTION: Recréer ancienne version cassée (filtrait statut='ouvert' au lieu de 'en_attente')
-- Version pré-migration ne gérait pas mode_diffusion, locked_at
-- Pour rollback complet, restaurer depuis backup SQL pré-migration

-- Placeholder: Recréer version simplifiée cassée
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT TO authenticated
USING (
  -- VERSION CASSÉE: filtre statut='ouvert' au lieu de 'en_attente'
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND statut = 'ouvert'  -- ❌ BUG: tickets diffusés sont en 'en_attente', pas 'ouvert'
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
    AND e.profile_id = auth.uid()
  )
);

-- ============================================================
-- VALIDATION POST-ROLLBACK
-- ============================================================

-- VALIDATION 1: Vérifier policy restaurée (version cassée)
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'tickets' 
-- AND policyname = 'Entreprise can view authorized tickets';
-- Attendu: 1 ligne

-- VALIDATION 2: Comportement cassé attendu
-- API call: GET /rest/v1/tickets (avec JWT entreprise)
-- Attendu: 0 ticket en statut 'en_attente' visible (bug RLS filtre mauvais statut)

-- VALIDATION 3: Régression workflow confirmée
-- Workflow tickets cassé (entreprises ne voient plus tickets diffusés)

-- ============================================================
-- FIN ROLLBACK M07
-- ============================================================
