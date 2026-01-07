-- =====================================================
-- FIX RLS - TECHNICIENS DOIVENT VOIR LEURS TICKETS
-- VERSION 2 - SANS RÉCURSION INFINIE
-- =====================================================
-- PROBLÈME V1: Policies avec EXISTS + JOIN créaient récursion infinie
-- SOLUTION V2: Utiliser SECURITY DEFINER functions pour casser la récursion
-- =====================================================

BEGIN;

-- ═══════════════════════════════════════════════════
-- 1. SUPPRIMER LES ANCIENNES POLICIES (V1 bugguées)
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "Technicien can view tickets from assigned missions" ON tickets;
DROP POLICY IF EXISTS "Technicien can view locataires from assigned missions" ON locataires;
DROP POLICY IF EXISTS "Technicien can view logements from assigned missions" ON logements;
DROP POLICY IF EXISTS "Technicien can view immeubles from assigned missions" ON immeubles;

-- ═══════════════════════════════════════════════════
-- 2. FONCTIONS SECURITY DEFINER (contournent RLS)
-- ═══════════════════════════════════════════════════

-- Fonction: Vérifier si un ticket est assigné au technicien connecté
CREATE OR REPLACE FUNCTION public.technicien_can_view_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM missions m
    JOIN techniciens t ON t.id = m.technicien_id
    WHERE m.ticket_id = p_ticket_id
      AND t.profile_id = auth.uid()
  );
END;
$$;

-- Fonction: Vérifier si un locataire est accessible au technicien
CREATE OR REPLACE FUNCTION public.technicien_can_view_locataire(p_locataire_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.locataire_id = p_locataire_id
      AND tech.profile_id = auth.uid()
  );
END;
$$;

-- Fonction: Vérifier si un logement est accessible au technicien
CREATE OR REPLACE FUNCTION public.technicien_can_view_logement(p_logement_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.logement_id = p_logement_id
      AND tech.profile_id = auth.uid()
  );
END;
$$;

-- Fonction: Vérifier si un immeuble est accessible au technicien
CREATE OR REPLACE FUNCTION public.technicien_can_view_immeuble(p_immeuble_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN logements log ON log.id = t.logement_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE log.immeuble_id = p_immeuble_id
      AND tech.profile_id = auth.uid()
  );
END;
$$;

-- ═══════════════════════════════════════════════════
-- 3. POLICIES RLS UTILISANT LES FONCTIONS
-- ═══════════════════════════════════════════════════

-- Policy tickets: utilise fonction SECURITY DEFINER (pas de récursion)
CREATE POLICY "Technicien can view tickets from assigned missions"
ON tickets
FOR SELECT
TO authenticated
USING (technicien_can_view_ticket(id));

COMMENT ON POLICY "Technicien can view tickets from assigned missions" ON tickets IS
  'Technicien peut voir tickets via function SECURITY DEFINER (évite récursion RLS)';

-- Policy locataires
CREATE POLICY "Technicien can view locataires from assigned missions"
ON locataires
FOR SELECT
TO authenticated
USING (technicien_can_view_locataire(id));

COMMENT ON POLICY "Technicien can view locataires from assigned missions" ON locataires IS
  'Technicien peut voir locataires via function SECURITY DEFINER';

-- Policy logements
CREATE POLICY "Technicien can view logements from assigned missions"
ON logements
FOR SELECT
TO authenticated
USING (technicien_can_view_logement(id));

COMMENT ON POLICY "Technicien can view logements from assigned missions" ON logements IS
  'Technicien peut voir logements via function SECURITY DEFINER';

-- Policy immeubles
CREATE POLICY "Technicien can view immeubles from assigned missions"
ON immeubles
FOR SELECT
TO authenticated
USING (technicien_can_view_immeuble(id));

COMMENT ON POLICY "Technicien can view immeubles from assigned missions" ON immeubles IS
  'Technicien peut voir immeubles via function SECURITY DEFINER';

-- ═══════════════════════════════════════════════════
-- 4. VÉRIFICATION
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
  v_policies int;
  v_functions int;
BEGIN
  -- Compter policies
  SELECT COUNT(*) INTO v_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE '%Technicien can view%';
  
  -- Compter fonctions
  SELECT COUNT(*) INTO v_functions
  FROM pg_proc
  WHERE proname LIKE 'technicien_can_view_%';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FIX RLS TECHNICIENS - VERSION 2 (SANS RÉCURSION)';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Fonctions SECURITY DEFINER créées: %', v_functions;
  RAISE NOTICE '  ✓ technicien_can_view_ticket()';
  RAISE NOTICE '  ✓ technicien_can_view_locataire()';
  RAISE NOTICE '  ✓ technicien_can_view_logement()';
  RAISE NOTICE '  ✓ technicien_can_view_immeuble()';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies RLS créées: %', v_policies;
  RAISE NOTICE '  ✓ tickets';
  RAISE NOTICE '  ✓ locataires';
  RAISE NOTICE '  ✓ logements';
  RAISE NOTICE '  ✓ immeubles';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Différence V1 → V2:';
  RAISE NOTICE '  V1: Policy avec EXISTS (JOIN direct) → récursion infinie ❌';
  RAISE NOTICE '  V2: Policy avec SECURITY DEFINER function → RLS contourné ✅';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST:';
  RAISE NOTICE '  1. Login: demo.technicien@test.app';
  RAISE NOTICE '  2. Dashboard technicien';
  RAISE NOTICE '  3. mission.ticket devrait être rempli';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════
-- RÉSUMÉ TECHNIQUE
-- ═══════════════════════════════════════════════════
-- 
-- ❌ PROBLÈME V1:
--   Policy: USING (EXISTS (SELECT ... FROM missions JOIN tickets ...))
--   → RLS vérifie policy tickets
--   → Policy tickets vérifie missions
--   → RÉCURSION INFINIE
-- 
-- ✅ SOLUTION V2:
--   Policy: USING (technicien_can_view_ticket(id))
--   Function: SECURITY DEFINER (bypass RLS)
--   → Pas de récursion, la fonction ignore les policies RLS
-- 
-- 📊 Performance:
--   SECURITY DEFINER est légèrement plus lent qu'EXISTS direct
--   Mais c'est la seule façon d'éviter la récursion avec des JOINs complexes
-- 
-- ═══════════════════════════════════════════════════
