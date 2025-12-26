/**
 * Rollback M20: Restaurer l'ancienne policy RLS INSERT
 */

DROP POLICY IF EXISTS "Locataire can create own tickets" ON public.tickets;

-- Restaurer l'ancienne policy (problématique mais pour rollback)
CREATE POLICY "Locataire can create own tickets"
ON public.tickets
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM locataires
    WHERE locataires.id = tickets.locataire_id
      AND locataires.profile_id = auth.uid()
  )
);
