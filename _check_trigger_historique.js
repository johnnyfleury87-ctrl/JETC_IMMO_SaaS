#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistorique() {
  console.log('===== DIAGNOSTIC MISSION_HISTORIQUE_STATUTS =====\n');
  
  // 1. Vérifier si la table existe
  console.log('1️⃣  Vérification table mission_historique_statuts...\n');
  const { data: tableCheck, error: tableError } = await supabase
    .from('mission_historique_statuts')
    .select('*')
    .limit(1);
  
  if (tableError) {
    console.log('❌ Table non trouvée ou inaccessible:', tableError.message);
    if (tableError.code === '42P01') {
      console.log('   → La table n\'existe pas encore');
      console.log('   → Le trigger log_mission_statut_change() est probablement désactivé ou inexistant');
    }
  } else {
    console.log('✅ Table existe');
    console.log('   Enregistrements:', tableCheck?.length || 0);
  }
  
  // 2. Tester UPDATE sans le trigger
  console.log('\n2️⃣  Test UPDATE missions (pour déclencher le trigger)...\n');
  
  const { data: missions } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (missions && missions.length > 0) {
    const missionId = missions[0].id;
    console.log('Mission test:', missionId.substring(0, 13) + '...');
    
    const { data: updateData, error: updateError } = await supabase
      .from('missions')
      .update({ 
        statut: 'en_cours',
        started_at: new Date().toISOString()
      })
      .eq('id', missionId)
      .select();
    
    if (updateError) {
      console.error('❌ UPDATE Error:', updateError);
      console.log('\nDétails:');
      console.log('  Code    :', updateError.code);
      console.log('  Message :', updateError.message);
      console.log('  Details :', updateError.details);
      
      if (updateError.code === '23503') {
        console.log('\n⚠️  VIOLATION FK DÉTECTÉE');
        console.log('  → Le trigger log_mission_statut_change() insère dans mission_historique_statuts');
        console.log('  → Avec change_par = COALESCE(auth.uid(), \'00000000-0000-0000-0000-000000000000\')');
        console.log('  → Mais cet UUID fake n\'existe pas dans la table users');
      }
    } else {
      console.log('✅ UPDATE Success!');
      console.log('   Nouveau statut:', updateData[0]?.statut);
      
      // Rollback
      await supabase
        .from('missions')
        .update({ statut: 'en_attente', started_at: null })
        .eq('id', missionId);
      console.log('↩️  Rollback effectué');
    }
  }
}

checkHistorique().catch(console.error);
