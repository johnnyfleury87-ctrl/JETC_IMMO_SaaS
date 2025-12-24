-- =====================================================
-- DIAGNOSTIC : Vérifier cohérence profiles / regies
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Identifier pourquoi regieError survient
-- =====================================================

-- 1. Compter les profils régie
SELECT 
  'Profils avec role=regie' as description,
  COUNT(*) as count
FROM profiles 
WHERE role = 'regie';

-- 2. Compter les lignes dans regies
SELECT 
  'Lignes dans table regies' as description,
  COUNT(*) as count
FROM regies;

-- 3. Identifier les profils régie SANS ligne dans regies
SELECT 
  'Profils régie SANS régie associée' as description,
  p.id as profile_id,
  p.email,
  p.created_at
FROM profiles p
WHERE p.role = 'regie'
  AND NOT EXISTS (
    SELECT 1 FROM regies r WHERE r.profile_id = p.id
  );

-- 4. Vérifier les regies existantes
SELECT 
  r.id as regie_id,
  r.nom as nom_agence,
  r.profile_id,
  r.statut_validation,
  p.email as email_profil,
  p.role as role_profil
FROM regies r
LEFT JOIN profiles p ON p.id = r.profile_id
ORDER BY r.created_at DESC;

-- 5. Tester la policy RLS (simulation)
-- Cette requête simule ce que fait le frontend
SELECT 
  'Test policy RLS : profile_id = auth.uid()' as test,
  r.id,
  r.nom,
  r.profile_id
FROM regies r
WHERE r.profile_id = auth.uid();
