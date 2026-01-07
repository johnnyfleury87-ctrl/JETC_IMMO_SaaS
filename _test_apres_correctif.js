#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAfterFix() {
  console.log('===== TEST APRÈS CORRECTIF =====\n');
  
  // 1. Récupérer une mission en_attente
  console.log('1️⃣  Récupération mission en_attente...\n');
  const { data: missions, error: fetchError } = await supabase
    .from('missions')
    .select('id, statut, technicien_id, started_at')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (fetchError || !missions || missions.length === 0) {
    console.error('❌ Aucune mission en_attente trouvée');
    return;
  }
  
  const mission = missions[0];
  console.log('Mission:', mission.id.substring(0, 13) + '...');
  console.log('Statut avant:', mission.statut);
  console.log('Technicien:', mission.technicien_id ? mission.technicien_id.substring(0, 8) + '...' : 'NONE');
  
  // 2. Test UPDATE direct
  console.log('\n2️⃣  Test UPDATE missions...\n');
  const { data: updateData, error: updateError } = await supabase
    .from('missions')
    .update({ 
      statut: 'en_cours',
      started_at: new Date().toISOString()
    })
    .eq('id', mission.id)
    .select();
  
  if (updateError) {
    console.error('❌ UPDATE échoué:', updateError);
    console.log('\nCODE:', updateError.code);
    console.log('MESSAGE:', updateError.message);
    console.log('DETAILS:', updateError.details);
    return;
  }
  
  console.log('✅ UPDATE réussi!');
  console.log('Nouveau statut:', updateData[0].statut);
  console.log('Started_at:', updateData[0].started_at);
  
  // 3. Vérifier l'historique
  console.log('\n3️⃣  Vérification historique...\n');
  const { data: historique, error: histError } = await supabase
    .from('mission_historique_statuts')
    .select('*')
    .eq('mission_id', mission.id)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (histError) {
    console.log('⚠️  Erreur lecture historique:', histError.message);
  } else if (historique && historique.length > 0) {
    const record = historique[0];
    console.log('✅ Enregistrement historique créé:');
    console.log('  Ancien statut:', record.ancien_statut);
    console.log('  Nouveau statut:', record.nouveau_statut);
    console.log('  Change_par:', record.change_par || 'NULL (système)');
    console.log('  Created_at:', record.created_at);
  } else {
    console.log('ℹ️  Aucun historique trouvé (peut-être trigger désactivé)');
  }
  
  // 4. Test RPC start_mission
  console.log('\n4️⃣  Rollback + Test RPC start_mission...\n');
  
  // Rollback d'abord
  await supabase
    .from('missions')
    .update({ statut: 'en_attente', started_at: null })
    .eq('id', mission.id);
  
  console.log('↩️  Mission remise en_attente');
  
  // Test RPC
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('start_mission', { p_mission_id: mission.id });
  
  if (rpcError) {
    console.error('❌ RPC start_mission échoué:', rpcError);
    return;
  }
  
  console.log('✅ RPC start_mission réussi:', rpcData);
  
  // 5. Vérifier le résultat final
  console.log('\n5️⃣  Vérification finale...\n');
  const { data: finalMission } = await supabase
    .from('missions')
    .select('id, statut, started_at')
    .eq('id', mission.id)
    .single();
  
  console.log('📊 État final:');
  console.log('  Statut:', finalMission.statut);
  console.log('  Started_at:', finalMission.started_at);
  
  if (finalMission.statut === 'en_cours' && finalMission.started_at) {
    console.log('\n🎉 SUCCESS COMPLET!');
    console.log('   Le bouton "Démarrer Mission" devrait maintenant fonctionner!');
  } else {
    console.log('\n⚠️  État inattendu - vérifier la configuration');
  }
  
  // 6. Rollback final pour permettre de re-tester
  await supabase
    .from('missions')
    .update({ statut: 'en_attente', started_at: null })
    .eq('id', mission.id);
  
  console.log('\n↩️  Mission remise en_attente pour permettre nouveaux tests');
}

testAfterFix().catch(console.error);
