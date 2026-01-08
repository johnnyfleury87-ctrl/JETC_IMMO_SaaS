/**
 * APPLIQUER M54 - RPC ÉDITION/ENVOI FACTURES
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyM54() {
  console.log('🚀 APPLICATION M54 - RPC ÉDITION/ENVOI FACTURES\n');
  
  const sql = fs.readFileSync('supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql', 'utf8');
  
  console.log('SQL à exécuter:');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  
  console.log('\n⚠️  IMPORTANT: Copier le SQL ci-dessus et l\'exécuter dans Supabase SQL Editor');
  console.log('\n📍 URL: ' + supabaseUrl.replace('//', '//supabase.com/project/').replace('.supabase.co', '') + '/sql/new');
  
  console.log('\n✅ Une fois exécuté dans Supabase, relancer le test avec:');
  console.log('   node _TEST_RPC_EDITER_FACTURE.js');
}

applyM54().catch(console.error);
