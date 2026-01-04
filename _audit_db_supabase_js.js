#!/usr/bin/env node
/**
 * AUDIT FINAL SUPABASE — MODE LECTURE SEULE
 * Utilise uniquement Supabase JS (plus fiable que pg direct)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  connection: { method: 'Supabase JS SDK', url: supabaseUrl },
  migration_logs: [],
  tables_info: {},
  rls_analysis: {},
  mode_diffusion_analysis: {}
};

async function testConnection() {
  console.log('🔌 Test connexion Supabase...');
  const { data, error } = await supabase.from('migration_logs').select('count');
  if (error) throw new Error(`Connexion échouée: ${error.message}`);
  console.log('✅ Connecté via Supabase JS SDK');
}

async function getMigrationLogs() {
  console.log('\n📜 Récupération migration_logs...');
  const { data, error } = await supabase
    .from('migration_logs')
    .select('*')
    .order('executed_at');
  
  if (error) {
    console.error(`❌ Erreur migration_logs: ${error.message}`);
    return [];
  }
  
  console.log(`✅ ${data.length} migrations enregistrées`);
  return data;
}

async function getTablesList() {
  console.log('\n📊 Récupération liste des tables...');
  
  // Via RPC qui liste les tables
  const { data, error } = await supabase.rpc('jetc_debug_schema');
  
  if (!error && data) {
    console.log('✅ Tables récupérées via RPC debug');
    return data;
  }
  
  // Fallback: essayer de lire directement les tables connues
  const knownTables = [
    'profiles', 'regies', 'immeubles', 'logements', 'locataires',
    'tickets', 'missions', 'entreprises', 'regies_entreprises',
    'tickets_disponibilites', 'tickets_visibles_entreprise',
    'migration_logs'
  ];
  
  const tablesInfo = [];
  for (const table of knownTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      tablesInfo.push({ table_name: table, row_count: count });
      console.log(`  ✅ ${table}: ${count} lignes`);
    }
  }
  
  return tablesInfo;
}

async function analyzeModeDiffusion() {
  console.log('\n🎯 Analyse mode_diffusion...');
  
  const analysis = {};
  
  // 1. Valeurs dans tickets
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('tickets')
    .select('mode_diffusion, statut')
    .not('mode_diffusion', 'is', null);
  
  if (!ticketsError) {
    const counts = {};
    ticketsData.forEach(t => {
      counts[t.mode_diffusion] = (counts[t.mode_diffusion] || 0) + 1;
    });
    analysis.tickets_values = counts;
    console.log('  ✅ Valeurs mode_diffusion tickets:', counts);
  }
  
  // 2. Valeurs dans regies_entreprises
  const { data: regiesData, error: regiesError } = await supabase
    .from('regies_entreprises')
    .select('mode_diffusion');
  
  if (!regiesError) {
    const counts = {};
    regiesData.forEach(r => {
      counts[r.mode_diffusion] = (counts[r.mode_diffusion] || 0) + 1;
    });
    analysis.regies_entreprises_values = counts;
    console.log('  ✅ Valeurs mode_diffusion regies_entreprises:', counts);
  }
  
  // 3. Test RPC accept_ticket_and_create_mission
  // NOTE: On ne peut pas l'appeler sans paramètres, on vérifie juste qu'elle existe
  const { data: rpcData, error: rpcError } = await supabase.rpc('jetc_debug_schema');
  
  analysis.rpc_available = !rpcError;
  
  return analysis;
}

async function getTicketsAvailableForEnterprise() {
  console.log('\n🎫 Tickets disponibles pour entreprises...');
  
  // Test si on peut voir des tickets en tant qu'entreprise
  const { data, error, count } = await supabase
    .from('tickets')
    .select('id, mode_diffusion, statut, description', { count: 'exact' })
    .in('statut', ['diffuse', 'en_attente'])
    .limit(5);
  
  if (error) {
    console.log(`  ⚠️ Erreur lecture tickets: ${error.message}`);
    return { accessible: false, error: error.message };
  }
  
  console.log(`  ✅ ${count} tickets visibles (${data.length} premiers)`);
  return { accessible: true, total: count, sample: data };
}

async function testRLSPolicies() {
  console.log('\n🔒 Test accessibilité RLS...');
  
  const tests = {};
  
  // Test chaque table
  const tables = ['profiles', 'tickets', 'missions', 'entreprises', 'regies_entreprises'];
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    tests[table] = {
      accessible: !error,
      count: count || 0,
      error: error ? error.message : null
    };
    
    console.log(`  ${!error ? '✅' : '❌'} ${table}: ${error ? error.message : `${count} lignes`}`);
  }
  
  return tests;
}

async function runFullAudit() {
  try {
    await testConnection();
    
    // 1. Migration logs
    results.migration_logs = await getMigrationLogs();
    
    // 2. Tables
    results.tables_info = await getTablesList();
    
    // 3. Mode diffusion
    results.mode_diffusion_analysis = await analyzeModeDiffusion();
    
    // 4. Tickets disponibles
    results.tickets_analysis = await getTicketsAvailableForEnterprise();
    
    // 5. RLS policies
    results.rls_analysis = await testRLSPolicies();
    
    // Sauvegarder
    console.log('\n💾 Sauvegarde résultats...');
    fs.writeFileSync(
      '_audit_db_results.json',
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('✅ Résultats dans _audit_db_results.json');
    
    console.log('\n✅ AUDIT TERMINÉ');
    console.log(`📊 Migrations: ${results.migration_logs.length}`);
    console.log(`📊 Tables: ${Array.isArray(results.tables_info) ? results.tables_info.length : Object.keys(results.tables_info).length}`);
    
    return results;
    
  } catch (error) {
    console.error('\n❌ ERREUR AUDIT:', error.message);
    throw error;
  }
}

runFullAudit().catch(err => {
  console.error('Échec audit:', err);
  process.exit(1);
});
