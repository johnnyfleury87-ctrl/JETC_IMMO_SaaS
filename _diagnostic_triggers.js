#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAndTest() {
  console.log('===== DIAGNOSTIC COMPLET =====\n');
  
  // 1. Vérifier l'existence des triggers
  console.log('1️⃣  Listage des triggers...\n');
  
  const { data: triggersData, error: triggersError } = await supabase
    .from('pg_trigger')
    .select('*')
    .limit(5);
  
  console.log('Résultat triggers:', triggersError || 'Table non accessible directement');
  
  // 2. Essayer de DROP + RECREATE le trigger problématique
  console.log('\n2️⃣  Tentative suppression trigger...\n');
  
  try {
    // Via ALTER TABLE (ne nécessite pas exec RPC)
    const dropResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query: 'DROP TRIGGER IF EXISTS mission_status_change_notification ON missions'
      })
    });
    
    console.log('Drop trigger response:', dropResponse.status);
  } catch (e) {
    console.log('Drop failed (expected)');
  }
  
  // 3. Test direct UPDATE sans trigger
  console.log('\n3️⃣  Test UPDATE direct...\n');
  
  const { data: missions } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (missions && missions.length > 0) {
    const missionId = missions[0].id;
    
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
      console.log('\n⚠️  Le trigger est toujours actif et référence une colonne inexistante');
      console.log('');
      console.log('SOLUTION MANUELLE REQUISE:');
      console.log('');
      console.log('1. Ouvrez Supabase Dashboard SQL Editor:');
      console.log(`   https://supabase.com/dashboard/project/${supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]}/sql`);
      console.log('');
      console.log('2. Exécutez ces commandes:');
      console.log('');
      console.log('   DROP TRIGGER IF EXISTS mission_status_change_notification ON missions;');
      console.log('   DROP TRIGGER IF EXISTS trigger_mission_technicien_assignment ON missions;');
      console.log('');
      console.log('3. Puis appliquez le correctif depuis _fix_trigger_reference.sql');
      console.log('');
    } else {
      console.log('✅ UPDATE Success! Mission passée à en_cours');
      console.log('Mission:', updateData[0].id.substring(0, 13), '→', updateData[0].statut);
      
      // Rollback pour re-tester
      await supabase
        .from('missions')
        .update({ statut: 'en_attente', started_at: null })
        .eq('id', missionId);
      
      console.log('↩️  Rollback effectué pour permettre nouveaux tests');
    }
  }
}

fixAndTest().catch(console.error);
