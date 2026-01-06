-- =====================================================
-- SCRIPT DE CORRECTION : LIAISONS ENTREPRISES ↔ PROFILES
-- =====================================================
-- Ce script corrige les liaisons manquantes entre:
-- - entreprises.profile_id → profiles.id
-- - profiles.entreprise_id → entreprises.id
--
-- USAGE: Exécuter dans le SQL Editor de Supabase
-- =====================================================

-- 📋 ÉTAPE 1 : DIAGNOSTIC AVANT CORRECTION
-- =====================================================
SELECT '=== DIAGNOSTIC AVANT CORRECTION ===' as info;

-- Utiliser LEFT JOIN au lieu de FULL OUTER JOIN avec OR
SELECT 
  e.id as entreprise_id,
  e.nom as entreprise_nom,
  e.profile_id as entreprise_profile_id,
  p.id as profile_id,
  p.email as profile_email,
  p.entreprise_id as profile_entreprise_id,
  CASE 
    WHEN e.profile_id = p.id AND p.entreprise_id = e.id THEN '✅ LIAISON OK'
    WHEN e.profile_id = p.id AND p.entreprise_id IS NULL THEN '⚠️ Corriger profile.entreprise_id'
    WHEN e.profile_id IS NULL AND p.entreprise_id = e.id THEN '⚠️ Corriger entreprise.profile_id'
    WHEN e.profile_id IS NULL AND p.entreprise_id IS NULL THEN '❌ AUCUNE LIAISON'
    ELSE '❌ INCOHÉRENCE'
  END as statut
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE p.role = 'entreprise' OR p.role IS NULL
ORDER BY e.nom;

-- =====================================================
-- 🔧 ÉTAPE 2 : CORRECTION AUTOMATIQUE
-- =====================================================
SELECT '=== CORRECTION EN COURS ===' as info;

-- 2A. Lier profiles → entreprises (quand entreprise.profile_id existe)
UPDATE profiles p
SET entreprise_id = e.id
FROM entreprises e
WHERE e.profile_id = p.id
  AND p.role = 'entreprise'
  AND p.entreprise_id IS NULL;

-- Afficher combien de profiles ont été mis à jour
SELECT 
  COUNT(*) as profiles_corriges,
  'profiles.entreprise_id mis à jour' as action
FROM profiles p
JOIN entreprises e ON e.profile_id = p.id
WHERE p.role = 'entreprise';

-- 2B. Lier entreprises → profiles (quand profile.entreprise_id existe)
-- Cas où l'entreprise n'a pas de profile_id mais le profile a un entreprise_id
UPDATE entreprises e
SET profile_id = p.id
FROM profiles p
WHERE p.entreprise_id = e.id
  AND p.role = 'entreprise'
  AND e.profile_id IS NULL;

-- Afficher combien d'entreprises ont été mises à jour
SELECT 
  COUNT(*) as entreprises_corrigees,
  'entreprises.profile_id mis à jour' as action
FROM entreprises e
JOIN profiles p ON p.entreprise_id = e.id
WHERE p.role = 'entreprise';

-- =====================================================
-- 🎯 ÉTAPE 3 : CAS PARTICULIERS (CRÉATION MANUELLE)
-- =====================================================
-- Si un profile 'entreprise' n'a AUCUNE entreprise associée:
-- - Créer une entreprise pour ce profile
-- - Ou associer à une entreprise existante

SELECT '=== PROFILES SANS ENTREPRISE ===' as info;

-- Simplifier la requête sans FULL JOIN
SELECT 
  p.id,
  p.email,
  p.role,
  'Aucune entreprise liée' as probleme,
  '⚠️ Nécessite intervention manuelle' as action_requise
FROM profiles p
WHERE p.role = 'entreprise'
  AND NOT EXISTS (
    SELECT 1 FROM entreprises e 
    WHERE e.profile_id = p.id OR p.entreprise_id = e.id
  );

-- 📝 CORRECTION MANUELLE POUR PROFILES SANS ENTREPRISE
-- Si le profil entreprise@test.app n'a pas d'entreprise, exécuter :
/*
-- Exemple : Créer une entreprise pour entreprise@test.app
DO $$
DECLARE
  v_profile_id uuid;
  v_entreprise_id uuid;
BEGIN
  -- Récupérer l'ID du profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE email = 'entreprise@test.app' AND role = 'entreprise';
  
  IF v_profile_id IS NULL THEN
    RAISE NOTICE 'Profile entreprise@test.app introuvable';
    RETURN;
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
    actif,
    created_at,
    updated_at
  ) VALUES (
    'Entreprise Test',           -- Nom à personnaliser
    '12345678901234',            -- SIRET à personnaliser
    'entreprise@test.app',
    '0600000000',                -- Téléphone à personnaliser
    '1 rue Test',                -- Adresse à personnaliser
    'Paris',
    '75000',
    v_profile_id,
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_entreprise_id;
  
  -- Mettre à jour le profile avec entreprise_id
  UPDATE profiles
  SET entreprise_id = v_entreprise_id
  WHERE id = v_profile_id;
  
  RAISE NOTICE 'Entreprise créée avec succès: %', v_entreprise_id;
END $$;
*/

-- =====================================================
-- ✅ ÉTAPE 4 : VÉRIFICATION FINALE
-- =====================================================
SELECT '=== VÉRIFICATION FINALE ===' as info;

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

-- Statistiques finales
SELECT 
  COUNT(*) FILTER (WHERE e.profile_id = p.id AND p.entreprise_id = e.id) as liaisons_ok,
  COUNT(*) FILTER (WHERE e.profile_id IS NULL OR p.entreprise_id IS NULL) as liaisons_manquantes,
  COUNT(*) as total_entreprises
FROM entreprises e
LEFT JOIN profiles p ON e.profile_id = p.id
WHERE p.role = 'entreprise' OR e.id IS NOT NULL;

-- =====================================================
-- 📌 NOTES IMPORTANTES
-- =====================================================
/*
1. ORDRE D'EXÉCUTION
   - Exécuter ce script dans le SQL Editor de Supabase
   - Le script est IDEMPOTENT (peut être exécuté plusieurs fois sans danger)
   - Les UPDATE utilisent des conditions strictes pour éviter les doublons

2. RELATION BIDIRECTIONNELLE
   - entreprises.profile_id → profiles.id
   - profiles.entreprise_id → entreprises.id
   - Les deux doivent pointer l'un vers l'autre

3. CAS D'UTILISATION
   a) Profile existe, entreprise existe : le script crée les liens
   b) Profile existe, pas d'entreprise : nécessite création manuelle (voir bloc commenté)
   c) Entreprise existe, pas de profile : cas anormal (créer un profile d'abord)

4. APRÈS CORRECTION
   - Tester la page techniciens.html
   - L'erreur "Entreprise non liée au profile" devrait disparaître
   - Les APIs backend devraient fonctionner

5. ROLLBACK
   Si problème, vous pouvez annuler avec:
   -- UPDATE profiles SET entreprise_id = NULL WHERE role = 'entreprise';
   -- UPDATE entreprises SET profile_id = NULL;
   ATTENTION : À n'utiliser qu'en cas de problème majeur
*/

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
