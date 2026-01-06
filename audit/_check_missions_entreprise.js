// Script pour vérifier l'état complet des missions entreprise
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissionsState() {
  console.log('🔍 AUDIT MISSIONS ENTREPRISE\n');
  console.log('='.repeat(60));
  
  // 1. Vérifier RPC assign_technicien_to_mission
  console.log('\n📋 1. RPC assign_technicien_to_mission');
  console.log('-'.repeat(60));
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: '00000000-0000-0000-0000-000000000000',
    p_technicien_id: '00000000-0000-0000-0000-000000000000'
  });
  
  if (rpcError) {
    if (rpcError.message.includes('Could not find')) {
      console.log('❌ RPC assign_technicien_to_mission MANQUANTE');
      console.log('   → Migration nécessaire pour créer la fonction');
    } else {
      console.log('✅ RPC existe (erreur params attendue)');
      console.log('   Erreur:', rpcError.message);
    }
  } else {
    console.log('✅ RPC accessible');
  }
  
  // 2. Vérifier policies RLS sur missions
  console.log('\n🔒 2. Policies RLS missions');
  console.log('-'.repeat(60));
  
  // Test SELECT
  const { data: missions, error: selectError } = await supabase
    .from('missions')
    .select('*')
    .limit(1);
  
  if (selectError) {
    console.log('❌ SELECT missions erreur:', selectError.message);
  } else {
    console.log('✅ SELECT missions OK');
    console.log('   Missions trouvées:', missions?.length || 0);
  }
  
  // 3. Lister toutes les missions
  console.log('\n📊 3. Missions en DB');
  console.log('-'.repeat(60));
  
  const { data: allMissions, error: allError } = await supabase
    .from('missions')
    .select(`
      id,
      ticket_id,
      entreprise_id,
      technicien_id,
      statut,
      created_at,
      tickets (
        id,
        titre,
        statut
      ),
      entreprises (
        id,
        nom
      )
    `)
    .order('created_at', { ascending: false });
  
  if (allError) {
    console.log('❌ Erreur:', allError.message);
  } else {
    console.log(`✅ ${allMissions?.length || 0} missions trouvées\n`);
    
    if (allMissions && allMissions.length > 0) {
      allMissions.forEach((m, i) => {
        console.log(`Mission ${i + 1}:`);
        console.log(`  ID: ${m.id}`);
        console.log(`  Ticket: ${m.tickets?.titre || 'N/A'} (${m.tickets?.statut})`);
        console.log(`  Entreprise: ${m.entreprises?.nom || m.entreprise_id}`);
        console.log(`  Technicien: ${m.technicien_id || 'NON ASSIGNÉ'}`);
        console.log(`  Statut: ${m.statut}`);
        console.log(`  Créée: ${new Date(m.created_at).toLocaleString('fr-FR')}`);
        console.log('');
      });
    }
  }
  
  // 4. Vérifier entreprises et leurs techniciens
  console.log('\n👥 4. Entreprises et techniciens');
  console.log('-'.repeat(60));
  
  const { data: entreprises, error: entError } = await supabase
    .from('entreprises')
    .select(`
      id,
      nom,
      techniciens (
        id,
        nom,
        prenom,
        actif
      )
    `);
  
  if (entError) {
    console.log('❌ Erreur:', entError.message);
  } else {
    console.log(`✅ ${entreprises?.length || 0} entreprises\n`);
    
    entreprises?.forEach(e => {
      console.log(`${e.nom} (${e.id.substring(0, 8)}...)`);
      console.log(`  Techniciens: ${e.techniciens?.length || 0}`);
      if (e.techniciens && e.techniciens.length > 0) {
        e.techniciens.forEach(t => {
          console.log(`    - ${t.prenom} ${t.nom} ${t.actif ? '✅' : '❌'}`);
        });
      }
      console.log('');
    });
  }
  
  // 5. Test UPDATE mission (simulation)
  console.log('\n🔧 5. Test UPDATE mission (simulation)');
  console.log('-'.repeat(60));
  
  if (allMissions && allMissions.length > 0) {
    const testMission = allMissions[0];
    console.log(`Test sur mission ${testMission.id.substring(0, 8)}...`);
    
    // Tenter update notes (champ simple)
    const { data: updateData, error: updateError } = await supabase
      .from('missions')
      .update({ notes: 'Test update ' + new Date().toISOString() })
      .eq('id', testMission.id)
      .select();
    
    if (updateError) {
      console.log('❌ UPDATE refusé:', updateError.message);
      console.log('   → Problème RLS probable');
    } else {
      console.log('✅ UPDATE OK');
      console.log('   Notes mises à jour');
    }
  } else {
    console.log('⚠️  Aucune mission pour tester UPDATE');
  }
  
  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📋 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log('');
  console.log('Actions requises:');
  console.log('1. Vérifier que RPC assign_technicien_to_mission existe');
  console.log('2. Vérifier policies RLS sur missions (SELECT + UPDATE entreprise)');
  console.log('3. Implémenter UI actions missions dans dashboard entreprise');
  console.log('');
}

checkMissionsState().catch(console.error);
