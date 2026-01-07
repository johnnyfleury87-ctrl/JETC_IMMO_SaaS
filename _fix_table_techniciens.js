/**
 * FIX RÉEL: Créer entrée dans table techniciens
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function realFix() {
  console.log('[FIX] CRÉATION DANS TABLE TECHNICIENS\n');
  
  try {
    const userId = '3196179e-5258-457f-b31f-c88a4760ebe0'; // demo.technicien@test.app
    const entrepriseId = '6ff210bc-9985-457c-8851-4185123edb07';
    const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
    
    // 1. Vérifier structure table techniciens
    console.log('=== ÉTAPE 1: Structure table techniciens ===');
    const { data: sample } = await supabase
      .from('techniciens')
      .select('*')
      .limit(1);
    
    if (sample && sample.length > 0) {
      console.log('Colonnes:', Object.keys(sample[0]));
    } else {
      console.log('⚠️ Table techniciens vide, on va deviner la structure');
    }
    console.log('');
    
    // 2. Créer entrée dans techniciens
    console.log('=== ÉTAPE 2: Insérer dans techniciens ===');
    const { data: techData, error: techError } = await supabase
      .from('techniciens')
      .upsert({
        id: userId,
        profile_id: userId,
        entreprise_id: entrepriseId,
        nom: 'Technicien',
        prenom: 'Demo',
        email: 'demo.technicien@test.app',
        telephone: '0612345678',
        actif: true
      })
      .select();
    
    if (techError) {
      console.error('❌ Erreur techniciens:', techError.message);
      console.log('Tentative avec structure minimale...');
      
      const { data: tech2, error: tech2Error } = await supabase
        .from('techniciens')
        .upsert({ id: userId })
        .select();
      
      if (tech2Error) {
        console.error('❌ Erreur même avec id seul:', tech2Error.message);
        return;
      }
      
      console.log('✅ Insertion OK (structure minimale)');
    } else {
      console.log('✅ Insertion OK');
    }
    console.log('');
    
    // 3. Assigner la mission
    console.log('=== ÉTAPE 3: Assignation mission ===');
    const { error: updateError } = await supabase
      .from('missions')
      .update({ technicien_id: userId })
      .eq('id', missionId);
    
    if (updateError) {
      console.error('❌ Erreur assignation:', updateError.message);
      return;
    }
    
    console.log('✅ Mission assignée!');
    console.log('');
    
    console.log('========== SUCCESS ==========');
    console.log('');
    console.log('🧪 TESTER:');
    console.log('   URL: http://localhost:3001/technicien/dashboard.html');
    console.log('   Email: demo.technicien@test.app');
    console.log('   Password: Demo1234!');
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

realFix();
