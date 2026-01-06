// Chercher PARTOUT où user_id pourrait être utilisé
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function findAllUserIdSources() {
  console.log('🔍 RECHERCHE EXHAUSTIVE DE "user_id"\n');
  console.log('='.repeat(70));
  
  // 1. Vérifier le code de la RPC assign_technicien_to_mission
  console.log('\n1️⃣  CODE DE LA RPC assign_technicien_to_mission\n');
  
  const { data: rpcCode, error: rpcError } = await supabase
    .from('pg_proc')
    .select('*')
    .ilike('proname', '%assign_technicien%');
  
  if (rpcError) {
    console.log('⚠️  Impossible de lire pg_proc:', rpcError.message);
  }
  
  // 2. Lister TOUTES les policies de TOUTES les tables
  console.log('\n2️⃣  POLICIES DE TOUTES LES TABLES (pas seulement missions/techniciens)\n');
  
  const { data: allPolicies, error: polError } = await supabase
    .from('pg_policies')
    .select('tablename, policyname, qual, with_check');
  
  if (polError) {
    console.log('⚠️  Impossible de lire pg_policies:', polError.message);
  } else {
    console.log(`✅ ${allPolicies.length} policies trouvées\n`);
    
    const withUserId = allPolicies.filter(p => {
      const qual = (p.qual || '').toLowerCase();
      const check = (p.with_check || '').toLowerCase();
      return qual.includes('user_id') || check.includes('user_id');
    });
    
    if (withUserId.length > 0) {
      console.log(`🔴 ${withUserId.length} POLICIES CONTIENNENT "user_id" :\n`);
      withUserId.forEach(p => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`❌ ${p.tablename}.${p.policyname}`);
        console.log(`   USING: ${p.qual}`);
        if (p.with_check) {
          console.log(`   WITH CHECK: ${p.with_check}`);
        }
      });
    } else {
      console.log('✅ Aucune policy ne contient "user_id"');
    }
  }
  
  // 3. Vérifier les tables entreprises, profiles
  console.log('\n\n3️⃣  POLICIES SUR TABLES CONNEXES (entreprises, profiles)\n');
  
  const tables = ['entreprises', 'profiles', 'tickets', 'locataires', 'logements', 'immeubles', 'regies'];
  
  for (const table of tables) {
    const { data: tablePolicies, error } = await supabase
      .from('pg_policies')
      .select('policyname')
      .eq('tablename', table);
    
    if (!error && tablePolicies) {
      console.log(`${table}: ${tablePolicies.length} policies`);
    }
  }
  
  // 4. Test direct pour voir quelle requête échoue exactement
  console.log('\n\n4️⃣  TEST ÉTAPE PAR ÉTAPE DE LA RPC\n');
  
  const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
  const technicienId = 'e3d51a56-4c1a-4d6b-a7c1-3065adf3acbd';
  
  // Test SELECT missions
  console.log('Test 1: SELECT missions...');
  const { data: m1, error: e1 } = await supabase
    .from('missions')
    .select('entreprise_id')
    .eq('id', missionId)
    .single();
  
  if (e1) {
    console.log('❌ ERREUR sur SELECT missions:', e1.message);
  } else {
    console.log('✅ SELECT missions OK, entreprise_id:', m1.entreprise_id);
  }
  
  // Test SELECT techniciens
  console.log('\nTest 2: SELECT techniciens...');
  const { data: t1, error: e2 } = await supabase
    .from('techniciens')
    .select('entreprise_id, actif')
    .eq('id', technicienId)
    .single();
  
  if (e2) {
    console.log('❌ ERREUR sur SELECT techniciens:', e2.message);
  } else {
    console.log('✅ SELECT techniciens OK, entreprise_id:', t1.entreprise_id, ', actif:', t1.actif);
  }
  
  // Test UPDATE missions
  console.log('\nTest 3: UPDATE missions (dry run)...');
  const { data: u1, error: e3 } = await supabase
    .from('missions')
    .update({ notes: 'Test diagnostic ' + new Date().toISOString() })
    .eq('id', missionId)
    .select();
  
  if (e3) {
    console.log('❌ ERREUR sur UPDATE missions:', e3.message);
    console.log('   Code:', e3.code);
    console.log('   Details:', e3.details);
  } else {
    console.log('✅ UPDATE missions OK');
  }
  
  // Test RPC complet
  console.log('\nTest 4: RPC assign_technicien_to_mission...');
  const { data: rpc, error: e4 } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: missionId,
    p_technicien_id: technicienId
  });
  
  if (e4) {
    console.log('❌ ERREUR RPC:', e4.message);
    console.log('   Code:', e4.code);
  } else {
    console.log('✅ RPC OK:', rpc);
  }
  
  console.log('\n' + '='.repeat(70));
}

findAllUserIdSources().catch(console.error);
