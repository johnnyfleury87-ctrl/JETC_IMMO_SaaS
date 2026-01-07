/**
 * APPLIQUER LE FIX: Réassigner la mission
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMission() {
  console.log('[FIX] RÉASSIGNATION MISSION AU TECHNICIEN EXISTANT\n');
  
  try {
    const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
    const newTechnicienId = 'e5dc1c44-96b0-49fd-b18e-1b8f539df1a5'; // tech@test.app
    
    console.log('Mission ID:', missionId);
    console.log('Nouveau technicien_id:', newTechnicienId);
    console.log('');
    
    // Réassigner
    const { data, error } = await supabase
      .from('missions')
      .update({ technicien_id: newTechnicienId })
      .eq('id', missionId)
      .select();
    
    if (error) {
      console.error('❌ Erreur update:', error.message);
      return;
    }
    
    console.log('✅ Mission réassignée\n');
    
    // Vérifier
    const { data: check } = await supabase
      .from('missions')
      .select(`
        id,
        technicien_id,
        statut,
        profiles!missions_technicien_id_fkey(email, role),
        tickets(categorie, sous_categorie)
      `)
      .eq('id', missionId)
      .single();
    
    console.log('=== VÉRIFICATION ===');
    console.log('Mission ID:', check.id.substring(0, 8));
    console.log('Technicien:', check.profiles?.email);
    console.log('Statut:', check.statut);
    console.log('Intervention:', check.tickets?.categorie, '-', check.tickets?.sous_categorie);
    console.log('');
    console.log('✅ FIX APPLIQUÉ AVEC SUCCÈS');
    console.log('');
    console.log('🧪 TESTER MAINTENANT:');
    console.log('   1. Ouvrir: http://localhost:3001/technicien/dashboard.html');
    console.log('   2. Login: tech@test.app');
    console.log('   3. Vérifier que la mission s\'affiche avec toutes les infos');
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

fixMission();
