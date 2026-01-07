#!/usr/bin/env node
/**
 * AUDIT FACTURATION - ÉTAPE 5
 * Vérifie le flux complet : mission terminée → facture → régie → admin
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(70));
console.log('AUDIT FACTURATION - ÉTAPE 5');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  tables: {},
  workflow: {},
  issues: [],
  recommendations: []
};

// ============================================================
// 1. VÉRIFIER LES TABLES DE FACTURATION
// ============================================================
async function checkTables() {
  console.log('📋 1. TABLES DE FACTURATION');
  console.log('-'.repeat(70));
  
  const tables = [
    'factures',
    'factures_commissions_jetc',
    'factures_lignes'
  ];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ❌ ${table.padEnd(30)} : ${error.message}`);
        results.tables[table] = { exists: false, error: error.message };
      } else {
        console.log(`  ✅ ${table.padEnd(30)} : ${count} enregistrements`);
        results.tables[table] = { exists: true, count };
      }
    } catch (err) {
      console.log(`  ⚠️  ${table.padEnd(30)} : ${err.message}`);
      results.tables[table] = { exists: false, error: err.message };
    }
  }
  
  console.log();
}

// ============================================================
// 2. VÉRIFIER STRUCTURE TABLE FACTURES
// ============================================================
async function checkFacturesStructure() {
  console.log('🔍 2. STRUCTURE TABLE FACTURES');
  console.log('-'.repeat(70));
  
  const { data: factures, error } = await supabase
    .from('factures')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log(`  ❌ Erreur : ${error.message}`);
    results.issues.push({
      type: 'STRUCTURE_ERROR',
      table: 'factures',
      error: error.message,
      severity: 'CRITIQUE'
    });
    return;
  }
  
  if (factures && factures.length > 0) {
    console.log('  Colonnes disponibles :');
    Object.keys(factures[0]).sort().forEach(col => {
      console.log(`    - ${col}`);
    });
  } else {
    console.log('  ℹ️  Aucune facture existante');
    console.log('  → Création d\'une facture test recommandée');
  }
  
  // Vérifier colonnes critiques
  console.log('\n  Colonnes critiques attendues :');
  const expectedColumns = [
    'mission_id',
    'entreprise_id',
    'regie_id',
    'montant_ht',
    'montant_ttc',
    'tva',
    'statut',
    'numero_facture'
  ];
  
  if (factures && factures.length > 0) {
    expectedColumns.forEach(col => {
      if (col in factures[0]) {
        console.log(`    ✅ ${col}`);
      } else {
        console.log(`    ❌ ${col} - MANQUANTE`);
        results.issues.push({
          type: 'MISSING_COLUMN',
          table: 'factures',
          column: col,
          severity: 'MAJEUR'
        });
      }
    });
  } else {
    console.log('    ⏸️  Impossible de vérifier sans données');
  }
  
  console.log();
}

// ============================================================
// 3. VÉRIFIER COMMISSIONS JETC
// ============================================================
async function checkCommissions() {
  console.log('💰 3. COMMISSIONS JETC (2%)');
  console.log('-'.repeat(70));
  
  const { data: commissions, error, count } = await supabase
    .from('factures_commissions_jetc')
    .select('*', { count: 'exact' });
  
  if (error) {
    console.log(`  ❌ Erreur : ${error.message}`);
    results.issues.push({
      type: 'TABLE_ERROR',
      table: 'factures_commissions_jetc',
      error: error.message,
      severity: 'CRITIQUE'
    });
  } else {
    console.log(`  ✅ Table accessible : ${count} commissions`);
    
    if (commissions && commissions.length > 0) {
      console.log('\n  Exemple de commission :');
      const c = commissions[0];
      console.log(`    Facture ID : ${c.facture_id}`);
      console.log(`    Montant facture : ${c.montant_facture_ttc || 'N/A'}`);
      console.log(`    Commission (2%) : ${c.montant_commission || 'N/A'}`);
      console.log(`    Période : ${c.periode_mois || 'N/A'}/${c.periode_annee || 'N/A'}`);
      
      // Vérifier le calcul
      if (c.montant_facture_ttc && c.montant_commission) {
        const expectedCommission = c.montant_facture_ttc * 0.02;
        const diff = Math.abs(expectedCommission - c.montant_commission);
        
        if (diff < 0.01) {
          console.log(`    ✅ Calcul 2% correct`);
        } else {
          console.log(`    ⚠️  Calcul incorrect : attendu ${expectedCommission.toFixed(2)}, trouvé ${c.montant_commission}`);
        }
      }
    } else {
      console.log('\n  ℹ️  Aucune commission enregistrée');
    }
  }
  
  console.log();
}

// ============================================================
// 4. WORKFLOW FACTURATION
// ============================================================
async function checkWorkflow() {
  console.log('🔄 4. WORKFLOW FACTURATION');
  console.log('-'.repeat(70));
  
  console.log('  Flux attendu :');
  console.log('    1. Mission terminée (statut = terminee)');
  console.log('    2. Entreprise crée facture');
  console.log('    3. Facture envoyée à régie (statut = envoyee)');
  console.log('    4. Admin consolide mensuellement');
  console.log('    5. Commission JETC 2% appliquée');
  console.log();
  
  // Vérifier missions terminées sans facture
  const { data: missionsTerminees, count: mCount } = await supabase
    .from('missions')
    .select('id, statut, completed_at', { count: 'exact' })
    .eq('statut', 'terminee');
  
  console.log(`  Missions terminées : ${mCount || 0}`);
  
  if (missionsTerminees && missionsTerminees.length > 0) {
    // Pour chaque mission terminée, vérifier s'il y a une facture
    for (const mission of missionsTerminees) {
      const { data: facture } = await supabase
        .from('factures')
        .select('id, numero_facture, statut')
        .eq('mission_id', mission.id)
        .single();
      
      if (!facture) {
        console.log(`    ⚠️  Mission ${mission.id.substring(0, 8)}... : Pas de facture créée`);
        results.workflow.missions_without_invoice = (results.workflow.missions_without_invoice || 0) + 1;
      } else {
        console.log(`    ✅ Mission ${mission.id.substring(0, 8)}... : Facture ${facture.numero_facture} (${facture.statut})`);
      }
    }
  } else {
    console.log('  ℹ️  Aucune mission terminée à facturer');
  }
  
  console.log();
}

// ============================================================
// 5. FONCTIONS RPC FACTURATION
// ============================================================
async function checkRPCFunctions() {
  console.log('⚙️  5. FONCTIONS RPC FACTURATION');
  console.log('-'.repeat(70));
  
  const functions = [
    'create_facture',
    'generer_commissions_mensuelles',
    'valider_facture'
  ];
  
  for (const func of functions) {
    try {
      // Test avec des paramètres vides pour vérifier l'existence
      const { data, error } = await supabase.rpc(func, {}).catch(() => ({ error: { message: 'not found' } }));
      
      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.log(`  ❌ ${func.padEnd(35)} : N'existe pas`);
          results.issues.push({
            type: 'MISSING_RPC',
            function: func,
            severity: 'MAJEUR'
          });
        } else {
          console.log(`  ✅ ${func.padEnd(35)} : Existe (erreur params: OK)`);
        }
      } else {
        console.log(`  ✅ ${func.padEnd(35)} : Existe et répond`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${func.padEnd(35)} : Erreur test`);
    }
  }
  
  console.log();
}

// ============================================================
// 6. VUES FACTURATION
// ============================================================
async function checkViews() {
  console.log('👁️  6. VUES FACTURATION');
  console.log('-'.repeat(70));
  
  // Vérifier l'existence de vues utiles
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('id')
    .limit(1)
    .single();
  
  if (entreprise) {
    // Tester si l'entreprise peut voir ses factures
    const { data: factures, error } = await supabase
      .from('factures')
      .select('*')
      .eq('entreprise_id', entreprise.id);
    
    if (!error) {
      console.log(`  ✅ Entreprise peut voir ses factures : ${factures?.length || 0}`);
    } else {
      console.log(`  ❌ Entreprise ne peut pas voir ses factures : ${error.message}`);
    }
  }
  
  console.log();
}

// ============================================================
// 7. RECOMMANDATIONS
// ============================================================
function generateRecommendations() {
  console.log('💡 7. RECOMMANDATIONS');
  console.log('-'.repeat(70));
  
  console.log('\n  Fonctionnalités à vérifier :');
  console.log('    1. Interface entreprise : bouton "Créer facture" après mission terminée');
  console.log('    2. Formulaire facture : saisie main d\'œuvre, matériel, TVA');
  console.log('    3. Calcul automatique TTC = HT + TVA');
  console.log('    4. Numéro de facture auto-généré (ex: FAC-2026-001)');
  console.log('    5. Envoi facture à régie (changement statut brouillon → envoyee)');
  console.log('    6. Vue régie : réception et consultation factures');
  console.log('    7. Admin : consolidation mensuelle automatique');
  console.log('    8. Admin : calcul commission JETC 2% sur chaque facture');
  console.log();
  
  if (results.issues.length > 0) {
    console.log('  ⚠️  Corrections nécessaires :');
    results.issues.forEach((issue, idx) => {
      console.log(`    ${idx + 1}. [${issue.severity}] ${issue.type} - ${issue.table || issue.function || 'N/A'}`);
    });
  }
  
  console.log();
}

// ============================================================
// RÉSUMÉ
// ============================================================
function summary() {
  console.log('='.repeat(70));
  console.log('RÉSUMÉ');
  console.log('='.repeat(70));
  
  const tablesExist = Object.values(results.tables).filter(t => t.exists).length;
  const totalTables = Object.keys(results.tables).length;
  const criticalIssues = results.issues.filter(i => i.severity === 'CRITIQUE').length;
  const majorIssues = results.issues.filter(i => i.severity === 'MAJEUR').length;
  
  console.log(`Tables vérifiées : ${totalTables}`);
  console.log(`Tables existantes : ${tablesExist}`);
  console.log(`Problèmes critiques : ${criticalIssues}`);
  console.log(`Problèmes majeurs : ${majorIssues}`);
  console.log(`Missions sans facture : ${results.workflow.missions_without_invoice || 0}`);
  
  console.log();
  
  // Sauvegarder
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '_AUDIT_FACTURATION_ETAPE5_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
  console.log();
  
  process.exit(criticalIssues > 0 ? 1 : 0);
}

// ============================================================
// EXÉCUTION
// ============================================================
async function run() {
  try {
    await checkTables();
    await checkFacturesStructure();
    await checkCommissions();
    await checkWorkflow();
    await checkRPCFunctions();
    await checkViews();
    generateRecommendations();
    summary();
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();
