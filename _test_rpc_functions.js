/**
 * ═════════════════════════════════════════════════════════════
 * TEST DIRECT RPC - QUELLE FONCTION EXISTE EN PROD?
 * ═════════════════════════════════════════════════════════════
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 TEST: Quelle fonction RPC existe en production?\n');

async function main() {
  const tests = [
    { name: 'update_mission_statut', params: { p_mission_id: '00000000-0000-0000-0000-000000000000', p_nouveau_statut: 'en_cours', p_role: 'technicien' } },
    { name: 'start_mission', params: { p_mission_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'complete_mission', params: { p_mission_id: '00000000-0000-0000-0000-000000000000' } },
  ];

  for (const test of tests) {
    console.log(`📌 Test fonction: ${test.name}`);
    
    const { data, error } = await supabase.rpc(test.name, test.params);
    
    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.log(`   ❌ N'EXISTE PAS en production`);
      } else {
        console.log(`   ✅ EXISTE (erreur attendue: ${error.message.substring(0, 60)}...)`);
      }
    } else {
      console.log(`   ✅ EXISTE (résultat:`, data, ')');
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📊 CONCLUSION:\n');
  console.log('Si start_mission / complete_mission existent → Utiliser celles-ci');
  console.log('Si update_mission_statut existe → Fonction centralisée OK');
  console.log('Si aucune → Déployer les fonctions manquantes\n');
}

main().catch(console.error);
