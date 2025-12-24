-- =====================================================
-- MIGRATION : Ajout colonnes et adaptation format suisse immeubles
-- =====================================================
-- Date : 24 décembre 2025
-- Objectif : Adapter format NPA suisse + ajouter colonnes métier
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADAPTER FORMAT CODE POSTAL (FR → CH)
-- =====================================================

-- Renommer colonne pour clarté
ALTER TABLE immeubles 
RENAME COLUMN code_postal TO npa;

COMMENT ON COLUMN immeubles.npa IS 'Code postal suisse (NPA - 4 chiffres)';

-- Supprimer ancienne contrainte (5 chiffres français)
ALTER TABLE immeubles
DROP CONSTRAINT IF EXISTS check_code_postal;

-- Nouvelle contrainte (4 chiffres suisse)
ALTER TABLE immeubles
ADD CONSTRAINT check_npa_format 
CHECK (npa ~ '^[0-9]{4}$');

-- Adapter index
DROP INDEX IF EXISTS idx_immeubles_code_postal;
CREATE INDEX IF NOT EXISTS idx_immeubles_npa ON immeubles(npa);

-- =====================================================
-- 2. AJOUTER COLONNES MANQUANTES
-- =====================================================

ALTER TABLE immeubles
ADD COLUMN IF NOT EXISTS pays TEXT DEFAULT 'Suisse',
ADD COLUMN IF NOT EXISTS type_immeuble TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS proprietaire_id UUID;

COMMENT ON COLUMN immeubles.pays IS 'Pays (défaut: Suisse)';
COMMENT ON COLUMN immeubles.type_immeuble IS 'Type: Résidentiel, Mixte, Commercial';
COMMENT ON COLUMN immeubles.description IS 'Description/remarques sur l\'immeuble';
COMMENT ON COLUMN immeubles.proprietaire_id IS 'Propriétaire de l\'immeuble (optionnel, fonctionnalité à venir)';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_immeubles_proprietaire_id ON immeubles(proprietaire_id);

-- =====================================================
-- 3. MIGRATION DONNÉES EXISTANTES
-- =====================================================

-- Convertir NPA français (5 chiffres) vers suisse (4 chiffres)
-- Attention : cette conversion est destructive, adapter selon cas réel
UPDATE immeubles
SET npa = LPAD(LEFT(npa, 4), 4, '0')
WHERE LENGTH(npa) = 5;

-- Mettre pays = Suisse pour toutes les lignes existantes
UPDATE immeubles
SET pays = 'Suisse'
WHERE pays IS NULL;

-- =====================================================
-- 4. VALIDATION POST-MIGRATION
-- =====================================================

DO $$
DECLARE
  v_total_immeubles INTEGER;
  v_immeubles_npa_ok INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_immeubles FROM immeubles;
  SELECT COUNT(*) INTO v_immeubles_npa_ok FROM immeubles WHERE npa ~ '^[0-9]{4}$';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION IMMEUBLES COMPLÈTE';
  RAISE NOTICE '';
  RAISE NOTICE 'Total immeubles : %', v_total_immeubles;
  RAISE NOTICE 'Immeubles NPA valide (4 chiffres) : %', v_immeubles_npa_ok;
  RAISE NOTICE '';
  RAISE NOTICE 'Modifications :';
  RAISE NOTICE '  - code_postal → npa (format suisse 4 chiffres)';
  RAISE NOTICE '  - Ajout colonnes : pays, type_immeuble, description';
  RAISE NOTICE '  - Ajout colonne : proprietaire_id (optionnel)';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- =====================================================
-- 5. LOG MIGRATION
-- =====================================================

INSERT INTO migration_logs (migration_name, description)
VALUES (
  '20251224000002_immeubles_npa_suisse_caracteristiques',
  'Adaptation format NPA suisse + ajout colonnes type, description, pays, proprietaire_id'
);
