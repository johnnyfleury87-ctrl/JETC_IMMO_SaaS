// Script pour vérifier l'état M43
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkM43() {
  console.log('🔍 VÉRIFICATION MIGRATION M43\n');

  // 1. Vérifier colonnes missions
  console.log('📋 1. Colonnes table missions:');
  const { data: missions, error: missionsError } = await supabase
    .from('missions')
    .select('*')
    .limit(1);
  
  if (!missionsError && missions) {
    const columns = missions.length > 0 ? Object.keys(missions[0]) : [];
    const m43Columns = ['locataire_absent', 'absence_signalement_at', 'absence_raison', 'photos_urls'];
    
    m43Columns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? 'PRÉSENTE' : 'MANQUANTE'}`);
    });
  } else {
    console.log('  ⚠️ Impossible de lire missions:', missionsError?.message);
  }

  // 2. Vérifier table mission_signalements
  console.log('\n📋 2. Table mission_signalements:');
  const { data: signalements, error: signError } = await supabase
    .from('mission_signalements')
    .select('id')
    .limit(1);
  
  if (signError) {
    if (signError.code === '42P01') {
      console.log('  ❌ Table ABSENTE (code 42P01)');
    } else {
      console.log(`  ⚠️ Erreur: ${signError.message}`);
    }
  } else {
    console.log('  ✅ Table PRÉSENTE');
  }

  // 3. Vérifier table mission_historique_statuts
  console.log('\n📋 3. Table mission_historique_statuts:');
  const { data: historique, error: histError } = await supabase
    .from('mission_historique_statuts')
    .select('id')
    .limit(1);
  
  if (histError) {
    if (histError.code === '42P01') {
      console.log('  ❌ Table ABSENTE (code 42P01)');
    } else {
      console.log(`  ⚠️ Erreur: ${histError.message}`);
    }
  } else {
    console.log('  ✅ Table PRÉSENTE');
  }

  // 4. Vérifier fonctions RPC
  console.log('\n📋 4. Fonctions RPC:');
  const functions = [
    'signaler_absence_locataire',
    'ajouter_photos_mission',
    'log_mission_statut_change',
    'log_mission_creation'
  ];

  for (const fn of functions) {
    const { data, error } = await supabase.rpc(fn, {});
    if (error) {
      if (error.code === '42883') {
        console.log(`  ❌ ${fn}: ABSENTE (code 42883)`);
      } else {
        console.log(`  ⚠️ ${fn}: Erreur - ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${fn}: PRÉSENTE`);
    }
  }

  // 5. Vérifier vues
  console.log('\n📋 5. Vues M43:');
  const views = [
    'mission_signalements_details',
    'missions_avec_absence_locataire',
    'mission_historique_details',
    'mission_transitions_stats'
  ];

  for (const view of views) {
    const { data, error } = await supabase
      .from(view)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log(`  ❌ ${view}: ABSENTE`);
      } else {
        console.log(`  ⚠️ ${view}: Erreur - ${error.message}`);
      }
    } else {
      console.log(`  ✅ ${view}: PRÉSENTE`);
    }
  }

  console.log('\n✅ VÉRIFICATION M43 TERMINÉE');
}

checkM43().catch(console.error);
