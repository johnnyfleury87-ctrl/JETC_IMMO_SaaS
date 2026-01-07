/**
 * LISTE DES COMPTES TECHNICIENS
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTechniciens() {
  console.log('[DEBUG] LISTE DES COMPTES TECHNICIENS\n');
  
  try {
    // Liste profiles avec role technicien
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'technicien');
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    if (!profiles || profiles.length === 0) {
      console.log('⚠️ Aucun compte technicien trouvé');
      return;
    }
    
    console.log(`✅ ${profiles.length} technicien(s) trouvé(s):\n`);
    
    profiles.forEach((p, i) => {
      console.log(`${i + 1}. ${p.email}`);
      console.log(`   ID: ${p.id}`);
      console.log('');
    });
    
    // Chercher missions pour chaque technicien
    console.log('=== MISSIONS PAR TECHNICIEN ===\n');
    
    for (const profile of profiles) {
      const { data: missions } = await supabase
        .from('missions')
        .select('id, statut, ticket_id')
        .eq('technicien_id', profile.id);
      
      console.log(`${profile.email}:`);
      console.log(`  ${missions?.length || 0} mission(s)`);
      
      if (missions && missions.length > 0) {
        missions.forEach(m => {
          console.log(`    - ${m.id.substring(0, 8)} (${m.statut})`);
        });
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

listTechniciens();
