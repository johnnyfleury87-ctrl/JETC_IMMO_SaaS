/**
 * Tests de validation - ÉTAPE 4 : Structure immobilière
 * 
 * Vérifie la cohérence des relations FK et l'isolation des régies
 * 
 * Usage:
 *   node tests/structure.test.js
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// Tests
const tests = [];
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ==================== TESTS ====================

test('Fichier 05_regies.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/05_regies.sql');
  assert(fs.existsSync(filePath), '05_regies.sql devrait exister');
});

test('Fichier 06_immeubles.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/06_immeubles.sql');
  assert(fs.existsSync(filePath), '06_immeubles.sql devrait exister');
});

test('Fichier 07_logements.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/07_logements.sql');
  assert(fs.existsSync(filePath), '07_logements.sql devrait exister');
});

test('Fichier 08_locataires.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/08_locataires.sql');
  assert(fs.existsSync(filePath), '08_locataires.sql devrait exister');
});

test('Table regies a une FK vers profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/05_regies.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('regies'),
    'Devrait créer la table regies'
  );
  
  assert(
    content.includes('profile_id') && content.includes('references profiles'),
    'regies devrait avoir une FK vers profiles'
  );
});

test('Table immeubles a une FK vers regies avec cascade', () => {
  const filePath = path.join(__dirname, '../supabase/schema/06_immeubles.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('immeubles'),
    'Devrait créer la table immeubles'
  );
  
  assert(
    content.includes('regie_id') && content.includes('references regies'),
    'immeubles devrait avoir une FK vers regies'
  );
  
  assert(
    content.includes('on delete cascade'),
    'FK vers regies devrait avoir on delete cascade'
  );
  
  assert(
    content.includes('not null') && content.match(/regie_id[^;]*not null/),
    'regie_id devrait être NOT NULL (obligatoire)'
  );
});

test('Table logements a une FK vers immeubles avec cascade', () => {
  const filePath = path.join(__dirname, '../supabase/schema/07_logements.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('logements'),
    'Devrait créer la table logements'
  );
  
  assert(
    content.includes('immeuble_id') && content.includes('references immeubles'),
    'logements devrait avoir une FK vers immeubles'
  );
  
  assert(
    content.includes('on delete cascade'),
    'FK vers immeubles devrait avoir on delete cascade'
  );
  
  assert(
    content.includes('not null') && content.match(/immeuble_id[^;]*not null/),
    'immeuble_id devrait être NOT NULL (obligatoire)'
  );
});

test('Table locataires a une FK vers profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/08_locataires.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('locataires'),
    'Devrait créer la table locataires'
  );
  
  assert(
    content.includes('profile_id') && content.includes('references profiles'),
    'locataires devrait avoir une FK vers profiles'
  );
});

test('Table locataires a une FK vers logements avec set null', () => {
  const filePath = path.join(__dirname, '../supabase/schema/08_locataires.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('logement_id') && content.includes('references logements'),
    'locataires devrait avoir une FK vers logements'
  );
  
  assert(
    content.includes('on delete set null'),
    'FK vers logements devrait avoir on delete set null (logement peut être supprimé sans supprimer le locataire)'
  );
});

test('Table regies a un nom unique', () => {
  const filePath = path.join(__dirname, '../supabase/schema/05_regies.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('unique') && (content.includes('unique_regie_nom') || content.includes('unique(nom)')),
    'regies devrait avoir une contrainte unique sur le nom'
  );
});

test('Table logements a un numéro unique par immeuble', () => {
  const filePath = path.join(__dirname, '../supabase/schema/07_logements.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('unique') && content.includes('numero') && content.includes('immeuble_id'),
    'logements devrait avoir une contrainte unique sur (numero, immeuble_id)'
  );
});

test('Toutes les tables ont created_at et updated_at', () => {
  const files = [
    '../supabase/schema/05_regies.sql',
    '../supabase/schema/06_immeubles.sql',
    '../supabase/schema/07_logements.sql',
    '../supabase/schema/08_locataires.sql'
  ];
  
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    assert(
      content.includes('created_at'),
      `${path.basename(file)} devrait avoir created_at`
    );
    
    assert(
      content.includes('updated_at'),
      `${path.basename(file)} devrait avoir updated_at`
    );
  }
});

test('Toutes les tables ont un trigger de mise à jour updated_at', () => {
  const files = [
    '../supabase/schema/05_regies.sql',
    '../supabase/schema/06_immeubles.sql',
    '../supabase/schema/07_logements.sql',
    '../supabase/schema/08_locataires.sql'
  ];
  
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    assert(
      content.includes('trigger') && content.includes('updated_at'),
      `${path.basename(file)} devrait avoir un trigger pour updated_at`
    );
  }
});

test('Table locataires a un trigger de synchronisation avec profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/08_locataires.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('sync_profile_logement_id'),
    'locataires devrait avoir une fonction sync_profile_logement_id'
  );
  
  assert(
    content.includes('trigger') && content.includes('sync_profile'),
    'locataires devrait avoir un trigger de synchronisation'
  );
});

test('Les tables ont des index sur les FK', () => {
  const checks = [
    { file: '../supabase/schema/05_regies.sql', index: 'idx_regies_profile_id' },
    { file: '../supabase/schema/06_immeubles.sql', index: 'idx_immeubles_regie_id' },
    { file: '../supabase/schema/07_logements.sql', index: 'idx_logements_immeuble_id' },
    { file: '../supabase/schema/08_locataires.sql', index: 'idx_locataires_profile_id' },
    { file: '../supabase/schema/08_locataires.sql', index: 'idx_locataires_logement_id' }
  ];
  
  for (const { file, index } of checks) {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    assert(
      content.includes(index) || (content.includes('create index') && content.includes(index.split('_').pop())),
      `${path.basename(file)} devrait avoir l'index ${index}`
    );
  }
});

test('Table regies a des contraintes de validation', () => {
  const filePath = path.join(__dirname, '../supabase/schema/05_regies.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('check') || content.includes('constraint'),
    'regies devrait avoir des contraintes de validation (email, téléphone, etc.)'
  );
});

test('Table logements a des contraintes de validation', () => {
  const filePath = path.join(__dirname, '../supabase/schema/07_logements.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('check_statut'),
    'logements devrait avoir une contrainte sur le statut'
  );
  
  assert(
    content.includes('vacant') && content.includes('occupé'),
    'La contrainte de statut devrait inclure vacant et occupé'
  );
});

test('Hiérarchie complète : regies -> immeubles -> logements', () => {
  // Vérifier que la hiérarchie est cohérente
  const regiesPath = path.join(__dirname, '../supabase/schema/05_regies.sql');
  const immeublesPath = path.join(__dirname, '../supabase/schema/06_immeubles.sql');
  const logementsPath = path.join(__dirname, '../supabase/schema/07_logements.sql');
  
  const regiesContent = fs.readFileSync(regiesPath, 'utf8');
  const immeublesContent = fs.readFileSync(immeublesPath, 'utf8');
  const logementsContent = fs.readFileSync(logementsPath, 'utf8');
  
  // Vérifier que immeubles référence regies
  assert(
    immeublesContent.includes('regie_id') && immeublesContent.includes('references regies'),
    'immeubles doit référencer regies'
  );
  
  // Vérifier que logements référence immeubles
  assert(
    logementsContent.includes('immeuble_id') && logementsContent.includes('references immeubles'),
    'logements doit référencer immeubles'
  );
  
  // Vérifier cascade
  assert(
    immeublesContent.includes('on delete cascade'),
    'La suppression d\'une régie doit supprimer ses immeubles'
  );
  
  assert(
    logementsContent.includes('on delete cascade'),
    'La suppression d\'un immeuble doit supprimer ses logements'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 4 - Structure immobilière        ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`);

  for (const { name, fn } of tests) {
    try {
      fn();
      passedTests++;
      console.log(`${colors.green}✓${colors.reset} ${name}`);
    } catch (error) {
      failedTests++;
      console.log(`${colors.red}✗${colors.reset} ${name}`);
      console.log(`  ${colors.red}Erreur: ${error.message}${colors.reset}`);
    }
  }

  console.log(`\n${colors.blue}════════════════════════════════════════════════${colors.reset}`);
  console.log(`Tests réussis: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Tests échoués: ${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}`);
  console.log(`Total: ${passedTests + failedTests}`);
  console.log(`${colors.blue}════════════════════════════════════════════════${colors.reset}\n`);

  if (failedTests > 0) {
    console.log(`${colors.red}❌ Certains tests ont échoué${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Tous les tests de structure sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 4 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
