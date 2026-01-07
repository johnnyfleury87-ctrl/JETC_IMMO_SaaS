#!/usr/bin/env node
/**
 * AUDIT INTERNATIONALISATION - ÉTAPE 6
 * Vérifie que TOUT le projet est multilingue
 * Source de vérité : profiles.language
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('AUDIT INTERNATIONALISATION - ÉTAPE 6');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  i18n_system: {},
  pages_status: [],
  hardcoded_texts: [],
  missing_translations: [],
  issues: [],
  summary: {}
};

// ============================================================
// 1. VÉRIFIER LE SYSTÈME I18N EXISTANT
// ============================================================
function checkI18nSystem() {
  console.log('🌐 1. SYSTÈME I18N EXISTANT');
  console.log('-'.repeat(70));
  
  const i18nFiles = [
    'public/js/i18n.js',
    'public/js/translations.js',
    'src/lib/i18n.js',
    'locales/fr.json',
    'locales/en.json'
  ];
  
  i18nFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ ${file}`);
      results.i18n_system[file] = { exists: true };
    } else {
      console.log(`  ❌ ${file} - N'existe pas`);
      results.i18n_system[file] = { exists: false };
    }
  });
  
  console.log();
}

// ============================================================
// 2. ANALYSER TOUTES LES PAGES HTML
// ============================================================
function analyzePagesForI18n() {
  console.log('📄 2. ANALYSE DES PAGES HTML');
  console.log('-'.repeat(70));
  
  const publicDir = path.join(__dirname, 'public');
  const htmlFiles = [];
  
  // Récursif pour trouver tous les .html
  function findHtmlFiles(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        findHtmlFiles(fullPath);
      } else if (file.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    });
  }
  
  findHtmlFiles(publicDir);
  
  console.log(`  Fichiers HTML trouvés : ${htmlFiles.length}\n`);
  
  htmlFiles.forEach(file => {
    const relativePath = file.replace(__dirname + '/', '');
    const content = fs.readFileSync(file, 'utf-8');
    
    // Détection de traduction
    const hasI18n = content.includes('data-i18n') || 
                    content.includes('t(') || 
                    content.includes('i18n.t') ||
                    content.includes('translations.');
    
    const hasHardcodedFrench = /["'](Bonjour|Tableau de bord|Missions|Techniciens|Entreprises|Voir|Modifier|Supprimer|Connexion|Déconnexion|Créer|Enregistrer|Annuler)/i.test(content);
    
    const status = hasI18n ? '✅ Traduit' : (hasHardcodedFrench ? '❌ Textes en dur' : '⚠️  À vérifier');
    
    console.log(`  ${status.padEnd(20)} ${relativePath}`);
    
    results.pages_status.push({
      file: relativePath,
      hasI18n,
      hasHardcodedFrench,
      status: hasI18n ? 'translated' : 'hardcoded'
    });
    
    // Chercher les textes en dur français
    if (hasHardcodedFrench && !hasI18n) {
      const frenchMatches = content.match(/["']((?:Bonjour|Tableau de bord|Missions|Techniciens|Entreprises|Régies|Locataires|Voir|Modifier|Supprimer|Connexion|Déconnexion|Créer|Enregistrer|Annuler|Ajouter|Valider|Confirmer|Rechercher|Filtrer|Exporter)[^"']*)["']/gi);
      
      if (frenchMatches && frenchMatches.length > 0) {
        results.hardcoded_texts.push({
          file: relativePath,
          count: frenchMatches.length,
          samples: frenchMatches.slice(0, 5)
        });
      }
    }
  });
  
  console.log();
}

// ============================================================
// 3. VÉRIFIER profiles.language
// ============================================================
function checkProfilesLanguage() {
  console.log('🗣️  3. SOURCE DE VÉRITÉ : profiles.language');
  console.log('-'.repeat(70));
  
  // Vérifier dans le schéma SQL
  const schemaFiles = [
    'supabase/schema/01_profiles.sql',
    'supabase/schema/02_profiles.sql'
  ];
  
  let found = false;
  schemaFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('language')) {
        console.log(`  ✅ Colonne 'language' trouvée dans ${file}`);
        found = true;
      }
    }
  });
  
  if (!found) {
    console.log('  ⚠️  Colonne profiles.language non trouvée dans les schémas');
    results.issues.push({
      type: 'MISSING_COLUMN',
      table: 'profiles',
      column: 'language',
      severity: 'MAJEUR'
    });
  }
  
  console.log();
}

// ============================================================
// 4. ÉLÉMENTS À TRADUIRE
// ============================================================
function listTranslatableElements() {
  console.log('📝 4. ÉLÉMENTS À TRADUIRE');
  console.log('-'.repeat(70));
  
  const elements = [
    { category: 'UI Générale', items: ['Boutons', 'Titres', 'Labels', 'Placeholders', 'Tooltips'] },
    { category: 'Modales', items: ['Titres modales', 'Messages confirmation', 'Boutons actions'] },
    { category: 'Messages d\'erreur', items: ['Erreurs auth', 'Erreurs validation', 'Erreurs réseau'] },
    { category: 'Statuts', items: ['Statuts missions', 'Statuts factures', 'Statuts tickets'] },
    { category: 'Navigation', items: ['Menu sidebar', 'Breadcrumbs', 'Liens'] },
    { category: 'Formulaires', items: ['Labels champs', 'Messages validation', 'Help text'] },
    { category: 'Emails', items: ['Objets', 'Corps des emails', 'Signatures'] }
  ];
  
  elements.forEach(cat => {
    console.log(`\n  ${cat.category} :`);
    cat.items.forEach(item => {
      console.log(`    - ${item}`);
    });
  });
  
  console.log();
}

// ============================================================
// 5. PAGES PRIORITAIRES
// ============================================================
function identifyPriorityPages() {
  console.log('🎯 5. PAGES PRIORITAIRES À TRADUIRE');
  console.log('-'.repeat(70));
  
  const priorityPages = [
    { path: 'public/index.html', priority: 'FAIBLE', reason: 'Déjà traduit (selon PDF)' },
    { path: 'public/login.html', priority: 'HAUTE', reason: 'Point d\'entrée principal' },
    { path: 'public/technicien/dashboard.html', priority: 'CRITIQUE', reason: 'Vue métier principale' },
    { path: 'public/entreprise/dashboard.html', priority: 'CRITIQUE', reason: 'Vue métier principale' },
    { path: 'public/regie/dashboard.html', priority: 'CRITIQUE', reason: 'Vue métier principale' },
    { path: 'public/admin/dashboard.html', priority: 'CRITIQUE', reason: 'Vue admin principale' },
    { path: 'public/locataire/dashboard.html', priority: 'HAUTE', reason: 'Vue utilisateur final' }
  ];
  
  priorityPages.forEach(page => {
    const fullPath = path.join(__dirname, page.path);
    const exists = fs.existsSync(fullPath);
    const status = exists ? '✅' : '❌';
    
    console.log(`  ${status} [${page.priority.padEnd(8)}] ${page.path}`);
    console.log(`      → ${page.reason}`);
  });
  
  console.log();
}

// ============================================================
// 6. RECOMMANDATIONS
// ============================================================
function generateRecommendations() {
  console.log('💡 6. RECOMMANDATIONS');
  console.log('-'.repeat(70));
  
  const untranslatedPages = results.pages_status.filter(p => p.status === 'hardcoded').length;
  const totalPages = results.pages_status.length;
  const translatedPages = totalPages - untranslatedPages;
  
  console.log(`\n  Pages traduites : ${translatedPages}/${totalPages} (${Math.round(translatedPages/totalPages*100)}%)`);
  console.log(`  Pages avec textes en dur : ${untranslatedPages}`);
  
  if (untranslatedPages > 0) {
    console.log('\n  ⚠️  ACTION REQUISE :');
    console.log('    1. Créer un système i18n centralisé');
    console.log('    2. Définir les fichiers de traduction (fr.json, en.json)');
    console.log('    3. Remplacer tous les textes en dur par des clés i18n');
    console.log('    4. Utiliser profiles.language comme source de vérité');
    console.log('    5. Ajouter un sélecteur de langue dans l\'interface');
  }
  
  console.log('\n  📋 STRUCTURE RECOMMANDÉE :');
  console.log('    public/');
  console.log('      js/');
  console.log('        i18n.js          → Système de traduction');
  console.log('        translations/');
  console.log('          fr.json        → Traductions françaises');
  console.log('          en.json        → Traductions anglaises');
  console.log('          es.json        → Traductions espagnoles (optionnel)');
  
  console.log('\n  🔧 IMPLÉMENTATION :');
  console.log('    1. Charger la langue depuis profiles.language au login');
  console.log('    2. Stocker dans localStorage pour persistance');
  console.log('    3. Appliquer data-i18n sur tous les éléments');
  console.log('    4. Fonction t(key) pour JS dynamique');
  console.log('    5. Fallback FR si langue non supportée');
  
  console.log();
}

// ============================================================
// 7. RÉSUMÉ
// ============================================================
function summary() {
  console.log('='.repeat(70));
  console.log('RÉSUMÉ');
  console.log('='.repeat(70));
  
  const totalPages = results.pages_status.length;
  const translatedPages = results.pages_status.filter(p => p.hasI18n).length;
  const hardcodedPages = results.pages_status.filter(p => p.status === 'hardcoded').length;
  const criticalIssues = results.issues.filter(i => i.severity === 'CRITIQUE').length;
  const majorIssues = results.issues.filter(i => i.severity === 'MAJEUR').length;
  
  results.summary = {
    total_pages: totalPages,
    translated_pages: translatedPages,
    hardcoded_pages: hardcodedPages,
    critical_issues: criticalIssues,
    major_issues: majorIssues,
    translation_coverage: Math.round((translatedPages / totalPages) * 100)
  };
  
  console.log(`Pages HTML totales : ${totalPages}`);
  console.log(`Pages traduites : ${translatedPages} (${results.summary.translation_coverage}%)`);
  console.log(`Pages avec textes en dur : ${hardcodedPages}`);
  console.log(`Fichiers avec textes FR détectés : ${results.hardcoded_texts.length}`);
  console.log(`Problèmes critiques : ${criticalIssues}`);
  console.log(`Problèmes majeurs : ${majorIssues}`);
  
  if (results.hardcoded_texts.length > 0) {
    console.log('\n🚨 TOP 5 FICHIERS AVEC TEXTES EN DUR :');
    results.hardcoded_texts
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.file} (${item.count} occurrences)`);
        console.log(`     Exemples : ${item.samples.slice(0, 2).join(', ')}`);
      });
  }
  
  console.log();
  
  // Sauvegarder
  const reportPath = path.join(__dirname, '_AUDIT_I18N_ETAPE6_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
  console.log();
  
  process.exit(hardcodedPages > 0 ? 1 : 0);
}

// ============================================================
// EXÉCUTION
// ============================================================
try {
  checkI18nSystem();
  analyzePagesForI18n();
  checkProfilesLanguage();
  listTranslatableElements();
  identifyPriorityPages();
  generateRecommendations();
  summary();
} catch (error) {
  console.error('❌ Erreur:', error);
  process.exit(1);
}
