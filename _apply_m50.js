/**
 * APPLICATION MIGRATION M50 - WORKFLOW FACTURATION
 * =================================================
 * Applique directement via l'API Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySqlFile(filePath) {
  console.log(`📥 Lecture du fichier: ${filePath}`);
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Diviser en statements individuels
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`📝 ${statements.length} statements à exécuter\n`);
  
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    // Ignorer les commentaires multi-lignes
    if (stmt.includes('/*') || stmt.startsWith('COMMENT ON')) {
      continue;
    }
    
    try {
      console.log(`[${i + 1}/${statements.length}] Exécution...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        console.error(`❌ Erreur: ${error.message}`);
        errors++;
        
        // Ne pas arrêter sur certaines erreurs (colonnes déjà existantes, etc.)
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('   ⚠️  Erreur ignorée (élément déjà existant ou supprimé)');
        }
      } else {
        console.log(`✅ OK`);
        success++;
      }
    } catch (err) {
      console.error(`❌ Exception: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Réussis: ${success}`);
  console.log(`❌ Erreurs: ${errors}`);
  console.log(`${'='.repeat(60)}`);
  
  return errors === 0;
}

async function main() {
  console.log('🚀 APPLICATION MIGRATION M50');
  console.log('Workflow facturation complet\n');
  
  const migrationFile = 'supabase/migrations/20260107120000_m50_workflow_facturation_complet.sql';
  
  try {
    // Test si RPC exec_sql existe
    const { error: testError } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
    
    if (testError && testError.message.includes('Could not find')) {
      console.log('❌ RPC exec_sql non disponible');
      console.log('📌 Solution alternative : Appliquer manuellement via Supabase Dashboard');
      console.log(`   1. Ouvrir ${supabaseUrl}/project/_/sql/new`);
      console.log(`   2. Copier le contenu de ${migrationFile}`);
      console.log(`   3. Exécuter`);
      process.exit(1);
    }
    
    const success = await applySqlFile(migrationFile);
    
    if (success) {
      console.log('\n✅ Migration M50 appliquée avec succès!');
    } else {
      console.log('\n⚠️  Migration M50 appliquée avec des erreurs (vérifier logs)');
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    process.exit(1);
  }
}

main();
