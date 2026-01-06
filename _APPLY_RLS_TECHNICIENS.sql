-- =====================================================
-- POLICIES RLS POUR LA TABLE TECHNICIENS
-- =====================================================
-- À appliquer OBLIGATOIREMENT avant mise en production
-- Ces policies garantissent l'isolation des données entre entreprises
-- =====================================================

-- 1️⃣ Activer RLS sur la table techniciens
ALTER TABLE techniciens ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES SELECT (Lecture)
-- =====================================================

-- 📋 Policy : Une entreprise voit UNIQUEMENT SES techniciens
CREATE POLICY "entreprises_voir_leurs_techniciens" ON techniciens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
      AND profiles.entreprise_id = techniciens.entreprise_id
    )
  );

-- 👤 Policy : Un technicien voit SON PROPRE profil
CREATE POLICY "techniciens_voir_leur_profil" ON techniciens
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
  );

-- 👨‍💼 Policy : Admin JETC voit TOUS les techniciens
CREATE POLICY "admin_jtec_voir_tout_techniciens" ON techniciens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- POLICIES INSERT (Création)
-- =====================================================

-- ➕ Policy : Une entreprise peut créer un technicien lié à elle-même
CREATE POLICY "entreprises_creer_leurs_techniciens" ON techniciens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
      AND profiles.entreprise_id = techniciens.entreprise_id
    )
  );

-- 👨‍💼 Policy : Admin JETC peut créer n'importe quel technicien
CREATE POLICY "admin_jtec_creer_techniciens" ON techniciens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- POLICIES UPDATE (Modification)
-- =====================================================

-- ✏️ Policy : Une entreprise peut modifier SES techniciens
CREATE POLICY "entreprises_modifier_leurs_techniciens" ON techniciens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
      AND profiles.entreprise_id = techniciens.entreprise_id
    )
  );

-- 👤 Policy : Un technicien peut modifier certains champs de SON profil
CREATE POLICY "techniciens_modifier_leur_profil" ON techniciens
  FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid()
  );

-- 👨‍💼 Policy : Admin JETC peut modifier tous les techniciens
CREATE POLICY "admin_jtec_modifier_techniciens" ON techniciens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- POLICIES DELETE (Suppression)
-- =====================================================

-- 🗑️ Policy : Une entreprise peut supprimer SES techniciens
CREATE POLICY "entreprises_supprimer_leurs_techniciens" ON techniciens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'entreprise'
      AND profiles.entreprise_id = techniciens.entreprise_id
    )
  );

-- 👨‍💼 Policy : Admin JETC peut supprimer tous les techniciens
CREATE POLICY "admin_jtec_supprimer_techniciens" ON techniciens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- VÉRIFICATION DES POLICIES
-- =====================================================

-- Lister toutes les policies de la table techniciens
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'techniciens'
ORDER BY cmd, policyname;

-- =====================================================
-- TESTS DE VÉRIFICATION
-- =====================================================

-- TEST 1 : Vérifier que RLS est activé
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'techniciens' AND relnamespace = 'public'::regnamespace;
-- Résultat attendu : relrowsecurity = true

-- TEST 2 : Compter les policies
SELECT COUNT(*) as nombre_policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'techniciens';
-- Résultat attendu : 11 policies

-- TEST 3 : Vérifier les policies par opération
SELECT 
  cmd,
  COUNT(*) as nombre
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'techniciens'
GROUP BY cmd
ORDER BY cmd;
-- Résultat attendu :
-- SELECT | 3
-- INSERT | 2
-- UPDATE | 3
-- DELETE | 2

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================

/*
1. APPLICATION DES POLICIES
   - Exécuter ce script dans l'éditeur SQL Supabase
   - Dashboard Supabase → SQL Editor → New Query
   - Copier-coller ce script et exécuter

2. ORDRE D'IMPORTANCE
   - Les policies SELECT sont appliquées AUTOMATIQUEMENT
   - Les policies INSERT/UPDATE/DELETE nécessitent WITH CHECK
   - L'ordre des policies n'a pas d'importance (OR logique)

3. COMPORTEMENT
   - Si AUCUNE policy ne matche → Accès refusé
   - Si AU MOINS UNE policy matche → Accès autorisé
   - Les policies sont cumulatives (OR)

4. BACKEND BYPASS
   - Les APIs backend utilisent SERVICE_ROLE_KEY
   - Cette clé BYPASS toutes les RLS
   - C'est normal et sécurisé (validation faite côté serveur)

5. FRONTEND PROTECTION
   - Le frontend utilise ANON_KEY
   - Les RLS s'appliquent pleinement
   - Protection contre les accès directs Supabase

6. TESTS APRÈS APPLICATION
   - Se connecter avec un compte entreprise A
   - Créer un technicien
   - Se connecter avec un compte entreprise B
   - Vérifier que le technicien de A n'est PAS visible

7. ROLLBACK EN CAS DE PROBLÈME
   - Si problème : désactiver temporairement RLS
   ALTER TABLE techniciens DISABLE ROW LEVEL SECURITY;
   
   - Corriger le problème
   
   - Réactiver RLS
   ALTER TABLE techniciens ENABLE ROW LEVEL SECURITY;

8. MONITORING
   - Surveiller les logs Supabase pour les erreurs RLS
   - Vérifier régulièrement l'isolation des données
   - Auditer les accès avec :
*/

-- Audit des tentatives d'accès
SELECT 
  auth.uid() as user_id,
  p.role,
  COUNT(t.id) as techniciens_visibles
FROM techniciens t
CROSS JOIN profiles p
WHERE p.id = auth.uid()
GROUP BY auth.uid(), p.role;

-- =====================================================
-- MAINTENANCE
-- =====================================================

-- Supprimer TOUTES les policies (pour recommencer)
-- ⚠️ ATTENTION : À utiliser uniquement en développement
/*
DROP POLICY IF EXISTS "entreprises_voir_leurs_techniciens" ON techniciens;
DROP POLICY IF EXISTS "techniciens_voir_leur_profil" ON techniciens;
DROP POLICY IF EXISTS "admin_jtec_voir_tout_techniciens" ON techniciens;
DROP POLICY IF EXISTS "entreprises_creer_leurs_techniciens" ON techniciens;
DROP POLICY IF EXISTS "admin_jtec_creer_techniciens" ON techniciens;
DROP POLICY IF EXISTS "entreprises_modifier_leurs_techniciens" ON techniciens;
DROP POLICY IF EXISTS "techniciens_modifier_leur_profil" ON techniciens;
DROP POLICY IF EXISTS "admin_jtec_modifier_techniciens" ON techniciens;
DROP POLICY IF EXISTS "entreprises_supprimer_leurs_techniciens" ON techniciens;
DROP POLICY IF EXISTS "admin_jtec_supprimer_techniciens" ON techniciens;
*/

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
