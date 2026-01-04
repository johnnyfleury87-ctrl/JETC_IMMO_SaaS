-- ============================================================
-- MIGRATION M35: Harmonisation terminologie mode_diffusion
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit complet workflow tickets M26-M34
-- Objectif: Corriger incohérence terminologique entre migrations et policies
-- 
-- PROBLÈME IDENTIFIÉ:
-- - M32/M34 utilisent: 'general' et 'restreint'
-- - Policy RLS actuelle utilise: 'public' et 'assigné'
-- - Cette incohérence BLOQUE le filtrage RLS entreprises !
-- 
-- SOLUTION:
-- 1. Standardiser sur: 'general' et 'restreint' (alignement M32/M34)
-- 2. Recréer policies RLS avec terminologie correcte
-- 3. Migrer données existantes si nécessaire
-- ============================================================

-- STEP 1: Vérifier valeurs actuelles dans la base
DO $$
DECLARE
  v_count_public int;
  v_count_assigne int;
  v_count_general int;
  v_count_restreint int;
BEGIN
  SELECT COUNT(*) INTO v_count_public FROM tickets WHERE mode_diffusion = 'public';
  SELECT COUNT(*) INTO v_count_assigne FROM tickets WHERE mode_diffusion = 'assigné';
  SELECT COUNT(*) INTO v_count_general FROM tickets WHERE mode_diffusion = 'general';
  SELECT COUNT(*) INTO v_count_restreint FROM tickets WHERE mode_diffusion = 'restreint';
  
  RAISE NOTICE '📊 Audit mode_diffusion:';
  RAISE NOTICE '  - Anciennes valeurs: public=%, assigné=%', v_count_public, v_count_assigne;
  RAISE NOTICE '  - Nouvelles valeurs: general=%, restreint=%', v_count_general, v_count_restreint;
END $$;

-- STEP 2: Migrer données existantes (public → general, assigné → restreint)
UPDATE tickets
SET mode_diffusion = 'general'
WHERE mode_diffusion = 'public';

UPDATE tickets
SET mode_diffusion = 'restreint'
WHERE mode_diffusion = 'assigné';

-- STEP 3: Supprimer anciennes policies RLS incohérentes
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- STEP 4: Recréer policies avec terminologie correcte (M34)
-- Policy 1: Mode GENERAL (diffusion large marketplace)
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Vérifier rôle entreprise
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  -- Ticket en mode 'general'
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND
  -- Entreprise autorisée par cette régie
  EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
  )
);

-- Policy 2: Mode RESTREINT (assignation directe)
CREATE POLICY "Entreprise can view assigned tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Vérifier rôle entreprise
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND
  -- Ticket assigné directement à cette entreprise
  mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
);

-- STEP 5: Commentaires documentation
COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Mode GENERAL (marketplace): Entreprise voit tickets diffusés en mode general 
de ses régies autorisées (statut en_attente, non verrouillés).
Permet à plusieurs entreprises de voir le même ticket simultanément.
Valeurs standardisées M35: general (ex-public).';

COMMENT ON POLICY "Entreprise can view assigned tickets" ON tickets IS
'Mode RESTREINT (assignation exclusive): Entreprise voit uniquement tickets 
assignés directement (mode restreint) avec tous statuts mission.
Une seule entreprise voit ce ticket (assignation 1-to-1).
Valeurs standardisées M35: restreint (ex-assigné).';

-- STEP 6: Validation finale
DO $$
DECLARE
  v_count_policies int;
  v_count_public int;
  v_count_assigne int;
BEGIN
  -- Vérifier policies créées
  SELECT COUNT(*) INTO v_count_policies
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  -- Vérifier migration données
  SELECT COUNT(*) INTO v_count_public FROM tickets WHERE mode_diffusion = 'public';
  SELECT COUNT(*) INTO v_count_assigne FROM tickets WHERE mode_diffusion = 'assigné';
  
  IF v_count_policies = 2 THEN
    RAISE NOTICE '✅ M35: Policies RLS créées avec terminologie standardisée';
  ELSE
    RAISE EXCEPTION '❌ M35: Erreur création policies (trouvé: % sur 2)', v_count_policies;
  END IF;
  
  IF v_count_public = 0 AND v_count_assigne = 0 THEN
    RAISE NOTICE '✅ M35: Migration données terminée (aucune valeur obsolète)';
  ELSE
    RAISE WARNING '⚠️ M35: Valeurs obsolètes restantes (public=%, assigné=%)', v_count_public, v_count_assigne;
  END IF;
END $$;
