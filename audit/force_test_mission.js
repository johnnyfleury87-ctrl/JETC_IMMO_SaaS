// =====================================================
// FORCER CRÉATION MISSION TEST OU RÉASSIGNER
// =====================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceMissionTest() {
  console.log('\n[TECHNICIEN][TEST] Forçage mission test...\n');
  
  // 1. Technicien Teste
  const { data: technicien } = await supabase
    .from('techniciens')
    .select('id, nom, entreprise_id')
    .eq('nom', 'Teste')
    .single();
  
  if (!technicien) {
    console.error('❌ Technicien Teste introuvable');
    process.exit(1);
  }
  
  console.log(`✅ Technicien: ${technicien.nom} (${technicien.id.substring(0, 8)}...)`);
  
  // 2. Chercher TOUTES les missions
  const { data: allMissions } = await supabase
    .from('missions')
    .select('id, ticket_id, technicien_id, statut, entreprise_id')
    .limit(10);
  
  console.log(`\n📊 Total missions: ${allMissions ? allMissions.length : 0}`);
  
  if (allMissions && allMissions.length > 0) {
    // Prendre la première mission et la réassigner au technicien Teste
    const mission = allMissions[0];
    
    console.log(`\n🔄 Réassignation mission ${mission.id.substring(0, 8)}...`);
    console.log(`   Ancien technicien_id: ${mission.technicien_id ? mission.technicien_id.substring(0, 8) + '...' : 'NULL'}`);
    console.log(`   Nouveau: ${technicien.id.substring(0, 8)}...`);
    
    const { error } = await supabase
      .from('missions')
      .update({ 
        technicien_id: technicien.id,
        statut: 'en_attente'  // Reset statut pour tests
      })
      .eq('id', mission.id);
    
    if (error) {
      console.error('❌ Erreur réassignation:', error.message);
      process.exit(1);
    }
    
    console.log(`\n✅ Mission ${mission.id.substring(0, 8)}... réassignée à ${technicien.nom}`);
    console.log(`✅ Statut: en_attente`);
    console.log('\n🎯 Mission de test prête pour UI\n');
    
  } else {
    console.log('\n⚠️  Aucune mission dans la base');
    console.log('   La base de données est vide\n');
  }
}

forceMissionTest().catch(err => {
  console.error('\n❌ ERREUR:', err);
  process.exit(1);
});
