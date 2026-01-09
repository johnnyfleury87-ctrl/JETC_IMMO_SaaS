-- ============================================
-- PATCH SÉCURITÉ: Ajouter search_path à get_user_regie_id
-- Date: 2026-01-09
-- Objectif: Corriger manque search_path sur fonction SECURITY DEFINER critique
-- ============================================

/**
 * Retourne la regie_id de l'utilisateur connecté
 * Utilisée dans les policies RLS pour filtrer par régie
 * PATCH: Ajout SET search_path = public (sécurité SECURITY DEFINER)
 */
CREATE OR REPLACE FUNCTION get_user_regie_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT regie_id FROM (
    -- Pour le rôle 'regie', prendre directement depuis regies
    SELECT r.id AS regie_id
    FROM regies r
    WHERE r.profile_id = auth.uid()
    
    UNION
    
    -- Pour le rôle 'locataire', remonter via logements → immeubles
    SELECT i.regie_id
    FROM locataires l
    JOIN logements lg ON lg.id = l.logement_id
    JOIN immeubles i ON i.id = lg.immeuble_id
    WHERE l.profile_id = auth.uid()
    
    LIMIT 1
  ) AS user_regie;
$$;

COMMENT ON FUNCTION get_user_regie_id IS 'Retourne la regie_id de l''utilisateur connecté (pour rôles regie et locataire). SECURITY DEFINER avec search_path fixe.';

-- ============================================
-- Vérification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ get_user_regie_id : search_path fixé à public';
END $$;
