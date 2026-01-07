#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStartMission() {
  console.log('===== TEST RPC start_mission =====\n');
  
  // Récupérer une mission en_attente
  const { data: missions, error: fetchError } = await supabase
    .from('missions')
    .select('id, statut, technicien_id')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (fetchError) {
    console.error('❌ Erreur fetch:', fetchError);
    return;
  }
  
  if (!missions || missions.length === 0) {
    console.log('❌ Aucune mission en_attente');
    return;
  }
  
  const missionId = missions[0].id;
  console.log('Mission:', missionId.substring(0, 13) + '...');
  console.log('Statut avant:', missions[0].statut);
  console.log('Technicien:', missions[0].technicien_id ? missions[0].technicien_id.substring(0, 8) + '...' : 'NONE');
  
  // Appel RPC
  console.log('\n🔧 Appel RPC start_mission...\n');
  const { data, error } = await supabase.rpc('start_mission', {
    p_mission_id: missionId
  });
  
  if (error) {
    console.error('❌ RPC Error:', error);
  } else {
    console.log('✅ RPC Success:', JSON.stringify(data, null, 2));
    
    // Vérifier le statut après
    const { data: updated, error: checkError } = await supabase
      .from('missions')
      .select('id, statut, started_at')
      .eq('id', missionId)
      .single();
    
    if (!checkError) {
      console.log('\n📊 État après RPC:');
      console.log('  Statut:', updated.statut);
      console.log('  Started_at:', updated.started_at);
    }
  }
}

testStartMission().catch(console.error);
