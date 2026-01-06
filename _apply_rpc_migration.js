/**
 * Applique la migration RPC get_table_structure directement sur Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Application migration: RPC get_table_structure\n');
  
  const sql = fs.readFileSync('./supabase/migrations/20260108000000_rpc_get_table_structure.sql', 'utf-8');
  
  console.log('SQL à exécuter:');
  console.log('─'.repeat(50));
  console.log(sql);
  console.log('─'.repeat(50));
  
  // Exécuter via RPC sql ou directement
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error('\n❌ ERREUR lors de l\'application:', error.message);
    console.log('\nTentative avec approche alternative...');
    
    // Alternative : utiliser le client postgrest directement
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      console.error('❌ Échec aussi avec fetch:', await response.text());
      console.log('\n⚠️ SOLUTION MANUELLE REQUISE:');
      console.log('1. Aller sur https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/editor');
      console.log('2. Copier-coller le SQL ci-dessus dans l\'éditeur SQL');
      console.log('3. Exécuter');
      process.exit(1);
    }
    
    console.log('✅ Migration appliquée avec succès (fetch)');
    return;
  }
  
  console.log('\n✅ Migration appliquée avec succès');
  console.log('   RPC get_table_structure est maintenant disponible');
}

applyMigration().catch(err => {
  console.error('ERREUR:', err);
  console.log('\n⚠️ SOLUTION MANUELLE:');
  console.log('Copier le contenu de supabase/migrations/20260108000000_rpc_get_table_structure.sql');
  console.log('et l\'exécuter manuellement dans le SQL Editor de Supabase');
  process.exit(1);
});
