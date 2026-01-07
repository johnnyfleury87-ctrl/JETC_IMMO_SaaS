#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStructure() {
  console.log('STRUCTURE TABLE MISSIONS');
  console.log('='.repeat(60));
  
  // Méthode 1 : Tenter de récupérer toutes les colonnes
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Erreur:', error.message);
  } else if (data && data[0]) {
    console.log('Colonnes détectées:');
    Object.keys(data[0]).sort().forEach(col => {
      console.log(`  - ${col}`);
    });
  } else {
    console.log('Aucune mission dans la base');
  }
}

checkStructure().catch(console.error);
