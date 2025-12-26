-- ============================================================
-- MIGRATION M07 - Corriger policy RLS entreprise sur tickets
-- ============================================================
-- Date: 2025-12-26
-- Phase: 1 (Débloquer workflow)
-- Objectif: Corriger policy RLS pour utiliser mode_diffusion + locked_at + statut correct
-- Dépendances: M01-M06 (toutes colonnes + vue corrigée)
-- Rollback: 20251226170600_m07_fix_rls_policy_entreprise_rollback.sql
-- ============================================================

-- Supprimer ancienne policy (si existe)
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

-- Créer nouvelle policy corrigée
CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT TO authenticated
USING (
  -- Vérifier que l'utilisateur est bien une entreprise
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  (
    -- Cas 1: Tickets diffusés en mode PUBLIC, non verrouillés, statut en_attente
    (
      mode_diffusion = 'public'
      AND statut = 'en_attente'
      AND locked_at IS NULL
      AND EXISTS (
        SELECT 1 FROM regies_entreprises re
        JOIN entreprises e ON e.id = re.entreprise_id
        WHERE re.regie_id = tickets.regie_id
        AND e.profile_id = auth.uid()
        AND re.mode_diffusion = 'general'
      )
    )
    OR
    -- Cas 2: Tickets diffusés en mode ASSIGNÉ à cette entreprise
    (
      mode_diffusion = 'assigné'
      AND entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      AND statut IN ('en_attente', 'en_cours', 'termine')
    )
    OR
    -- Cas 3: Tickets acceptés par cette entreprise (historique missions)
    (
      entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())
      AND statut IN ('en_cours', 'termine', 'clos')
    )
  )
);

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier policy créée
-- SELECT policyname, cmd, permissive 
-- FROM pg_policies 
-- WHERE tablename = 'tickets' 
-- AND policyname = 'Entreprise can view authorized tickets';
-- Attendu: 1 ligne (SELECT, PERMISSIVE)

-- VALIDATION 2: Test RLS mode public via API (staging avec JWT entreprise)
-- Pré-requis: Entreprise autorisée mode 'general', ticket mode_diffusion='public' statut='en_attente'
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise>
-- Attendu: 1 ligne retournée (ticket visible)

-- VALIDATION 3: Test RLS isolation entreprise restreinte via API
-- Pré-requis: Entreprise mode 'restreint', ticket mode_diffusion='public'
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise_restreinte>
-- Attendu: 0 ligne (ticket invisible)

-- VALIDATION 4: Test RLS ticket verrouillé via API
-- Pré-requis: Ticket locked_at NOT NULL par entreprise E1
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise_E2>
-- Attendu: 0 ligne (autre entreprise ne voit plus ticket verrouillé)

-- VALIDATION 5: Test RLS mode assigné via API
-- Pré-requis: Ticket mode_diffusion='assigné', entreprise_id=<E1>
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise_E1>
-- Attendu: 1 ligne (entreprise assignée voit ticket)
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise_E2>
-- Attendu: 0 ligne (autre entreprise ne voit pas)

-- VALIDATION 6: Test RLS historique missions via API
-- Pré-requis: Ticket statut='clos', entreprise_id=<E1>
-- API call: GET /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise_E1>
-- Attendu: 1 ligne (entreprise voit ticket de sa mission terminée)

-- ============================================================
-- FIN MIGRATION M07
-- ============================================================
