#!/usr/bin/env node
/**
 * DEBUG - Vérifier la table immeubles
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('DEBUG - Table immeubles');
  console.log('='.repeat(60));
  
  // Test 1 : Count
  const { data: d1, error: e1, count } = await supabase
    .from('immeubles')
    .select('*', { count: 'exact' });
  
  console.log('Count:', count);
  console.log('Error:', e1);
  console.log('Data:', JSON.stringify(d1, null, 2));
  console.log();
  
  // Test 2 : RLS bypass ?
  console.log('Test avec RLS explicite...');
  const { data: d2, error: e2 } = await supabase
    .rpc('exec_sql', { query: 'SELECT * FROM immeubles LIMIT 10' })
    .catch(() => null);
  
  console.log('RPC error:', e2);
  console.log('RPC data:', d2);
}

debug().catch(console.error);
