/**
 * VÉRIFIER QUELLE MISSION EST ASSIGNÉE À QUEL TECHNICIEN
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissionOwner() {
  console.log('[DEBUG] VÉRIFICATION ASSIGNATION MISSION\n');
  
  try {
    // Récupérer la mission
    const { data: mission } = await supabase
      .from('missions')
      .select('id, technicien_id, statut, ticket_id')
      .eq('id', '2d84c11c-6415-4f49-ba33-8b53ae1ee22d')
      .single();
    
    if (!mission) {
      console.log('❌ Mission non trouvée');
      return;
    }
    
    console.log('Mission ID:', mission.id);
    console.log('Technicien ID:', mission.technicien_id);
    console.log('Statut:', mission.statut);
    console.log('');
    
    // Trouver le profile du technicien
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', mission.technicien_id)
      .single();
    
    if (!profile) {
      console.log('❌ Profile technicien non trouvé');
      console.log('⚠️ mission.technicien_id ne correspond à aucun profile');
      return;
    }
    
    console.log('Profile trouvé:');
    console.log('  Email:', profile.email);
    console.log('  Role:', profile.role);
    console.log('');
    
    // Vérifier si auth existe
    console.log('=== VÉRIFICATION AUTH ===');
    const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
    
    if (usersErr) {
      console.log('⚠️ Impossible de lister les users auth');
    } else {
      const authUser = users.users.find(u => u.id === profile.id);
      
      if (authUser) {
        console.log('✅ Compte auth existe');
        console.log('  Email:', authUser.email);
        console.log('  ID:', authUser.id);
      } else {
        console.log('❌ Aucun compte auth pour profile_id:', profile.id);
        console.log('⚠️ Le technicien ne peut pas se connecter');
      }
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

checkMissionOwner();
