/**
 * CRÉER UN NOUVEAU TECHNICIEN COMPLET (auth + profile + mission)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTechnicienAndAssign() {
  console.log('[FIX] CRÉATION TECHNICIEN + ASSIGNATION MISSION\n');
  
  try {
    const email = 'demo.technicien@test.app';
    const password = 'Demo1234!';
    const missionId = '2d84c11c-6415-4f49-ba33-8b53ae1ee22d';
    
    // 1. Créer le compte auth
    console.log('=== ÉTAPE 1: Créer compte auth ===');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (authError) {
      console.error('❌ Erreur création auth:', authError.message);
      
      // Peut-être que le compte existe déjà
      console.log('⚠️ Le compte existe peut-être déjà, essayons de le retrouver...');
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users.users.find(u => u.email === email);
      
      if (existing) {
        console.log('✅ Compte trouvé:', existing.email);
        console.log('   ID:', existing.id);
        
        // Utiliser ce compte
        const userId = existing.id;
        
        // 2. Créer/MAJ profile
        console.log('\n=== ÉTAPE 2: Créer/MAJ profile ===');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            role: 'technicien'
          })
          .select();
        
        if (profileError) {
          console.error('❌ Erreur profile:', profileError.message);
          return;
        }
        
        console.log('✅ Profile OK');
        
        // 3. Assigner la mission
        console.log('\n=== ÉTAPE 3: Assigner la mission ===');
        const { error: updateError } = await supabase
          .from('missions')
          .update({ technicien_id: userId })
          .eq('id', missionId);
        
        if (updateError) {
          console.error('❌ Erreur assignation:', updateError.message);
          return;
        }
        
        console.log('✅ Mission assignée');
        console.log('');
        console.log('========== SUCCESS ==========');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Mission ID:', missionId.substring(0, 8));
        console.log('');
        console.log('🧪 TESTER:');
        console.log('   URL: http://localhost:3001/technicien/dashboard.html');
        console.log('   Login:', email);
        console.log('   Password:', password);
        
        return;
      } else {
        console.error('❌ Compte introuvable');
        return;
      }
    }
    
    const userId = authData.user.id;
    console.log('✅ Compte auth créé');
    console.log('   User ID:', userId);
    console.log('   Email:', authData.user.email);
    console.log('');
    
    // 2. Créer le profile
    console.log('=== ÉTAPE 2: Créer profile ===');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        role: 'technicien'
      })
      .select();
    
    if (profileError) {
      console.error('❌ Erreur profile:', profileError.message);
      return;
    }
    
    console.log('✅ Profile créé');
    console.log('');
    
    // 3. Assigner la mission
    console.log('=== ÉTAPE 3: Assigner la mission ===');
    const { error: updateError } = await supabase
      .from('missions')
      .update({ technicien_id: userId })
      .eq('id', missionId);
    
    if (updateError) {
      console.error('❌ Erreur assignation:', updateError.message);
      return;
    }
    
    console.log('✅ Mission assignée');
    console.log('');
    console.log('========== SUCCESS ==========');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Mission ID:', missionId.substring(0, 8));
    console.log('');
    console.log('🧪 TESTER:');
    console.log('   URL: http://localhost:3001/technicien/dashboard.html');
    console.log('   Login:', email);
    console.log('   Password:', password);
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

createTechnicienAndAssign();
