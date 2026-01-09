-- ============================================
-- PATCH SÉCURITÉ: Ajouter search_path à get_user_regie_id
-- Date: 2026-01-09
-- Objectif: Corriger manque search_path sur fonction SECURITY DEFINER critique
-- ============================================

/**
 * Retourne la regie_id de l'utilisateur connecté
 * Utilisée dans les policies RLS pour filtrer par régie
 * 
 * AMÉLIORATIONS:
 * 1. Ajout SET search_path = public (sécurité SECURITY DEFINER)
 * 2. Version robuste pour locataires:
 *    - Priorité: locataires.regie_id (ajouté M60A, hérité automatiquement)
 *    - Fallback: remontée logements → immeubles (legacy)
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
    
    -- Pour le rôle 'locataire', version robuste avec fallback
    SELECT COALESCE(
      l.regie_id,                    -- Priorité: colonne directe (M60A)
      i.regie_id                     -- Fallback: remontée via immeubles (legacy)
    ) AS regie_id
    FROM locataires l
    LEFT JOIN logements lg ON lg.id = l.logement_id
    LEFT JOIN immeubles i ON i.id = lg.immeuble_id
    WHERE l.profile_id = auth.uid()
    
    LIMIT 1
  ) AS user_regie;
$$;

COMMENT ON FUNCTION get_user_regie_id() IS 'Retourne la regie_id de l''utilisateur connecté (rôles regie et locataire). SECURITY DEFINER avec search_path fixe. Version robuste avec locataires.regie_id + fallback logements/immeubles.';

-- ============================================
-- Vérification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PATCH SÉCURITÉ get_user_regie_id()';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SET search_path = public ajouté';
  RAISE NOTICE '✅ Signature complète dans COMMENT ON FUNCTION';
  RAISE NOTICE '✅ Logique locataires robuste:';
  RAISE NOTICE '   - Priorité: locataires.regie_id';
  RAISE NOTICE '   - Fallback: logements → immeubles';
  RAISE NOTICE '========================================';
END $$;
