/**
 * FIX MISSION ORPHELINE
 * La mission a été assignée à l'ancien technicien_id qui n'existe plus
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMissionOrpheline() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 FIX MISSION ORPHELINE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Trouver missions orphelines
    const { data: missions } = await supabase
      .from('missions')
      .select('id, technicien_id, statut');
    
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('id, profile_id, email');
    
    const techIds = new Set(techniciens.map(t => t.id));
    const orphelines = missions.filter(m => m.technicien_id && !techIds.has(m.technicien_id));
    
    console.log(`Missions orphelines: ${orphelines.length}\n`);
    
    if (orphelines.length === 0) {
      console.log('✅ Aucune mission orpheline');
      return;
    }
    
    for (const mission of orphelines) {
      console.log(`Mission ${mission.id.substring(0, 8)}`);
      console.log(`  technicien_id actuel: ${mission.technicien_id}`);
      
      // Chercher si c'était un ancien ID de technicien
      // Heuristique: proposer tech@test.app (premier technicien)
      if (techniciens.length > 0) {
        const techDefault = techniciens[0];
        
        console.log(`  Proposition: réassigner à ${techDefault.email} (${techDefault.id.substring(0, 8)})`);
        console.log(`  OU mettre à NULL si vous préférez la laisser non assignée`);
        console.log('');
        
        // Pour l'instant, mettre à NULL (sécurité)
        const { error } = await supabase
          .from('missions')
          .update({ technicien_id: null })
          .eq('id', mission.id);
        
        if (error) {
          console.log(`  ❌ Erreur:`, error.message);
        } else {
          console.log(`  ✅ technicien_id mis à NULL`);
        }
      }
    }
    
    console.log('\n✅ Missions orphelines corrigées (technicien_id = NULL)');
    console.log('⚠️ Vous pouvez maintenant les réassigner via l\'UI entreprise');

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

fixMissionOrpheline();
