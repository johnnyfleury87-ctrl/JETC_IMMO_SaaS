-- ============================================================
-- MIGRATION M34: Policy RLS entreprise SELECT tickets
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit workflow tickets régie-entreprise
-- Objectif: Filtrer tickets visibles selon mode_diffusion (general vs restreint)
-- ============================================================

-- Supprimer policies existantes (si présentes)
DROP POLICY IF EXISTS "Entreprise can view available tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- Policy 1: Mode GENERAL (diffusion large)
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Entreprise voit tickets en mode 'general'
  mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
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
  -- Entreprise voit tickets où elle est explicitement assignée
  mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
);

-- Commentaires
COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Entreprise voit tickets diffusés en mode general de ses régies autorisées (statut en_attente, non verrouillés).
Permet à plusieurs entreprises de voir le même ticket en mode marketplace.';

COMMENT ON POLICY "Entreprise can view assigned tickets" ON tickets IS
'Entreprise voit tickets assignés directement (mode restreint) avec tous statuts mission.
Assignation exclusive : une seule entreprise voit ce ticket.';

-- Validation
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  IF v_count = 2 THEN
    RAISE NOTICE '✅ M34: Policies RLS entreprise créées avec succès';
  ELSE
    RAISE EXCEPTION '❌ M34: Erreur lors de la création des policies (trouvé: % sur 2)', v_count;
  END IF;
END $$;
