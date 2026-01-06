// Vérifier structure réelle en production
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStructure() {
  console.log('🔍 VÉRIFICATION STRUCTURE DB PRODUCTION\n');
  
  // 1. Vérifier enum user_role
  console.log('1️⃣  ENUM user_role');
  console.log('-'.repeat(60));
  const { data: enumData, error: enumError } = await supabase.rpc('exec_raw_sql', {
    sql: "SELECT unnest(enum_range(NULL::user_role))::text as role_value;"
  });
  
  if (enumError) {
    console.log('⚠️  Impossible de lire enum via RPC');
    console.log('   Valeurs attendues selon schema: locataire, regie, entreprise, technicien, proprietaire, admin_jtec');
  } else {
    console.log('✅ Valeurs enum user_role:', enumData);
  }
  
  // 2. Vérifier structure table profiles
  console.log('\n2️⃣  TABLE profiles');
  console.log('-'.repeat(60));
  const { data: profilesTest, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .limit(3);
  
  if (profilesError) {
    console.log('❌ Erreur lecture profiles:', profilesError.message);
  } else {
    console.log('✅ Structure profiles accessible');
    console.log('   Colonnes: id, email, role');
    console.log('   Exemples roles:', profilesTest.map(p => p.role));
  }
  
  // 3. Vérifier table regies
  console.log('\n3️⃣  TABLE regies (colonne actif?)');
  console.log('-'.repeat(60));
  const { data: regiesTest, error: regiesError } = await supabase
    .from('regies')
    .select('*')
    .limit(1);
  
  if (regiesError) {
    console.log('❌ Erreur lecture regies:', regiesError.message);
  } else {
    console.log('✅ Colonnes regies:', Object.keys(regiesTest[0] || {}));
    if (regiesTest[0]?.actif !== undefined) {
      console.log('   ✅ Colonne "actif" existe');
    } else {
      console.log('   ❌ Colonne "actif" N\'EXISTE PAS');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log('- Enum user_role: locataire, regie, entreprise, technicien, proprietaire, admin_jtec');
  console.log('- Table profiles: colonne "role" type user_role');
  console.log('- Table regies: colonne "actif" à vérifier');
}

verifyStructure().catch(console.error);
