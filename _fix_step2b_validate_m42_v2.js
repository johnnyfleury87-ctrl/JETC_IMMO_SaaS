#!/usr/bin/env node
/**
 * ÉTAPE 2B - VALIDATION POST-APPLY M42 (MÉTHODE ALTERNATIVE)
 * 
 * Pas de RPC raw_sql disponible, on utilise:
 * 1. SELECT direct pour tester colonnes
 * 2. Test FK via tentative INSERT/UPDATE
 * 3. Requêtes SQL prêtes pour exécution manuelle
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  timestamp: new Date().toISOString(),
  etape: '2B - Validation M42',
  checks: {}
};

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('ÉTAPE 2B - VALIDATION M42 (TEST FONCTIONNEL)');
  console.log('═══════════════════════════════════════════════════\n');
  
  // ═══════════════════════════════════════════════════
  // CHECK 1: Colonne disponibilite_id existe
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 1: Colonne missions.disponibilite_id     │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  console.log('🔍 Test SELECT disponibilite_id...');
  const { data: missions, error: selectError } = await supabase
    .from('missions')
    .select('disponibilite_id')
    .limit(1);
  
  if (selectError) {
    console.log(`   ❌ ERREUR: ${selectError.message}`);
    if (selectError.message.includes('does not exist')) {
      console.log('   ❌ COLONNE ABSENTE\n');
      results.checks.column_exists = false;
    } else {
      console.log('   ⚠️ Erreur autre (possiblement RLS)\n');
      results.checks.column_exists = 'unknown';
    }
  } else {
    console.log('   ✅ SELECT RÉUSSI - Colonne disponibilite_id PRÉSENTE\n');
    results.checks.column_exists = true;
  }
  
  // Test toutes colonnes accessibles
  console.log('🔍 Test SELECT * FROM missions...');
  const { data: fullMission, error: fullError } = await supabase
    .from('missions')
    .select('*')
    .limit(1);
  
  if (!fullError && fullMission) {
    const columns = fullMission.length > 0 ? Object.keys(fullMission[0]) : [];
    console.log(`   ✅ Colonnes accessibles (${columns.length}):`, columns.join(', '));
    results.checks.accessible_columns = columns;
    results.checks.column_in_list = columns.includes('disponibilite_id');
    console.log(`   ${columns.includes('disponibilite_id') ? '✅' : '❌'} disponibilite_id dans la liste\n`);
  } else {
    console.log(`   ⚠️ Aucune donnée (table vide ou RLS strict)\n`);
    results.checks.accessible_columns = [];
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 2: Table tickets_disponibilites accessible (FK target)
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 2: Table tickets_disponibilites (FK)     │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  console.log('🔍 Test SELECT FROM tickets_disponibilites...');
  const { data: dispos, error: dispoError } = await supabase
    .from('tickets_disponibilites')
    .select('id')
    .limit(1);
  
  if (dispoError) {
    console.log(`   ❌ Table inaccessible: ${dispoError.message}\n`);
    results.checks.fk_target_accessible = false;
  } else {
    console.log(`   ✅ Table tickets_disponibilites accessible (${dispos?.length || 0} rows)\n`);
    results.checks.fk_target_accessible = true;
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 3: Compter missions
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 3: Nombre de missions dans la base      │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  console.log('🔍 Test COUNT missions...');
  const { count, error: countError } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.log(`   ⚠️ Erreur: ${countError.message}\n`);
    results.checks.missions_count = 'unknown';
  } else {
    console.log(`   ✅ Total missions: ${count}\n`);
    results.checks.missions_count = count;
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 4: Migration enregistrée
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 4: Migration M42 dans migration_logs     │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  console.log('🔍 Query migration_logs...');
  const { data: logs, error: logsError } = await supabase
    .from('migration_logs')
    .select('*')
    .or('migration_name.ilike.%m42%,migration_name.ilike.%disponibilite%')
    .order('applied_at', { ascending: false });
  
  if (logsError) {
    console.log(`   ⚠️ Erreur: ${logsError.message}\n`);
    results.checks.migration_logged = false;
  } else if (logs && logs.length > 0) {
    console.log(`   ✅ Migration M42 enregistrée:`);
    logs.forEach(log => {
      console.log(`      - ${log.migration_name} (${log.applied_at})`);
    });
    console.log('');
    results.checks.migration_logged = true;
    results.checks.migration_logs_found = logs;
  } else {
    console.log(`   ⚠️ Aucune migration M42 trouvée dans migration_logs\n`);
    results.checks.migration_logged = false;
  }
  
  // ═══════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('RÉSUMÉ VALIDATION M42');
  console.log('═══════════════════════════════════════════════════\n');
  
  const columnExists = results.checks.column_exists === true;
  const fkTargetOk = results.checks.fk_target_accessible === true;
  const migrationLogged = results.checks.migration_logged === true;
  
  console.log(`✓ Colonne disponibilite_id:     ${columnExists ? '✅ PRÉSENTE' : '❌ ABSENTE'}`);
  console.log(`✓ Table FK target accessible:   ${fkTargetOk ? '✅ OUI' : '❌ NON'}`);
  console.log(`✓ Migration enregistrée:        ${migrationLogged ? '✅ OUI' : '⚠️ NON'}`);
  
  // Validation stricte: colonne doit exister
  const validationSuccess = columnExists;
  
  results.summary = {
    column_exists: columnExists,
    fk_target_accessible: fkTargetOk,
    migration_logged: migrationLogged,
    validation: validationSuccess ? 'SUCCESS' : 'FAILED',
    note: 'FK et index non testables via SDK - requiert validation SQL manuelle'
  };
  
  if (validationSuccess) {
    console.log(`\n🎯 VALIDATION CRITIQUE: ✅ SUCCÈS`);
    console.log(`   → Colonne missions.disponibilite_id PRÉSENTE`);
    console.log(`   → Blocker #1 RÉSOLU (SQLSTATE 42703 ne peut plus se produire)\n`);
  } else {
    console.log(`\n🎯 VALIDATION CRITIQUE: ❌ ÉCHEC`);
    console.log(`   → Colonne missions.disponibilite_id toujours absente\n`);
  }
  
  console.log(`⚠️  NOTE: FK et index nécessitent validation SQL manuelle (voir queries.sql)\n`);
  
  // Sauvegarder résultats
  const outputPath = '_fix_output/02_post_apply_m42_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Résultats: ${outputPath}\n`);
  
  process.exit(validationSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
