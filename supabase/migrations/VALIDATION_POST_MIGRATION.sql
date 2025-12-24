-- =====================================================
-- REQUÊTES DE VALIDATION POST-MIGRATION
-- =====================================================
-- Date : 24 décembre 2025
-- Usage : Copier-coller dans Supabase SQL Editor après migrations
-- =====================================================

-- =====================================================
-- 1. VÉRIFIER STRUCTURE LOGEMENTS
-- =====================================================

-- 1.1 Lister toutes les colonnes de logements
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'logements'
ORDER BY ordinal_position;

-- 1.2 Vérifier nouvelles colonnes spécifiques
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'logements'
  AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 
                      'annee_construction', 'annee_renovation', 'type_chauffage', 
                      'description', 'proprietaire_id')
ORDER BY column_name;

-- Résultat attendu : 10 lignes

-- 1.3 Vérifier contraintes logements
SELECT 
  conname AS contrainte_nom, 
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'logements'::regclass
  AND conname IN ('check_npa_format', 'check_annee_construction', 'check_annee_renovation')
ORDER BY conname;

-- Résultat attendu : 3 contraintes

-- 1.4 Vérifier index logements
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'logements'
  AND indexname IN ('idx_logements_npa', 'idx_logements_ville', 'idx_logements_proprietaire_id')
ORDER BY indexname;

-- Résultat attendu : 3 index

-- =====================================================
-- 2. VÉRIFIER STRUCTURE IMMEUBLES
-- =====================================================

-- 2.1 Vérifier renommage code_postal → npa
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('code_postal', 'npa');

-- Résultat attendu : UNE SEULE ligne avec 'npa'
-- Si 'code_postal' apparaît → migration échouée ou pas exécutée

-- 2.2 Vérifier nouvelles colonnes immeubles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'immeubles'
  AND column_name IN ('npa', 'pays', 'type_immeuble', 'description', 'proprietaire_id')
ORDER BY column_name;

-- Résultat attendu : 5 lignes

-- 2.3 Vérifier contrainte NPA immeubles
SELECT 
  conname AS contrainte_nom, 
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'immeubles'::regclass
  AND conname IN ('check_npa_format', 'check_code_postal')
ORDER BY conname;

-- Résultat attendu : 
-- 1 ligne : check_npa_format (NPA 4 chiffres)
-- Si check_code_postal existe → migration incomplète

-- 2.4 Vérifier index immeubles renommés
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'immeubles'
  AND indexname IN ('idx_immeubles_code_postal', 'idx_immeubles_npa', 'idx_immeubles_proprietaire_id')
ORDER BY indexname;

-- Résultat attendu : 2 lignes (npa, proprietaire_id)
-- Si idx_immeubles_code_postal existe → migration incomplète

-- =====================================================
-- 3. VÉRIFIER MIGRATION_LOGS
-- =====================================================

-- 3.1 Vérifier entrées migration_logs
SELECT 
  migration_name, 
  description, 
  executed_at
FROM migration_logs
WHERE migration_name LIKE '20251224%'
ORDER BY executed_at;

-- Résultat attendu : 2 lignes
-- 20251224000001... (logements)
-- 20251224000002... (immeubles)

-- 3.2 Compter toutes les migrations
SELECT COUNT(*) AS total_migrations
FROM migration_logs;

-- =====================================================
-- 4. VÉRIFIER DONNÉES MIGRÉES
-- =====================================================

-- 4.1 Compter logements avec adresses
SELECT 
  COUNT(*) AS total_logements,
  COUNT(adresse) AS logements_avec_adresse,
  COUNT(npa) AS logements_avec_npa,
  COUNT(CASE WHEN immeuble_id IS NULL THEN 1 END) AS maisons_individuelles,
  COUNT(CASE WHEN immeuble_id IS NOT NULL THEN 1 END) AS appartements
FROM logements;

-- 4.2 Compter immeubles avec NPA suisse
SELECT 
  COUNT(*) AS total_immeubles,
  COUNT(CASE WHEN npa ~ '^[0-9]{4}$' THEN 1 END) AS npa_format_suisse,
  COUNT(CASE WHEN LENGTH(npa) = 5 THEN 1 END) AS npa_format_francais,
  COUNT(pays) AS immeubles_avec_pays
FROM immeubles;

-- Résultat attendu : npa_format_francais = 0

-- =====================================================
-- 5. VÉRIFIER CONTRAINTES FONCTIONNELLES
-- =====================================================

-- 5.1 Tester validation NPA logements (ne doit pas s'exécuter)
-- Décommenter pour tester :
/*
INSERT INTO logements (
  numero, type_logement, adresse, npa, ville, pays, statut, regie_id
) VALUES (
  'Test NPA Invalide',
  'T2',
  '1 rue Test',
  '75001',  -- ❌ 5 chiffres
  'Paris',
  'France',
  'vacant',
  'UUID_INVALIDE'
);
*/
-- Résultat attendu : ERROR "check_npa_format"

-- 5.2 Tester validation NPA immeubles (ne doit pas s'exécuter)
-- Décommenter pour tester :
/*
INSERT INTO immeubles (
  nom, adresse, npa, ville, nombre_etages, regie_id
) VALUES (
  'Test NPA Invalide',
  '1 rue Test',
  '12345',  -- ❌ 5 chiffres
  'Paris',
  3,
  'UUID_INVALIDE'
);
*/
-- Résultat attendu : ERROR "check_npa_format"

-- =====================================================
-- 6. RAPPORT COMPLET
-- =====================================================

-- 6.1 Récapitulatif global
SELECT 
  '=== RAPPORT VALIDATION MIGRATIONS ===' AS section,
  NOW() AS date_verification;

SELECT 
  'LOGEMENTS' AS table_name,
  COUNT(CASE WHEN column_name = 'adresse' THEN 1 END) AS col_adresse,
  COUNT(CASE WHEN column_name = 'npa' THEN 1 END) AS col_npa,
  COUNT(CASE WHEN column_name = 'ville' THEN 1 END) AS col_ville,
  COUNT(CASE WHEN column_name = 'pays' THEN 1 END) AS col_pays,
  COUNT(CASE WHEN column_name = 'orientation' THEN 1 END) AS col_orientation,
  COUNT(CASE WHEN column_name = 'annee_construction' THEN 1 END) AS col_annee_construction,
  COUNT(CASE WHEN column_name = 'annee_renovation' THEN 1 END) AS col_annee_renovation,
  COUNT(CASE WHEN column_name = 'type_chauffage' THEN 1 END) AS col_type_chauffage,
  COUNT(CASE WHEN column_name = 'description' THEN 1 END) AS col_description,
  COUNT(CASE WHEN column_name = 'proprietaire_id' THEN 1 END) AS col_proprietaire_id
FROM information_schema.columns
WHERE table_name = 'logements';

-- Résultat attendu : toutes les colonnes = 1

SELECT 
  'IMMEUBLES' AS table_name,
  COUNT(CASE WHEN column_name = 'npa' THEN 1 END) AS col_npa,
  COUNT(CASE WHEN column_name = 'code_postal' THEN 1 END) AS col_code_postal_old,
  COUNT(CASE WHEN column_name = 'pays' THEN 1 END) AS col_pays,
  COUNT(CASE WHEN column_name = 'type_immeuble' THEN 1 END) AS col_type_immeuble,
  COUNT(CASE WHEN column_name = 'description' THEN 1 END) AS col_description,
  COUNT(CASE WHEN column_name = 'proprietaire_id' THEN 1 END) AS col_proprietaire_id
FROM information_schema.columns
WHERE table_name = 'immeubles';

-- Résultat attendu : 
-- col_npa = 1
-- col_code_postal_old = 0
-- autres = 1

-- 6.2 Vérifier cohérence totale
SELECT 
  '✅ VALIDATION COMPLÈTE' AS statut,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'logements' AND column_name IN ('adresse', 'npa', 'ville', 'pays', 'orientation', 'annee_construction', 'annee_renovation', 'type_chauffage', 'description', 'proprietaire_id')) AS logements_nouvelles_colonnes,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'immeubles' AND column_name IN ('npa', 'pays', 'type_immeuble', 'description', 'proprietaire_id')) AS immeubles_nouvelles_colonnes,
  (SELECT COUNT(*) FROM pg_constraint WHERE conrelid IN ('logements'::regclass, 'immeubles'::regclass) AND conname LIKE 'check_npa_format%') AS contraintes_npa,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('logements', 'immeubles') AND indexname LIKE '%proprietaire_id%') AS index_proprietaire,
  (SELECT COUNT(*) FROM migration_logs WHERE migration_name LIKE '20251224%') AS migrations_enregistrees;

-- Résultat attendu :
-- logements_nouvelles_colonnes = 10
-- immeubles_nouvelles_colonnes = 5
-- contraintes_npa = 2 (1 pour logements, 1 pour immeubles)
-- index_proprietaire = 2 (1 pour logements, 1 pour immeubles)
-- migrations_enregistrees = 2

-- =====================================================
-- 7. TESTS INSERTION RÉELS
-- =====================================================

-- 7.1 Test création logement avec toutes nouvelles colonnes
-- Remplacer <VOTRE_REGIE_ID> par ID réel
/*
INSERT INTO logements (
  numero, type_logement, 
  adresse, npa, ville, pays,
  orientation, annee_construction, annee_renovation, type_chauffage, description,
  statut, loyer_mensuel, charges_mensuelles,
  balcon, parking,
  regie_id
) VALUES (
  'Test Migration Complet',
  'T3',
  '123 Avenue de Test',
  '1003',
  'Lausanne',
  'Suisse',
  'Sud-Est',
  2018,
  2023,
  'Pompe à chaleur',
  'Logement test migration avec toutes colonnes renseignées',
  'vacant',
  1800.00,
  250.00,
  true,
  true,
  '<VOTRE_REGIE_ID>'
)
RETURNING id, numero, adresse, npa, ville, orientation, annee_construction;
*/

-- 7.2 Test création immeuble avec toutes nouvelles colonnes
-- Remplacer <VOTRE_REGIE_ID> par ID réel
/*
INSERT INTO immeubles (
  nom, adresse, npa, ville, pays,
  type_immeuble, nombre_etages, annee_construction, description,
  type_chauffage, ascenseur, interphone,
  regie_id
) VALUES (
  'Résidence Test Migration',
  '456 Rue du Test',
  '1000',
  'Lausanne',
  'Suisse',
  'Résidentiel',
  4,
  2020,
  'Immeuble test migration avec toutes colonnes renseignées',
  'Chauffage central',
  true,
  true,
  '<VOTRE_REGIE_ID>'
)
RETURNING id, nom, npa, ville, pays, type_immeuble;
*/

-- =====================================================
-- 8. NETTOYAGE (SI TOUT OK)
-- =====================================================

-- Supprimer tables backup si validation réussie
-- ⚠️ NE PAS EXÉCUTER AVANT D'ÊTRE SÛR
/*
DROP TABLE IF EXISTS logements_backup_20251224;
DROP TABLE IF EXISTS immeubles_backup_20251224;

SELECT '✅ Tables backup supprimées' AS statut;
*/

-- =====================================================
-- FIN DES REQUÊTES DE VALIDATION
-- =====================================================

-- RÉSULTAT ATTENDU :
-- ✅ 10 nouvelles colonnes dans logements
-- ✅ 5 colonnes dans immeubles (dont npa renommé)
-- ✅ code_postal n'existe plus
-- ✅ Contraintes NPA 4 chiffres actives
-- ✅ Index créés
-- ✅ 2 entrées dans migration_logs
-- ✅ Tests insertion réussissent
