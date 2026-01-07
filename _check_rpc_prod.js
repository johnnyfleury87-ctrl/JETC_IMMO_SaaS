#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Vérification RPC get_tickets_dashboard_regie en PROD\n');
  
  // Test direct du RPC
  const { data, error } = await supabase.rpc('get_tickets_dashboard_regie');
  
  if (error) {
    console.log('❌ RPC ABSENT ou ERREUR');
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Details:', error.details);
    console.log('\n⚠️ Migration M22 doit être appliquée\n');
    process.exit(1);
  } else {
    console.log('✅ RPC EXISTE et FONCTIONNE');
    console.log('Résultat:', JSON.stringify(data, null, 2));
    process.exit(0);
  }
})();
