const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditStructure() {
  console.log('🔍 AUDIT STRUCTURE TABLES\n');
  
  // 1. Colonnes table profiles
  console.log('1️⃣ COLONNES TABLE PROFILES:\n');
  const { data: profileSample } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'regie')
    .limit(1)
    .maybeSingle();
  
  if (profileSample) {
    console.log('Colonnes disponibles:', Object.keys(profileSample).join(', '));
    console.log('\nExemple régie:');
    console.log(JSON.stringify(profileSample, null, 2));
  } else {
    console.log('❌ Aucune régie trouvée');
  }
  
  // 2. Colonnes table regies_entreprises
  console.log('\n2️⃣ COLONNES TABLE REGIES_ENTREPRISES:\n');
  const { data: reSample } = await supabase
    .from('regies_entreprises')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (reSample) {
    console.log('Colonnes disponibles:', Object.keys(reSample).join(', '));
    console.log('\nExemple:');
    console.log(JSON.stringify(reSample, null, 2));
  }
  
  // 3. Colonnes table tickets
  console.log('\n3️⃣ COLONNES TABLE TICKETS:\n');
  const { data: ticketSample } = await supabase
    .from('tickets')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (ticketSample) {
    console.log('Colonnes disponibles:', Object.keys(ticketSample).join(', '));
  }
  
  // 4. Colonnes table locataires
  console.log('\n4️⃣ COLONNES TABLE LOCATAIRES:\n');
  const { data: locSample } = await supabase
    .from('locataires')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (locSample) {
    console.log('Colonnes disponibles:', Object.keys(locSample).join(', '));
  }
  
  // 5. Colonnes table logements
  console.log('\n5️⃣ COLONNES TABLE LOGEMENTS:\n');
  const { data: logSample } = await supabase
    .from('logements')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (logSample) {
    console.log('Colonnes disponibles:', Object.keys(logSample).join(', '));
  }
  
  // 6. Colonnes table immeubles
  console.log('\n6️⃣ COLONNES TABLE IMMEUBLES:\n');
  const { data: immSample } = await supabase
    .from('immeubles')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (immSample) {
    console.log('Colonnes disponibles:', Object.keys(immSample).join(', '));
  }
  
  console.log('\n' + '='.repeat(60));
}

auditStructure().catch(console.error);
