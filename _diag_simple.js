#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagComplet() {
  console.log('===== DIAGNOSTIC SCHÉMA COMPLET =====\n');
  console.log('URL:', supabaseUrl);
  console.log('');
  
  // 1. Test simple UPDATE
  console.log('1️⃣  Test UPDATE missions...\n');
  
  const { data: missions } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (!missions || missions.length === 0) {
    console.log('⚠️  Aucune mission en_attente');
    return;
  }
  
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
    console.log('❌ UPDATE ÉCHOUÉ\n');
    console.log('Code:', updateError.code);
    console.log('Message:', updateError.message);
    console.log('Details:', updateError.details || 'N/A');
    
    console.log('\n📋 DIAGNOSTIC:');
    if (updateError.code === '23503') {
      console.log('   Type: FK violation');
      console.log('   Table: mission_historique_statuts');
      console.log('   Colonne: change_par');
      console.log('   Cause: log_mission_statut_change() insère UUID fake');
      console.log('');
      console.log('   SOLUTION: Appliquer _fix_trigger_reference.sql');
      console.log('   Mais AVANT, il faut DROP les triggers existants!');
    } else if (updateError.code === '42703') {
      console.log('   Type: Colonne inexistante');
      console.log('   Cause: Trigger accède à NEW.reference');
      console.log('   Solution: Appliquer _fix_trigger_reference.sql');
    }
    
    // 2. Vérifier si change_par est nullable
    console.log('\n2️⃣  Vérification change_par nullable...\n');
    
    const { data: historique } = await supabase
      .from('mission_historique_statuts')
      .select('*')
      .limit(1);
    
    if (historique && historique.length > 0) {
      console.log('Colonnes:', Object.keys(historique[0]).join(', '));
    } else {
      console.log('Table vide - impossible de vérifier structure');
    }
    
  } else {
    console.log('✅ UPDATE RÉUSSI!\n');
    console.log('Nouveau statut:', updateData[0]?.statut);
    console.log('Started_at:', updateData[0]?.started_at);
    console.log('\n🎉 Les triggers fonctionnent correctement!');
    console.log('   Le bouton "Démarrer Mission" devrait être opérationnel.');
    
    // Rollback
    await supabase
      .from('missions')
      .update({ statut: 'en_attente', started_at: null })
      .eq('id', missionId);
    console.log('\n↩️  Rollback effectué');
  }
  
  console.log('\n=====================================');
}

diagComplet().catch(console.error);
