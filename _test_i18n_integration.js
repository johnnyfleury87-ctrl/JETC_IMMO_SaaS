#!/usr/bin/env node
/**
 * TEST INTÉGRATION I18N - ÉTAPE 6
 * Vérifie que profiles.language est bien utilisé comme source de vérité
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('TEST INTÉGRATION I18N');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  issues: [],
  summary: {}
};

// ============================================================
// 1. VÉRIFIER QUE profiles.language EXISTE
// ============================================================
function test1_ProfilesLanguageColumn() {
  console.log('🧪 TEST 1 : Colonne profiles.language existe');
  console.log('-'.repeat(70));
  
  const schemaPath = path.join(__dirname, 'supabase/schema/04_users.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.log('  ❌ ÉCHEC : 04_users.sql introuvable');
    results.tests.push({
      name: 'profiles.language exists',
      status: 'FAILED',
      reason: 'Schema file not found'
    });
    return false;
  }
  
  const content = fs.readFileSync(schemaPath, 'utf-8');
  
  if (content.includes('language text not null default')) {
    console.log('  ✅ SUCCÈS : Colonne language existe avec default');
    console.log('  → Ligne : language text not null default \'fr\'');
    results.tests.push({
      name: 'profiles.language exists',
      status: 'PASSED'
    });
    return true;
  } else {
    console.log('  ❌ ÉCHEC : Colonne language introuvable');
    results.issues.push({
      type: 'MISSING_COLUMN',
      table: 'profiles',
      column: 'language',
      severity: 'CRITIQUE'
    });
    results.tests.push({
      name: 'profiles.language exists',
      status: 'FAILED'
    });
    return false;
  }
}

// ============================================================
// 2. VÉRIFIER LE SYSTÈME LANGUAGEMANAGER
// ============================================================
function test2_LanguageManagerExists() {
  console.log('\n🧪 TEST 2 : LanguageManager existe et est complet');
  console.log('-'.repeat(70));
  
  const langManagerPath = path.join(__dirname, 'public/js/languageManager.js');
  
  if (!fs.existsSync(langManagerPath)) {
    console.log('  ❌ ÉCHEC : languageManager.js introuvable');
    results.tests.push({
      name: 'languageManager.js exists',
      status: 'FAILED'
    });
    return false;
  }
  
  const content = fs.readFileSync(langManagerPath, 'utf-8');
  
  const checks = [
    { pattern: /SUPPORTED_LANGUAGES.*=.*\[.*'fr'.*'en'.*'de'.*\]/, name: 'SUPPORTED_LANGUAGES' },
    { pattern: /function getCurrentLanguage/, name: 'getCurrentLanguage()' },
    { pattern: /function setLanguage/, name: 'setLanguage()' },
    { pattern: /function applyTranslations/, name: 'applyTranslations()' },
    { pattern: /function changeLanguage/, name: 'changeLanguage()' },
    { pattern: /function t\(/, name: 't() helper' },
    { pattern: /const translations\s*=\s*\{/, name: 'translations object' },
    { pattern: /data-i18n/, name: 'data-i18n support' }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} MANQUANT`);
      allPassed = false;
      results.issues.push({
        type: 'MISSING_FUNCTION',
        file: 'languageManager.js',
        function: check.name,
        severity: 'MAJEUR'
      });
    }
  });
  
  results.tests.push({
    name: 'languageManager.js complete',
    status: allPassed ? 'PASSED' : 'FAILED'
  });
  
  return allPassed;
}

// ============================================================
// 3. VÉRIFIER L'INTÉGRATION DANS LES DASHBOARDS
// ============================================================
function test3_DashboardsUseI18n() {
  console.log('\n🧪 TEST 3 : Dashboards utilisent languageManager');
  console.log('-'.repeat(70));
  
  const dashboards = [
    'public/technicien/dashboard.html',
    'public/entreprise/dashboard.html',
    'public/regie/dashboard.html',
    'public/admin/dashboard.html',
    'public/locataire/dashboard.html'
  ];
  
  let allPass = true;
  
  dashboards.forEach(dash => {
    const fullPath = path.join(__dirname, dash);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠️  ${dash} - N'existe pas`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    const hasLanguageManager = content.includes('languageManager.js');
    const hasDataI18n = content.includes('data-i18n');
    const hasApplyTranslations = content.includes('applyTranslations');
    
    if (hasLanguageManager && hasDataI18n) {
      console.log(`  ✅ ${dash}`);
    } else {
      console.log(`  ❌ ${dash}`);
      console.log(`      → languageManager.js: ${hasLanguageManager ? '✓' : '✗'}`);
      console.log(`      → data-i18n: ${hasDataI18n ? '✓' : '✗'}`);
      console.log(`      → applyTranslations: ${hasApplyTranslations ? '✓' : '✗'}`);
      allPass = false;
    }
  });
  
  results.tests.push({
    name: 'dashboards use i18n',
    status: allPass ? 'PASSED' : 'FAILED'
  });
  
  return allPass;
}

// ============================================================
// 4. VÉRIFIER LA SYNCHRONISATION AVEC profiles.language
// ============================================================
function test4_ProfilesLanguageSync() {
  console.log('\n🧪 TEST 4 : Synchronisation profiles.language ↔ UI');
  console.log('-'.repeat(70));
  
  // Chercher dans bootstrapSupabase.js ou les pages de connexion
  const files = [
    'public/js/bootstrapSupabase.js',
    'public/login.html',
    'public/technicien/dashboard.html'
  ];
  
  let syncFound = false;
  
  files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    
    if (!fs.existsSync(fullPath)) {
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Chercher si profiles.language est lu
    if (content.includes('profiles') && content.includes('language')) {
      console.log(`  ✅ ${file} lit profiles.language`);
      syncFound = true;
    }
  });
  
  if (!syncFound) {
    console.log('  ⚠️  ATTENTION : profiles.language ne semble pas être lu au login');
    console.log('  → Le système utilise localStorage uniquement');
    console.log('  → Recommandation : Synchroniser au login');
    
    results.issues.push({
      type: 'MISSING_SYNC',
      description: 'profiles.language non synchronisé au login',
      severity: 'MAJEUR',
      recommendation: 'Lire profiles.language au login et appeler setLanguage()'
    });
    
    results.tests.push({
      name: 'profiles.language sync',
      status: 'WARNING'
    });
    
    return false;
  }
  
  results.tests.push({
    name: 'profiles.language sync',
    status: 'PASSED'
  });
  
  return true;
}

// ============================================================
// 5. VÉRIFIER LA COMPLÉTUDE DES TRADUCTIONS
// ============================================================
function test5_TranslationsComplete() {
  console.log('\n🧪 TEST 5 : Complétude des traductions FR/EN/DE');
  console.log('-'.repeat(70));
  
  const langManagerPath = path.join(__dirname, 'public/js/languageManager.js');
  const content = fs.readFileSync(langManagerPath, 'utf-8');
  
  // Extraire les clés FR
  const frMatch = content.match(/fr:\s*\{([^}]+(?:\}[^}]+)*)\}/s);
  if (!frMatch) {
    console.log('  ❌ ÉCHEC : Traductions FR introuvables');
    return false;
  }
  
  const frKeys = (frMatch[1].match(/(\w+):/g) || []).map(k => k.replace(':', ''));
  
  // Vérifier EN
  const enMatch = content.match(/en:\s*\{([^}]+(?:\}[^}]+)*)\}/s);
  const enKeys = enMatch ? (enMatch[1].match(/(\w+):/g) || []).map(k => k.replace(':', '')) : [];
  
  // Vérifier DE
  const deMatch = content.match(/de:\s*\{([^}]+(?:\}[^}]+)*)\}/s);
  const deKeys = deMatch ? (deMatch[1].match(/(\w+):/g) || []).map(k => k.replace(':', '')) : [];
  
  console.log(`  FR : ${frKeys.length} clés`);
  console.log(`  EN : ${enKeys.length} clés`);
  console.log(`  DE : ${deKeys.length} clés`);
  
  const missingEN = frKeys.filter(k => !enKeys.includes(k));
  const missingDE = frKeys.filter(k => !deKeys.includes(k));
  
  if (missingEN.length > 0) {
    console.log(`  ⚠️  ${missingEN.length} clés manquantes en EN`);
    console.log(`     Exemples : ${missingEN.slice(0, 3).join(', ')}`);
  } else {
    console.log('  ✅ Traductions EN complètes');
  }
  
  if (missingDE.length > 0) {
    console.log(`  ⚠️  ${missingDE.length} clés manquantes en DE`);
    console.log(`     Exemples : ${missingDE.slice(0, 3).join(', ')}`);
  } else {
    console.log('  ✅ Traductions DE complètes');
  }
  
  results.tests.push({
    name: 'translations complete',
    status: (missingEN.length === 0 && missingDE.length === 0) ? 'PASSED' : 'WARNING',
    details: {
      fr_keys: frKeys.length,
      en_keys: enKeys.length,
      de_keys: deKeys.length,
      missing_en: missingEN.length,
      missing_de: missingDE.length
    }
  });
  
  return missingEN.length === 0 && missingDE.length === 0;
}

// ============================================================
// 6. RÉSUMÉ
// ============================================================
function summary() {
  console.log('\n' + '='.repeat(70));
  console.log('RÉSUMÉ DES TESTS');
  console.log('='.repeat(70));
  
  const passed = results.tests.filter(t => t.status === 'PASSED').length;
  const failed = results.tests.filter(t => t.status === 'FAILED').length;
  const warnings = results.tests.filter(t => t.status === 'WARNING').length;
  const total = results.tests.length;
  
  console.log(`Tests passés : ${passed}/${total}`);
  console.log(`Tests échoués : ${failed}/${total}`);
  console.log(`Avertissements : ${warnings}/${total}`);
  
  console.log(`\nProblèmes critiques : ${results.issues.filter(i => i.severity === 'CRITIQUE').length}`);
  console.log(`Problèmes majeurs : ${results.issues.filter(i => i.severity === 'MAJEUR').length}`);
  
  if (results.issues.length > 0) {
    console.log('\n🚨 PROBLÈMES DÉTECTÉS :');
    results.issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. [${issue.severity}] ${issue.type}`);
      if (issue.description) console.log(`   ${issue.description}`);
      if (issue.recommendation) console.log(`   → ${issue.recommendation}`);
    });
  }
  
  results.summary = {
    total_tests: total,
    passed,
    failed,
    warnings,
    success_rate: Math.round((passed / total) * 100)
  };
  
  // Sauvegarder
  const reportPath = path.join(__dirname, '_TEST_I18N_INTEGRATION_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);
  console.log();
  
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================
// EXÉCUTION
// ============================================================
try {
  test1_ProfilesLanguageColumn();
  test2_LanguageManagerExists();
  test3_DashboardsUseI18n();
  test4_ProfilesLanguageSync();
  test5_TranslationsComplete();
  summary();
} catch (error) {
  console.error('❌ Erreur:', error);
  process.exit(1);
}
