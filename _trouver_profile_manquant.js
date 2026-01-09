#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function trouverProfileManquant() {
  const entrepriseId = '898b4b8b-e7aa-4bd4-9390-b489519c7f19';
  
  console.log('\n🔍 RECHERCHE DU PROFILE MANQUANT\n');
  
  // 1. Nom de l'entreprise
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('*')
    .eq('id', entrepriseId)
    .single();
  
  console.log('🏢 Entreprise:', entreprise.nom);
  console.log('   Email:', entreprise.email);
  
  // 2. Chercher profiles qui devraient pointer vers cette entreprise
  const { data: profilesSimilaires } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'entreprise')
    .ilike('email', `%${entreprise.email.split('@')[0]}%`);
  
  console.log('\n📋 PROFILES SIMILAIRES (par email):');
  if (profilesSimilaires && profilesSimilaires.length > 0) {
    profilesSimilaires.forEach(p => {
      console.log(`  - ${p.email}: entreprise_id = ${p.entreprise_id || 'NULL'}`);
    });
  } else {
    console.log('  Aucun');
  }
  
  // 3. Chercher profile avec id = entreprise_id (ancienne logique)
  const { data: profileId } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', entrepriseId)
    .maybeSingle();
  
  console.log('\n🎯 PROFILE avec id = ' + entrepriseId.substring(0, 8) + '...:');
  if (profileId) {
    console.log('  ✅ TROUVÉ!');
    console.log('  Email:', profileId.email);
    console.log('  Role:', profileId.role);
    console.log('  entreprise_id:', profileId.entreprise_id || 'NULL');
    
    if (profileId.role === 'entreprise' && !profileId.entreprise_id) {
      console.log('\n✅ SOLUTION TROUVÉE:');
      console.log('   Ce profile doit avoir entreprise_id = profiles.id');
      console.log('\n📝 COMMANDE SQL:');
      console.log(`   UPDATE profiles SET entreprise_id = '${profileId.id}' WHERE id = '${profileId.id}';`);
    } else if (profileId.entreprise_id && profileId.entreprise_id !== entrepriseId) {
      console.log('\n⚠️ INCOHÉRENCE:');
      console.log(`   profiles.entreprise_id = ${profileId.entreprise_id}`);
      console.log(`   factures.entreprise_id = ${entrepriseId}`);
      console.log('   → Ces UUIDs doivent correspondre!');
    }
  } else {
    console.log('  ❌ Aucun profile avec cet ID');
    console.log('\n⚠️ ARCHITECTURE CASSÉE:');
    console.log('   L\'entreprise existe mais n\'a pas de compte user associé');
    console.log('   → Créer un profile OU corriger factures.entreprise_id');
  }
  
  console.log('\n');
}

trouverProfileManquant().catch(console.error);
