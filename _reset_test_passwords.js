#!/usr/bin/env node
/**
 * CRÉER/RÉINITIALISER COMPTES DE TEST
 * Pour chaque rôle avec mot de passe connu
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI';

const TEST_PASSWORD = 'TestJetc2026!'; // Nouveau mot de passe unifié pour tous les comptes test

async function resetTestAccounts() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 RÉINITIALISATION COMPTES DE TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`🔑 Mot de passe unifié: ${TEST_PASSWORD}\n`);

  // Récupérer tous les profils
  const { data: profiles } = await supabase.from('profiles').select('id, email, role');

  if (!profiles) {
    console.log('❌ Impossible de récupérer les profils');
    return;
  }

  console.log(`📊 ${profiles.length} profils trouvés\n`);

  for (const profile of profiles) {
    console.log(`\n🔄 ${profile.role.toUpperCase()}: ${profile.email}`);
    console.log(`   User ID: ${profile.id}`);

    try {
      // Tenter de mettre à jour le mot de passe via admin API
      const { data, error } = await supabase.auth.admin.updateUserById(
        profile.id,
        { password: TEST_PASSWORD }
      );

      if (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
      } else {
        console.log(`   ✅ Mot de passe réinitialisé`);
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ RÉINITIALISATION TERMINÉE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 COMPTES DE TEST DISPONIBLES:\n');
  profiles.forEach(p => {
    console.log(`   ${p.role.padEnd(15)} | ${p.email}`);
  });
  console.log(`\n🔑 Mot de passe pour TOUS: ${TEST_PASSWORD}\n`);
}

resetTestAccounts();
