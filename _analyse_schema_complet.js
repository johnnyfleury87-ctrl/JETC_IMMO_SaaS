#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyseComplete() {
  console.log('===== ANALYSE COMPLÈTE SCHÉMA MISSIONS =====\n');
  
  // 1. Récupérer la structure de la table missions
  console.log('1️⃣  Structure table missions...\n');
  const { data: missions, error: mError } = await supabase
    .from('missions')
    .select('*')
    .limit(0);
  
  if (mError) {
    console.log('Erreur:', mError.message);
  } else {
    console.log('✅ Table missions accessible');
  }
  
  // 2. Vérifier table mission_historique_statuts
  console.log('\n2️⃣  Structure mission_historique_statuts...\n');
  const { data: historique, error: hError } = await supabase
    .from('mission_historique_statuts')
    .select('*')
    .limit(1);
  
  if (hError) {
    console.log('❌ Erreur:', hError.message);
  } else {
    console.log('✅ Table existe');
    if (historique && historique.length > 0) {
      console.log('Colonnes:', Object.keys(historique[0]));
    }
  }
  
  // 3. Tester si change_par est nullable
  console.log('\n3️⃣  Test change_par nullable...\n');
  const testMissionId = 'test-test-test-test-testtesttesttest';
  const { error: insertError } = await supabase
    .from('mission_historique_statuts')
    .insert({
      mission_id: testMissionId,
      ancien_statut: 'test',
      nouveau_statut: 'test',
      change_par: null  // Test si NULL accepté
    });
  
  if (insertError) {
    if (insertError.code === '23503') {
      console.log('❌ FK violation - mission_id invalide (normal pour le test)');
    } else if (insertError.code === '23502') {
      console.log('❌ NOT NULL constraint - change_par n\'accepte pas NULL');
      console.log('   → CORRECTIF NÉCESSAIRE : ALTER COLUMN DROP NOT NULL');
    } else {
      console.log('Erreur:', insertError.code, '-', insertError.message);
    }
  } else {
    console.log('✅ change_par accepte NULL');
    // Cleanup
    await supabase
      .from('mission_historique_statuts')
      .delete()
      .eq('mission_id', testMissionId);
  }
  
  // 4. Lister les fonctions triggers
  console.log('\n4️⃣  Recherche fonctions triggers...\n');
  
  const fonctions = [
    'log_mission_statut_change',
    'notify_mission_status_change_extended',
    'notify_technicien_assignment',
    'create_system_message',
    'get_mission_actors'
  ];
  
  for (const fn of fonctions) {
    const { data, error } = await supabase.rpc(fn, {}).catch(() => ({ error: true }));
    if (error) {
      console.log(`❌ ${fn} - Non trouvée ou erreur`);
    } else {
      console.log(`✅ ${fn} - Existe`);
    }
  }
  
  // 5. Test UPDATE pour voir quel trigger échoue
  console.log('\n5️⃣  Test UPDATE missions (trigger log_mission_statut_change)...\n');
  
  const { data: testMissions } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (testMissions && testMissions.length > 0) {
    const missionId = testMissions[0].id;
    
    const { error: updateError } = await supabase
      .from('missions')
      .update({ statut: 'en_cours', started_at: new Date().toISOString() })
      .eq('id', missionId);
    
    if (updateError) {
      console.log('❌ UPDATE échoué:');
      console.log('   Code:', updateError.code);
      console.log('   Message:', updateError.message);
      console.log('   Details:', updateError.details);
      
      if (updateError.code === '23503') {
        console.log('\n⚠️  PROBLÈME CONFIRMÉ:');
        console.log('   → log_mission_statut_change() insère UUID fake');
        console.log('   → Viole FK mission_historique_statuts_change_par_fkey');
      } else if (updateError.code === '42703') {
        console.log('\n⚠️  PROBLÈME CONFIRMÉ:');
        console.log('   → Trigger tente d\'accéder à colonne inexistante');
      }
    } else {
      console.log('✅ UPDATE réussi (trigger fonctionne)');
      // Rollback
      await supabase
        .from('missions')
        .update({ statut: 'en_attente', started_at: null })
        .eq('id', missionId);
    }
  }
  
  console.log('\n===== FIN ANALYSE =====');
}

analyseComplete().catch(console.error);
