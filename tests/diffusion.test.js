/**
 * Tests de validation - ÉTAPE 6 : Diffusion des tickets aux entreprises
 * 
 * Vérifie :
 * - Existence des tables (entreprises, regies_entreprises)
 * - Modes de diffusion (général, restreint)
 * - Sécurité : entreprise non autorisée ne voit rien
 * - Vue tickets_visibles_entreprise
 * 
 * Usage:
 *   node tests/diffusion.test.js
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

test('Fichier 10_entreprises.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  assert(fs.existsSync(filePath), '10_entreprises.sql devrait exister');
});

test('Table entreprises créée avec colonnes requises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const requiredColumns = [
    'id', 'nom', 'siret', 'email', 'telephone',
    'specialites', 'profile_id', 'created_at'
  ];
  
  for (const col of requiredColumns) {
    assert(
      content.includes(col),
      `La table entreprises devrait avoir la colonne ${col}`
    );
  }
});

test('Table entreprises a une FK vers profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('profile_id') && content.includes('references profiles'),
    'entreprises devrait avoir une FK vers profiles'
  );
});

test('Table regies_entreprises créée (table de liaison)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('regies_entreprises'),
    'Devrait créer la table regies_entreprises'
  );
  
  assert(
    content.includes('regie_id') && content.includes('entreprise_id'),
    'regies_entreprises devrait avoir regie_id et entreprise_id'
  );
});

test('Table regies_entreprises a des FK vers regies et entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie_id') && content.includes('references regies'),
    'regies_entreprises devrait avoir une FK vers regies'
  );
  
  assert(
    content.includes('entreprise_id') && content.includes('references entreprises'),
    'regies_entreprises devrait avoir une FK vers entreprises'
  );
});

test('Table regies_entreprises a une colonne mode_diffusion', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mode_diffusion'),
    'regies_entreprises devrait avoir une colonne mode_diffusion'
  );
  
  assert(
    content.includes('general') && content.includes('restreint'),
    'mode_diffusion devrait avoir les valeurs "general" et "restreint"'
  );
});

test('Contrainte unique sur (regie_id, entreprise_id)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('unique') && content.includes('regie_entreprise'),
    'Devrait avoir une contrainte unique sur (regie_id, entreprise_id)'
  );
});

test('Contrainte check sur mode_diffusion', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('check_mode_diffusion') || (content.includes('check') && content.includes('mode_diffusion')),
    'Devrait avoir une contrainte check sur mode_diffusion'
  );
});

test('Vue tickets_visibles_entreprise créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('tickets_visibles_entreprise'),
    'Devrait créer la vue tickets_visibles_entreprise'
  );
});

test('Vue utilise la table regies_entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('tickets_visibles_entreprise') && content.includes('regies_entreprises'),
    'La vue devrait utiliser regies_entreprises'
  );
});

test('Vue gère le mode général (tous les tickets ouverts)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mode_diffusion') && content.includes('general') && content.includes('ouvert'),
    'La vue devrait gérer le mode général (tous les tickets ouverts)'
  );
});

test('Vue gère le mode restreint (seulement tickets assignés)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('restreint') && content.includes('entreprise_id'),
    'La vue devrait gérer le mode restreint (tickets assignés)'
  );
});

test('Route API /api/tickets/entreprise existe', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  assert(fs.existsSync(filePath), 'La route /api/tickets/entreprise.js devrait exister');
});

test('API vérifie que l\'utilisateur est une entreprise', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('role'),
    'L\'API devrait vérifier que le role est "entreprise"'
  );
  
  assert(
    content.includes('403') || content.includes('Accès réservé'),
    'L\'API devrait retourner 403 si l\'utilisateur n\'est pas une entreprise'
  );
});

test('API récupère l\'entreprise depuis profile_id', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprises') && content.includes('profile_id'),
    'L\'API devrait requêter la table entreprises avec profile_id'
  );
});

test('API utilise la vue tickets_visibles_entreprise', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('tickets_visibles_entreprise'),
    'L\'API devrait utiliser la vue tickets_visibles_entreprise'
  );
});

test('API filtre par entreprise_id', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise_id') && (content.includes('.eq(') || content.includes('where')),
    'L\'API devrait filtrer par entreprise_id'
  );
});

test('API retourne un tableau vide si aucune autorisation', () => {
  const filePath = path.join(__dirname, '../api/tickets/entreprise.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('[]') || content.includes('tickets || []'),
    'L\'API devrait retourner un tableau vide si l\'entreprise n\'a aucune autorisation'
  );
});

test('Table entreprises a des index de performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const indexesToCheck = [
    'idx_entreprises_profile_id',
    'idx_regies_entreprises_regie_id',
    'idx_regies_entreprises_entreprise_id'
  ];
  
  for (const idx of indexesToCheck) {
    assert(
      content.includes(idx),
      `Devrait avoir l'index ${idx}`
    );
  }
});

test('Table entreprises a un nom unique', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('unique') && content.includes('entreprise_nom'),
    'entreprises devrait avoir une contrainte unique sur le nom'
  );
});

test('Table entreprises a une validation email', () => {
  const filePath = path.join(__dirname, '../supabase/schema/10_entreprises.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('check_email') || (content.includes('check') && content.includes('email')),
    'entreprises devrait avoir une contrainte de validation sur l\'email'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 6 - Diffusion tickets            ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests de diffusion sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 6 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
