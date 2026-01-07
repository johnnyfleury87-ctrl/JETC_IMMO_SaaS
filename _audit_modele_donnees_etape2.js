#!/usr/bin/env node
/**
 * AUDIT MODÈLE DE DONNÉES - ÉTAPE 2
 * Vérifie la cohérence du schéma et des relations SQL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Configuration Supabase manquante');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(70));
console.log('AUDIT MODÈLE DE DONNÉES - ÉTAPE 2');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  schema_check: {},
  relations: {},
  orphans: {},
  inconsistencies: [],
  summary: {}
};

// ============================================================
// 1. VÉRIFICATION DU SCHÉMA
// ============================================================
async function checkSchema() {
  console.log('📋 1. VÉRIFICATION DU SCHÉMA');
  console.log('-'.repeat(70));
  
  const tables = [
    'profiles',
    'techniciens',
    'entreprises',
    'missions',
    'tickets',
    'logements',
    'locataires',
    'immeubles',
    'regies'
  ];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ❌ ${table} : Erreur - ${error.message}`);
        results.schema_check[table] = { exists: false, error: error.message };
      } else {
        console.log(`  ✅ ${table} : ${count} enregistrements`);
        results.schema_check[table] = { exists: true, count };
      }
    } catch (err) {
      console.log(`  ❌ ${table} : Exception - ${err.message}`);
      results.schema_check[table] = { exists: false, error: err.message };
    }
  }
  
  console.log();
}

// ============================================================
// 2. VÉRIFICATION DES RELATIONS (Clés étrangères)
// ============================================================
async function checkRelations() {
  console.log('🔗 2. VÉRIFICATION DES RELATIONS');
  console.log('-'.repeat(70));
  
  // Relation : profiles → techniciens
  console.log('  Relation : profiles → techniciens (via profile_id)');
  const { data: techWithoutProfile, error: e1 } = await supabase
    .from('techniciens')
    .select('id, profile_id')
    .is('profile_id', null);
  
  if (!e1) {
    console.log(`    ${techWithoutProfile.length === 0 ? '✅' : '⚠️'} Techniciens sans profile_id : ${techWithoutProfile.length}`);
    results.relations.techniciens_without_profile = techWithoutProfile.length;
  }
  
  // Relation : techniciens → missions
  console.log('  Relation : techniciens → missions (via technicien_id)');
  const { data: missionsWithoutTech, error: e2 } = await supabase
    .from('missions')
    .select('id, technicien_id')
    .is('technicien_id', null);
  
  if (!e2) {
    console.log(`    ℹ️ Missions sans technicien_id (normal si non assignées) : ${missionsWithoutTech.length}`);
    results.relations.missions_without_technicien = missionsWithoutTech.length;
  }
  
  // Relation : missions → tickets
  console.log('  Relation : missions → tickets (via ticket_id)');
  const { data: missionsWithoutTicket, error: e3 } = await supabase
    .from('missions')
    .select('id, ticket_id')
    .is('ticket_id', null);
  
  if (!e3) {
    console.log(`    ${missionsWithoutTicket.length === 0 ? '✅' : '❌'} Missions sans ticket_id : ${missionsWithoutTicket.length}`);
    results.relations.missions_without_ticket = missionsWithoutTicket.length;
    if (missionsWithoutTicket.length > 0) {
      results.inconsistencies.push({
        type: 'MISSING_FK',
        table: 'missions',
        column: 'ticket_id',
        count: missionsWithoutTicket.length,
        severity: 'CRITIQUE'
      });
    }
  }
  
  // Relation : tickets → logements
  console.log('  Relation : tickets → logements (via logement_id)');
  const { data: ticketsWithoutLogement, error: e4 } = await supabase
    .from('tickets')
    .select('id, logement_id')
    .is('logement_id', null);
  
  if (!e4) {
    console.log(`    ${ticketsWithoutLogement.length === 0 ? '✅' : '⚠️'} Tickets sans logement_id : ${ticketsWithoutLogement.length}`);
    results.relations.tickets_without_logement = ticketsWithoutLogement.length;
    if (ticketsWithoutLogement.length > 0) {
      results.inconsistencies.push({
        type: 'MISSING_FK',
        table: 'tickets',
        column: 'logement_id',
        count: ticketsWithoutLogement.length,
        severity: 'MAJEUR'
      });
    }
  }
  
  // Relation : logements → locataires
  console.log('  Relation : logements → locataires (via locataire_id)');
  const { data: logementsWithoutLocataire, error: e5 } = await supabase
    .from('logements')
    .select('id, locataire_id')
    .is('locataire_id', null);
  
  if (!e5) {
    console.log(`    ℹ️ Logements sans locataire_id (normal si vacant) : ${logementsWithoutLocataire.length}`);
    results.relations.logements_without_locataire = logementsWithoutLocataire.length;
  }
  
  // Relation : logements → immeubles
  console.log('  Relation : logements → immeubles (via immeuble_id)');
  const { data: logementsWithoutImmeuble, error: e6 } = await supabase
    .from('logements')
    .select('id, immeuble_id')
    .is('immeuble_id', null);
  
  if (!e6) {
    console.log(`    ${logementsWithoutImmeuble.length === 0 ? '✅' : '❌'} Logements sans immeuble_id : ${logementsWithoutImmeuble.length}`);
    results.relations.logements_without_immeuble = logementsWithoutImmeuble.length;
    if (logementsWithoutImmeuble.length > 0) {
      results.inconsistencies.push({
        type: 'MISSING_FK',
        table: 'logements',
        column: 'immeuble_id',
        count: logementsWithoutImmeuble.length,
        severity: 'CRITIQUE'
      });
    }
  }
  
  console.log();
}

// ============================================================
// 3. VÉRIFICATION DES DONNÉES ORPHELINES
// ============================================================
async function checkOrphans() {
  console.log('🔍 3. VÉRIFICATION DES DONNÉES ORPHELINES');
  console.log('-'.repeat(70));
  
  // Missions avec technicien_id invalide
  console.log('  Vérifie : Missions avec technicien_id invalide');
  const { data: allMissions } = await supabase
    .from('missions')
    .select('id, technicien_id')
    .not('technicien_id', 'is', null);
  
  if (allMissions && allMissions.length > 0) {
    const { data: validTechIds } = await supabase
      .from('techniciens')
      .select('id');
    
    const validIds = new Set(validTechIds.map(t => t.id));
    const orphanMissions = allMissions.filter(m => !validIds.has(m.technicien_id));
    
    console.log(`    ${orphanMissions.length === 0 ? '✅' : '❌'} Missions orphelines (technicien invalide) : ${orphanMissions.length}`);
    results.orphans.missions_invalid_technicien = orphanMissions.length;
    
    if (orphanMissions.length > 0) {
      results.inconsistencies.push({
        type: 'ORPHAN_FK',
        table: 'missions',
        column: 'technicien_id',
        count: orphanMissions.length,
        severity: 'CRITIQUE',
        sample: orphanMissions.slice(0, 3).map(m => m.id)
      });
    }
  }
  
  // Tickets avec logement_id invalide
  console.log('  Vérifie : Tickets avec logement_id invalide');
  const { data: allTickets } = await supabase
    .from('tickets')
    .select('id, logement_id')
    .not('logement_id', 'is', null);
  
  if (allTickets && allTickets.length > 0) {
    const { data: validLogementIds } = await supabase
      .from('logements')
      .select('id');
    
    const validIds = new Set(validLogementIds.map(l => l.id));
    const orphanTickets = allTickets.filter(t => !validIds.has(t.logement_id));
    
    console.log(`    ${orphanTickets.length === 0 ? '✅' : '❌'} Tickets orphelins (logement invalide) : ${orphanTickets.length}`);
    results.orphans.tickets_invalid_logement = orphanTickets.length;
    
    if (orphanTickets.length > 0) {
      results.inconsistencies.push({
        type: 'ORPHAN_FK',
        table: 'tickets',
        column: 'logement_id',
        count: orphanTickets.length,
        severity: 'CRITIQUE',
        sample: orphanTickets.slice(0, 3).map(t => t.id)
      });
    }
  }
  
  console.log();
}

// ============================================================
// 4. VÉRIFICATION DES ÉTATS DE MISSIONS
// ============================================================
async function checkMissionStates() {
  console.log('📊 4. VÉRIFICATION DES ÉTATS DE MISSIONS');
  console.log('-'.repeat(70));
  
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, statut, date_debut, date_fin');
  
  if (!error && missions) {
    const states = {};
    missions.forEach(m => {
      states[m.statut] = (states[m.statut] || 0) + 1;
    });
    
    console.log('  États des missions :');
    Object.keys(states).sort().forEach(statut => {
      console.log(`    ${statut.padEnd(20)} : ${states[statut]}`);
    });
    
    results.mission_states = states;
    
    // Vérifier incohérences
    const incoherent = missions.filter(m => 
      (m.statut === 'en_cours' && !m.date_debut) ||
      (m.statut === 'terminee' && !m.date_fin)
    );
    
    if (incoherent.length > 0) {
      console.log(`  ⚠️ Missions avec dates incohérentes : ${incoherent.length}`);
      results.inconsistencies.push({
        type: 'INCOHERENT_STATE',
        table: 'missions',
        count: incoherent.length,
        severity: 'MAJEUR'
      });
    }
  }
  
  console.log();
}

// ============================================================
// EXÉCUTION
// ============================================================
async function run() {
  try {
    await checkSchema();
    await checkRelations();
    await checkOrphans();
    await checkMissionStates();
    
    // Résumé
    console.log('='.repeat(70));
    console.log('RÉSUMÉ');
    console.log('='.repeat(70));
    
    const criticalCount = results.inconsistencies.filter(i => i.severity === 'CRITIQUE').length;
    const majorCount = results.inconsistencies.filter(i => i.severity === 'MAJEUR').length;
    
    results.summary = {
      total_inconsistencies: results.inconsistencies.length,
      critical: criticalCount,
      major: majorCount,
      tables_checked: Object.keys(results.schema_check).length,
      tables_ok: Object.values(results.schema_check).filter(t => t.exists).length
    };
    
    console.log(`Tables vérifiées : ${results.summary.tables_checked}`);
    console.log(`Tables OK : ${results.summary.tables_ok}`);
    console.log(`Incohérences CRITIQUES : ${criticalCount}`);
    console.log(`Incohérences MAJEURES : ${majorCount}`);
    console.log();
    
    if (results.inconsistencies.length > 0) {
      console.log('⚠️ INCOHÉRENCES DÉTECTÉES :');
      results.inconsistencies.forEach((inc, idx) => {
        console.log(`  ${idx + 1}. [${inc.severity}] ${inc.type} - ${inc.table}.${inc.column || ''}`);
        console.log(`     Nombre : ${inc.count}`);
        if (inc.sample) {
          console.log(`     Exemples : ${inc.sample.join(', ')}`);
        }
      });
      console.log();
    }
    
    // Sauvegarder
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '_AUDIT_MODELE_DONNEES_ETAPE2_RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
    console.log();
    
    process.exit(results.inconsistencies.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();
