// Vérifier définition de la vue tickets_visibles_entreprise en DB
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkViewDefinition() {
  console.log('🔍 Vérification définition vue tickets_visibles_entreprise\n');
  
  // Méthode 1: Query pg_views directement via supabase
  const { data, error } = await supabase
    .from('tickets_visibles_entreprise')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Erreur lecture vue:', error.message);
    return;
  }
  
  console.log('✅ Vue accessible');
  console.log('📌 Colonnes:', Object.keys(data[0] || {}).join(', '));
  
  // Test avec un ticket
  console.log('\n🧪 Test lecture tickets avec mode_diffusion...');
  
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id, titre, mode_diffusion, statut, locked_at')
    .limit(5);
  
  if (ticketsError) {
    console.log('❌ Erreur tickets:', ticketsError.message);
  } else {
    console.log(`\n📊 ${tickets.length} tickets dans la base:`);
    tickets.forEach(t => {
      console.log(`  - ${t.id.substring(0, 8)}... | mode: ${t.mode_diffusion || 'NULL'} | statut: ${t.statut} | locked: ${t.locked_at ? 'OUI' : 'NON'}`);
    });
  }
  
  // Test vue avec filtre entreprise
  console.log('\n🔎 Test vue tickets_visibles_entreprise...');
  
  const { data: vueTickets, error: vueError } = await supabase
    .from('tickets_visibles_entreprise')
    .select('id, titre, mode_diffusion, statut, locked_at, visible_par_entreprise_id')
    .limit(5);
  
  if (vueError) {
    console.log('❌ Erreur vue:', vueError.message);
  } else {
    console.log(`\n✅ ${vueTickets.length} tickets visibles dans la vue`);
    if (vueTickets.length > 0) {
      vueTickets.forEach(t => {
        console.log(`  - ${t.id.substring(0, 8)}... | mode: ${t.mode_diffusion || 'NULL'} | statut: ${t.statut} | locked: ${t.locked_at ? 'OUI' : 'NON'}`);
      });
    } else {
      console.log('  ⚠️  Aucun ticket visible (possible si vue utilise ancienne terminologie)');
    }
  }
  
  // Diagnostic final
  console.log('\n📋 DIAGNOSTIC:');
  if (tickets && tickets.length > 0 && tickets[0].mode_diffusion) {
    const modeDiffusion = tickets[0].mode_diffusion;
    if (modeDiffusion === 'general' || modeDiffusion === 'restreint') {
      console.log('✅ Tickets utilisent NOUVELLE terminologie (general/restreint)');
      if (!vueTickets || vueTickets.length === 0) {
        console.log('❌ PROBLÈME: Vue ne retourne rien → Vue utilise probablement ANCIENNE terminologie');
        console.log('🔧 SOLUTION: Appliquer ou ré-appliquer migration M37');
      } else {
        console.log('✅ Vue fonctionne correctement');
      }
    } else if (modeDiffusion === 'public' || modeDiffusion === 'assigné') {
      console.log('⚠️  Tickets utilisent ANCIENNE terminologie (public/assigné)');
      console.log('🔧 SOLUTION: Appliquer migration M35 pour harmoniser les données');
    }
  }
}

checkViewDefinition().catch(console.error);
