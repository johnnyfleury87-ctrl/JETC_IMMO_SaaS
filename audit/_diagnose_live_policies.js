// Diagnostic des policies RLS en production
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function diagnoseLivePolicies() {
  console.log('🔍 DIAGNOSTIC POLICIES RLS EN PRODUCTION');
  console.log('='.repeat(70));
  console.log('URL:', supabaseUrl);
  console.log('='.repeat(70));
  
  // Test 1: Lire les policies via query directe
  console.log('\n📋 POLICIES EXISTANTES\n');
  
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, cmd, qual, with_check')
    .in('tablename', ['missions', 'techniciens'])
    .order('tablename')
    .order('policyname');
  
  if (policiesError) {
    console.log('⚠️  Impossible de lire pg_policies directement');
    console.log('   Erreur:', policiesError.message);
    console.log('\n💡 Tentative via RPC SQL...\n');
    
    // Essayer d'obtenir les policies via une requête SQL brute
    // Utiliser postgres connection si disponible
    console.log('Exécution impossible via API. Besoin accès SQL direct.');
  } else {
    console.log(`✅ ${policies.length} policies trouvées\n`);
    
    for (const p of policies) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📌 ${p.tablename}.${p.policyname} (${p.cmd})`);
      console.log(`   Schema: ${p.schemaname}`);
      
      const using_clause = p.qual || 'NULL';
      const with_check = p.with_check || 'NULL';
      
      console.log(`   USING: ${using_clause}`);
      if (with_check !== 'NULL') {
        console.log(`   WITH CHECK: ${with_check}`);
      }
      
      // Détecter user_id
      if (using_clause.includes('user_id') || with_check.includes('user_id')) {
        console.log(`   ⚠️  ⚠️  ⚠️  CONTIENT "user_id" ⚠️  ⚠️  ⚠️`);
      }
    }
  }
  
  // Test 2: Essayer d'assigner un technicien pour voir l'erreur exacte
  console.log('\n\n🧪 TEST ASSIGNATION TECHNICIEN\n');
  console.log('━'.repeat(70));
  
  const { data: testData, error: testError } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: '2d84c11c-6415-4f49-ba33-8b53ae1ee22d',
    p_technicien_id: 'b76aefc5-cef9-4f60-86af-27ea38dbaa09'
  });
  
  if (testError) {
    console.log('❌ ERREUR:', testError.message);
    console.log('   Code:', testError.code);
    console.log('   Details:', testError.details);
    console.log('   Hint:', testError.hint);
  } else {
    console.log('✅ RPC assign_technicien_to_mission OK');
    console.log('   Result:', testData);
  }
}

diagnoseLivePolicies().catch(console.error);
