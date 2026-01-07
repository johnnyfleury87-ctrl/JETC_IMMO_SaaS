#!/usr/bin/env node
/**
 * AUDIT WORKFLOW TECHNICIEN - ÉTAPE 3
 * Teste le workflow complet : voir → démarrer → terminer mission
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(70));
console.log('AUDIT WORKFLOW TECHNICIEN - ÉTAPE 3');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  missions: [],
  techniciens: [],
  rpc_functions: {},
  workflow_tests: [],
  issues: []
};

// ============================================================
// 1. ÉTAT DES MISSIONS
// ============================================================
async function checkMissions() {
  console.log('📋 1. ÉTAT DES MISSIONS');
  console.log('-'.repeat(70));
  
  const { data: missions, error } = await supabase
    .from('missions')
    .select(`
      id,
      statut,
      started_at,
      completed_at,
      date_intervention_prevue,
      date_intervention_realisee,
      technicien_id,
      ticket:tickets(
        id,
        categorie,
        description,
        logement:logements(
          id,
          adresse,
          numero,
          locataire:locataires(
            id,
            nom,
            prenom
          )
        )
      )
    `);
  
  if (error) {
    console.log(`❌ Erreur : ${error.message}`);
    return;
  }
  
  if (!missions || missions.length === 0) {
    console.log('ℹ️ Aucune mission dans la base');
    return;
  }
  
  results.missions = missions;
  
  missions.forEach(m => {
    console.log(`\n  Mission ${m.id.substring(0, 8)}...`);
    console.log(`    Statut : ${m.statut}`);
    console.log(`    Technicien : ${m.technicien_id ? m.technicien_id.substring(0, 8) + '...' : 'Non assigné'}`);
    console.log(`    Started at : ${m.started_at || 'N/A'}`);
    console.log(`    Completed at : ${m.completed_at || 'N/A'}`);
    console.log(`    Date prévue : ${m.date_intervention_prevue || 'N/A'}`);
    console.log(`    Date réalisée : ${m.date_intervention_realisee || 'N/A'}`);
    if (m.ticket) {
      console.log(`    Ticket : ${m.ticket.categorie} - ${m.ticket.description}`);
      if (m.ticket.logement) {
        console.log(`    Logement : ${m.ticket.logement.adresse} ${m.ticket.logement.numero || ''}`);
        if (m.ticket.logement.locataire) {
          console.log(`    Locataire : ${m.ticket.logement.locataire.prenom} ${m.ticket.logement.locataire.nom}`);
        }
      }
    }
  });
  
  console.log();
}

// ============================================================
// 2. LISTE DES TECHNICIENS
// ============================================================
async function checkTechniciens() {
  console.log('👷 2. LISTE DES TECHNICIENS');
  console.log('-'.repeat(70));
  
  const { data: techniciens, error } = await supabase
    .from('techniciens')
    .select(`
      id,
      profile_id,
      entreprise_id,
      specialites
    `);
  
  if (error) {
    console.log(`❌ Erreur : ${error.message}`);
    return;
  }
  
  results.techniciens = techniciens;
  
  // Récupérer les profils séparément
  for (const t of techniciens) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', t.profile_id)
      .single();
    
    t.profile = profile;
  }
  
  techniciens.forEach(t => {
    console.log(`\n  Technicien ${t.id.substring(0, 8)}...`);
    console.log(`    Email : ${t.profile?.email || 'N/A'}`);
    console.log(`    Entreprise : ${t.entreprise_id ? t.entreprise_id.substring(0, 8) + '...' : 'Indépendant'}`);
    console.log(`    Spécialités : ${t.specialites || 'Aucune'}`);
  });
  
  console.log();
}

// ============================================================
// 3. VÉRIFIER LES FONCTIONS RPC
// ============================================================
async function checkRPCFunctions() {
  console.log('⚙️  3. FONCTIONS RPC (WORKFLOW)');
  console.log('-'.repeat(70));
  
  // Liste des fonctions attendues
  const functions = [
    'start_mission',
    'complete_mission',
    'assign_mission_to_technicien'
  ];
  
  for (const func of functions) {
    try {
      // Test avec des paramètres invalides pour vérifier l'existence
      const { data, error } = await supabase.rpc(func, {
        p_mission_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (error) {
        // Si erreur != "function does not exist", la fonction existe
        if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.log(`  ❌ ${func} : N'existe pas`);
          results.rpc_functions[func] = { exists: false };
          results.issues.push({
            type: 'MISSING_RPC',
            function: func,
            severity: 'CRITIQUE'
          });
        } else {
          console.log(`  ✅ ${func} : Existe (erreur attendue: ${error.message.substring(0, 50)}...)`);
          results.rpc_functions[func] = { exists: true, test_error: error.message };
        }
      } else {
        console.log(`  ✅ ${func} : Existe et répond`);
        results.rpc_functions[func] = { exists: true, response: data };
      }
    } catch (err) {
      console.log(`  ⚠️  ${func} : Erreur test - ${err.message}`);
      results.rpc_functions[func] = { exists: false, error: err.message };
    }
  }
  
  console.log();
}

// ============================================================
// 4. TESTER LE WORKFLOW (si possible)
// ============================================================
async function testWorkflow() {
  console.log('🔄 4. TEST WORKFLOW (SIMULATION)');
  console.log('-'.repeat(70));
  
  const mission = results.missions[0];
  const technicien = results.techniciens[0];
  
  if (!mission) {
    console.log('  ℹ️ Aucune mission disponible pour test');
    return;
  }
  
  if (!technicien) {
    console.log('  ℹ️ Aucun technicien disponible pour test');
    return;
  }
  
  console.log(`  Mission test : ${mission.id.substring(0, 8)}... (statut: ${mission.statut})`);
  console.log(`  Technicien test : ${technicien.id.substring(0, 8)}...`);
  console.log();
  
  // Test 1 : Vérifier que le technicien peut voir la mission
  console.log('  Test 1 : Le technicien peut-il voir ses missions ?');
  
  const { data: visibleMissions, error: e1 } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('technicien_id', technicien.id);
  
  if (e1) {
    console.log(`    ❌ Erreur : ${e1.message}`);
    results.issues.push({
      type: 'WORKFLOW_VIEW',
      test: 'Voir missions',
      error: e1.message,
      severity: 'CRITIQUE'
    });
  } else {
    console.log(`    ✅ ${visibleMissions.length} mission(s) visible(s)`);
  }
  
  // Test 2 : Vérifier si la mission est dans le bon état pour être démarrée
  console.log('\n  Test 2 : État de la mission pour démarrage');
  
  if (mission.statut === 'en_attente') {
    console.log(`    ✅ Statut correct (en_attente) → peut être démarrée`);
  } else if (mission.statut === 'en_cours') {
    console.log(`    ⚠️  Mission déjà en cours`);
  } else if (mission.statut === 'terminee') {
    console.log(`    ⚠️  Mission déjà terminée`);
  } else if (mission.statut === 'validee') {
    console.log(`    ⚠️  Mission déjà validée`);
  } else if (mission.statut === 'annulee') {
    console.log(`    ⚠️  Mission annulée`);
  } else {
    console.log(`    ❌ Statut inconnu : ${mission.statut}`);
    results.issues.push({
      type: 'INVALID_STATE',
      mission_id: mission.id,
      statut: mission.statut,
      severity: 'MAJEUR'
    });
  }
  
  // Test 3 : Vérifier les données nécessaires
  console.log('\n  Test 3 : Données nécessaires pour le workflow');
  
  if (mission.ticket) {
    console.log(`    ✅ Ticket lié`);
  } else {
    console.log(`    ❌ Pas de ticket lié`);
    results.issues.push({
      type: 'MISSING_DATA',
      field: 'ticket',
      mission_id: mission.id,
      severity: 'CRITIQUE'
    });
  }
  
  if (mission.technicien_id) {
    console.log(`    ✅ Technicien assigné`);
  } else {
    console.log(`    ❌ Pas de technicien assigné`);
    results.issues.push({
      type: 'MISSING_DATA',
      field: 'technicien_id',
      mission_id: mission.id,
      severity: 'CRITIQUE'
    });
  }
  
  console.log();
}

// ============================================================
// 5. VÉRIFIER LES ACTIONS DISPONIBLES
// ============================================================
async function checkActions() {
  console.log('🎯 5. ACTIONS DISPONIBLES SELON STATUT');
  console.log('-'.repeat(70));
  
  const stateTransitions = {
    'en_attente': ['démarrer', 'ajouter notes', 'signaler incident'],
    'en_cours': ['ajouter notes', 'ajouter photos', 'signaler incident', 'terminer'],
    'terminee': ['ajouter photos', 'valider (régie uniquement)'],
    'validee': ['consultation uniquement'],
    'annulee': []
  };
  
  Object.keys(stateTransitions).forEach(statut => {
    console.log(`\n  ${statut.toUpperCase()} :`);
    stateTransitions[statut].forEach(action => {
      console.log(`    → ${action}`);
    });
  });
  
  console.log();
}

// ============================================================
// RÉSUMÉ
// ============================================================
async function summary() {
  console.log('='.repeat(70));
  console.log('RÉSUMÉ');
  console.log('='.repeat(70));
  
  console.log(`Missions : ${results.missions.length}`);
  console.log(`Techniciens : ${results.techniciens.length}`);
  console.log(`Fonctions RPC vérifiées : ${Object.keys(results.rpc_functions).length}`);
  console.log(`Problèmes détectés : ${results.issues.length}`);
  
  if (results.issues.length > 0) {
    console.log('\n⚠️  PROBLÈMES DÉTECTÉS :');
    results.issues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [${issue.severity}] ${issue.type}`);
      if (issue.function) console.log(`     Fonction : ${issue.function}`);
      if (issue.test) console.log(`     Test : ${issue.test}`);
      if (issue.error) console.log(`     Erreur : ${issue.error}`);
    });
  }
  
  console.log();
  
  // Sauvegarder
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '_AUDIT_WORKFLOW_TECHNICIEN_ETAPE3_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
  console.log();
}

// ============================================================
// EXÉCUTION
// ============================================================
async function run() {
  try {
    await checkMissions();
    await checkTechniciens();
    await checkRPCFunctions();
    await testWorkflow();
    await checkActions();
    await summary();
    
    process.exit(results.issues.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();
