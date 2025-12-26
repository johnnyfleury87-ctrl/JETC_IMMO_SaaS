/**
 * Rollback M24 : Restaurer anciennes policies régie
 */

DROP POLICY IF EXISTS "Regie can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Regie can update own tickets" ON public.tickets;

-- Restaurer anciennes policies avec get_user_regie_id()
CREATE POLICY "Regie can view own tickets"
ON public.tickets FOR SELECT
USING (regie_id = get_user_regie_id());

CREATE POLICY "Regie can manage own tickets"
ON public.tickets FOR ALL
USING (regie_id = get_user_regie_id());
