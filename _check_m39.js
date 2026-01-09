const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkM39() {
  console.log('🔍 Vérification M39 appliquée\n');
  
  // Vérifier dans supabase_migrations
  const { data: migrations } = await supabase
    .from('supabase_migrations')
    .select('*')
    .eq('name', '20260104001500_m39_fix_rls_mode_diffusion.sql')
    .maybeSingle();
  
  if (migrations) {
    console.log('✅ M39 présente dans supabase_migrations');
    console.log(`   Appliquée le: ${migrations.executed_at}`);
  } else {
    console.log('❌ M39 NON trouvée dans supabase_migrations');
    console.log('   La migration n\'a jamais été appliquée');
  }
}

checkM39().catch(console.error);
