#!/usr/bin/env node

/**
 * =====================================================
 * VÉRIFICATION POST-M52
 * =====================================================
 * Vérifie que assign_technicien_to_mission est corrigée
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifyM52() {
  console.log('🔍 VÉRIFICATION POST-M52\n');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Vérifier que la fonction existe
    console.log('\n📋 Test 1: Vérifier existence de la fonction');
    const { data: functions, error: funcError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            p.proname,
            pg_get_functiondef(p.oid) AS definition
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.proname = 'assign_technicien_to_mission';
        `
      })
      .catch(() => ({ data: null, error: 'RPC exec_sql non disponible' }));
    
    if (funcError) {
      console.log('⚠️  Impossible de vérifier via API');
      console.log('   Vérifiez manuellement sur le dashboard Supabase');
      console.log('   SQL Editor > SELECT * FROM pg_proc WHERE proname = \'assign_technicien_to_mission\';\n');
      return;
    }
    
    if (!functions || functions.length === 0) {
      console.log('❌ Fonction assign_technicien_to_mission non trouvée');
      console.log('   La migration M52 n\'a probablement pas été appliquée');
      console.log('   Appliquer via: supabase/migrations/_APPLY_M52_MANUAL.sql\n');
      return;
    }
    
    console.log('✅ Fonction existe\n');
    
    // Test 2: Vérifier les bonnes colonnes
    const definition = functions[0].definition;
    
    console.log('📝 Test 2: Vérifier les noms de colonnes dans INSERT notifications');
    
    const checks = {
      'title': definition.includes('title,') || definition.includes('title\n'),
      'related_mission_id': definition.includes('related_mission_id'),
      'related_ticket_id': definition.includes('related_ticket_id'),
      'mission_assigned': definition.includes('mission_assigned')
    };
    
    // Vérifier qu'on n'a PAS les anciennes colonnes
    const badChecks = {
      'titre': definition.includes('titre,') || definition.includes('titre\n'),
      'mission_id,': definition.includes('mission_id,') && !definition.includes('related_mission_id'),
      'ticket_id,': definition.includes('ticket_id,') && !definition.includes('related_ticket_id')
    };
    
    console.log('\n✅ Colonnes correctes:');
    for (const [col, ok] of Object.entries(checks)) {
      console.log(`   ${ok ? '✅' : '❌'} ${col}`);
    }
    
    console.log('\n❌ Colonnes incorrectes (ne doivent PAS être présentes):');
    for (const [col, present] of Object.entries(badChecks)) {
      console.log(`   ${present ? '❌ PRÉSENT' : '✅ Absent'} ${col}`);
    }
    
    const allGood = Object.values(checks).every(v => v) && Object.values(badChecks).every(v => !v);
    
    if (allGood) {
      console.log('\n🎉 CORRECTION VALIDÉE!');
      console.log('   La fonction assign_technicien_to_mission utilise les bons noms de colonnes');
      console.log('   L\'assignation technicien devrait fonctionner en production\n');
    } else {
      console.log('\n⚠️  ATTENTION: Problème détecté');
      console.log('   Vérifier manuellement la définition de la fonction');
      console.log('   Ou réappliquer la migration M52\n');
    }
    
    // Test 3: Tester l'assignation (si possible)
    console.log('\n🧪 Test 3: Test assignation (facultatif)');
    console.log('   Pour tester en production:');
    console.log('   1. Se connecter en tant qu\'entreprise');
    console.log('   2. Ouvrir une mission en statut "en_attente"');
    console.log('   3. Assigner un technicien');
    console.log('   4. Vérifier qu\'aucune erreur n\'apparaît\n');
    
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

verifyM52()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
