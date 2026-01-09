#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyserDoublonEntreprises() {
  console.log('\n🔍 ANALYSE DOUBLON ENTREPRISES\n');
  
  // 1. Toutes les entreprises Toutpourpout
  const { data: entreprises } = await supabase
    .from('entreprises')
    .select('*')
    .ilike('nom', '%toutpourpout%');
  
  console.log('🏢 ENTREPRISES "Toutpourpout":');
  entreprises.forEach(e => {
    console.log(`\n  ID: ${e.id}`);
    console.log(`  Nom: ${e.nom}`);
    console.log(`  Email: ${e.email}`);
    console.log(`  Créé le: ${e.created_at}`);
  });
  
  // 2. Profile toutpourtout
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'toutpourtout@test.app')
    .single();
  
  console.log('\n👤 PROFILE toutpourtout@test.app:');
  console.log(`  profiles.id: ${profile.id}`);
  console.log(`  profiles.entreprise_id: ${profile.entreprise_id}`);
  
  // 3. Factures pour chaque entreprise
  for (const e of entreprises) {
    const { count } = await supabase
      .from('factures')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', e.id);
    
    console.log(`\n💰 Factures pour entreprise ${e.id.substring(0, 8)}...: ${count || 0}`);
  }
  
  // 4. RECOMMANDATION
  console.log('\n═══════════════════════════════════════');
  console.log('✅ SOLUTION:');
  console.log('═══════════════════════════════════════');
  console.log('Corriger profiles.entreprise_id pour pointer vers la BONNE entreprise:');
  console.log(`\nUPDATE profiles`);
  console.log(`SET entreprise_id = '898b4b8b-e7aa-4bd4-9390-b489519c7f19'`);
  console.log(`WHERE email = 'toutpourtout@test.app';`);
  console.log('\nOu supprimer l\'entreprise en doublon 91126ecf... si elle n\'a pas de factures.\n');
}

analyserDoublonEntreprises().catch(console.error);
