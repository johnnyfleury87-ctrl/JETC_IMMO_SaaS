#!/usr/bin/env node

/**
 * ======================================================
 * RÉSUMÉ VISUEL M43
 * ======================================================
 * Affiche l'état d'avancement de la migration M43
 * ======================================================
 */

const fs = require('fs');
const path = require('path');

// Couleurs ANSI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text) {
  console.log('\n' + colorize('═'.repeat(60), 'cyan'));
  console.log(colorize(` ${text}`, 'bright'));
  console.log(colorize('═'.repeat(60), 'cyan'));
}

function printSection(title) {
  console.log('\n' + colorize(`▶ ${title}`, 'blue'));
  console.log(colorize('─'.repeat(60), 'blue'));
}

function checkFileExists(filepath) {
  return fs.existsSync(path.join(__dirname, filepath));
}

function getFileSize(filepath) {
  try {
    const stats = fs.statSync(path.join(__dirname, filepath));
    return `${(stats.size / 1024).toFixed(1)} KB`;
  } catch {
    return 'N/A';
  }
}

function getLineCount(filepath) {
  try {
    const content = fs.readFileSync(path.join(__dirname, filepath), 'utf8');
    return content.split('\n').length;
  } catch {
    return 'N/A';
  }
}

console.clear();

printHeader('🎯 MIGRATION M43 - RÉSUMÉ VISUEL');

// ======================================================
// FICHIERS DOCUMENTATION
// ======================================================

printSection('📚 DOCUMENTATION GÉNÉRÉE');

const docs = [
  'AUDIT_ENTREPRISE_TECHNICIEN_MISSIONS_COMPLET.md',
  'AUDIT_M43_RESULT.md',
  'GUIDE_APPLICATION_M43.md',
  'INDEX_M43_CORRECTIONS_DEPLOIEMENT.md',
  'ETAT_AVANCEMENT_M43.md'
];

docs.forEach(doc => {
  const exists = checkFileExists(doc);
  const status = exists ? colorize('✅', 'green') : colorize('❌', 'red');
  const lines = exists ? `${getLineCount(doc)} lignes` : '';
  console.log(`${status} ${doc.padEnd(50)} ${colorize(lines, 'cyan')}`);
});

// ======================================================
// MIGRATIONS SQL
// ======================================================

printSection('🗄️ MIGRATIONS SQL PRÊTES');

const migrations = [
  'supabase/migrations/20260106000001_m43_mission_signalements.sql',
  'supabase/migrations/20260106000002_m43_mission_champs_complementaires.sql',
  'supabase/migrations/20260106000003_m43_mission_historique_statuts.sql'
];

migrations.forEach(migration => {
  const exists = checkFileExists(migration);
  const status = exists ? colorize('✅', 'green') : colorize('❌', 'red');
  const filename = path.basename(migration);
  const lines = exists ? `${getLineCount(migration)} lignes` : '';
  console.log(`${status} ${filename.padEnd(50)} ${colorize(lines, 'cyan')}`);
});

// SQL consolidé
const consolidatedExists = checkFileExists('_apply_m43_consolidated.sql');
if (consolidatedExists) {
  const lines = getLineCount('_apply_m43_consolidated.sql');
  console.log(colorize(`\n   📦 SQL Consolidé : ${lines} lignes (prêt à appliquer)`, 'green'));
}

// ======================================================
// SCRIPTS UTILITAIRES
// ======================================================

printSection('🔧 SCRIPTS UTILITAIRES');

const scripts = [
  ['_check_m43.js', 'Vérifier état M43'],
  ['_apply_m43.js', 'Générer SQL consolidé'],
  ['_test_m43_complete.sh', 'Tests automatisés']
];

scripts.forEach(([script, desc]) => {
  const exists = checkFileExists(script);
  const status = exists ? colorize('✅', 'green') : colorize('❌', 'red');
  console.log(`${status} ${script.padEnd(30)} ${colorize(desc, 'cyan')}`);
});

// ======================================================
// APIS BACKEND
// ======================================================

printSection('🌐 APIS BACKEND CRÉÉES');

const apis = [
  ['api/config.js', 'Injection config frontend'],
  ['api/techniciens/create.js', 'POST - Créer technicien'],
  ['api/techniciens/update.js', 'PATCH - Modifier technicien'],
  ['api/techniciens/delete.js', 'DELETE - Supprimer technicien']
];

apis.forEach(([api, desc]) => {
  const exists = checkFileExists(api);
  const status = exists ? colorize('✅', 'green') : colorize('❌', 'red');
  const lines = exists ? `(${getLineCount(api)} lignes)` : '';
  console.log(`${status} ${api.padEnd(35)} ${colorize(desc, 'cyan')} ${lines}`);
});

// ======================================================
// FRONTEND
// ======================================================

printSection('🎨 FRONTEND MODIFIÉ');

const frontend = [
  ['public/js/supabaseClient.js', 'URL dynamique via window.__SUPABASE_ENV__'],
  ['public/exemple_config_dynamique.html', 'Page test configuration']
];

frontend.forEach(([file, desc]) => {
  const exists = checkFileExists(file);
  const status = exists ? colorize('✅', 'green') : colorize('❌', 'red');
  console.log(`${status} ${file.padEnd(40)} ${colorize(desc, 'cyan')}`);
});

// ======================================================
// STATISTIQUES
// ======================================================

printSection('📊 STATISTIQUES');

let totalFiles = 0;
let totalLines = 0;

[...docs, ...migrations, ...scripts.map(s => s[0]), ...apis.map(a => a[0]), ...frontend.map(f => f[0])].forEach(file => {
  if (checkFileExists(file)) {
    totalFiles++;
    const lines = getLineCount(file);
    if (lines !== 'N/A') totalLines += lines;
  }
});

console.log(`   📁 Fichiers créés/modifiés : ${colorize(totalFiles, 'green')}`);
console.log(`   📝 Lignes de code total : ${colorize(`~${totalLines}`, 'green')}`);
console.log(`   🗄️ Tables SQL ajoutées : ${colorize('2', 'green')} (mission_signalements, mission_historique_statuts)`);
console.log(`   📋 Colonnes missions ajoutées : ${colorize('4', 'green')} (locataire_absent, absence_signalement_at, absence_raison, photos_urls)`);
console.log(`   🔧 Fonctions RPC ajoutées : ${colorize('4', 'green')}`);
console.log(`   📊 Vues SQL ajoutées : ${colorize('4', 'green')}`);
console.log(`   🔒 RLS Policies ajoutées : ${colorize('~10', 'green')}`);

// ======================================================
// PROCHAINES ÉTAPES
// ======================================================

printSection('🚀 PROCHAINES ÉTAPES');

const steps = [
  ['Appliquer migrations M43', 'Copier _apply_m43_consolidated.sql dans SQL Editor', '5 min'],
  ['Vérifier application', 'node _check_m43.js (tout doit être ✅)', '1 min'],
  ['Déployer code', 'git add . && git commit && git push', '3 min'],
  ['Tester APIs', 'bash _test_m43_complete.sh', '10 min'],
  ['Tests fonctionnels', 'Créer technicien, signaler absence, etc.', '10 min']
];

steps.forEach(([step, action, duration], index) => {
  console.log(`   ${index + 1}. ${colorize(step, 'yellow')} (${colorize(duration, 'cyan')})`);
  console.log(`      ${action}`);
});

console.log(colorize('\n   ⏱️  DURÉE TOTALE ESTIMÉE : 30 minutes', 'green'));

// ======================================================
// COMMANDES RAPIDES
// ======================================================

printSection('⚡ COMMANDES RAPIDES');

console.log(`   ${colorize('Vérifier M43', 'yellow')}     : node _check_m43.js`);
console.log(`   ${colorize('Générer SQL', 'yellow')}      : node _apply_m43.js`);
console.log(`   ${colorize('Tester complet', 'yellow')}   : bash _test_m43_complete.sh`);
console.log(`   ${colorize('Déployer', 'yellow')}         : git add . && git commit -m "feat: M43" && git push`);

// ======================================================
// FOOTER
// ======================================================

console.log('\n' + colorize('═'.repeat(60), 'cyan'));
console.log(colorize(' 📋 Voir AUDIT_M43_RESULT.md pour le rapport complet', 'bright'));
console.log(colorize(' 📖 Voir GUIDE_APPLICATION_M43.md pour les instructions détaillées', 'bright'));
console.log(colorize('═'.repeat(60), 'cyan'));
console.log('');
