/**
 * Migration M24 : Policy RLS SELECT tickets pour régies
 * 
 * PROBLÈME IDENTIFIÉ:
 * - Régie déconnectée automatiquement sur page tickets
 * - Policy "Regie can view own tickets" existe mais utilise get_user_regie_id()
 * - Possible récursion RLS ou policy non appliquée en prod
 * 
 * SOLUTION:
 * - Créer policy SELECT EXPLICITE sans fonction helper
 * - Vérification directe via JOIN regies.profile_id = auth.uid()
 * - Évite récursion RLS
 */

-- Supprimer anciennes policies SELECT régie si existent
DROP POLICY IF EXISTS "Regie can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Regie can manage own tickets" ON public.tickets;

-- Créer policy SELECT explicite pour régie
CREATE POLICY "Regie can view own tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = tickets.regie_id
      AND r.profile_id = auth.uid()
  )
);

-- Créer policy UPDATE/DELETE pour régie (si besoin)
CREATE POLICY "Regie can update own tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM regies r
    WHERE r.id = tickets.regie_id
      AND r.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Regie can view own tickets" ON public.tickets IS 
'Régie peut lire tous les tickets où regie_id correspond à son profile_id. Pas de récursion RLS.';

COMMENT ON POLICY "Regie can update own tickets" ON public.tickets IS 
'Régie peut modifier (priorité, plafond, diffusion) ses propres tickets.';
