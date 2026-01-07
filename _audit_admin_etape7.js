#!/usr/bin/env node
/**
 * AUDIT DASHBOARD ADMIN - ÉTAPE 7
 * Vérifie l'état actuel de la vue Admin JETC
 * 
 * EXIGENCES PDF :
 * - Compteurs temps réel : régies, entreprises, techniciens, locataires, propriétaires
 * - Interventions par régie (nombre)
 * - Factures mensuelles détaillées avec commission 2%
 * - Vérifier Supabase Realtime et connexions actives
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('AUDIT VUE ADMIN JETC - ÉTAPE 7');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  dashboard_exists: false,
  features: {},
  missing_features: [],
  issues: [],
  summary: {}
};

// ============================================================
// 1. VÉRIFIER DASHBOARD ADMIN
// ============================================================
function checkAdminDashboard() {
  console.log('📊 1. DASHBOARD ADMIN');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  
  if (!fs.existsSync(dashboardPath)) {
    console.log('  ❌ CRITIQUE : Dashboard admin introuvable');
    results.dashboard_exists = false;
    results.issues.push({
      type: 'MISSING_FILE',
      severity: 'CRITIQUE',
      file: 'public/admin/dashboard.html'
    });
    return false;
  }
  
  console.log('  ✅ Dashboard admin existe');
  results.dashboard_exists = true;
  
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  // Analyser le contenu
  const features = {
    stats_regies: content.includes('régies') || content.includes('regies'),
    stats_entreprises: content.includes('entreprises'),
    stats_techniciens: content.includes('techniciens'),
    stats_locataires: content.includes('locataires'),
    stats_proprietaires: content.includes('propriétaires'),
    interventions_par_regie: content.includes('interventions') && content.includes('régie'),
    factures_mensuelles: content.includes('factures') || content.includes('facturation'),
    commission_2pct: content.includes('2%') || content.includes('commission'),
    supabase_realtime: content.includes('realtime') || content.includes('subscribe'),
    load_stats_function: content.includes('loadStats') || content.includes('loadStatistiques')
  };
  
  console.log('\n  Fonctionnalités détectées :');
  Object.entries(features).forEach(([key, found]) => {
    const status = found ? '✅' : '❌';
    console.log(`    ${status} ${key}`);
    results.features[key] = found;
  });
  
  return true;
}

// ============================================================
// 2. VÉRIFIER COMPTEURS TEMPS RÉEL
// ============================================================
function checkRealtimeCounters() {
  console.log('\n📈 2. COMPTEURS TEMPS RÉEL');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const expectedCounters = [
    { id: 'regies', label: 'Régies immobilières' },
    { id: 'entreprises', label: 'Entreprises de service' },
    { id: 'techniciens', label: 'Techniciens' },
    { id: 'locataires', label: 'Locataires' },
    { id: 'proprietaires', label: 'Propriétaires' }
  ];
  
  let allFound = true;
  
  expectedCounters.forEach(counter => {
    const hasId = content.includes(`id="${counter.id}"`);
    const hasLabel = content.includes(counter.label);
    const found = hasId || hasLabel;
    
    const status = found ? '✅' : '❌';
    console.log(`  ${status} ${counter.label}`);
    
    if (!found) {
      allFound = false;
      results.missing_features.push(counter.label);
    }
  });
  
  if (!allFound) {
    results.issues.push({
      type: 'MISSING_COUNTERS',
      severity: 'MAJEUR',
      description: 'Compteurs manquants dans le dashboard admin'
    });
  }
  
  return allFound;
}

// ============================================================
// 3. VÉRIFIER INTERVENTIONS PAR RÉGIE
// ============================================================
function checkInterventionsByRegie() {
  console.log('\n🏢 3. INTERVENTIONS PAR RÉGIE');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const hasSection = content.includes('intervention') && content.includes('régie');
  const hasTable = content.includes('table') || content.includes('list');
  const hasLoading = content.includes('loadRegie') || content.includes('loadIntervention');
  
  console.log(`  Section interventions : ${hasSection ? '✅' : '❌'}`);
  console.log(`  Table/Liste : ${hasTable ? '✅' : '❌'}`);
  console.log(`  Fonction chargement : ${hasLoading ? '✅' : '❌'}`);
  
  if (!hasSection) {
    results.missing_features.push('Section interventions par régie');
    results.issues.push({
      type: 'MISSING_FEATURE',
      severity: 'MAJEUR',
      feature: 'Interventions par régie'
    });
  }
  
  return hasSection && hasTable;
}

// ============================================================
// 4. VÉRIFIER FACTURES MENSUELLES + COMMISSION 2%
// ============================================================
function checkMonthlyInvoices() {
  console.log('\n💰 4. FACTURES MENSUELLES + COMMISSION 2%');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const hasFactures = content.includes('facture');
  const hasMensuel = content.includes('mensuel') || content.includes('mois');
  const hasCommission = content.includes('commission');
  const has2Percent = content.includes('2%') || content.includes('2 %');
  
  console.log(`  Section factures : ${hasFactures ? '✅' : '❌'}`);
  console.log(`  Affichage mensuel : ${hasMensuel ? '✅' : '❌'}`);
  console.log(`  Commission affichée : ${hasCommission ? '✅' : '❌'}`);
  console.log(`  Taux 2% : ${has2Percent ? '✅' : '❌'}`);
  
  if (!hasFactures || !hasCommission) {
    results.missing_features.push('Factures mensuelles avec commission 2%');
    results.issues.push({
      type: 'MISSING_FEATURE',
      severity: 'MAJEUR',
      feature: 'Factures mensuelles détaillées avec commission 2%'
    });
  }
  
  return hasFactures && hasCommission;
}

// ============================================================
// 5. VÉRIFIER SUPABASE REALTIME
// ============================================================
function checkSupabaseRealtime() {
  console.log('\n🔄 5. SUPABASE REALTIME');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const hasRealtimeImport = content.includes('realtime') || content.includes('subscribe');
  const hasChannelSubscribe = content.includes('channel(') && content.includes('subscribe');
  const hasOn = content.includes('.on(');
  
  console.log(`  Import Realtime : ${hasRealtimeImport ? '✅' : '⚠️'}`);
  console.log(`  Channel subscribe : ${hasChannelSubscribe ? '✅' : '⚠️'}`);
  console.log(`  Event listeners : ${hasOn ? '✅' : '⚠️'}`);
  
  if (!hasRealtimeImport) {
    console.log('\n  ℹ️  Supabase Realtime non détecté (optionnel mais recommandé)');
    results.features.realtime = false;
  } else {
    results.features.realtime = true;
  }
  
  return true; // Non bloquant
}

// ============================================================
// 6. VÉRIFIER RÉGIES EN ATTENTE DE VALIDATION
// ============================================================
function checkRegiesValidation() {
  console.log('\n⏳ 6. RÉGIES EN ATTENTE DE VALIDATION');
  console.log('-'.repeat(70));
  
  const dashboardPath = path.join(__dirname, 'public/admin/dashboard.html');
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const hasValidation = content.includes('validation') || content.includes('attente');
  const hasLoadFunction = content.includes('loadRegies') || content.includes('loadEnAttente');
  const hasApproveButton = content.includes('approuve') || content.includes('valider');
  
  console.log(`  Section validation : ${hasValidation ? '✅' : '❌'}`);
  console.log(`  Fonction chargement : ${hasLoadFunction ? '✅' : '❌'}`);
  console.log(`  Boutons action : ${hasApproveButton ? '✅' : '❌'}`);
  
  results.features.validation_regies = hasValidation && hasLoadFunction;
  
  return true;
}

// ============================================================
// 7. RÉSUMÉ
// ============================================================
function summary() {
  console.log('\n' + '='.repeat(70));
  console.log('RÉSUMÉ');
  console.log('='.repeat(70));
  
  const criticalIssues = results.issues.filter(i => i.severity === 'CRITIQUE').length;
  const majorIssues = results.issues.filter(i => i.severity === 'MAJEUR').length;
  const missingCount = results.missing_features.length;
  
  console.log(`Dashboard existe : ${results.dashboard_exists ? '✅' : '❌'}`);
  console.log(`Fonctionnalités manquantes : ${missingCount}`);
  console.log(`Problèmes critiques : ${criticalIssues}`);
  console.log(`Problèmes majeurs : ${majorIssues}`);
  
  if (missingCount > 0) {
    console.log('\n🚨 FONCTIONNALITÉS À AJOUTER :');
    results.missing_features.forEach((feat, idx) => {
      console.log(`  ${idx + 1}. ${feat}`);
    });
  }
  
  results.summary = {
    dashboard_exists: results.dashboard_exists,
    total_features_checked: Object.keys(results.features).length,
    features_present: Object.values(results.features).filter(v => v).length,
    missing_features: missingCount,
    critical_issues: criticalIssues,
    major_issues: majorIssues
  };
  
  // Sauvegarder
  const reportPath = path.join(__dirname, '_AUDIT_ADMIN_ETAPE7_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);
  console.log();
  
  process.exit(missingCount > 0 ? 1 : 0);
}

// ============================================================
// EXÉCUTION
// ============================================================
try {
  const dashboardOk = checkAdminDashboard();
  if (dashboardOk) {
    checkRealtimeCounters();
    checkInterventionsByRegie();
    checkMonthlyInvoices();
    checkSupabaseRealtime();
    checkRegiesValidation();
  }
  summary();
} catch (error) {
  console.error('❌ Erreur:', error);
  process.exit(1);
}
