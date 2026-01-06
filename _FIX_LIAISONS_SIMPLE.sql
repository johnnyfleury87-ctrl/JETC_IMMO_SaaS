-- =====================================================
-- SCRIPT DE CORRECTION SIMPLIFIÉ : LIAISONS ENTREPRISES ↔ PROFILES
-- =====================================================
-- Version sans FULL JOIN (compatible Supabase)
-- =====================================================

-- 📋 ÉTAPE 1 : DIAGNOSTIC
-- =====================================================

-- Voir toutes les entreprises
SELECT 
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  e.profile_id
FROM entreprises e
ORDER BY e.nom;

-- Voir tous les profiles entreprise
SELECT 
  p.id as profile_id,
  p.email,
  p.entreprise_id
FROM profiles p
WHERE p.role = 'entreprise'
ORDER BY p.email;

-- Voir les liaisons actuelles
SELECT 
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  e.profile_id,
  p.id as profile_id,
  p.email,
  p.entreprise_id,
  CASE 
    WHEN e.profile_id = p.id AND p.entreprise_id = e.id THEN '✅ OK'
    WHEN e.profile_id = p.id AND p.entreprise_id IS NULL THEN '⚠️ Manque profile.entreprise_id'
    WHEN e.profile_id IS NULL THEN '❌ entreprise.profile_id NULL'
    ELSE '❌ ERREUR'
  END as statut
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
ORDER BY e.nom;

-- =====================================================
-- 🔧 ÉTAPE 2 : CORRECTION AUTOMATIQUE
-- =====================================================

-- 2A. Mettre à jour profiles.entreprise_id quand il manque
UPDATE profiles p
SET entreprise_id = e.id
FROM entreprises e
WHERE e.profile_id = p.id
  AND p.role = 'entreprise'
  AND p.entreprise_id IS NULL;

-- Vérifier combien ont été corrigés
SELECT 
  COUNT(*) as profiles_corriges
FROM profiles p
JOIN entreprises e ON e.profile_id = p.id
WHERE p.role = 'entreprise' 
  AND p.entreprise_id = e.id;

-- 2B. Mettre à jour entreprises.profile_id quand il manque
UPDATE entreprises e
SET profile_id = p.id
FROM profiles p
WHERE p.entreprise_id = e.id
  AND p.role = 'entreprise'
  AND e.profile_id IS NULL;

-- Vérifier combien ont été corrigés
SELECT 
  COUNT(*) as entreprises_corrigees
FROM entreprises e
JOIN profiles p ON p.entreprise_id = e.id
WHERE p.role = 'entreprise'
  AND e.profile_id = p.id;

-- =====================================================
-- ✅ ÉTAPE 3 : VÉRIFICATION FINALE
-- =====================================================

-- Voir le résultat final
SELECT 
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  e.profile_id,
  p.id as profile_id,
  p.email,
  p.entreprise_id,
  CASE 
    WHEN e.profile_id = p.id AND p.entreprise_id = e.id THEN '✅ OK'
    ELSE '❌ ERREUR'
  END as statut_liaison
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE p.role = 'entreprise'
ORDER BY e.nom;

-- Statistiques
SELECT 
  COUNT(*) FILTER (WHERE e.profile_id = p.id AND p.entreprise_id = e.id) as liaisons_ok,
  COUNT(*) FILTER (WHERE e.profile_id IS NULL OR p.entreprise_id IS NULL) as liaisons_manquantes,
  COUNT(*) as total
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE p.role = 'entreprise';

-- =====================================================
-- 🎯 CAS PARTICULIER : Profiles sans entreprise
-- =====================================================

-- Vérifier s'il existe des profiles entreprise sans entreprise liée
SELECT 
  p.id,
  p.email,
  'Aucune entreprise liée' as probleme
FROM profiles p
WHERE p.role = 'entreprise'
  AND NOT EXISTS (SELECT 1 FROM entreprises e WHERE e.profile_id = p.id)
  AND p.entreprise_id IS NULL;

-- =====================================================
-- 📝 SI UN PROFILE N'A PAS D'ENTREPRISE, CRÉER UNE ENTREPRISE
-- =====================================================
-- Décommenter et adapter si nécessaire :

/*
DO $$
DECLARE
  v_profile_id uuid;
  v_entreprise_id uuid;
BEGIN
  -- Récupérer le profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE email = 'entreprise@test.app' AND role = 'entreprise';
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile entreprise@test.app introuvable';
  END IF;
  
  -- Créer l'entreprise
  INSERT INTO entreprises (
    nom,
    siret,
    email,
    telephone,
    adresse,
    ville,
    code_postal,
    profile_id,
    actif
  ) VALUES (
    'Entreprise Test',
    '12345678901234',
    'entreprise@test.app',
    '0600000000',
    '1 rue Test',
    'Paris',
    '75000',
    v_profile_id,
    true
  )
  RETURNING id INTO v_entreprise_id;
  
  -- Mettre à jour le profile
  UPDATE profiles
  SET entreprise_id = v_entreprise_id
  WHERE id = v_profile_id;
  
  RAISE NOTICE 'Entreprise créée: %', v_entreprise_id;
END $$;
*/

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
