const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findProfile() {
  const entrepriseId = '898b4b8b-e7aa-4bd4-9390-b489519c7f19';
  
  console.log('🔍 RECHERCHE PROFILE CORRECT\n');
  console.log(`Entreprise ID: ${entrepriseId}\n`);
  
  // Chercher profile avec entreprise_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .maybeSingle();
  
  if (profile) {
    console.log('✅ PROFILE TROUVÉ:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   entreprise_id: ${profile.entreprise_id}`);
  } else {
    console.log('❌ AUCUN PROFILE avec entreprise_id = ' + entrepriseId);
    console.log('\n⚠️ PROBLÈME: profiles.entreprise_id doit pointer vers entreprises.id');
    console.log('   Vérifier si profiles.entreprise_id est bien rempli');
  }
}

findProfile().catch(console.error);
