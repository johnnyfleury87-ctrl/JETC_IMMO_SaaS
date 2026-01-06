#!/usr/bin/env node
/**
 * =====================================================
 * VALIDATION FINALE - GESTION TECHNICIENS
 * =====================================================
 * 
 * Vérifie que tout est prêt pour la production :
 * - APIs backend accessibles
 * - Frontend accessible
 * - Structure base de données OK
 * - RLS appliquées (ou alerte)
 */

const fs = require('fs');
const path = require('path');

console.log('═'.repeat(60));
console.log('🔍 VALIDATION FINALE - GESTION TECHNICIENS');
console.log('═'.repeat(60));
console.log('');

const results = {
  backend: { total: 0, ok: 0, errors: [] },
  frontend: { total: 0, ok: 0, errors: [] },
  database: { total: 0, ok: 0, errors: [] },
  rls: { total: 0, ok: 0, errors: [] },
  documentation: { total: 0, ok: 0, errors: [] }
};

// =========================================
// 1. VÉRIFIER BACKEND APIs
// =========================================
console.log('📋 1. VÉRIFICATION BACKEND APIs\n');

const apis = [
  '/api/techniciens/create.js',
  '/api/techniciens/list.js',
  '/api/techniciens/update.js',
  '/api/techniciens/delete.js'
];

apis.forEach(api => {
  results.backend.total++;
  const filePath = path.join(__dirname, api);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Vérifier les corrections critiques
    let issues = [];
    
    if (content.includes("role !== 'entreprise'")) {
      issues.push('Rôle "entreprise" non corrigé en "admin_entreprise"');
    }
    
    if (api.includes('update') && content.includes('const { technicien_id, telephone, specialites, disponible }')) {
      issues.push('Colonne "disponible" non corrigée en "actif"');
    }
    
    if (issues.length === 0) {
      console.log(`   ✅ ${api}`);
      results.backend.ok++;
    } else {
      console.log(`   ⚠️  ${api}`);
      issues.forEach(issue => console.log(`       - ${issue}`));
      results.backend.errors.push({ file: api, issues });
    }
  } else {
    console.log(`   ❌ ${api} - FICHIER MANQUANT`);
    results.backend.errors.push({ file: api, issues: ['Fichier manquant'] });
  }
});

console.log('');

// =========================================
// 2. VÉRIFIER FRONTEND
// =========================================
console.log('📋 2. VÉRIFICATION FRONTEND\n');

const frontendFiles = [
  '/public/entreprise/techniciens.html',
  '/public/entreprise/dashboard.html'
];

frontendFiles.forEach(file => {
  results.frontend.total++;
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (file.includes('techniciens.html')) {
      // Vérifier présence des fonctions clés
      const hasFunctions = [
        'loadTechniciens',
        'openCreateModal',
        'handleSubmit',
        'deleteTechnicien'
      ].every(fn => content.includes(fn));
      
      if (hasFunctions) {
        console.log(`   ✅ ${file}`);
        results.frontend.ok++;
      } else {
        console.log(`   ⚠️  ${file} - Fonctions manquantes`);
        results.frontend.errors.push({ file, issues: ['Fonctions JavaScript incomplètes'] });
      }
    } else if (file.includes('dashboard.html')) {
      // Vérifier activation du lien techniciens
      if (content.includes('href="/entreprise/techniciens.html"')) {
        console.log(`   ✅ ${file} - Lien techniciens activé`);
        results.frontend.ok++;
      } else {
        console.log(`   ⚠️  ${file} - Lien techniciens non activé`);
        results.frontend.errors.push({ file, issues: ['Lien menu techniciens toujours désactivé'] });
      }
    }
  } else {
    console.log(`   ❌ ${file} - FICHIER MANQUANT`);
    results.frontend.errors.push({ file, issues: ['Fichier manquant'] });
  }
});

console.log('');

// =========================================
// 3. VÉRIFIER SCRIPTS D'AUDIT
// =========================================
console.log('📋 3. VÉRIFICATION SCRIPTS D\'AUDIT\n');

const scripts = [
  '_audit_techniciens_supabase_api.js',
  '_check_techniciens_structure.js',
  '_check_rls_rpc.js'
];

scripts.forEach(script => {
  results.database.total++;
  const filePath = path.join(__dirname, script);
  
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${script}`);
    results.database.ok++;
  } else {
    console.log(`   ❌ ${script} - MANQUANT`);
    results.database.errors.push({ file: script, issues: ['Script manquant'] });
  }
});

console.log('');

// =========================================
// 4. VÉRIFIER SCRIPT RLS
// =========================================
console.log('📋 4. VÉRIFICATION SCRIPT RLS\n');

results.rls.total++;
const rlsPath = path.join(__dirname, '_APPLY_RLS_TECHNICIENS.sql');

if (fs.existsSync(rlsPath)) {
  const content = fs.readFileSync(rlsPath, 'utf-8');
  
  // Compter les policies
  const policyCount = (content.match(/CREATE POLICY/g) || []).length;
  
  if (policyCount >= 10) {
    console.log(`   ✅ Script RLS présent (${policyCount} policies)`);
    results.rls.ok++;
  } else {
    console.log(`   ⚠️  Script RLS incomplet (${policyCount}/11 policies)`);
    results.rls.errors.push({ file: '_APPLY_RLS_TECHNICIENS.sql', issues: ['Policies manquantes'] });
  }
} else {
  console.log(`   ❌ Script RLS manquant`);
  results.rls.errors.push({ file: '_APPLY_RLS_TECHNICIENS.sql', issues: ['Fichier manquant'] });
}

console.log('');

// =========================================
// 5. VÉRIFIER DOCUMENTATION
// =========================================
console.log('📋 5. VÉRIFICATION DOCUMENTATION\n');

const docs = [
  '_RAPPORT_AUDIT_COMPLET_TECHNICIENS.md',
  '_LIVRABLE_GESTION_TECHNICIENS.md',
  '_GUIDE_APPLICATION_RAPIDE.md',
  '_RESUME_EXECUTIF.md'
];

docs.forEach(doc => {
  results.documentation.total++;
  const filePath = path.join(__dirname, doc);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`   ✅ ${doc} (${sizeKB} KB)`);
    results.documentation.ok++;
  } else {
    console.log(`   ❌ ${doc} - MANQUANT`);
    results.documentation.errors.push({ file: doc, issues: ['Fichier manquant'] });
  }
});

console.log('');

// =========================================
// 6. RAPPORT FINAL
// =========================================
console.log('═'.repeat(60));
console.log('📊 RAPPORT FINAL');
console.log('═'.repeat(60));
console.log('');

function printCategory(name, data) {
  const percentage = data.total > 0 ? Math.round((data.ok / data.total) * 100) : 0;
  const status = percentage === 100 ? '✅' : percentage >= 75 ? '⚠️' : '❌';
  
  console.log(`${status} ${name}`);
  console.log(`   Statut: ${data.ok}/${data.total} (${percentage}%)`);
  
  if (data.errors.length > 0) {
    console.log(`   Problèmes détectés:`);
    data.errors.forEach(error => {
      console.log(`     - ${error.file}`);
      error.issues.forEach(issue => console.log(`       • ${issue}`));
    });
  }
  console.log('');
}

printCategory('Backend APIs', results.backend);
printCategory('Frontend', results.frontend);
printCategory('Scripts d\'audit', results.database);
printCategory('Script RLS', results.rls);
printCategory('Documentation', results.documentation);

// Calcul score global
const totalChecks = results.backend.total + results.frontend.total + 
                    results.database.total + results.rls.total + 
                    results.documentation.total;

const totalOk = results.backend.ok + results.frontend.ok + 
                results.database.ok + results.rls.ok + 
                results.documentation.ok;

const globalScore = Math.round((totalOk / totalChecks) * 100);

console.log('═'.repeat(60));
console.log(`🎯 SCORE GLOBAL: ${totalOk}/${totalChecks} (${globalScore}%)`);
console.log('═'.repeat(60));
console.log('');

if (globalScore === 100) {
  console.log('✅ TOUT EST CONFORME - Prêt pour production');
  console.log('');
  console.log('⚠️  IMPORTANT : Ne pas oublier d\'appliquer le script RLS dans Supabase !');
  console.log('   → Dashboard Supabase → SQL Editor → Exécuter _APPLY_RLS_TECHNICIENS.sql');
} else if (globalScore >= 80) {
  console.log('⚠️  PRESQUE PRÊT - Quelques ajustements nécessaires');
  console.log('');
  console.log('Actions recommandées:');
  console.log('1. Vérifier les fichiers marqués en ⚠️ ou ❌');
  console.log('2. Corriger les problèmes détectés');
  console.log('3. Relancer ce script de validation');
} else {
  console.log('❌ NON CONFORME - Corrections importantes requises');
  console.log('');
  console.log('Actions requises:');
  console.log('1. Consulter la documentation');
  console.log('2. Corriger tous les problèmes détectés');
  console.log('3. Relancer ce script de validation');
}

console.log('');
console.log('═'.repeat(60));
console.log('Validation terminée - ' + new Date().toLocaleString('fr-FR'));
console.log('═'.repeat(60));

// Sauvegarder le rapport JSON
const reportPath = path.join(__dirname, '_VALIDATION_RESULT.json');
fs.writeFileSync(reportPath, JSON.stringify({
  date: new Date().toISOString(),
  score: {
    total: totalChecks,
    ok: totalOk,
    percentage: globalScore
  },
  details: results
}, null, 2));

console.log(`\n💾 Rapport détaillé sauvegardé: ${reportPath}`);

// Code de sortie
process.exit(globalScore < 80 ? 1 : 0);
