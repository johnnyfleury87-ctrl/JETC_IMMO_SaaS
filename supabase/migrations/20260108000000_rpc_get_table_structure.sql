-- Migration: Ajouter RPC pour audit structure
-- Description: Permet de lire information_schema pour vérifier colonnes

-- Créer RPC get_table_structure
CREATE OR REPLACE FUNCTION get_table_structure(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    column_name::text,
    data_type::text,
    is_nullable::text,
    column_default::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name
  ORDER BY ordinal_position;
$$;

-- Grant execute à tous les rôles authentifiés
GRANT EXECUTE ON FUNCTION get_table_structure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_structure(text) TO service_role;

COMMENT ON FUNCTION get_table_structure IS 'Retourne la structure d''une table depuis information_schema (audit)';
