-- ============================================================
-- PROBES_TICKETS.sql
-- Requêtes de diagnostic pour l'audit tickets création
-- ============================================================

-- STEP 2: Vérifier que PostgREST voit la colonne locataire_id
-- (à exécuter via API avec service_role)
SELECT 'locataire_id' as test_column, COUNT(*) as count_records
FROM public.tickets
WHERE locataire_id IS NOT NULL
LIMIT 1;

-- STEP 5: RPC temporaire pour INSERT direct (bypass PostgREST)
-- Preuve que SQL direct fonctionne
DROP FUNCTION IF EXISTS public.jtec_insert_ticket_audit(uuid, uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.jtec_insert_ticket_audit(
  p_locataire_id uuid,
  p_logement_id uuid,
  p_regie_id uuid,
  p_titre text,
  p_description text,
  p_categorie text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id uuid;
  v_created_at timestamptz;
BEGIN
  -- INSERT direct en SQL (bypass PostgREST)
  INSERT INTO public.tickets (
    titre,
    description,
    categorie,
    locataire_id,
    logement_id,
    regie_id
  )
  VALUES (
    p_titre,
    p_description,
    p_categorie,
    p_locataire_id,
    p_logement_id,
    p_regie_id
  )
  RETURNING id, created_at INTO v_ticket_id, v_created_at;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'created_at', v_created_at,
    'method', 'direct_sql_insert',
    'message', 'INSERT SQL réussi via RPC'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', SQLERRM,
      'error_state', SQLSTATE,
      'method', 'direct_sql_insert'
    );
END;
$$;

-- STEP 6: Corriger la policy INSERT (si nécessaire)
-- Policy INSERT n'accepte QUE WITH CHECK, pas USING
DROP POLICY IF EXISTS "Locataire can create own tickets" ON public.tickets;

CREATE POLICY "Locataire can create own tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'locataire'
  )
);

-- STEP 7: Vérifier les derniers tickets créés
SELECT 
  id,
  titre,
  statut,
  locataire_id,
  logement_id,
  regie_id,
  created_at
FROM public.tickets
ORDER BY created_at DESC
LIMIT 5;

-- STEP 8: Diagnostic détaillé si erreur persiste
-- Vérifier l'état exact de la table et colonnes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name IN ('locataire_id', 'logement_id', 'regie_id')
ORDER BY ordinal_position;

-- Vérifier les policies RLS actuelles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tickets'
  AND cmd = 'INSERT';

-- Vérifier les triggers BEFORE INSERT
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tickets'
  AND action_timing = 'BEFORE'
  AND event_manipulation = 'INSERT';
