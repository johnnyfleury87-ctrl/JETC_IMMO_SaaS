/**
 * VÉRIFIER LA VRAIE STRUCTURE missions.technicien_id
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRealStructure() {
  console.log('[DEBUG] STRUCTURE MISSIONS.TECHNICIEN_ID\n');
  
  try {
    // Récupérer l'ancienne valeur
    const { data: oldMission } = await supabase
      .from('missions')
      .select('id, technicien_id, entreprise_id')
      .eq('id', '2d84c11c-6415-4f49-ba33-8b53ae1ee22d')
      .single();
    
    console.log('Mission actuelle:');
    console.log('  technicien_id:', oldMission.technicien_id);
    console.log('  entreprise_id:', oldMission.entreprise_id);
    console.log('');
    
    // Vérifier si technicien_id existe dans diverses tables
    console.log('Recherche de', oldMission.technicien_id, 'dans:');
    
    const tables = ['profiles', 'entreprises'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('id', oldMission.technicien_id)
        .maybeSingle();
      
      console.log(`  ${table}:`, data ? '✅ TROUVÉ' : '❌ absent');
    }
    
    console.log('');
    
    // Si entreprise_id correspond, alors missions.technicien_id pourrait être mal nommé
    // et devrait pointer vers entreprises
    if (oldMission.entreprise_id) {
      const { data: entr } = await supabase
        .from('entreprises')
        .select('id')
        .eq('id', oldMission.entreprise_id)
        .maybeSingle();
      
      console.log('entreprise_id existe dans entreprises:', entr ? '✅' : '❌');
      
      // Vérifier si l'entreprise a des techniciens liés
      const { data: tech } = await supabase
        .from('profiles')
        .select('id, email, role, entreprise_id')
        .eq('entreprise_id', oldMission.entreprise_id)
        .eq('role', 'technicien');
      
      if (tech && tech.length > 0) {
        console.log('');
        console.log('✅ Techniciens trouvés dans cette entreprise:');
        tech.forEach(t => {
          console.log(`  - ${t.email} (${t.id})`);
        });
        console.log('');
        console.log('💡 SOLUTION: Assigner la mission à un de ces techniciens');
        console.log(`   UPDATE missions SET technicien_id = '${tech[0].id}' WHERE id = '${oldMission.id}';`);
      } else {
        console.log('⚠️ Aucun technicien dans cette entreprise');
      }
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

checkRealStructure();
