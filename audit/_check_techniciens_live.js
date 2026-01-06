// Vérifier les techniciens disponibles
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkTechniciens() {
  console.log('🔍 VÉRIFICATION TECHNICIENS DISPONIBLES\n');
  
  // 1. Lister tous les techniciens
  const { data: techniciens, error: techError } = await supabase
    .from('techniciens')
    .select('*');
  
  if (techError) {
    console.log('❌ Erreur lecture techniciens:', techError.message);
    return;
  }
  
  console.log(`✅ ${techniciens.length} techniciens trouvés\n`);
  
  for (const tech of techniciens) {
    console.log('━'.repeat(70));
    console.log(`👤 ${tech.prenom} ${tech.nom}`);
    console.log(`   ID: ${tech.id}`);
    console.log(`   Entreprise: ${tech.entreprise_id}`);
    console.log(`   Actif: ${tech.actif !== undefined ? tech.actif : 'N/A (colonne inexistante)'}`);
    console.log(`   Profile ID: ${tech.profile_id || 'NULL'}`);
    console.log(`   Téléphone: ${tech.telephone || 'N/A'}`);
  }
  
  // 2. Lister les missions en attente
  console.log('\n\n📋 MISSIONS EN ATTENTE\n');
  
  const { data: missions, error: missError } = await supabase
    .from('missions')
    .select('*')
    .eq('statut', 'en_attente');
  
  if (missError) {
    console.log('❌ Erreur lecture missions:', missError.message);
  } else {
    console.log(`✅ ${missions.length} missions en attente\n`);
    
    for (const miss of missions) {
      console.log('━'.repeat(70));
      console.log(`📌 Mission ${miss.id}`);
      console.log(`   Entreprise: ${miss.entreprise_id}`);
      console.log(`   Technicien assigné: ${miss.technicien_id || 'AUCUN'}`);
      console.log(`   Statut: ${miss.statut}`);
    }
  }
  
  // 3. Vérifier correspondance entreprise
  if (missions.length > 0 && techniciens.length > 0) {
    console.log('\n\n🔗 CORRESPONDANCE ENTREPRISE-TECHNICIEN\n');
    
    const mission = missions[0];
    console.log(`Mission entreprise_id: ${mission.entreprise_id}`);
    
    const matchingTech = techniciens.filter(t => t.entreprise_id === mission.entreprise_id);
    console.log(`Techniciens de la même entreprise: ${matchingTech.length}`);
    
    if (matchingTech.length > 0) {
      console.log('\n✅ Techniciens compatibles:');
      matchingTech.forEach(t => {
        console.log(`   - ${t.prenom} ${t.nom} (${t.id})`);
        console.log(`     Actif: ${t.actif !== undefined ? t.actif : 'N/A'}`);
      });
    } else {
      console.log('❌ Aucun technicien de cette entreprise');
    }
  }
}

checkTechniciens().catch(console.error);
