/**
 * RPC - Création Atomique Locataire + Profile
 * 
 * Date : 20 décembre 2025
 * Objectif : Fonction RPC pour créer locataire avec transaction atomique
 * 
 * WORKFLOW :
 * 1. Vérifier que logement appartient à la régie
 * 2. Créer utilisateur Supabase Auth (via admin SDK côté backend)
 * 3. Créer profile (role='locataire')
 * 4. Créer locataire (profile_id + logement_id)
 * 
 * SÉCURITÉ :
 * - SECURITY DEFINER : Exécuté avec privilèges owner (bypass RLS temporairement)
 * - Vérification explicite ownership logement
 * - Transaction atomique (rollback si erreur)
 * 
 * USAGE :
 * SELECT creer_locataire_complet(
 *   'Dupont', 'Jean', 'jean@test.ch', 
 *   '<profile_uuid>', '<logement_uuid>', '2025-01-15'
 * );
 */

-- =====================================================
-- 1. FONCTION PRINCIPALE
-- =====================================================

CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,           -- UUID déjà créé par backend (auth.users)
  p_logement_id uuid,
  p_date_entree date,
  p_telephone text DEFAULT NULL,
  p_date_naissance date DEFAULT NULL,
  p_contact_urgence_nom text DEFAULT NULL,
  p_contact_urgence_telephone text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locataire_id uuid;
  v_regie_id uuid;
  v_logement_numero text;
  v_immeuble_nom text;
BEGIN
  -- ========================================
  -- 1. Vérifier que logement existe et récupérer info
  -- ========================================
  SELECT 
    i.regie_id,
    l.numero,
    im.nom
  INTO v_regie_id, v_logement_numero, v_immeuble_nom
  FROM logements l
  JOIN immeubles im ON im.id = l.immeuble_id
  JOIN regies r ON r.id = im.regie_id
  JOIN profiles p ON p.id = r.profile_id
  WHERE l.id = p_logement_id
    AND p.id = auth.uid();  -- Vérifier que l'utilisateur connecté est la régie propriétaire
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Logement non trouvé ou vous n''avez pas les droits sur ce logement';
  END IF;
  
  -- ========================================
  -- 2. Vérifier que profile_id existe et role='locataire'
  -- ========================================
  IF NOT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = p_profile_id 
      AND role = 'locataire'
  ) THEN
    RAISE EXCEPTION 'Profile non trouvé ou rôle incorrect (doit être ''locataire'')';
  END IF;
  
  -- ========================================
  -- 3. Vérifier que profile_id n'est pas déjà utilisé
  -- ========================================
  IF EXISTS (
    SELECT 1 
    FROM locataires 
    WHERE profile_id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Ce profile est déjà associé à un locataire existant';
  END IF;
  
  -- ========================================
  -- 4. Vérifier que logement n'a pas déjà un locataire actif
  -- ========================================
  IF EXISTS (
    SELECT 1 
    FROM locataires 
    WHERE logement_id = p_logement_id
      AND date_sortie IS NULL  -- Locataire actuel (pas encore sorti)
  ) THEN
    RAISE EXCEPTION 'Ce logement a déjà un locataire actif. Veuillez d''abord clôturer le locataire actuel (date_sortie).';
  END IF;
  
  -- ========================================
  -- 5. Créer locataire
  -- ========================================
  INSERT INTO locataires (
    nom,
    prenom,
    email,
    profile_id,
    logement_id,
    date_entree,
    telephone,
    date_naissance,
    contact_urgence_nom,
    contact_urgence_telephone
  )
  VALUES (
    p_nom,
    p_prenom,
    p_email,
    p_profile_id,
    p_logement_id,
    p_date_entree,
    p_telephone,
    p_date_naissance,
    p_contact_urgence_nom,
    p_contact_urgence_telephone
  )
  RETURNING id INTO v_locataire_id;
  
  -- ========================================
  -- 6. Optionnel : Mettre à jour statut logement
  -- ========================================
  UPDATE logements
  SET statut = 'occupé'
  WHERE id = p_logement_id;
  
  -- ========================================
  -- 7. Retourner résultat
  -- ========================================
  RETURN json_build_object(
    'success', true,
    'locataire_id', v_locataire_id,
    'profile_id', p_profile_id,
    'email', p_email,
    'logement', json_build_object(
      'id', p_logement_id,
      'numero', v_logement_numero,
      'immeuble', v_immeuble_nom
    ),
    'message', 'Locataire créé avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automatique en cas d'erreur
    RAISE EXCEPTION 'Erreur création locataire : %', SQLERRM;
END;
$$;

-- =====================================================
-- 2. COMMENTAIRES
-- =====================================================

COMMENT ON FUNCTION creer_locataire_complet IS 
  'Création atomique d''un locataire avec vérifications sécurité (ownership logement, unicité profile, logement libre)';

-- =====================================================
-- 3. PERMISSIONS
-- =====================================================

-- Autoriser exécution pour utilisateurs authentifiés uniquement
REVOKE ALL ON FUNCTION creer_locataire_complet FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creer_locataire_complet TO authenticated;

-- =====================================================
-- 4. FONCTION HELPER - Libérer logement (date_sortie)
-- =====================================================

CREATE OR REPLACE FUNCTION liberer_logement_locataire(
  p_locataire_id uuid,
  p_date_sortie date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logement_id uuid;
  v_ancien_statut text;
BEGIN
  -- ========================================
  -- 1. Vérifier que locataire appartient à la régie connectée
  -- ========================================
  SELECT l.logement_id INTO v_logement_id
  FROM locataires l
  JOIN logements lg ON lg.id = l.logement_id
  JOIN immeubles i ON i.id = lg.immeuble_id
  WHERE l.id = p_locataire_id
    AND i.regie_id = get_user_regie_id();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Locataire non trouvé ou vous n''avez pas les droits';
  END IF;
  
  -- ========================================
  -- 2. Mettre date_sortie locataire
  -- ========================================
  UPDATE locataires
  SET date_sortie = p_date_sortie
  WHERE id = p_locataire_id;
  
  -- ========================================
  -- 3. Changer statut logement en "vacant"
  -- ========================================
  UPDATE logements
  SET statut = 'vacant'
  WHERE id = v_logement_id
  RETURNING statut INTO v_ancien_statut;
  
  -- ========================================
  -- 4. Retourner résultat
  -- ========================================
  RETURN json_build_object(
    'success', true,
    'locataire_id', p_locataire_id,
    'logement_id', v_logement_id,
    'date_sortie', p_date_sortie,
    'logement_statut', 'vacant',
    'message', 'Logement libéré avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur libération logement : %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION liberer_logement_locataire IS 
  'Définit la date_sortie d''un locataire et libère le logement (statut=vacant)';

REVOKE ALL ON FUNCTION liberer_logement_locataire FROM PUBLIC;
GRANT EXECUTE ON FUNCTION liberer_logement_locataire TO authenticated;

-- =====================================================
-- 5. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '2025-12-20_rpc_creer_locataire',
  'Création RPC creer_locataire_complet() et liberer_logement_locataire() avec transaction atomique'
);

