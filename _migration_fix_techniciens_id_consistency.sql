-- =====================================================
-- MIGRATION: FIX TECHNICIENS ID CONSISTENCY
-- =====================================================
-- PROBLÈME: techniciens.id ≠ techniciens.profile_id
--   Cause: INSERT sans spécifier l'ID, PostgreSQL génère UUID aléatoire
--   Impact: missions.technicien_id pointe vers un ID différent du profile_id
--           → RLS échoue car auth.uid() ne matche pas techniciens.id
--
-- SOLUTION:
--   1. Corriger les techniciens existants (id = profile_id)
--   2. Corriger les missions assignées (pointer vers nouveau id)
--   3. Ajouter contrainte CHECK pour forcer id = profile_id
--   4. Ajouter FK stricte missions → techniciens
-- =====================================================

BEGIN;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 1: AUDIT AVANT CORRECTION
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
  v_techniciens_incohérents INT;
  v_missions_orphelines INT;
BEGIN
  -- Compter techniciens incohérents
  SELECT COUNT(*) INTO v_techniciens_incohérents
  FROM techniciens
  WHERE id <> profile_id;
  
  RAISE NOTICE '📊 Techniciens avec id ≠ profile_id: %', v_techniciens_incohérents;
  
  -- Compter missions orphelines ou avec mauvais ID
  SELECT COUNT(*) INTO v_missions_orphelines
  FROM missions m
  WHERE m.technicien_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM techniciens t WHERE t.id = m.technicien_id
    );
  
  RAISE NOTICE '📊 Missions orphelines: %', v_missions_orphelines;
END $$;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 2: CORRIGER LES TECHNICIENS (id = profile_id)
-- ═══════════════════════════════════════════════════

-- Créer une table temporaire pour mapper ancien_id → nouveau_id
CREATE TEMP TABLE techniciens_mapping AS
SELECT 
  id as old_id,
  profile_id as new_id,
  email
FROM techniciens
WHERE id <> profile_id;

-- Afficher le mapping
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 MAPPING TECHNICIENS:';
  RAISE NOTICE '════════════════════════════════════════════════════';
  
  FOR r IN 
    SELECT 
      substring(old_id::text, 1, 8) as old_id_short,
      substring(new_id::text, 1, 8) as new_id_short,
      email
    FROM techniciens_mapping
  LOOP
    RAISE NOTICE 'Technicien: %', r.email;
    RAISE NOTICE '  old_id: % → new_id: %', r.old_id_short, r.new_id_short;
  END LOOP;
  
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 3: CORRIGER LES MISSIONS ASSIGNÉES
-- ═══════════════════════════════════════════════════

-- Mettre à jour missions.technicien_id avec le nouveau ID
UPDATE missions m
SET technicien_id = tm.new_id
FROM techniciens_mapping tm
WHERE m.technicien_id = tm.old_id;

-- Log
DO $$
DECLARE
  v_updated INT;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ Missions corrigées: %', v_updated;
END $$;

-- ═══════════════════════════════════════════════════
-- ÉTAPE 4: SUPPRIMER ET RECRÉER TECHNICIENS AVEC BON ID
-- ═══════════════════════════════════════════════════

-- Désactiver temporairement les contraintes FK
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_technicien_id_fkey;

-- Supprimer les anciens techniciens
DELETE FROM techniciens
WHERE id IN (SELECT old_id FROM techniciens_mapping);

-- Recréer avec le bon ID
INSERT INTO techniciens (
  id,                -- ✅ Forcer id = profile_id
  profile_id,
  entreprise_id,
  nom,
  prenom,
  email,
  telephone,
  specialites,
  actif,
  created_at,
  updated_at
)
SELECT 
  t.profile_id as id,          -- ✅ id = profile_id
  t.profile_id,
  t.entreprise_id,
  t.nom,
  t.prenom,
  t.email,
  t.telephone,
  t.specialites,
  t.actif,
  t.created_at,
  now() as updated_at
FROM techniciens t
JOIN techniciens_mapping tm ON t.profile_id = tm.new_id
ON CONFLICT (id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  entreprise_id = EXCLUDED.entreprise_id,
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  email = EXCLUDED.email,
  telephone = EXCLUDED.telephone,
  specialites = EXCLUDED.specialites,
  actif = EXCLUDED.actif,
  updated_at = now();

RAISE NOTICE '✅ Techniciens recréés avec id = profile_id';

-- ═══════════════════════════════════════════════════
-- ÉTAPE 5: AJOUTER CONTRAINTES
-- ═══════════════════════════════════════════════════

-- Contrainte CHECK: forcer id = profile_id
ALTER TABLE techniciens 
  DROP CONSTRAINT IF EXISTS techniciens_id_equals_profile_id;

ALTER TABLE techniciens 
  ADD CONSTRAINT techniciens_id_equals_profile_id
  CHECK (id = profile_id);

RAISE NOTICE '✅ Contrainte CHECK ajoutée: techniciens.id = profile_id';

-- Contrainte FK stricte: missions → techniciens
ALTER TABLE missions 
  ADD CONSTRAINT missions_technicien_id_fkey
  FOREIGN KEY (technicien_id)
  REFERENCES techniciens(id)
  ON DELETE SET NULL;

RAISE NOTICE '✅ FK ajoutée: missions.technicien_id → techniciens.id';

-- ═══════════════════════════════════════════════════
-- ÉTAPE 6: AUDIT APRÈS CORRECTION
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
  v_techniciens_ok INT;
  v_missions_ok INT;
  v_missions_orphelines INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '📊 AUDIT POST-CORRECTION';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  
  -- Techniciens cohérents
  SELECT COUNT(*) INTO v_techniciens_ok
  FROM techniciens
  WHERE id = profile_id;
  
  RAISE NOTICE '✅ Techniciens cohérents (id = profile_id): %', v_techniciens_ok;
  
  -- Missions correctement assignées
  SELECT COUNT(*) INTO v_missions_ok
  FROM missions m
  JOIN techniciens t ON t.id = m.technicien_id;
  
  RAISE NOTICE '✅ Missions avec technicien valide: %', v_missions_ok;
  
  -- Missions orphelines (devrait être 0)
  SELECT COUNT(*) INTO v_missions_orphelines
  FROM missions m
  WHERE m.technicien_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM techniciens t WHERE t.id = m.technicien_id
    );
  
  IF v_missions_orphelines > 0 THEN
    RAISE WARNING '⚠️ Missions orphelines restantes: %', v_missions_orphelines;
  ELSE
    RAISE NOTICE '✅ Aucune mission orpheline';
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════
-- RÉSUMÉ
-- ═══════════════════════════════════════════════════

\echo '✅ MIGRATION COMPLÈTE'
\echo ''
\echo '📋 Modifications:'
\echo '  ✓ Techniciens: id forcé à profile_id'
\echo '  ✓ Missions: technicien_id corrigé'
\echo '  ✓ Contrainte CHECK: id = profile_id'
\echo '  ✓ FK stricte: missions → techniciens'
\echo ''
\echo '⚠️ IMPORTANT: Modifier api/techniciens/create.js'
\echo '   Ajouter: id: authUser.user.id dans le .insert()'
