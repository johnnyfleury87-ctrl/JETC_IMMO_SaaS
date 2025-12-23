-- =====================================================
-- MIGRATION : Rendre logement_id optionnel
-- Date : 2025-12-21
-- Objectif : Permettre création de locataire SANS logement assigné
-- =====================================================
-- 
-- CONTEXTE :
-- - Les régies doivent pouvoir créer des locataires AVANT de les assigner à un logement
-- - Le schéma DB autorise déjà logement_id = NULL (08_locataires.sql ligne 28)
-- - Mais la RPC creer_locataire_complet() exigeait un logement_id obligatoire
-- 
-- CHANGEMENTS :
-- ✅ Paramètre p_logement_id devient DEFAULT NULL
-- ✅ Vérifications sur logements conditionnelles (uniquement si logement_id fourni)
-- ✅ UPDATE statut logement conditionnel
-- ✅ Retour JSON adapté (logement peut être NULL)
-- =====================================================

-- Supprimer l'ancienne version si elle existe (optionnel, CREATE OR REPLACE suffit)
-- DROP FUNCTION IF EXISTS creer_locataire_complet(text, text, text, uuid, uuid, date, text, date, text, text);

-- Recréer la fonction avec logement_id optionnel + regie_id obligatoire
CREATE OR REPLACE FUNCTION creer_locataire_complet(
  p_nom text,
  p_prenom text,
  p_email text,
  p_profile_id uuid,              -- UUID déjà créé par backend (auth.users)
  p_regie_id uuid,                -- ✅ OBLIGATOIRE : régie qui gère ce locataire
  p_logement_id uuid DEFAULT NULL,  -- ✅ OPTIONNEL : peut créer locataire sans logement
  p_date_entree date DEFAULT NULL,  -- ✅ DEFAULT obligatoire (contrainte PostgreSQL)
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
  -- 1. Vérifier que p_regie_id est fourni
  -- ========================================
  IF p_regie_id IS NULL THEN
    RAISE EXCEPTION 'regie_id obligatoire pour créer un locataire';
  END IF;
  
  -- Vérifier que la régie existe
  IF NOT EXISTS (SELECT 1 FROM regies WHERE id = p_regie_id) THEN
    RAISE EXCEPTION 'Régie non trouvée : %', p_regie_id;
  END IF;
  
  -- ========================================
  -- 2. Vérifier que logement existe et appartient à la régie (UNIQUEMENT SI logement_id fourni)
  -- ========================================
  IF p_logement_id IS NOT NULL THEN
    SELECT 
      i.regie_id,
      l.numero,
      im.nom
    INTO v_regie_id, v_logement_numero, v_immeuble_nom
    FROM logements l
    JOIN immeubles im ON im.id = l.immeuble_id
    WHERE l.id = p_logement_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Logement non trouvé : %', p_logement_id;
    END IF;
    
    -- Vérifier que le logement appartient bien à la régie
    IF v_regie_id != p_regie_id THEN
      RAISE EXCEPTION 'Le logement % n''appartient pas à la régie %', p_logement_id, p_regie_id;
    END IF;
    
    -- ========================================
    -- 3. Vérifier que logement n'a pas déjà un locataire actif
    -- ========================================
    IF EXISTS (
      SELECT 1 
      FROM locataires 
      WHERE logement_id = p_logement_id
        AND date_sortie IS NULL  -- Locataire actuel (pas encore sorti)
    ) THEN
      RAISE EXCEPTION 'Ce logement a déjà un locataire actif. Veuillez d''abord clôturer le locataire actuel (date_sortie).';
    END IF;
  END IF;
  
  -- ========================================
  -- 4. Vérifier que profile_id existe et role='locataire'
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
  -- 5. Vérifier que profile_id n'est pas déjà utilisé
  -- ========================================
  IF EXISTS (
    SELECT 1 
    FROM locataires 
    WHERE profile_id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Ce profile est déjà associé à un locataire existant';
  END IF;
  
  -- ========================================
  -- 6. Créer locataire avec regie_id
  -- ========================================
  INSERT INTO locataires (
    nom,
    prenom,
    email,
    profile_id,
    regie_id,
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
    p_regie_id,
    p_logement_id,
    p_date_entree,
    p_telephone,
    p_date_naissance,
    p_contact_urgence_nom,
    p_contact_urgence_telephone
  )
  RETURNING id INTO v_locataire_id;
  
  -- ========================================
  -- 7. Optionnel : Mettre à jour statut logement (UNIQUEMENT si logement_id fourni)
  -- ========================================
  IF p_logement_id IS NOT NULL THEN
    UPDATE logements
    SET statut = 'occupé'
    WHERE id = p_logement_id;
  END IF;
  
  -- ========================================
  -- 8. Retourner résultat
  -- ========================================
  RETURN json_build_object(
    'success', true,
    'locataire_id', v_locataire_id,
    'profile_id', p_profile_id,
    'email', p_email,
    'logement', CASE 
      WHEN p_logement_id IS NOT NULL THEN json_build_object(
        'id', p_logement_id,
        'numero', v_logement_numero,
        'immeuble', v_immeuble_nom
      )
      ELSE NULL
    END,
    'message', 'Locataire créé avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automatique en cas d'erreur
    RAISE EXCEPTION 'Erreur création locataire : %', SQLERRM;
END;
$$;

-- =====================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION creer_locataire_complet IS 
  'Création atomique d''un locataire avec vérifications sécurité. Le logement_id est optionnel (NULL accepté) pour créer un locataire avant de lui assigner un logement. Le regie_id est obligatoire pour garantir l''isolation multi-tenant.';

-- =====================================================
-- TEST DE LA MIGRATION
-- =====================================================
-- Pour tester après application :
-- 
-- SELECT creer_locataire_complet(
--   p_nom := 'Dupont',
--   p_prenom := 'Jean',
--   p_email := 'jean.dupont@test.com',
--   p_profile_id := '00000000-0000-0000-0000-000000000000'::uuid,
--   p_regie_id := '00000000-0000-0000-0000-000000000001'::uuid,  -- ✅ OBLIGATOIRE
--   p_logement_id := NULL,  -- ✅ NULL accepté
--   p_date_entree := '2025-01-01'
-- );
-- =====================================================
