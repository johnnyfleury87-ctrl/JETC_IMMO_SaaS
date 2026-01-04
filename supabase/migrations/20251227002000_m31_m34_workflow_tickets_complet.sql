-- ============================================================
-- MIGRATION M31-M34 CONSOLIDÉE: Workflow tickets régie-entreprise
-- ============================================================
-- Date: 2026-01-04
-- Auteur: Audit workflow tickets régie-entreprise
-- Objectif: Implémentation complète du workflow de validation
-- ============================================================

-- ============================================================
-- M31: Colonnes traceability tickets
-- ============================================================

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS plafond_valide_par uuid REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS plafond_valide_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS diffuse_par uuid REFERENCES profiles(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS diffuse_at timestamptz;

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_tickets_plafond_valide_par ON tickets(plafond_valide_par);
CREATE INDEX IF NOT EXISTS idx_tickets_diffuse_par ON tickets(diffuse_par);

-- Commentaires
COMMENT ON COLUMN tickets.plafond_valide_par IS 'Profile (régie) qui a validé le plafond';
COMMENT ON COLUMN tickets.plafond_valide_at IS 'Date/heure de validation du plafond';
COMMENT ON COLUMN tickets.diffuse_par IS 'Profile (régie) qui a diffusé le ticket';
COMMENT ON COLUMN tickets.diffuse_at IS 'Date/heure de diffusion du ticket';


-- ============================================================
-- M32: RPC valider_ticket_regie
-- ============================================================

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
  v_ticket_regie_id uuid;
  v_ticket_statut text;
BEGIN
  -- STEP 1: Récupérer regie_id de l'utilisateur authentifié
  SELECT r.id INTO v_regie_id
  FROM regies r
  WHERE r.profile_id = auth.uid();
  
  IF v_regie_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non associé à une régie'
    );
  END IF;
  
  -- STEP 2: Vérifier que le ticket appartient à cette régie
  SELECT regie_id, statut INTO v_ticket_regie_id, v_ticket_statut
  FROM tickets
  WHERE id = p_ticket_id;
  
  IF v_ticket_regie_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket introuvable'
    );
  END IF;
  
  IF v_ticket_regie_id != v_regie_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket n''appartient pas à votre régie'
    );
  END IF;
  
  -- STEP 3: Vérifier statut du ticket (doit être 'nouveau')
  IF v_ticket_statut != 'nouveau' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket déjà validé (statut: ' || v_ticket_statut || ')'
    );
  END IF;
  
  -- STEP 4: Valider mode_diffusion
  IF p_mode_diffusion NOT IN ('general', 'restreint') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mode de diffusion invalide (general ou restreint)'
    );
  END IF;
  
  -- STEP 5: Si mode restreint, vérifier entreprise_id et autorisation
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
  
  -- STEP 7: UPDATE ticket avec validation
  UPDATE tickets SET
    statut = 'en_attente',
    plafond_intervention_chf = p_plafond_chf,
    mode_diffusion = p_mode_diffusion,
    entreprise_id = CASE 
      WHEN p_mode_diffusion = 'restreint' THEN p_entreprise_id 
      ELSE NULL 
    END,
    plafond_valide_par = auth.uid(),
    plafond_valide_at = NOW(),
    diffuse_par = auth.uid(),
    diffuse_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  -- STEP 8: Retourner succès avec détails
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'statut', 'en_attente',
    'mode_diffusion', p_mode_diffusion,
    'entreprise_id', p_entreprise_id,
    'plafond_chf', p_plafond_chf,
    'message', 'Ticket validé avec succès'
  );
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.valider_ticket_regie(uuid, numeric, text, uuid) IS
'RPC régie: Valider un ticket avec plafond + mode diffusion (general/restreint) + entreprise assignée si restreint.
Vérifie: appartenance régie, statut=nouveau, mode valide, entreprise autorisée, plafond>0.
Met à jour: statut→en_attente, plafond, mode, entreprise_id, colonnes traceability.
Retourne: JSON {success, ticket_id, statut, mode_diffusion, entreprise_id, plafond_chf, message}';


-- ============================================================
-- M33: RPC get_entreprises_autorisees
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_entreprises_autorisees()
RETURNS TABLE(
  id uuid,
  nom text,
  email text,
  siret text,
  mode_diffusion text
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
    RETURN;  -- Pas d'erreur, juste vide si pas régie
  END IF;
  
  -- Retourner entreprises autorisées
  RETURN QUERY
  SELECT
    e.id,
    e.nom,
    e.email,
    e.siret,
    re.mode_diffusion
  FROM entreprises e
  JOIN regies_entreprises re ON re.entreprise_id = e.id
  WHERE re.regie_id = v_regie_id
  ORDER BY e.nom ASC;
END;
$$;

-- Sécurité
REVOKE ALL ON FUNCTION public.get_entreprises_autorisees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entreprises_autorisees() TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.get_entreprises_autorisees() IS
'RPC régie: Retourne la liste des entreprises autorisées pour la régie de l''utilisateur.
Utilisé pour peupler le dropdown de sélection d''entreprise dans l''UI de validation ticket.
Retourne: id, nom, email, siret, mode_diffusion de chaque entreprise.';


-- ============================================================
-- M34: Policies RLS entreprise SELECT tickets
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


-- ============================================================
-- VALIDATION FINALE
-- ============================================================

DO $$
DECLARE
  v_count_columns int;
  v_count_rpc int;
  v_count_policies int;
BEGIN
  -- Vérifier colonnes M31
  SELECT COUNT(*) INTO v_count_columns
  FROM information_schema.columns
  WHERE table_name = 'tickets'
    AND column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_par', 'diffuse_at');
  
  IF v_count_columns != 4 THEN
    RAISE EXCEPTION '❌ VALIDATION M31: % colonnes sur 4 trouvées', v_count_columns;
  END IF;
  
  -- Vérifier RPC M32-M33
  SELECT COUNT(*) INTO v_count_rpc
  FROM pg_proc
  WHERE proname IN ('valider_ticket_regie', 'get_entreprises_autorisees');
  
  IF v_count_rpc != 2 THEN
    RAISE EXCEPTION '❌ VALIDATION M32-M33: % RPC sur 2 trouvées', v_count_rpc;
  END IF;
  
  -- Vérifier policies M34
  SELECT COUNT(*) INTO v_count_policies
  FROM pg_policies
  WHERE tablename = 'tickets'
    AND policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets');
  
  IF v_count_policies != 2 THEN
    RAISE EXCEPTION '❌ VALIDATION M34: % policies sur 2 trouvées', v_count_policies;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VALIDATION COMPLÈTE: M31-M34 appliquées avec succès';
  RAISE NOTICE '  - 4 colonnes traceability (M31)';
  RAISE NOTICE '  - 2 RPC functions (M32-M33)';
  RAISE NOTICE '  - 2 RLS policies (M34)';
  RAISE NOTICE '========================================';
END $$;
