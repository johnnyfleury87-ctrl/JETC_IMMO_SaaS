/**
 * Migration M20: Correction policy RLS INSERT tickets
 * 
 * PROBLÈME IDENTIFIÉ (audit CSV ligne 178-180):
 * La policy INSERT "Locataire can create own tickets" utilise WITH CHECK qui référence
 * tickets.locataire_id dans un contexte où PostgREST ne voit pas encore cette colonne
 * pendant l'évaluation RLS, causant l'erreur 42703 "column locataire_id does not exist"
 * 
 * SOLUTION:
 * Simplifier la policy INSERT pour vérifier uniquement que l'utilisateur est un locataire
 * via profiles.role, sans référencer tickets.locataire_id.
 * La validation "locataire a un logement" reste dans le trigger
 * ensure_locataire_has_logement_before_ticket.
 * 
 * RÈGLE SQL:
 * Pour INSERT, utiliser WITH CHECK (pas USING)
 */

-- Supprimer l'ancienne policy problématique
DROP POLICY IF EXISTS "Locataire can create own tickets" ON public.tickets;

-- Créer la nouvelle policy INSERT simplifiée
CREATE POLICY "Locataire can create own tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  -- Vérifier uniquement que l'utilisateur authentifié est un locataire
  -- via son profil (pas de référence à tickets.locataire_id)
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'locataire'::user_role
  )
);

COMMENT ON POLICY "Locataire can create own tickets" ON public.tickets IS
  'Policy INSERT simplifiée: vérifie uniquement role=locataire. La validation logement est dans le trigger.';

-- ============================================================
-- VALIDATION (à exécuter après migration)
-- ============================================================

-- Test 1: Vérifier que la policy existe
-- SELECT * FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Locataire can create own tickets';
-- Attendu: 1 ligne avec cmd='INSERT'

-- Test 2: Tester INSERT via API locataire
-- POST /api/tickets/create avec token locataire valide
-- Attendu: 200/201 OK, ticket créé

-- Test 3: Tester INSERT via API non-locataire
-- POST /api/tickets/create avec token regie/entreprise
-- Attendu: 403 Forbidden (policy RLS bloque)
