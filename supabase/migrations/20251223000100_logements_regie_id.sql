-- =====================================================
-- MIGRATION : logements.regie_id - PHASE 1
-- =====================================================
-- Date : 23 décembre 2025
-- Objectif : Simplifier modèle - logement appartient directement à régie
-- Décision : logements.regie_id NOT NULL, logements.immeuble_id NULLABLE
-- Bénéfice : Zéro récursion RLS, support maisons individuelles
-- =====================================================

BEGIN;

-- =====================================================
-- 1. AJOUTER COLONNE logements.regie_id
-- =====================================================

-- Étape 1 : Ajouter colonne NULLABLE d'abord (pour permettre migration données)
ALTER TABLE logements 
ADD COLUMN IF NOT EXISTS regie_id UUID;

-- Étape 2 : Remplir regie_id depuis immeubles.regie_id pour données existantes
UPDATE logements l
SET regie_id = i.regie_id
FROM immeubles i
WHERE l.immeuble_id = i.id
  AND l.regie_id IS NULL;

-- Étape 3 : Pour logements orphelins (si immeuble_id NULL), prendre première régie
-- (normalement ne devrait pas arriver, mais sécurité migration)
UPDATE logements
SET regie_id = (SELECT id FROM regies LIMIT 1)
WHERE regie_id IS NULL;

-- Étape 4 : Rendre colonne NOT NULL + ajouter FK
ALTER TABLE logements 
ALTER COLUMN regie_id SET NOT NULL;

ALTER TABLE logements
ADD CONSTRAINT fk_logements_regie_id 
FOREIGN KEY (regie_id) REFERENCES regies(id) ON DELETE CASCADE;

-- Index pour performance RLS
CREATE INDEX IF NOT EXISTS idx_logements_regie_id ON logements(regie_id);

-- =====================================================
-- 2. RENDRE immeuble_id NULLABLE
-- =====================================================

-- Un logement peut être une maison individuelle (sans immeuble)
ALTER TABLE logements 
ALTER COLUMN immeuble_id DROP NOT NULL;

-- =====================================================
-- 3. COMMENTAIRES DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN logements.regie_id IS 
'Régie propriétaire du logement (NOT NULL). Tout logement appartient à une régie.';

COMMENT ON COLUMN logements.immeuble_id IS 
'Immeuble parent (NULLABLE). NULL = maison individuelle, sinon appartement dans immeuble.';

-- =====================================================
-- 4. VALIDATION
-- =====================================================

DO $$
BEGIN
  -- Vérifier colonne existe et NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'logements' 
      AND column_name = 'regie_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE NOTICE '✅ logements.regie_id créée (NOT NULL)';
  ELSE
    RAISE EXCEPTION '❌ logements.regie_id manquante ou nullable';
  END IF;
  
  -- Vérifier immeuble_id NULLABLE
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'logements' 
      AND column_name = 'immeuble_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '✅ logements.immeuble_id rendue nullable';
  ELSE
    RAISE EXCEPTION '❌ logements.immeuble_id toujours NOT NULL';
  END IF;
  
  -- Vérifier FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'logements'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_logements_regie_id'
  ) THEN
    RAISE NOTICE '✅ FK logements.regie_id → regies.id créée';
  ELSE
    RAISE EXCEPTION '❌ FK logements.regie_id manquante';
  END IF;
  
  -- Vérifier pas de données orphelines
  IF EXISTS (SELECT 1 FROM logements WHERE regie_id IS NULL) THEN
    RAISE EXCEPTION '❌ Logements avec regie_id NULL détectés';
  ELSE
    RAISE NOTICE '✅ Tous logements ont un regie_id';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION logements.regie_id RÉUSSIE';
  RAISE NOTICE '';
  RAISE NOTICE 'Modèle PHASE 1 :';
  RAISE NOTICE '  - logements.regie_id NOT NULL (propriétaire direct)';
  RAISE NOTICE '  - logements.immeuble_id NULLABLE (maisons individuelles)';
  RAISE NOTICE '  - RLS simplifié : logements.regie_id = régie connectée';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;
