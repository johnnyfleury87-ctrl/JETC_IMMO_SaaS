#!/usr/bin/env node
/**
 * ÉTAPE 2 — APPLICATION MIGRATION M42
 * Ajoute colonne missions.disponibilite_id via Supabase JS
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const log = [];

function logStep(message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    data
  };
  log.push(entry);
  console.log(`\n${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

async function checkColumnExists(tableName, columnName) {
  logStep(`🔍 Vérification colonne ${tableName}.${columnName}...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName, { head: true });
    
    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        logStep(`   ❌ Colonne ABSENTE: ${error.message}`);
        return { exists: false, error: error.message };
      }
      logStep(`   ⚠️ Erreur: ${error.message}`);
      return { exists: 'unknown', error: error.message };
    }
    
    logStep(`   ✅ Colonne EXISTE`);
    return { exists: true };
  } catch (e) {
    logStep(`   ❌ Exception: ${e.message}`);
    return { exists: 'unknown', error: e.message };
  }
}

async function runStep2() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ÉTAPE 2 — APPLICATION MIGRATION M42');
  console.log('═══════════════════════════════════════════════');
  
  const results = {
    step: 'ÉTAPE 2 - Application M42',
    timestamp_start: new Date().toISOString(),
    checks: {}
  };
  
  try {
    // ========================================
    // PHASE 1: VÉRIFICATIONS AVANT
    // ========================================
    logStep('📋 PHASE 1: VÉRIFICATIONS AVANT APPLICATION');
    
    // Check 1: Colonne disponibilite_id absente
    results.checks.before_disponibilite_id = await checkColumnExists('missions', 'disponibilite_id');
    
    if (results.checks.before_disponibilite_id.exists === true) {
      logStep('⚠️ ATTENTION: Colonne disponibilite_id DÉJÀ PRÉSENTE!');
      logStep('Migration M42 probablement déjà appliquée.');
      
      results.status = 'ALREADY_APPLIED';
      results.message = 'Migration M42 déjà appliquée (colonne existe)';
      
      fs.writeFileSync(
        '_fix_output/02_apply_m42_results.json',
        JSON.stringify({ results, log }, null, 2)
      );
      
      return results;
    }
    
    // Check 2: Table tickets_disponibilites existe
    logStep('🔍 Vérification table tickets_disponibilites...');
    const { error: tableError } = await supabase
      .from('tickets_disponibilites')
      .select('id', { head: true });
    
    if (tableError) {
      logStep(`   ❌ Table tickets_disponibilites inaccessible: ${tableError.message}`);
      results.checks.tickets_disponibilites_exists = false;
      throw new Error('Table tickets_disponibilites requise pour FK absente/inaccessible');
    }
    
    logStep('   ✅ Table tickets_disponibilites accessible');
    results.checks.tickets_disponibilites_exists = true;
    
    // ========================================
    // PHASE 2: APPLICATION MIGRATION
    // ========================================
    logStep('\n📋 PHASE 2: APPLICATION MIGRATION M42');
    logStep('⚠️ LIMITATION: Supabase JS SDK ne peut pas exécuter DDL (ALTER TABLE)');
    logStep('ℹ️ MÉTHODE REQUISE: Application manuelle via Supabase Studio SQL Editor');
    
    // Lire migration M42
    const migrationSQL = fs.readFileSync(
      'supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql',
      'utf8'
    );
    
    logStep('\n📄 CONTENU MIGRATION M42:', { 
      file: '20260104001800_m42_add_disponibilite_id_missions.sql',
      lines: migrationSQL.split('\n').length,
      preview: migrationSQL.substring(0, 300) + '...'
    });
    
    // Instructions application manuelle
    const instructions = `
╔═══════════════════════════════════════════════════════════════╗
║  INSTRUCTIONS APPLICATION MANUELLE MIGRATION M42               ║
╚═══════════════════════════════════════════════════════════════╝

IMPOSSIBLE D'APPLIQUER VIA SUPABASE JS SDK (limitation DDL)

MÉTHODE 1 (RECOMMANDÉE): Supabase Studio SQL Editor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Ouvrir: ${supabaseUrl}/project/_/sql
2. Copier contenu: supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql
3. Exécuter (RUN)
4. Vérifier logs: "✅ M42: Colonne disponibilite_id ajoutée à missions"

MÉTHODE 2 (FALLBACK): psql CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
psql "$DATABASE_URL" -f supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql

MÉTHODE 3 (ALTERNATIVE): Supabase CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
supabase link --project-ref bwzyajsrmfhrxdmfpyqy
supabase db push

APRÈS APPLICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Relancer ce script pour vérifier application:
node _fix_step2_apply_m42.js
`;
    
    console.log(instructions);
    
    results.status = 'MANUAL_APPLICATION_REQUIRED';
    results.instructions = instructions;
    results.migration_file = 'supabase/migrations/20260104001800_m42_add_disponibilite_id_missions.sql';
    
    // Sauvegarder migration SQL dans output pour facilité
    fs.writeFileSync(
      '_fix_output/02_migration_m42_to_apply.sql',
      migrationSQL
    );
    
    logStep('\n💾 Migration SQL copiée dans: _fix_output/02_migration_m42_to_apply.sql');
    
    // ========================================
    // PHASE 3: VÉRIFICATION APRÈS (si appliquée)
    // ========================================
    logStep('\n📋 PHASE 3: VÉRIFICATION POST-APPLICATION (test)');
    
    const postCheck = await checkColumnExists('missions', 'disponibilite_id');
    results.checks.after_disponibilite_id = postCheck;
    
    if (postCheck.exists === true) {
      logStep('✅ MIGRATION M42 APPLIQUÉE AVEC SUCCÈS!');
      results.status = 'SUCCESS';
      results.message = 'Migration M42 appliquée, colonne disponibilite_id présente';
    } else {
      logStep('⏳ Migration M42 EN ATTENTE D\'APPLICATION MANUELLE');
      results.status = 'PENDING_MANUAL';
      results.message = 'Migration prête, application manuelle requise';
    }
    
    results.timestamp_end = new Date().toISOString();
    
    // Sauvegarder résultats
    fs.writeFileSync(
      '_fix_output/02_apply_m42_results.json',
      JSON.stringify({ results, log }, null, 2)
    );
    
    console.log('\n✅ ÉTAPE 2 PHASE 1-2 TERMINÉES');
    console.log('📄 Résultats: _fix_output/02_apply_m42_results.json');
    console.log('📄 Migration SQL: _fix_output/02_migration_m42_to_apply.sql');
    
    if (results.status === 'PENDING_MANUAL') {
      console.log('\n⚠️ ACTION REQUISE: Appliquer migration manuellement (voir instructions ci-dessus)');
      console.log('Puis relancer: node _fix_step2_apply_m42.js (pour vérification)');
    }
    
    return results;
    
  } catch (error) {
    logStep(`❌ ERREUR ÉTAPE 2: ${error.message}`, { stack: error.stack });
    results.status = 'ERROR';
    results.error = error.message;
    results.timestamp_end = new Date().toISOString();
    
    fs.writeFileSync(
      '_fix_output/02_apply_m42_results.json',
      JSON.stringify({ results, log }, null, 2)
    );
    
    throw error;
  }
}

runStep2().catch(err => {
  console.error('\n❌ Échec ÉTAPE 2:', err);
  process.exit(1);
});
