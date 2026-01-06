-- =====================================================
-- ROLLBACK M46: Restaurer policies RLS précédentes
-- =====================================================
-- Date: 2026-01-06
-- Auteur: Rollback M46
-- Objectif: Supprimer policies M46 et restaurer état précédent
-- NOTE: Le rollback ne peut pas restaurer les anciennes policies incorrectes.
--       Il supprime simplement les nouvelles policies.
-- =====================================================

-- =====================================================
-- 1. SUPPRIMER POLICIES TECHNICIENS M46
-- =====================================================

DROP POLICY IF EXISTS "Entreprise can view own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Entreprise can insert own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Entreprise can update own techniciens" ON techniciens;
DROP POLICY IF EXISTS "Technicien can view own profile" ON techniciens;
DROP POLICY IF EXISTS "Technicien can update own profile" ON techniciens;
DROP POLICY IF EXISTS "Regie can view techniciens of authorized entreprises" ON techniciens;
DROP POLICY IF EXISTS "Admin JTEC can view all techniciens" ON techniciens;

-- =====================================================
-- 2. SUPPRIMER POLICIES MISSIONS M46
-- =====================================================

DROP POLICY IF EXISTS "Regie can view missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Entreprise can view own missions" ON missions;
DROP POLICY IF EXISTS "Locataire can view missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Entreprise can update own missions" ON missions;
DROP POLICY IF EXISTS "Regie can update missions for own tickets" ON missions;
DROP POLICY IF EXISTS "Admin JTEC can view all missions" ON missions;
DROP POLICY IF EXISTS "Technicien can view assigned missions" ON missions;
DROP POLICY IF EXISTS "Technicien can update assigned missions" ON missions;

-- =====================================================
-- 3. VALIDATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ ROLLBACK M46: Policies supprimées';
  RAISE WARNING '⚠️  Les policies précédentes doivent être restaurées manuellement si nécessaire';
END $$;

-- =====================================================
-- FIN ROLLBACK M46
-- =====================================================
