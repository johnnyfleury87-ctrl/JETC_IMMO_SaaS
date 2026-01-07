/**
 * VÉRIFIER LA CONTRAINTE FK missions.technicien_id
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFK() {
  console.log('[DEBUG] VÉRIFICATION FK missions.technicien_id\n');
  
  try {
    // Vérifier si le technicien existe vraiment dans la table référencée
    const targetId = 'e5dc1c44-96b0-49fd-b18e-1b8f539df1a5';
    
    // Test 1: Dans profiles
    const { data: inProfiles } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', targetId)
      .single();
    
    console.log('Dans profiles:');
    if (inProfiles) {
      console.log('  ✅ Existe:', inProfiles.email, inProfiles.role);
    } else {
      console.log('  ❌ N\'existe pas');
    }
    console.log('');
    
    // Test 2: Si FK pointe vers auth.users
    const { data: users } = await supabase.auth.admin.listUsers();
    const inAuth = users.users.find(u => u.id === targetId);
    
    console.log('Dans auth.users:');
    if (inAuth) {
      console.log('  ✅ Existe:', inAuth.email);
    } else {
      console.log('  ❌ N\'existe pas');
    }
    console.log('');
    
    // Vérifier quelle est la vraie contrainte FK
    const { data: fkInfo, error: fkErr } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_name = 'missions'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'technicien_id';
        `
      });
    
    if (fkErr) {
      console.log('⚠️ Impossible de requêter les FK directement');
    } else {
      console.log('Contrainte FK missions.technicien_id:');
      console.log(fkInfo);
    }
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

checkFK();
