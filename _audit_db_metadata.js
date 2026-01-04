#!/usr/bin/env node
/**
 * AUDIT FINAL SUPABASE — INTERROGATION MÉTADONNÉES COMPLÈTE
 * Utilise PostgREST API pour récupérer les métadonnées système
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const results = require('./_audit_db_results.json'); // Charger résultats précédents

// Requêtes SQL pour métadonnées
const queries = {
  columns_mode_diffusion: `
    SELECT 
      table_name, 
      column_name, 
      data_type, 
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND column_name = 'mode_diffusion'
    ORDER BY table_name;
  `,
  
  all_columns_tickets: `
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'tickets'
    ORDER BY ordinal_position;
  `,
  
  check_constraints: `
    SELECT 
      tc.table_name,
      tc.constraint_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc 
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
    ORDER BY tc.table_name, tc.constraint_name;
  `,
  
  enum_types: `
    SELECT 
      t.typname as enum_name,
      string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as values
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    GROUP BY t.typname
    ORDER BY t.typname;
  `,
  
  rls_status: `
    SELECT 
      schemaname, 
      tablename,
      CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `,
  
  policies_summary: `
    SELECT 
      tablename,
      COUNT(*) as policy_count,
      string_agg(DISTINCT 
        CASE cmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END, 
        ',' ORDER BY CASE cmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END
      ) as commands
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
    ORDER BY tablename;
  `,
  
  functions_list: `
    SELECT 
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
      END as volatility,
      p.prosecdef as security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    ORDER BY p.proname;
  `,
  
  triggers_list: `
    SELECT 
      event_object_table as table_name,
      trigger_name,
      event_manipulation as event,
      action_timing as timing,
      action_orientation as orientation
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `
};

// Fonction pour exécuter requêtes via RPC si disponible
async function executeMetadataQuery(name, sql) {
  console.log(`\n🔍 ${name}...`);
  
  try {
    // Tentative via RPC custom si disponible
    const { data, error } = await supabase.rpc('execute_sql_readonly', { query_text: sql });
    
    if (!error && data) {
      console.log(`  ✅ ${Array.isArray(data) ? data.length : 'OK'}`);
      return data;
    }
    
    console.log(`  ⚠️ RPC non disponible: ${error?.message || 'unknown'}`);
    return null;
    
  } catch (e) {
    console.log(`  ⚠️ Erreur: ${e.message}`);
    return null;
  }
}

async function analyzeMetadata() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ANALYSE MÉTADONNÉES SYSTÈME');
  console.log('═══════════════════════════════════════════════');
  
  const metadata = {};
  
  for (const [key, sql] of Object.entries(queries)) {
    metadata[key] = await executeMetadataQuery(key, sql);
  }
  
  // Analyse spécifique tickets.statut (enum)
  console.log('\n🎯 Analyse enum ticket_statut...');
  const { data: enumData, error: enumError } = await supabase
    .from('tickets')
    .select('statut')
    .limit(0);
  
  if (enumError) {
    console.log(`  ⚠️ Détection enum: ${enumError.message}`);
    metadata.ticket_statut_enum = { error: enumError.message };
  }
  
  results.metadata = metadata;
  
  // Sauvegarder
  fs.writeFileSync(
    '_audit_db_results.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );
  
  console.log('\n✅ Métadonnées sauvegardées');
}

async function analyzeFromCSVFiles() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  CHARGEMENT AUDITS CSV EXISTANTS');
  console.log('═══════════════════════════════════════════════');
  
  const csvPath = './supabase/Audit_supabase/';
  const csvFiles = fs.readdirSync(csvPath).filter(f => f.endsWith('.csv'));
  
  console.log(`\n📁 ${csvFiles.length} fichiers CSV trouvés`);
  
  const csvData = {};
  for (const file of csvFiles) {
    const content = fs.readFileSync(csvPath + file, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    csvData[file] = {
      rows: lines.length - 1, // -1 pour header
      preview: lines.slice(0, 3).join('\n')
    };
    console.log(`  ✅ ${file}: ${lines.length - 1} lignes`);
  }
  
  results.csv_audits = csvData;
  
  fs.writeFileSync(
    '_audit_db_results.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );
}

async function compareMigrationsFiles() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  COMPARAISON MIGRATIONS FILES VS DB');
  console.log('═══════════════════════════════════════════════');
  
  // Charger inventory précédent
  const inventoryCSV = fs.readFileSync('_audit_output/10_migrations_inventory.csv', 'utf8');
  const migrationFiles = inventoryCSV.split('\n')
    .slice(1) // Skip header
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split(',');
      return {
        filename: parts[0],
        m_number: parts[1] || 'NONE',
        type: parts[2],
        dependencies: parts[3]
      };
    });
  
  console.log(`\n📂 ${migrationFiles.length} fichiers migrations`);
  
  const appliedNames = results.migration_logs.map(m => m.migration_name);
  console.log(`✅ ${appliedNames.length} migrations appliquées en DB`);
  
  const comparison = migrationFiles.map(file => {
    const applied = appliedNames.includes(file.filename.replace('.sql', ''));
    return {
      ...file,
      applied_in_db: applied,
      status: applied ? 'VALIDATED' : 'UNKNOWN'
    };
  });
  
  const validated = comparison.filter(m => m.status === 'VALIDATED').length;
  const unknown = comparison.filter(m => m.status === 'UNKNOWN').length;
  
  console.log(`\n📊 VALIDATED: ${validated}`);
  console.log(`📊 UNKNOWN: ${unknown}`);
  
  results.migrations_comparison = {
    total_files: migrationFiles.length,
    validated: validated,
    unknown: unknown,
    details: comparison
  };
  
  fs.writeFileSync(
    '_audit_db_results.json',
    JSON.stringify(results, null, 2),
    'utf8'
  );
}

async function runCompleteAudit() {
  try {
    await analyzeMetadata();
    await analyzeFromCSVFiles();
    await compareMigrationsFiles();
    
    console.log('\n✅ AUDIT COMPLET TERMINÉ');
    console.log('📄 Résultats dans _audit_db_results.json');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    throw error;
  }
}

runCompleteAudit().catch(err => {
  console.error('Échec:', err);
  process.exit(1);
});
