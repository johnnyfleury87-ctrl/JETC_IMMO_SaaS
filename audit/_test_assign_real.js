// Test d'assignation avec les vrais IDs
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function testAssign() {
  console.log('🧪 TEST ASSIGNATION TECHNICIEN (IDs réels)\n');
  
  const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
  const technicienId = 'e3d51a56-4c1a-4d6b-a7c1-3065adf3acbd'; // TEchn Teste
  
  console.log('Mission:', missionId);
  console.log('Technicien:', technicienId, '(TEchn Teste)');
  console.log('');
  
  const { data, error } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: missionId,
    p_technicien_id: technicienId
  });
  
  if (error) {
    console.log('❌ ERREUR RPC');
    console.log('   Message:', error.message);
    console.log('   Code:', error.code);
    console.log('   Details:', error.details);
    console.log('   Hint:', error.hint);
    return;
  }
  
  if (data && data.success === false) {
    console.log('❌ ÉCHEC MÉTIER');
    console.log('   Error:', data.error);
    return;
  }
  
  console.log('✅ ASSIGNATION RÉUSSIE !');
  console.log('   Result:', data);
  
  // Vérifier la mission mise à jour
  const { data: mission, error: missError } = await supabase
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .single();
  
  if (missError) {
    console.log('⚠️  Erreur lecture mission:', missError.message);
  } else {
    console.log('\n📋 Mission mise à jour:');
    console.log('   ID:', mission.id);
    console.log('   Technicien assigné:', mission.technicien_id);
    console.log('   Statut:', mission.statut);
  }
}

testAssign().catch(console.error);
