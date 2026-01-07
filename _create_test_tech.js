#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔧 Création compte technicien de test\n');
  
  const testEmail = 'tech.test@jetc.ch';
  const testPassword = 'Test1234!';
  
  // 1. Vérifier si existe déjà
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', testEmail)
    .single();
  
  if (existing) {
    console.log('✅ Compte existe déjà:', existing.email, '(role:', existing.role + ')');
    
    // Test login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (loginError) {
      console.log('⚠️  Login échoué:', loginError.message);
      console.log('   → Le mot de passe a peut-être changé');
    } else {
      console.log('✅ Login OK, token:');
      console.log(loginData.session.access_token.substring(0, 80) + '...\n');
      console.log('🧪 Test curl:');
      console.log(`curl -X POST http://localhost:3000/api/missions/start \\`);
      console.log(`  -H 'Content-Type: application/json' \\`);
      console.log(`  -H 'Authorization: Bearer ${loginData.session.access_token}' \\`);
      console.log(`  -d '{"mission_id":"test-uuid"}'`);
    }
    
    process.exit(0);
  }
  
  // 2. Créer compte test
  console.log('Création compte:', testEmail);
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      role: 'technicien'
    }
  });
  
  if (authError) {
    console.error('❌ Erreur création auth:', authError.message);
    process.exit(1);
  }
  
  console.log('✅ Auth user créé:', authData.user.id);
  
  // 3. Créer profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: testEmail,
      role: 'technicien',
      language: 'fr'
    });
  
  if (profileError) {
    console.error('❌ Erreur création profile:', profileError.message);
    process.exit(1);
  }
  
  console.log('✅ Profile créé\n');
  
  // 4. Login et récupérer token
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (loginError) {
    console.error('❌ Erreur login:', loginError.message);
    process.exit(1);
  }
  
  console.log('✅ Token généré:');
  console.log(loginData.session.access_token.substring(0, 80) + '...\n');
  
  console.log('🧪 Test curl:');
  console.log(`curl -X POST http://localhost:3000/api/missions/start \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H 'Authorization: Bearer ${loginData.session.access_token}' \\`);
  console.log(`  -d '{"mission_id":"test-uuid"}'`);
  
})();
