#!/usr/bin/env node
/**
 * ÉTAPE 2B - VALIDATION POST-APPLY M42
 * 
 * Vérifie que la migration M42 a été appliquée avec succès:
 * 1. Colonne missions.disponibilite_id existe
 * 2. Contrainte FK vers tickets_disponibilites.id
 * 3. Index idx_missions_disponibilite_id existe
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  timestamp: new Date().toISOString(),
  etape: '2B - Validation post-apply M42',
  checks: {}
};

/**
 * Exécute une requête SQL via RPC raw_sql
 */
async function executeQuery(sql, description) {
  console.log(`\n🔍 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('raw_sql', { query: sql });
    
    if (error) {
      console.log(`   ⚠️ Erreur RPC: ${error.message}`);
      return { success: false, error: error.message, data: null };
    }
    
    console.log(`   ✅ Requête réussie`);
    return { success: true, error: null, data };
  } catch (err) {
    console.log(`   ⚠️ Exception: ${err.message}`);
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Méthode alternative: tester SELECT sur la colonne
 */
async function testColumnDirectly() {
  console.log('\n🔍 Test direct: SELECT disponibilite_id FROM missions...');
  try {
    const { data, error } = await supabase
      .from('missions')
      .select('disponibilite_id')
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️ Erreur: ${error.message}`);
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('   ❌ COLONNE ABSENTE');
        return { exists: false, proof: 'SELECT failed - column does not exist' };
      }
      return { exists: 'unknown', proof: error.message };
    }
    
    console.log('   ✅ SELECT réussi - colonne existe!');
    return { exists: true, proof: 'SELECT disponibilite_id succeeded', count: data?.length || 0 };
  } catch (err) {
    console.log(`   ⚠️ Exception: ${err.message}`);
    return { exists: 'unknown', proof: err.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('ÉTAPE 2B - VALIDATION POST-APPLY M42');
  console.log('═══════════════════════════════════════════════════\n');
  
  // ═══════════════════════════════════════════════════
  // CHECK 1: Colonne missions.disponibilite_id existe
  // ═══════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 1: Colonne missions.disponibilite_id     │');
  console.log('└─────────────────────────────────────────────────┘');
  
  // Méthode 1: Test direct SELECT
  const directTest = await testColumnDirectly();
  results.checks.column_direct_test = directTest;
  
  // Méthode 2: information_schema.columns (si RPC disponible)
  const columnCheckSql = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'missions'
      AND column_name = 'disponibilite_id';
  `;
  
  const columnCheck = await executeQuery(columnCheckSql, 'Query information_schema.columns');
  results.checks.column_metadata = columnCheck;
  
  // Méthode 3: Liste toutes colonnes missions
  const allColumnsSql = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'missions'
    ORDER BY ordinal_position;
  `;
  
  const allColumns = await executeQuery(allColumnsSql, 'Liste toutes colonnes missions');
  results.checks.all_missions_columns = allColumns;
  
  // ═══════════════════════════════════════════════════
  // CHECK 2: Contrainte FK vers tickets_disponibilites
  // ═══════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 2: Contrainte FK disponibilite_id        │');
  console.log('└─────────────────────────────────────────────────┘');
  
  const fkCheckSql = `
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'missions'
      AND kcu.column_name = 'disponibilite_id';
  `;
  
  const fkCheck = await executeQuery(fkCheckSql, 'Query FK constraints');
  results.checks.fk_constraint = fkCheck;
  
  // ═══════════════════════════════════════════════════
  // CHECK 3: Index idx_missions_disponibilite_id
  // ═══════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 3: Index idx_missions_disponibilite_id   │');
  console.log('└─────────────────────────────────────────────────┘');
  
  const indexCheckSql = `
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'missions'
      AND indexname = 'idx_missions_disponibilite_id';
  `;
  
  const indexCheck = await executeQuery(indexCheckSql, 'Query pg_indexes');
  results.checks.index = indexCheck;
  
  // ═══════════════════════════════════════════════════
  // CHECK 4: Migration enregistrée dans migration_logs
  // ═══════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 4: Migration M42 dans migration_logs     │');
  console.log('└─────────────────────────────────────────────────┘');
  
  const migrationLogSql = `
    SELECT id, migration_name, description, applied_at
    FROM migration_logs
    WHERE migration_name LIKE '%m42%'
       OR migration_name LIKE '%disponibilite_id%'
    ORDER BY applied_at DESC;
  `;
  
  const migrationLog = await executeQuery(migrationLogSql, 'Query migration_logs');
  results.checks.migration_log = migrationLog;
  
  // ═══════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('RÉSUMÉ VALIDATION M42');
  console.log('═══════════════════════════════════════════════════\n');
  
  const columnExists = directTest.exists === true;
  const fkExists = fkCheck.success && fkCheck.data && fkCheck.data.length > 0;
  const indexExists = indexCheck.success && indexCheck.data && indexCheck.data.length > 0;
  const migrationLogged = migrationLog.success && migrationLog.data && migrationLog.data.length > 0;
  
  console.log(`✓ Colonne disponibilite_id:     ${columnExists ? '✅ PRÉSENTE' : '❌ ABSENTE'}`);
  console.log(`✓ Contrainte FK:                ${fkExists ? '✅ PRÉSENTE' : '❌ ABSENTE'}`);
  console.log(`✓ Index:                        ${indexExists ? '✅ PRÉSENT' : '❌ ABSENT'}`);
  console.log(`✓ Migration enregistrée:        ${migrationLogged ? '✅ OUI' : '⚠️ NON'}`);
  
  results.summary = {
    column_exists: columnExists,
    fk_exists: fkExists,
    index_exists: indexExists,
    migration_logged: migrationLogged,
    validation: columnExists && fkExists && indexExists ? 'SUCCESS' : 'INCOMPLETE'
  };
  
  console.log(`\n🎯 VALIDATION GLOBALE: ${results.summary.validation === 'SUCCESS' ? '✅ SUCCÈS' : '⚠️ INCOMPLÈTE'}\n`);
  
  // Sauvegarder résultats
  const outputPath = '_fix_output/02_post_apply_m42_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Résultats sauvegardés: ${outputPath}\n`);
  
  // Générer fichier SQL requêtes
  const sqlQueries = `-- ============================================================
-- ÉTAPE 2B - REQUÊTES VALIDATION M42
-- ============================================================
-- Date: ${new Date().toISOString().split('T')[0]}
-- Usage: Exécuter dans Supabase Studio SQL Editor pour validation manuelle
-- ============================================================

-- CHECK 1: Vérifier colonne disponibilite_id existe
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
  AND column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (missions, disponibilite_id, uuid, YES, NULL)


-- CHECK 1bis: Lister toutes colonnes missions (doit contenir disponibilite_id)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'missions'
ORDER BY ordinal_position;
-- Résultat attendu: 21 colonnes (20 existantes + disponibilite_id)


-- CHECK 2: Vérifier contrainte FK
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'missions'
  AND kcu.column_name = 'disponibilite_id';
-- Résultat attendu: 1 ligne (missions_disponibilite_id_fkey, tickets_disponibilites, id, SET NULL)


-- CHECK 3: Vérifier index
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'missions'
  AND indexname = 'idx_missions_disponibilite_id';
-- Résultat attendu: 1 ligne avec indexdef contenant WHERE disponibilite_id IS NOT NULL


-- CHECK 4: Vérifier migration enregistrée
SELECT id, migration_name, description, applied_at
FROM migration_logs
WHERE migration_name LIKE '%m42%'
   OR migration_name LIKE '%disponibilite_id%'
ORDER BY applied_at DESC;
-- Résultat attendu: 1 ligne (20260104001800_m42_add_disponibilite_id_missions)


-- ============================================================
-- FIN REQUÊTES VALIDATION
-- ============================================================
`;
  
  const sqlPath = '_fix_output/02_post_apply_m42_queries.sql';
  fs.writeFileSync(sqlPath, sqlQueries);
  console.log(`💾 Requêtes SQL générées: ${sqlPath}\n`);
  
  process.exit(results.summary.validation === 'SUCCESS' ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
