-- =====================================================
-- FIX RLS - TECHNICIENS DOIVENT VOIR LEURS TICKETS
-- =====================================================
-- PROBLÈME: Les techniciens ne peuvent pas lire tickets/locataires/logements
-- CAUSE: Aucune policy RLS pour techniciens avec missions assignées
-- SOLUTION: Ajouter policies basées sur missions.technicien_id
-- =====================================================

BEGIN;

-- ═══════════════════════════════════════════════════
-- 1. POLICY SELECT TICKETS POUR TECHNICIENS
-- ═══════════════════════════════════════════════════

-- Supprimer si existe (idempotent)
DROP POLICY IF EXISTS "Technicien can view tickets from assigned missions" ON tickets;

-- Créer policy: technicien voit tickets de ses missions
CREATE POLICY "Technicien can view tickets from assigned missions"
ON tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN techniciens t ON t.id = m.technicien_id
    WHERE m.ticket_id = tickets.id
      AND t.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Technicien can view tickets from assigned missions" ON tickets IS
  'Technicien peut voir les tickets des missions qui lui sont assignées (via missions.technicien_id)';

-- ═══════════════════════════════════════════════════
-- 2. POLICY SELECT LOCATAIRES POUR TECHNICIENS
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "Technicien can view locataires from assigned missions" ON locataires;

CREATE POLICY "Technicien can view locataires from assigned missions"
ON locataires
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.locataire_id = locataires.id
      AND tech.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Technicien can view locataires from assigned missions" ON locataires IS
  'Technicien peut voir les locataires des tickets/missions qui lui sont assignés';

-- ═══════════════════════════════════════════════════
-- 3. POLICY SELECT LOGEMENTS POUR TECHNICIENS
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "Technicien can view logements from assigned missions" ON logements;

CREATE POLICY "Technicien can view logements from assigned missions"
ON logements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE t.logement_id = logements.id
      AND tech.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Technicien can view logements from assigned missions" ON logements IS
  'Technicien peut voir les logements des tickets/missions qui lui sont assignés';

-- ═══════════════════════════════════════════════════
-- 4. POLICY SELECT IMMEUBLES POUR TECHNICIENS
-- ═══════════════════════════════════════════════════

DROP POLICY IF EXISTS "Technicien can view immeubles from assigned missions" ON immeubles;

CREATE POLICY "Technicien can view immeubles from assigned missions"
ON immeubles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM missions m
    JOIN tickets t ON t.id = m.ticket_id
    JOIN logements log ON log.id = t.logement_id
    JOIN techniciens tech ON tech.id = m.technicien_id
    WHERE log.immeuble_id = immeubles.id
      AND tech.profile_id = auth.uid()
  )
);

COMMENT ON POLICY "Technicien can view immeubles from assigned missions" ON immeubles IS
  'Technicien peut voir les immeubles des logements/tickets/missions qui lui sont assignés';

-- ═══════════════════════════════════════════════════
-- 5. VÉRIFICATION
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
  v_count int;
BEGIN
  -- Compter les policies ajoutées
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE '%Technicien can view%';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ POLICIES RLS AJOUTÉES POUR TECHNICIENS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies créées: %', v_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Tables protégées:';
  RAISE NOTICE '  ✓ tickets';
  RAISE NOTICE '  ✓ locataires';
  RAISE NOTICE '  ✓ logements';
  RAISE NOTICE '  ✓ immeubles';
  RAISE NOTICE '';
  RAISE NOTICE 'Logique:';
  RAISE NOTICE '  Technicien peut voir les données des missions qui lui sont assignées';
  RAISE NOTICE '  Filtre: missions.technicien_id → techniciens.profile_id = auth.uid()';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TEST À FAIRE:';
  RAISE NOTICE '  1. Login technicien: demo.technicien@test.app';
  RAISE NOTICE '  2. Ouvrir dashboard technicien';
  RAISE NOTICE '  3. Vérifier que mission.ticket n''est plus NULL';
  RAISE NOTICE '  4. Vérifier que toutes les infos s''affichent';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════
-- RÉSUMÉ
-- ═══════════════════════════════════════════════════
-- 
-- ✅ MIGRATION COMPLÈTE
-- 
-- 📋 Ce qui a été fait:
--   ✓ Policy SELECT tickets pour techniciens
--   ✓ Policy SELECT locataires pour techniciens
--   ✓ Policy SELECT logements pour techniciens
--   ✓ Policy SELECT immeubles pour techniciens
-- 
-- 🎯 Résultat attendu:
--   Le technicien peut maintenant lire via JOIN:
--     missions → tickets → locataires, logements → immeubles
-- 
-- ⚠️ IMPORTANT:
--   Ces policies sont basées sur missions.technicien_id
--   tickets.technicien_id reste NULL (pas utilisé)
--   L'assignation est portée UNIQUEMENT par missions
-- 
-- ═══════════════════════════════════════════════════
