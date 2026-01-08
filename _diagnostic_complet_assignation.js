const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnosticComplet() {
  console.log('🔍 DIAGNOSTIC COMPLET ASSIGNATION TECHNICIEN');
  console.log('='.repeat(60));
  
  const results = {
    policies: {},
    rpc_function: {},
    test_data: {},
    test_workflow: {}
  };

  try {
    // 1. Vérifier les policies RLS en production
    console.log('\n📋 1. VÉRIFICATION POLICIES RLS');
    console.log('-'.repeat(60));
    
    const { data: policiesData, error: policiesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          cmd,
          qual::text as using_clause
        FROM pg_policies
        WHERE tablename IN ('missions', 'techniciens')
        ORDER BY tablename, policyname;
      `
    });

    if (policiesError) {
      console.log('❌ exec_sql non disponible, utilisation query directe...');
      
      // Alternative : vérifier via une requête qui va déclencher les policies
      const { data: testMissions, error: testError } = await supabase
        .from('missions')
        .select('id, statut, technicien_id, entreprise_id')
        .limit(1);
      
      if (testError) {
        console.error('❌ Erreur test missions:', testError.message);
        results.policies.missions_error = testError.message;
      } else {
        console.log('✅ SELECT missions fonctionne');
        results.policies.missions_ok = true;
      }
      
      const { data: testTech, error: testTechError } = await supabase
        .from('techniciens')
        .select('id, nom, prenom, entreprise_id')
        .limit(1);
      
      if (testTechError) {
        console.error('❌ Erreur test techniciens:', testTechError.message);
        results.policies.techniciens_error = testTechError.message;
      } else {
        console.log('✅ SELECT techniciens fonctionne');
        results.policies.techniciens_ok = true;
      }
    } else {
      console.log('✅ Policies récupérées');
      results.policies.data = policiesData;
    }

    // 2. Vérifier que la fonction RPC existe
    console.log('\n📋 2. VÉRIFICATION FONCTION RPC');
    console.log('-'.repeat(60));
    
    const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          p.proname as function_name,
          pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'assign_technicien_to_mission';
      `
    });

    if (funcError) {
      console.log('⚠️ exec_sql non disponible pour fonctions');
      // Tester directement la fonction
      console.log('🧪 Test direct de la fonction RPC...');
    } else if (funcData && funcData.length > 0) {
      console.log('✅ Fonction assign_technicien_to_mission existe');
      results.rpc_function.exists = true;
    } else {
      console.error('❌ Fonction assign_technicien_to_mission INTROUVABLE');
      results.rpc_function.exists = false;
    }

    // 3. Récupérer données de test réelles
    console.log('\n📋 3. RÉCUPÉRATION DONNÉES TEST');
    console.log('-'.repeat(60));
    
    // Trouver une mission en_attente sans technicien
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select('id, ticket_id, entreprise_id, technicien_id, statut, tickets(categorie, sous_categorie)')
      .eq('statut', 'en_attente')
      .is('technicien_id', null)
      .limit(5);

    if (missionsError) {
      console.error('❌ Erreur récup missions:', missionsError.message);
      results.test_data.missions_error = missionsError.message;
    } else if (!missions || missions.length === 0) {
      console.log('⚠️ Aucune mission en_attente sans technicien trouvée');
      results.test_data.no_missions = true;
    } else {
      console.log(`✅ ${missions.length} mission(s) en_attente disponible(s)`);
      results.test_data.missions = missions;
      
      // Pour chaque mission, trouver techniciens disponibles
      for (const mission of missions.slice(0, 1)) { // Prendre la première seulement
        console.log(`\n  Mission ID: ${mission.id}`);
        console.log(`  Entreprise ID: ${mission.entreprise_id}`);
        console.log(`  Catégorie: ${mission.tickets?.categorie || 'N/A'}`);
        
        const { data: techniciens, error: techError } = await supabase
          .from('techniciens')
          .select('id, nom, prenom, entreprise_id, actif, specialites')
          .eq('entreprise_id', mission.entreprise_id)
          .eq('actif', true);

        if (techError) {
          console.error('  ❌ Erreur récup techniciens:', techError.message);
          results.test_data.techniciens_error = techError.message;
        } else if (!techniciens || techniciens.length === 0) {
          console.log('  ⚠️ Aucun technicien trouvé pour cette entreprise');
        } else {
          console.log(`  ✅ ${techniciens.length} technicien(s) disponible(s)`);
          results.test_data.mission_test = mission;
          results.test_data.techniciens = techniciens;
        }
      }
    }

    // 4. Test assignation si données disponibles
    if (results.test_data.mission_test && results.test_data.techniciens?.length > 0) {
      console.log('\n📋 4. TEST ASSIGNATION TECHNICIEN');
      console.log('-'.repeat(60));
      
      const mission = results.test_data.mission_test;
      const technicien = results.test_data.techniciens[0];
      
      console.log(`\n🧪 Test: Assigner technicien ${technicien.id} (${technicien.nom}) à mission ${mission.id}`);
      
      const { data: assignData, error: assignError } = await supabase
        .rpc('assign_technicien_to_mission', {
          p_mission_id: mission.id,
          p_technicien_id: technicien.id
        });

      if (assignError) {
        console.error('\n❌ ERREUR ASSIGNATION:');
        console.error('Message:', assignError.message);
        console.error('Details:', assignError.details);
        console.error('Hint:', assignError.hint);
        console.error('Code:', assignError.code);
        
        results.test_workflow.error = {
          message: assignError.message,
          details: assignError.details,
          hint: assignError.hint,
          code: assignError.code
        };
        
        // Analyser l'erreur
        if (assignError.message.includes('user_id')) {
          console.error('\n🔥 PROBLÈME: Erreur "user_id" détectée');
          console.error('🔍 Les policies RLS utilisent encore "user_id"');
          console.error('💡 M46 n\'a pas été appliquée correctement ou policies ont été recréées');
        } else if (assignError.message.includes('planifiee')) {
          console.error('\n🔥 PROBLÈME: Erreur "planifiee" détectée');
          console.error('🔍 Code utilise encore statut invalide');
        } else if (assignError.message.includes('permission')) {
          console.error('\n🔥 PROBLÈME: Erreur de permission');
          console.error('🔍 RLS bloque l\'opération');
        }
      } else {
        console.log('\n✅ ASSIGNATION RÉUSSIE!');
        console.log('Résultat:', JSON.stringify(assignData, null, 2));
        results.test_workflow.success = true;
        results.test_workflow.data = assignData;
        
        // Vérifier l'état de la mission après
        const { data: updatedMission, error: checkError } = await supabase
          .from('missions')
          .select('id, technicien_id, statut')
          .eq('id', mission.id)
          .single();
        
        if (!checkError) {
          console.log('\n📊 État mission après assignation:');
          console.log('  Technicien ID:', updatedMission.technicien_id);
          console.log('  Statut:', updatedMission.statut);
          results.test_workflow.final_state = updatedMission;
        }
      }
    } else {
      console.log('\n⚠️ 4. TEST ASSIGNATION - SKIP');
      console.log('Raison: Pas de données de test disponibles');
    }

    // 5. Diagnostic des policies via tentative UPDATE
    console.log('\n📋 5. TEST DIRECT POLICIES');
    console.log('-'.repeat(60));
    
    if (results.test_data.mission_test) {
      const mission = results.test_data.mission_test;
      
      // Tenter un UPDATE simple (sans passer par RPC)
      console.log('\n🧪 Test UPDATE direct sur missions...');
      const { data: updateData, error: updateError } = await supabase
        .from('missions')
        .update({ 
          notes: 'Test diagnostic - ' + new Date().toISOString()
        })
        .eq('id', mission.id)
        .select();

      if (updateError) {
        console.error('❌ Erreur UPDATE direct:', updateError.message);
        results.test_workflow.update_error = updateError.message;
        
        if (updateError.message.includes('user_id')) {
          console.error('\n🔥 CONFIRMATION: Policy UPDATE missions utilise "user_id"');
          console.error('📝 Policy concernée: "Entreprise can update own missions"');
        }
      } else {
        console.log('✅ UPDATE direct fonctionne');
        results.test_workflow.update_ok = true;
      }
    }

  } catch (error) {
    console.error('\n💥 ERREUR FATALE:', error.message);
    results.fatal_error = error.message;
  }

  // RAPPORT FINAL
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL');
  console.log('='.repeat(60));
  
  // Écrire le rapport
  const fs = require('fs');
  fs.writeFileSync(
    '_DIAGNOSTIC_ASSIGNATION_RESULTS.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n✅ Rapport sauvegardé: _DIAGNOSTIC_ASSIGNATION_RESULTS.json');
  
  // Résumé
  console.log('\n📋 RÉSUMÉ:');
  if (results.test_workflow.error) {
    console.log('\n❌ ERREUR BLOQUANTE:');
    console.log('   Message:', results.test_workflow.error.message);
    
    if (results.test_workflow.error.message.includes('user_id')) {
      console.log('\n💡 SOLUTION:');
      console.log('   1. Les policies RLS utilisent encore "user_id"');
      console.log('   2. M46 doit être appliquée via SQL Editor Dashboard');
      console.log('   3. Ou policies ont été recréées après M46');
    }
  } else if (results.test_workflow.success) {
    console.log('\n✅ WORKFLOW FONCTIONNEL!');
    console.log('   Assignation technicien: OK');
    console.log('   Statut final:', results.test_workflow.final_state?.statut);
  } else {
    console.log('\n⚠️ Tests incomplets (manque de données)');
  }
}

diagnosticComplet().catch(console.error);
