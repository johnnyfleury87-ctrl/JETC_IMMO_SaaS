/**
 * MIGRATION LOCATAIRES - Contraintes NOT NULL + Cascade
 * 
 * Date : 20 décembre 2025
 * Objectif : Rendre obligatoires profile_id et logement_id
 * 
 * RÈGLES MÉTIER :
 * - Un locataire est TOUJOURS un utilisateur authentifié (profile_id NOT NULL)
 * - Un locataire est TOUJOURS affilié à un logement (logement_id NOT NULL)
 * - La suppression d'un logement avec locataire est BLOQUÉE (ON DELETE RESTRICT)
 * 
 * ⚠️ PRÉ-REQUIS AVANT EXÉCUTION :
 * - Vérifier qu'AUCUN locataire n'a profile_id = NULL
 * - Vérifier qu'AUCUN locataire n'a logement_id = NULL
 * 
 * ROLLBACK :
 * - Pour annuler : ALTER TABLE locataires ALTER COLUMN ... DROP NOT NULL
 */

-- =====================================================
-- 1. VÉRIFICATION PRÉ-MIGRATION (obligatoire)
-- =====================================================

-- Vérifier locataires sans profile_id
DO $$
DECLARE
  v_count_profile_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_profile_null
  FROM locataires
  WHERE profile_id IS NULL;
  
  IF v_count_profile_null > 0 THEN
    RAISE EXCEPTION 'Migration bloquée : % locataires sans profile_id détectés', v_count_profile_null;
  END IF;
  
  RAISE NOTICE '✅ Vérification profile_id : OK (0 NULL)';
END $$;

-- Vérifier locataires sans logement_id
DO $$
DECLARE
  v_count_logement_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_logement_null
  FROM locataires
  WHERE logement_id IS NULL;
  
  IF v_count_logement_null > 0 THEN
    RAISE EXCEPTION 'Migration bloquée : % locataires sans logement_id détectés', v_count_logement_null;
  END IF;
  
  RAISE NOTICE '✅ Vérification logement_id : OK (0 NULL)';
END $$;

-- =====================================================
-- 2. SUPPRESSION TRIGGER ET FONCTION (dépréciation)
-- =====================================================

-- Supprimer trigger de synchronisation profile.logement_id
DROP TRIGGER IF EXISTS sync_profile_on_locataire_update ON locataires;

-- Supprimer fonction de synchronisation
DROP FUNCTION IF EXISTS sync_profile_logement_id();

COMMENT ON TABLE locataires IS 'JETC_IMMO - Locataires authentifiés (acteurs centraux créateurs de tickets)';

-- =====================================================
-- 3. MODIFICATION CONTRAINTES FK
-- =====================================================

-- Supprimer ancienne contrainte logement_id (ON DELETE SET NULL)
ALTER TABLE locataires 
DROP CONSTRAINT IF EXISTS locataires_logement_id_fkey;

-- Recréer contrainte avec ON DELETE RESTRICT
ALTER TABLE locataires 
ADD CONSTRAINT locataires_logement_id_fkey 
FOREIGN KEY (logement_id) 
REFERENCES logements(id) 
ON DELETE RESTRICT;

COMMENT ON CONSTRAINT locataires_logement_id_fkey ON locataires IS 
  'FK vers logements avec ON DELETE RESTRICT : empêche suppression logement si locataire présent';

-- =====================================================
-- 4. APPLICATION NOT NULL
-- =====================================================

-- Rendre profile_id obligatoire
ALTER TABLE locataires 
ALTER COLUMN profile_id SET NOT NULL;

-- Rendre logement_id obligatoire
ALTER TABLE locataires 
ALTER COLUMN logement_id SET NOT NULL;

-- Rendre date_entree obligatoire
ALTER TABLE locataires 
ALTER COLUMN date_entree SET NOT NULL;

-- =====================================================
-- 5. MISE À JOUR COMMENTAIRES
-- =====================================================

COMMENT ON COLUMN locataires.profile_id IS 
  'Profil authentifié du locataire (OBLIGATOIRE, role=locataire)';

COMMENT ON COLUMN locataires.logement_id IS 
  'Logement occupé (OBLIGATOIRE, un locataire est toujours affilié à un logement)';

COMMENT ON COLUMN locataires.date_entree IS 
  'Date d''entrée dans le logement (OBLIGATOIRE pour traçabilité)';

COMMENT ON COLUMN locataires.date_sortie IS 
  'Date de sortie (NULL = locataire actuel, NOT NULL = ancien locataire)';

-- =====================================================
-- 6. VÉRIFICATION POST-MIGRATION
-- =====================================================

DO $$
BEGIN
  -- Vérifier que NOT NULL est appliqué
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'locataires' 
      AND column_name = 'profile_id' 
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Échec migration : profile_id toujours nullable';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'locataires' 
      AND column_name = 'logement_id' 
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Échec migration : logement_id toujours nullable';
  END IF;
  
  RAISE NOTICE '✅ Migration contraintes NOT NULL : SUCCÈS';
END $$;

-- =====================================================
-- 7. LOG MIGRATION
-- =====================================================

-- Table de log des migrations (créer si n'existe pas)
CREATE TABLE IF NOT EXISTS migration_logs (
  id uuid primary key default uuid_generate_v4(),
  migration_name text not null,
  executed_at timestamptz default now(),
  description text
);

-- Enregistrer migration
INSERT INTO migration_logs (migration_name, description)
VALUES (
  '2025-12-20_migration_locataires_contraintes',
  'Application NOT NULL sur profile_id, logement_id, date_entree + ON DELETE RESTRICT'
);

