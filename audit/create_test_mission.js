// =====================================================
// CRÉER MISSION DE TEST POUR TECHNICIEN
// =====================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestMission() {
  console.log('\n[TECHNICIEN][TEST] Création mission de test...\n');
  
  // 1. Récupérer technicien "Teste"
  const { data: technicien, error: errTech } = await supabase
    .from('techniciens')
    .select('id, nom, entreprise_id, profile_id')
    .eq('nom', 'Teste')
    .single();
  
  if (errTech || !technicien) {
    console.error('❌ Technicien "Teste" introuvable');
    process.exit(1);
  }
  
  console.log(`✅ Technicien trouvé: ${technicien.nom} (${technicien.id})`);
  
  // 2. Chercher une mission existante non assignée
  const { data: missions, error: errMissions } = await supabase
    .from('missions')
    .select('id, ticket_id, statut, technicien_id')
    .is('technicien_id', null)
    .limit(5);
  
  if (missions && missions.length > 0) {
    console.log(`\n✅ ${missions.length} missions sans technicien trouvées`);
    
    // Assigner la première au technicien Teste
    const mission = missions[0];
    const { error: errUpdate } = await supabase
      .from('missions')
      .update({ technicien_id: technicien.id })
      .eq('id', mission.id);
    
    if (errUpdate) {
      console.error('❌ Erreur assignation mission:', errUpdate.message);
      process.exit(1);
    }
    
    console.log(`✅ Mission ${mission.id.substring(0, 8)}... assignée à ${technicien.nom}`);
    console.log(`   Statut: ${mission.statut}`);
    console.log('\n✅ Mission de test prête pour vérification UI\n');
    
  } else {
    console.log('\n⚠️  Aucune mission disponible sans technicien');
    console.log('   Toutes les missions sont déjà assignées');
    
    // Vérifier si le technicien a déjà des missions
    const { data: missionsTech } = await supabase
      .from('missions')
      .select('id, statut')
      .eq('technicien_id', technicien.id);
    
    if (missionsTech && missionsTech.length > 0) {
      console.log(`\n✅ Le technicien a déjà ${missionsTech.length} mission(s) assignée(s)`);
      missionsTech.forEach(m => {
        console.log(`   - ${m.id.substring(0, 8)}... (${m.statut})`);
      });
      console.log('\n✅ Missions disponibles pour tests UI\n');
    } else {
      console.log('\n⚠️  Le technicien n\'a aucune mission assignée');
      console.log('   Impossible de tester la vue sans mission\n');
    }
  }
}

createTestMission().catch(err => {
  console.error('\n❌ ERREUR:', err);
  process.exit(1);
});
