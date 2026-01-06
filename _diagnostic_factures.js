/**
 * DIAGNOSTIC APPROFONDI - Table factures
 * Vérifier si problème RLS ou structure réelle
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticFactures() {
  console.log('🔍 DIAGNOSTIC APPROFONDI - Table factures\n');
  
  // Test 1 : Lecture directe
  console.log('Test 1 : Lecture avec service_role (bypass RLS)...');
  const { data: data1, error: error1 } = await supabase
    .from('factures')
    .select('*')
    .limit(5);
  
  console.log('Data:', data1);
  console.log('Error:', error1);
  console.log('Colonnes détectées:', data1 && data1.length > 0 ? Object.keys(data1[0]) : 'aucune donnée');
  
  // Test 2 : Count
  console.log('\nTest 2 : Count...');
  const { count, error: error2 } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true });
  
  console.log('Count:', count);
  console.log('Error:', error2);
  
  // Test 3 : Information schema (si accessible)
  console.log('\nTest 3 : Vérification schéma via RPC...');
  
  // Créer RPC temporaire pour vérifier colonnes
  const { data: columns, error: error3 } = await supabase.rpc('get_table_columns', { 
    table_name: 'factures' 
  });
  
  console.log('Colonnes (via RPC):', columns);
  console.log('Error:', error3);
}

diagnosticFactures().catch(err => console.error('ERREUR:', err));
