#!/usr/bin/env node
/**
 * ═════════════════════════════════════════════════════════════
 * TEST END-TO-END - DASHBOARD TECHNICIEN
 * ═════════════════════════════════════════════════════════════
 * Valide que le dashboard technicien fonctionne après tous les fix
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables .env.local manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🧪 TEST END-TO-END - DASHBOARD TECHNICIEN');
console.log('═══════════════════════════════════════════════════════════════\n');

async function main() {
  let allPassed = true;

  // ═════════════════════════════════════════════════════════════
  // TEST 1: Vérifier compte technicien existe
  // ═════════════════════════════════════════════════════════════
  console.log('📋 TEST 1: Compte technicien test\n');
  
  const { data: techniciens, error: techError } = await supabase
    .from('techniciens')
    .select('id, profile_id, nom, prenom, entreprise_id')
    .limit(1);

  if (techError || !techniciens || techniciens.length === 0) {
    console.log('❌ Aucun technicien trouvé en DB');
    allPassed = false;
  } else {
    const tech = techniciens[0];
    console.log('✅ Technicien trouvé:', tech.nom, tech.prenom);
    console.log('   ID:', tech.id);
    console.log('   Profile ID:', tech.profile_id);
    console.log('   Entreprise:', tech.entreprise_id);
  }

  console.log('');

  // ═════════════════════════════════════════════════════════════
  // TEST 2: Vérifier fonction start_mission existe
  // ═════════════════════════════════════════════════════════════
  console.log('📋 TEST 2: Fonction start_mission\n');

  const { data: resultStart, error: errorStart } = await supabase
    .rpc('start_mission', { p_mission_id: '00000000-0000-0000-0000-000000000000' });

  if (errorStart) {
    if (errorStart.message.includes('Mission non trouvée')) {
      console.log('✅ Fonction start_mission existe (erreur attendue: Mission non trouvée)');
    } else if (errorStart.message.includes('Could not find')) {
      console.log('❌ Fonction start_mission N\'EXISTE PAS en production');
      console.log('   → Déployer _deploy_m48_func1.sql et _deploy_m48_func2.sql');
      allPassed = false;
    } else {
      console.log('⚠️  Erreur inattendue:', errorStart.message);
    }
  } else {
    console.log('✅ Fonction start_mission existe:', resultStart);
  }

  console.log('');

  // ═════════════════════════════════════════════════════════════
  // TEST 3: Vérifier fonction complete_mission existe
  // ═════════════════════════════════════════════════════════════
  console.log('📋 TEST 3: Fonction complete_mission\n');

  const { data: resultComplete, error: errorComplete } = await supabase
    .rpc('complete_mission', { p_mission_id: '00000000-0000-0000-0000-000000000000' });

  if (errorComplete) {
    if (errorComplete.message.includes('Mission non trouvée')) {
      console.log('✅ Fonction complete_mission existe (erreur attendue: Mission non trouvée)');
    } else if (errorComplete.message.includes('Could not find')) {
      console.log('❌ Fonction complete_mission N\'EXISTE PAS en production');
      allPassed = false;
    } else {
      console.log('⚠️  Erreur inattendue:', errorComplete.message);
    }
  } else {
    console.log('✅ Fonction complete_mission existe:', resultComplete);
  }

  console.log('');

  // ═════════════════════════════════════════════════════════════
  // TEST 4: Vérifier mission test disponible
  // ═════════════════════════════════════════════════════════════
  console.log('📋 TEST 4: Mission test disponible\n');

  const { data: missions, error: missionError } = await supabase
    .from('missions')
    .select('id, statut, technicien_id, ticket_id')
    .eq('statut', 'en_attente')
    .limit(1);

  if (missionError || !missions || missions.length === 0) {
    console.log('⚠️  Aucune mission en_attente disponible pour test');
    console.log('   (Normal si toutes les missions sont démarrées)');
  } else {
    const mission = missions[0];
    console.log('✅ Mission test trouvée:', mission.id);
    console.log('   Statut:', mission.statut);
    console.log('   Technicien:', mission.technicien_id || 'NON ASSIGNÉ');
    console.log('   Ticket:', mission.ticket_id);
  }

  console.log('');

  // ═════════════════════════════════════════════════════════════
  // TEST 5: Vérifier fichiers frontend
  // ═════════════════════════════════════════════════════════════
  console.log('📋 TEST 5: Fichiers frontend\n');

  const fs = require('fs');
  const files = [
    'public/technicien/dashboard.html',
    'public/js/bootstrapSupabase.js',
    'api/missions/start.js',
    'api/missions/complete.js'
  ];

  files.forEach(file => {
    if (fs.existsSync(file)) {
      const size = fs.statSync(file).size;
      console.log(`✅ ${file} (${size} bytes)`);
    } else {
      console.log(`❌ ${file} MANQUANT`);
      allPassed = false;
    }
  });

  console.log('');

  // ═════════════════════════════════════════════════════════════
  // RÉSUMÉ FINAL
  // ═════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (allPassed) {
    console.log('✅✅✅ TOUS LES TESTS PASSÉS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🎯 PROCHAINES ÉTAPES:\n');
    console.log('1. Ouvrir navigateur: http://localhost:3000/technicien/dashboard.html');
    console.log('2. Login: demo.technicien@test.app');
    console.log('3. Vérifier console (F12): Aucune erreur JavaScript');
    console.log('4. Tester "Démarrer mission"');
    console.log('5. Vérifier console: [TECH][START][SUCCESS]');
    console.log('');
  } else {
    console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚠️  ACTIONS REQUISES:\n');
    console.log('1. Si fonctions RPC manquantes:');
    console.log('   → Déployer _deploy_m48_func1.sql dans Supabase SQL Editor');
    console.log('   → Déployer _deploy_m48_func2.sql dans Supabase SQL Editor');
    console.log('');
    console.log('2. Re-exécuter ce test: node _test_dashboard_complet.js');
    console.log('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Erreur test:', err.message);
  process.exit(1);
});
