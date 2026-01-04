-- ============================================================
-- MIGRATION M31-M35 CONSOLIDÉE: Workflow tickets complet
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit complet workflow tickets régie-entreprise
-- Objectif: Appliquer TOUTES les migrations M31 à M35 de manière sûre
-- Usage: Exécuter ce fichier si migrations individuelles pas encore appliquées
-- ============================================================

\echo '🚀 Début application migrations M31-M35...'

-- ============================================================
-- M31: Colonnes traçabilité
-- ============================================================
\echo '📋 M31: Ajout colonnes traçabilité...'

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS plafond_valide_par uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plafond_valide_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_at timestamptz,
ADD COLUMN IF NOT EXISTS diffuse_par uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN tickets.plafond_valide_par IS 'Profile ID de la régie qui a validé le plafond';
COMMENT ON COLUMN tickets.plafond_valide_at IS 'Date/heure validation du plafond';
COMMENT ON COLUMN tickets.diffuse_at IS 'Date/heure diffusion/assignation aux entreprises';
COMMENT ON COLUMN tickets.diffuse_par IS 'Profile ID de la régie qui a diffusé';

CREATE INDEX IF NOT EXISTS idx_tickets_plafond_valide_par ON tickets(plafond_valide_par);
CREATE INDEX IF NOT EXISTS idx_tickets_diffuse_par ON tickets(diffuse_par);

\echo '✅ M31: Colonnes traçabilité ajoutées'

-- ============================================================
-- M32: RPC valider_ticket_regie
-- ============================================================
\echo '📋 M32: Création RPC valider_ticket_regie...'

CREATE OR REPLACE FUNCTION public.valider_ticket_regie(
  p_ticket_id uuid,
  p_plafond_chf numeric(10,2),
  p_mode_diffusion text,
  p_entreprise_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
  v_ticket_statut ticket_status;
  v_ticket_regie_id uuid;
BEGIN
  -- STEP 1: Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non autorisé - Régie introuvable'
    );
  END IF;
  
  -- STEP 2: Vérifier que le ticket appartient à cette régie
  SELECT statut, regie_id INTO v_ticket_statut, v_ticket_regie_id
  FROM tickets
  WHERE id = p_ticket_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket introuvable'
    );
  END IF;
  
  IF v_ticket_regie_id != v_regie_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce ticket appartient à une autre régie'
    );
  END IF;
  
  -- STEP 3: Vérifier statut (doit être 'nouveau')
  IF v_ticket_statut != 'nouveau' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket déjà validé (statut actuel: ' || v_ticket_statut::text || ')'
    );
  END IF;
  
  -- STEP 4: Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'mode_diffusion invalide (attendu: general ou restreint, reçu: ' || p_mode_diffusion || ')'
    );
  END IF;
  
  -- STEP 5: Si restreint, vérifier entreprise_id fournie ET autorisée
  IF p_mode_diffusion = 'restreint' THEN
    IF p_entreprise_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'entreprise_id obligatoire en mode restreint'
      );
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM regies_entreprises
      WHERE regie_id = v_regie_id
        AND entreprise_id = p_entreprise_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Entreprise non autorisée pour cette régie'
      );
    END IF;
  END IF;
  
  -- STEP 6: Valider plafond (doit être positif)
  IF p_plafond_chf IS NULL OR p_plafond_chf <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Plafond invalide (doit être > 0)'
    );
  END IF;
  
  -- STEP 7: UPDATE ticket
  UPDATE tickets
  SET 
    statut = 'en_attente',
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    plafond_intervention_chf = p_plafond_chf,
    plafond_valide_par = auth.uid(),
    plafond_valide_at = NOW(),
    diffuse_at = NOW(),
    diffuse_par = auth.uid(),
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  -- STEP 8: Retour succès
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'statut', 'en_attente',
    'mode_diffusion', p_mode_diffusion,
    'entreprise_id', CASE WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id ELSE NULL END,
    'plafond_chf', p_plafond_chf,
    'message', 'Ticket validé et diffusé avec succès'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.valider_ticket_regie IS 
'Valide un ticket (statut nouveau → en_attente) avec plafond et mode de diffusion.
Mode general : diffuse à toutes entreprises autorisées (entreprise_id = NULL).
Mode restreint : assigne à une entreprise spécifique (entreprise_id requis).
SECURITY DEFINER pour bypass RLS.
Trace QUI (auth.uid) et QUAND (NOW) pour plafond_valide_par/at et diffuse_par/at.';

\echo '✅ M32: RPC valider_ticket_regie créée'

-- ============================================================
-- M33: RPC get_entreprises_autorisees (helper pour régie)
-- ============================================================
\echo '📋 M33: Création RPC get_entreprises_autorisees...'

CREATE OR REPLACE FUNCTION public.get_entreprises_autorisees()
RETURNS TABLE (
  entreprise_id uuid,
  entreprise_nom text,
  entreprise_email text,
  specialites text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regie_id uuid;
BEGIN
  -- Récupérer regie_id de l'utilisateur
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non autorisé - Régie introuvable';
  END IF;
  
  -- Retourner entreprises autorisées
  RETURN QUERY
  SELECT 
    e.id,
    e.nom,
    p.email,
    e.specialites
  FROM entreprises e
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  JOIN profiles p ON p.id = e.profile_id
  WHERE re.regie_id = v_regie_id
  ORDER BY e.nom;
END;
$$;

REVOKE ALL ON FUNCTION public.get_entreprises_autorisees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entreprises_autorisees() TO authenticated;

COMMENT ON FUNCTION public.get_entreprises_autorisees IS
'Retourne la liste des entreprises autorisées pour la régie de l''utilisateur.
Utilisé par le frontend pour afficher les entreprises lors de la validation en mode restreint.
SECURITY DEFINER pour bypass RLS.';

\echo '✅ M33: RPC get_entreprises_autorisees créée'

-- ============================================================
-- M34: Policies RLS entreprise
-- ============================================================
\echo '📋 M34-M35: Création policies RLS entreprise (terminologie harmonisée)...'

-- Supprimer policies existantes
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view general tickets" ON tickets;
DROP POLICY IF EXISTS "Entreprise can view assigned tickets" ON tickets;

-- Policy 1: Mode GENERAL (marketplace)
CREATE POLICY "Entreprise can view general tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND mode_diffusion = 'general'
  AND statut = 'en_attente'
  AND locked_at IS NULL
  AND EXISTS (
    SELECT 1 FROM regies_entreprises re
    JOIN entreprises e ON e.id = re.entreprise_id
    WHERE re.regie_id = tickets.regie_id
      AND e.profile_id = auth.uid()
  )
);

-- Policy 2: Mode RESTREINT (assignation)
CREATE POLICY "Entreprise can view assigned tickets"
ON tickets FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'entreprise'
  AND mode_diffusion = 'restreint'
  AND entreprise_id = (
    SELECT id FROM entreprises WHERE profile_id = auth.uid()
  )
  AND statut IN ('en_attente', 'en_cours', 'termine')
);

COMMENT ON POLICY "Entreprise can view general tickets" ON tickets IS
'Mode GENERAL (marketplace): Entreprise voit tickets diffusés en mode general de ses régies autorisées.';

COMMENT ON POLICY "Entreprise can view assigned tickets" ON tickets IS
'Mode RESTREINT (assignation exclusive): Entreprise voit uniquement tickets assignés directement.';

\echo '✅ M34-M35: Policies RLS créées'

-- ============================================================
-- M35: Migration données + harmonisation terminologie
-- ============================================================
\echo '📋 M35: Harmonisation terminologie mode_diffusion...'

-- Migrer données existantes (public → general, assigné → restreint)
UPDATE tickets SET mode_diffusion = 'general' WHERE mode_diffusion = 'public';
UPDATE tickets SET mode_diffusion = 'restreint' WHERE mode_diffusion = 'assigné';

\echo '✅ M35: Données migrées vers terminologie standardisée'

-- ============================================================
-- VALIDATION FINALE
-- ============================================================
\echo '🔍 Validation finale...'

DO $$
DECLARE
  v_col_count int;
  v_rpc_count int;
  v_policy_count int;
  v_obsolete_count int;
BEGIN
  -- Vérifier colonnes M31
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'tickets'
    AND column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_at', 'diffuse_par');
  
  IF v_col_count = 4 THEN
    RAISE NOTICE '✅ M31: Colonnes traçabilité OK (4/4)';
  ELSE
    RAISE EXCEPTION '❌ M31: Colonnes manquantes (%/4)', v_col_count;
  END IF;
  
  -- Vérifier RPC M32-M33
  SELECT COUNT(*) INTO v_rpc_count
  FROM pg_proc
  WHERE proname IN ('valider_ticket_regie', 'get_entreprises_autorisees');
  
  IF v_rpc_count = 2 THEN
    RAISE NOTICE '✅ M32-M33: RPC créées OK (2/2)';
  ELSE
    RAISE EXCEPTION '❌ M32-M33: RPC manquantes (%/2)', v_rpc_count;
  END IF;
  
  -- Vérifier policies M34-M35
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  IF v_policy_count = 2 THEN
    RAISE NOTICE '✅ M34-M35: Policies RLS OK (2/2)';
  ELSE
    RAISE EXCEPTION '❌ M34-M35: Policies manquantes (%/2)', v_policy_count;
  END IF;
  
  -- Vérifier migration données M35
  SELECT COUNT(*) INTO v_obsolete_count
  FROM tickets
  WHERE mode_diffusion IN ('public', 'assigné');
  
  IF v_obsolete_count = 0 THEN
    RAISE NOTICE '✅ M35: Données migrées (aucune valeur obsolète)';
  ELSE
    RAISE WARNING '⚠️ M35: Valeurs obsolètes restantes (%)', v_obsolete_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 MIGRATIONS M31-M35 APPLIQUÉES AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Récapitulatif:';
  RAISE NOTICE '  - M31: Colonnes traçabilité (plafond_valide_par/at, diffuse_par/at)';
  RAISE NOTICE '  - M32: RPC valider_ticket_regie (validation + diffusion)';
  RAISE NOTICE '  - M33: RPC get_entreprises_autorisees (helper régie)';
  RAISE NOTICE '  - M34: Policies RLS entreprise (general + restreint)';
  RAISE NOTICE '  - M35: Harmonisation terminologie mode_diffusion';
END $$;
