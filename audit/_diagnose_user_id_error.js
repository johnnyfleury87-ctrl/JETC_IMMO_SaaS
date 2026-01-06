// Script pour diagnostiquer l'erreur "user_id" does not exist
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosePolicies() {
  console.log('🔍 DIAGNOSTIC POLICIES RLS\n');
  
  // Tenter de lire policies via SQL direct
  const query = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual as using_expression,
      with_check as with_check_expression
    FROM pg_policies
    WHERE tablename IN ('missions', 'techniciens')
    ORDER BY tablename, policyname;
  `;
  
  try {
    // Utiliser une requête SQL brute
    const { data, error } = await supabase.rpc('exec_sql', { query });
    
    if (error && error.message.includes('Could not find')) {
      console.log('⚠️  RPC exec_sql non disponible');
      console.log('📋 Tentative requête alternative...\n');
      
      // Alternative : essayer via query direct (si activé)
      const { data: altData, error: altError } = await supabase
        .from('pg_policies')
        .select('*')
        .in('tablename', ['missions', 'techniciens']);
      
      if (altError) {
        console.log('❌ Impossible de lire policies directement');
        console.log('   Erreur:', altError.message);
        console.log('\n💡 SOLUTION: Vérifier manuellement via Dashboard Supabase');
        console.log('   → Dashboard > Authentication > Policies');
        console.log('   → Chercher policies avec "user_id"');
      } else {
        console.log('✅ Policies trouvées:', altData);
      }
    } else if (error) {
      console.log('❌ Erreur:', error.message);
    } else {
      console.log('✅ Policies:', data);
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
  
  // Test direct RPC assign_technicien_to_mission
  console.log('\n🧪 TEST RPC assign_technicien_to_mission');
  console.log('-'.repeat(60));
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: '2d84c11c-6415-4f49-ba33-8b53ae1ee22d',
    p_technicien_id: 'b76aefc5-cef9-4f60-86af-27ea38dbaa09'
  });
  
  if (rpcError) {
    console.log('❌ Erreur RPC:', rpcError.message);
    console.log('   Code:', rpcError.code);
    console.log('   Details:', rpcError.details);
    console.log('   Hint:', rpcError.hint);
    
    if (rpcError.message.includes('user_id')) {
      console.log('\n🔴 CAUSE: Policy RLS fait référence à colonne "user_id" inexistante');
      console.log('   → Doit utiliser auth.uid() ou profiles.id à la place');
    }
  } else {
    console.log('✅ RPC réussie:', rpcData);
  }
  
  // Chercher dans migrations les policies qui utilisent user_id
  console.log('\n📂 Chercher "user_id" dans migrations SQL...');
  console.log('   → grep -r "user_id" supabase/migrations/*.sql');
}

diagnosePolicies().catch(console.error);
