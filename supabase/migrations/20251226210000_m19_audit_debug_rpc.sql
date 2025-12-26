/**
 * Migration M19: RPC Debug Schema pour audit tickets
 * 
 * OBJECTIF: Créer une fonction de debug qui retourne l'état réel du schéma
 * tel que vu par l'API via PostgREST, pour diagnostiquer l'erreur "locataire_id does not exist"
 * 
 * Cette fonction sera appelée depuis api/tickets/create.js pour prouver que Vercel
 * pointe vers le bon projet Supabase et que la colonne existe.
 */

-- ============================================================
-- Fonction 1: Debug schéma global
-- ============================================================

CREATE OR REPLACE FUNCTION public.jtec_debug_schema()
RETURNS TABLE (
  info_type TEXT,
  info_value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Database actuelle
  RETURN QUERY SELECT 'current_database'::TEXT, current_database()::TEXT;
  
  -- Schéma actuel
  RETURN QUERY SELECT 'current_schema'::TEXT, current_schema()::TEXT;
  
  -- Search path
  RETURN QUERY SELECT 'search_path'::TEXT, current_setting('search_path')::TEXT;
  
  -- Vérifier que public.tickets existe
  RETURN QUERY SELECT 
    'table_tickets_exists'::TEXT, 
    CASE WHEN to_regclass('public.tickets') IS NOT NULL THEN 'true' ELSE 'false' END::TEXT;
  
  -- Lister les colonnes de public.tickets
  RETURN QUERY
  SELECT 
    'tickets_columns'::TEXT,
    string_agg(column_name, ', ' ORDER BY ordinal_position)::TEXT
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tickets';
  
  -- Vérifier spécifiquement locataire_id
  RETURN QUERY
  SELECT 
    'column_locataire_id_exists'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'tickets' 
        AND column_name = 'locataire_id'
    ) THEN 'true' ELSE 'false' END::TEXT;
  
  -- Vérifier type de locataire_id
  RETURN QUERY
  SELECT 
    'column_locataire_id_type'::TEXT,
    COALESCE(
      (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' 
         AND table_name = 'tickets' 
         AND column_name = 'locataire_id'),
      'NOT_FOUND'
    )::TEXT;
  
  -- Version PostgreSQL
  RETURN QUERY SELECT 'postgres_version'::TEXT, version()::TEXT;
END;
$$;

COMMENT ON FUNCTION public.jtec_debug_schema IS
  'Fonction de debug pour audit: retourne l''état du schéma tel que vu par l''API';

-- ============================================================
-- Fonction 2: Test INSERT minimal (bypass PostgREST metadata)
-- ============================================================

CREATE OR REPLACE FUNCTION public.jtec_test_insert_ticket(
  p_locataire_id UUID,
  p_logement_id UUID,
  p_regie_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  ticket_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Tenter un INSERT minimal dans public.tickets
  BEGIN
    INSERT INTO public.tickets (
      titre,
      description,
      categorie,
      locataire_id,
      logement_id,
      regie_id
    ) VALUES (
      '[TEST AUDIT]',
      'Test insertion via RPC pour diagnostiquer erreur API',
      'autre',
      p_locataire_id,
      p_logement_id,
      p_regie_id
    )
    RETURNING id INTO v_ticket_id;
    
    -- Succès
    RETURN QUERY SELECT true, v_ticket_id, NULL::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Échec: retourner l'erreur
    RETURN QUERY SELECT false, NULL::UUID, SQLERRM::TEXT;
  END;
END;
$$;

COMMENT ON FUNCTION public.jtec_test_insert_ticket IS
  'Test INSERT direct SQL (bypass PostgREST) pour audit. Ne pas utiliser en production.';

-- ============================================================
-- Permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.jtec_debug_schema TO authenticated;
GRANT EXECUTE ON FUNCTION public.jtec_test_insert_ticket TO authenticated;

-- ============================================================
-- VALIDATION (à exécuter après migration)
-- ============================================================

-- Test 1: Appeler jtec_debug_schema
-- SELECT * FROM jtec_debug_schema();
-- Attendu: 7-8 lignes avec current_database, current_schema, tickets_columns, column_locataire_id_exists=true

-- Test 2: Appeler jtec_test_insert_ticket avec des UUIDs réels
-- SELECT * FROM jtec_test_insert_ticket(
--   'uuid-locataire',
--   'uuid-logement', 
--   'uuid-regie'
-- );
-- Attendu: success=true si les IDs existent, ou error_message si échec
