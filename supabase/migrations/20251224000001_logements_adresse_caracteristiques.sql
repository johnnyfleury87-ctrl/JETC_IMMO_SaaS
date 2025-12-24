-- =====================================================
-- MIGRATION : Ajout colonnes adresse et caractéristiques logements
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Compléter table logements avec adresse propre et infos métier
-- =====================================================

BEGIN;

-- =====================================================
-- 1. AJOUTER COLONNES ADRESSE DU LOGEMENT
-- =====================================================

ALTER TABLE logements 
ADD COLUMN IF NOT EXISTS adresse TEXT,
ADD COLUMN IF NOT EXISTS npa TEXT,
ADD COLUMN IF NOT EXISTS ville TEXT,
ADD COLUMN IF NOT EXISTS pays TEXT DEFAULT 'Suisse';

COMMENT ON COLUMN logements.adresse IS 'Adresse complète du logement (rue + numéro)';
COMMENT ON COLUMN logements.npa IS 'Code postal suisse (4 chiffres)';
COMMENT ON COLUMN logements.ville IS 'Ville du logement';
COMMENT ON COLUMN logements.pays IS 'Pays (défaut: Suisse)';

-- =====================================================
-- 2. AJOUTER COLONNES CARACTÉRISTIQUES
-- =====================================================

ALTER TABLE logements
ADD COLUMN IF NOT EXISTS orientation TEXT,
ADD COLUMN IF NOT EXISTS annee_construction INTEGER,
ADD COLUMN IF NOT EXISTS annee_renovation INTEGER,
ADD COLUMN IF NOT EXISTS type_chauffage TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN logements.orientation IS 'Orientation du logement (Nord, Sud, Est, Ouest, etc.)';
COMMENT ON COLUMN logements.annee_construction IS 'Année de construction du logement';
COMMENT ON COLUMN logements.annee_renovation IS 'Année de la dernière rénovation';
COMMENT ON COLUMN logements.type_chauffage IS 'Type de chauffage (électrique, gaz, collectif, etc.)';
COMMENT ON COLUMN logements.description IS 'Description/spécifications du logement';

-- =====================================================
-- 3. AJOUTER COLONNE PROPRIÉTAIRE (PRÉPARATION)
-- =====================================================

ALTER TABLE logements
ADD COLUMN IF NOT EXISTS proprietaire_id UUID;

COMMENT ON COLUMN logements.proprietaire_id IS 'Propriétaire du logement (optionnel, fonctionnalité à venir)';

-- =====================================================
-- 4. CONTRAINTES VALIDATION
-- =====================================================

-- NPA suisse : 4 chiffres
ALTER TABLE logements
ADD CONSTRAINT IF NOT EXISTS check_npa_format 
CHECK (npa IS NULL OR npa ~ '^[0-9]{4}$');

-- Années cohérentes
ALTER TABLE logements
ADD CONSTRAINT IF NOT EXISTS check_annee_construction 
CHECK (annee_construction IS NULL OR (annee_construction >= 1800 AND annee_construction <= 2100));

ALTER TABLE logements
ADD CONSTRAINT IF NOT EXISTS check_annee_renovation 
CHECK (annee_renovation IS NULL OR (annee_renovation >= 1800 AND annee_renovation <= 2100));

-- =====================================================
-- 5. INDEX POUR PERFORMANCES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_logements_npa ON logements(npa);
CREATE INDEX IF NOT EXISTS idx_logements_ville ON logements(ville);
CREATE INDEX IF NOT EXISTS idx_logements_proprietaire_id ON logements(proprietaire_id);

-- =====================================================
-- 6. MIGRATION DONNÉES EXISTANTES (SI NÉCESSAIRE)
-- =====================================================

-- Pour les logements dans un immeuble, copier l'adresse de l'immeuble
UPDATE logements l
SET 
  adresse = i.adresse,
  npa = i.code_postal,
  ville = i.ville,
  pays = 'Suisse'
FROM immeubles i
WHERE l.immeuble_id = i.id
  AND l.adresse IS NULL;

-- Pour les maisons individuelles sans adresse, mettre une valeur par défaut
-- ⚠️ NPA = NULL plutôt que '0000' (qui n'existe pas en Suisse)
UPDATE logements
SET 
  adresse = 'Non renseigné',
  npa = NULL,
  ville = 'Non renseigné',
  pays = 'Suisse'
WHERE immeuble_id IS NULL
  AND adresse IS NULL;

-- =====================================================
-- 7. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_logements INTEGER;
  v_logements_avec_adresse INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_logements FROM logements;
  SELECT COUNT(*) INTO v_logements_avec_adresse FROM logements WHERE adresse IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION LOGEMENTS COMPLÈTE';
  RAISE NOTICE '';
  RAISE NOTICE 'Total logements : %', v_total_logements;
  RAISE NOTICE 'Logements avec adresse : %', v_logements_avec_adresse;
  RAISE NOTICE '';
  RAISE NOTICE 'Nouvelles colonnes ajoutées :';
  RAISE NOTICE '  - adresse, npa, ville, pays';
  RAISE NOTICE '  - orientation, annee_construction, annee_renovation';
  RAISE NOTICE '  - type_chauffage, description';
  RAISE NOTICE '  - proprietaire_id (optionnel)';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- =====================================================
-- 8. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20251224000001_logements_adresse_caracteristiques',
  'Ajout colonnes adresse + caractéristiques + propriétaire pour logements'
);
