-- =====================================================
-- REQUÊTES DE VÉRIFICATION PROD
-- À exécuter AVANT et APRÈS la migration
-- =====================================================

-- =====================================================
-- ÉTAPE 1: VÉRIFICATION AVANT MIGRATION
-- =====================================================

-- 1.1 Vérifier si la RPC assign_technicien_to_mission existe
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  p.oid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname ILIKE '%assign%technicien%mission%';

-- Attendu AVANT migration: 
--   - Soit 0 ligne (fonction n'existe pas)
--   - Soit 1 ligne avec mauvaise signature ou bugs

-- 1.2 Vérifier les triggers sur missions
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'missions'
  AND (t.tgname ILIKE '%assign%' OR t.tgname ILIKE '%technicien%');

-- Attendu AVANT migration:
--   - Trigger technicien_assignment_notification peut exister (bugué)
--   - Ou aucun trigger

-- 1.3 Vérifier la fonction notify_technicien_assignment
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'notify_technicien_assignment';

-- Attendu AVANT migration:
--   - Fonction peut exister avec bug user_id
--   - Ou fonction n'existe pas

-- =====================================================
-- ⚠️  APPLIQUER LA MIGRATION ICI
-- Copier le contenu de 20260108120000_fix_assignation_prod_urgent.sql
-- =====================================================

-- =====================================================
-- ÉTAPE 2: VÉRIFICATION APRÈS MIGRATION
-- =====================================================

-- 2.1 Vérifier la RPC existe avec la bonne signature
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assign_technicien_to_mission';

-- Attendu APRÈS migration: 1 ligne
-- Schema: public
-- Function name: assign_technicien_to_mission
-- Arguments: p_mission_id uuid, p_technicien_id uuid
-- Is security definer: t

-- 2.2 Vérifier les permissions
SELECT 
  p.proname as function_name,
  pg_catalog.array_to_string(p.proacl, E'\n') as acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assign_technicien_to_mission';

-- Attendu: authenticated et anon ont EXECUTE

-- 2.3 Vérifier le trigger existe et est attaché
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE t.tgtype::integer & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END as level,
  CASE t.tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE t.tgtype::integer & 28
    WHEN 4 THEN 'INSERT'
    WHEN 8 THEN 'DELETE'
    WHEN 16 THEN 'UPDATE'
    WHEN 20 THEN 'INSERT OR UPDATE'
    WHEN 24 THEN 'UPDATE OR DELETE'
    WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
  END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'missions'
  AND t.tgname = 'technicien_assignment_notification';

-- Attendu: 1 ligne
-- Trigger name: technicien_assignment_notification
-- Table name: missions
-- Function name: notify_technicien_assignment
-- Level: ROW
-- Timing: AFTER
-- Event: UPDATE

-- =====================================================
-- ÉTAPE 3: TEST FONCTIONNEL (avec faux IDs)
-- =====================================================

-- 3.1 Test avec IDs invalides (doit échouer proprement)
SELECT assign_technicien_to_mission(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid
);

-- Attendu: {"success": false, "error": "Vous devez être connecté en tant qu'entreprise"}
-- Ou: {"success": false, "error": "Mission introuvable"}

-- SI vous êtes connecté en tant qu'entreprise dans SQL Editor (peu probable),
-- vous aurez: "Mission introuvable" ou "Technicien introuvable"

-- =====================================================
-- ÉTAPE 4: TEST RÉEL (optionnel, si vous avez des données)
-- =====================================================

-- 4.1 Lister vos missions en attente
SELECT 
  m.id,
  m.statut,
  m.technicien_id,
  e.nom as entreprise_nom,
  t.reference as ticket_ref
FROM missions m
JOIN entreprises e ON m.entreprise_id = e.id
JOIN tickets t ON m.ticket_id = t.id
WHERE m.statut = 'en_attente'
  AND m.technicien_id IS NULL
LIMIT 5;

-- 4.2 Lister vos techniciens disponibles
SELECT 
  tech.id,
  tech.nom,
  tech.prenom,
  e.nom as entreprise_nom
FROM techniciens tech
JOIN entreprises e ON tech.entreprise_id = e.id
LIMIT 5;

-- 4.3 Test d'assignation réelle (remplacer les IDs)
-- ⚠️  ATTENTION: Ceci va vraiment assigner un technicien !
-- Décommenter et remplacer les IDs pour tester:

-- SELECT assign_technicien_to_mission(
--   '<MISSION_ID>'::uuid,
--   '<TECHNICIEN_ID>'::uuid
-- );

-- Attendu: {"success": true, "mission_id": "...", "technicien_id": "...", "message": "Technicien assigné avec succès"}

-- =====================================================
-- ÉTAPE 5: VALIDATION FINALE
-- =====================================================

-- 5.1 Vérifier qu'il n'y a pas de doublons
SELECT 
  p.proname,
  COUNT(*) as count,
  array_agg(pg_get_function_identity_arguments(p.oid)) as all_signatures
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'assign_technicien_to_mission'
GROUP BY p.proname
HAVING COUNT(*) > 1;

-- Attendu: 0 lignes (pas de doublons)

-- 5.2 Vérifier les commentaires
SELECT 
  p.proname,
  pg_catalog.obj_description(p.oid, 'pg_proc') as comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('assign_technicien_to_mission', 'notify_technicien_assignment');

-- Attendu: 2 lignes avec commentaires descriptifs

-- =====================================================
-- RÉSUMÉ
-- =====================================================

-- ✅ Si toutes ces vérifications passent:
--    1. RPC assign_technicien_to_mission existe avec signature correcte
--    2. Trigger notify_technicien_assignment existe sur missions
--    3. Test avec IDs fictifs retourne erreur propre (pas de crash)
--    4. Pas de doublons de fonctions
--
-- ➡️  VOUS POUVEZ TESTER DEPUIS LE DASHBOARD ENTREPRISE

-- ❌ Si une vérification échoue:
--    1. Noter l'erreur exacte
--    2. Vérifier que la migration complète a été exécutée
--    3. Au besoin, exécuter manuellement les DROP puis CREATE
