-- ============================================================
-- MIGRATION M13 - Sécuriser DELETE tickets (RLS)
-- ============================================================
-- Date: 2025-12-26
-- Phase: 3 (Sécurisation & Cohérence workflow)
-- Objectif: Empêcher suppression ticket si mission existe + restreindre aux rôles régie/admin
-- Dépendances: PHASE 1 (table missions), PHASE 2 complète
-- Rollback: 20251226171100_m13_secure_delete_tickets_rls_rollback.sql
-- ============================================================

-- Créer fonction helper : vérifier si ticket a mission associée
CREATE OR REPLACE FUNCTION ticket_has_mission(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM missions 
    WHERE ticket_id = p_ticket_id
  );
$$;

-- Supprimer ancienne policy DELETE (si existe)
DROP POLICY IF EXISTS "Regie can delete tickets" ON tickets;
DROP POLICY IF EXISTS "Delete tickets by regie" ON tickets;
DROP POLICY IF EXISTS "Allow regie to delete tickets" ON tickets;

-- Créer policy DELETE sécurisée pour tickets
CREATE POLICY "Regie can delete tickets without mission"
ON tickets FOR DELETE TO authenticated
USING (
  -- Condition 1 : Rôle autorisé (régie ou admin_jtec)
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('regie', 'admin_jtec')
  AND
  -- Condition 2 : Ticket appartient à SA régie (isolation)
  (
    -- Pour régie : uniquement SES tickets
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'regie'
      AND regie_id = (SELECT regie_id FROM profiles WHERE id = auth.uid())
    )
    OR
    -- Pour admin_jtec : tous tickets
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_jtec'
  )
  AND
  -- Condition 3 : AUCUNE mission associée
  NOT ticket_has_mission(id)
);

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier fonction créée
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'ticket_has_mission';
-- Attendu: 1 ligne

-- VALIDATION 2: Vérifier policy créée
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE tablename = 'tickets' 
-- AND policyname = 'Regie can delete tickets without mission';
-- Attendu: 1 ligne avec cmd='DELETE'

-- VALIDATION 3: Vérifier anciennes policies supprimées
-- SELECT policyname FROM pg_policies 
-- WHERE tablename = 'tickets' 
-- AND cmd = 'DELETE' 
-- AND policyname != 'Regie can delete tickets without mission';
-- Attendu: 0 ligne

-- VALIDATION 4: Test DELETE ticket SANS mission (doit réussir - staging uniquement)
-- Pré-requis: Ticket créé par régie, aucune mission associée
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_regie>
-- Attendu: HTTP 204 No Content (suppression réussie)

-- VALIDATION 5: Test DELETE ticket AVEC mission (doit échouer - staging uniquement)
-- Pré-requis: Ticket avec mission acceptée (mission.ticket_id = <ticket_id>)
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_regie>
-- Attendu: HTTP 403 Forbidden ou 0 row deleted (RLS bloque)

-- VALIDATION 6: Test DELETE par locataire (doit échouer - staging uniquement)
-- Pré-requis: Ticket créé par locataire
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_locataire>
-- Attendu: HTTP 403 Forbidden (rôle non autorisé)

-- VALIDATION 7: Test DELETE par entreprise (doit échouer - staging uniquement)
-- Pré-requis: Ticket visible par entreprise
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_entreprise>
-- Attendu: HTTP 403 Forbidden (rôle non autorisé)

-- VALIDATION 8: Test isolation régie (doit échouer - staging uniquement)
-- Pré-requis: Ticket régie R1, user régie R2
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id_R1>
-- Headers: Authorization Bearer <jwt_regie_R2>
-- Attendu: HTTP 403 Forbidden ou 0 row deleted (isolation RLS)

-- VALIDATION 9: Test DELETE admin_jtec (doit réussir - staging uniquement)
-- Pré-requis: Ticket sans mission, user admin_jtec
-- Via API: DELETE /rest/v1/tickets?id=eq.<ticket_id>
-- Headers: Authorization Bearer <jwt_admin_jtec>
-- Attendu: HTTP 204 No Content (admin peut supprimer tous tickets sans mission)

-- VALIDATION 10: Test fonction ticket_has_mission directement (staging SQL)
-- Pré-requis: 1 ticket avec mission, 1 ticket sans mission
-- SELECT ticket_has_mission('<ticket_id_avec_mission>');
-- Attendu: true
-- SELECT ticket_has_mission('<ticket_id_sans_mission>');
-- Attendu: false

-- ============================================================
-- FIN MIGRATION M13
-- ============================================================
