-- ============================================================
-- ROLLBACK M29
-- ============================================================

-- Supprimer fonctions RPC
DROP FUNCTION IF EXISTS toggle_entreprise_mode(uuid, text);
DROP FUNCTION IF EXISTS create_entreprise_with_profile(uuid, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS create_entreprise_simple(text, text, text, text, text, text, text, text, text);

-- Supprimer policies entreprises
DROP POLICY IF EXISTS "Regie can delete authorized entreprises" ON entreprises;
DROP POLICY IF EXISTS "Regie can update authorized entreprises" ON entreprises;

-- Supprimer policy profiles
DROP POLICY IF EXISTS "System can insert entreprise profiles" ON profiles;

-- Vérification
-- SELECT policyname FROM pg_policies WHERE tablename IN ('profiles', 'entreprises');
-- SELECT proname FROM pg_proc WHERE proname LIKE 'create_entreprise%';

-- ============================================================
-- FIN ROLLBACK M29
-- ============================================================
