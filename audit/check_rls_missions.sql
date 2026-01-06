-- =====================================================
-- AUDIT POLICIES RLS MISSIONS
-- =====================================================

\echo '=== POLICIES SUR TABLE MISSIONS ==='

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'missions'
ORDER BY cmd, policyname;

\echo ''
\echo '=== POLICIES CONCERNANT TECHNICIEN ==='

SELECT 
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'missions'
  AND (
    policyname ILIKE '%technicien%' 
    OR qual ILIKE '%technicien%'
  )
ORDER BY cmd;
