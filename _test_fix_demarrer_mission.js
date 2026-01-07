
/**
 * TEST: Vérifier que start_mission fonctionne
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🧪 TEST: Fonction start_mission après fix\n');

(async () => {
  // Trouver mission test
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, statut, technicien_id, ticket_id')
    .eq('statut', 'en_attente')
    .limit(1);

  if (error || !missions || missions.length === 0) {
    console.log('❌ Aucune mission test disponible');
    return;
  }

  const mission = missions[0];
  console.log('📌 Mission test:', mission.id);
  console.log('   Statut:', mission.statut);
  console.log('   Technicien:', mission.technicien_id);
  console.log('');

  console.log('🚀 Appel start_mission...');
  
  const { data: result, error: startError } = await supabase.rpc('start_mission', {
    p_mission_id: mission.id
  });

  if (startError) {
    console.log('❌ Erreur:', startError.message);
    console.log('');
    console.log('⚠️  Si erreur contient "reference":');
    console.log('   → Migration M48 pas encore déployée');
    console.log('   → Exécuter les 2 fichiers SQL manuellement');
    return;
  }

  console.log('✅ Résultat:', result);
  console.log('');

  if (result.success) {
    console.log('✅✅✅ FIX RÉUSSI! start_mission fonctionne!');
    console.log('');
    
    // Rollback
    console.log('🔄 Rollback mission...');
    await supabase
      .from('missions')
      .update({ statut: 'en_attente', started_at: null })
      .eq('id', mission.id);
    
    console.log('✅ Rollback OK');
  } else {
    console.log('⚠️  Échec:', result.error);
  }

  console.log('');
})();
  