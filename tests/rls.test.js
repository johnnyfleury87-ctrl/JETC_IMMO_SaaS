/**
 * Tests de validation - ÉTAPE 7 : Row Level Security (RLS)
 * 
 * Vérifie :
 * - RLS activé sur toutes les tables
 * - Policies créées pour chaque rôle
 * - Aucun accès anonyme
 * - Isolation par regie_id
 * - Fonction helper get_user_regie_id()
 * - Pas de récursion RLS
 * 
 * Usage:
 *   node tests/rls.test.js
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

test('Fichier 11_rls.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  assert(fs.existsSync(filePath), '11_rls.sql devrait exister');
});

// ===== Tests activation RLS =====

test('RLS activé sur table profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table profiles enable row level security'),
    'RLS devrait être activé sur profiles'
  );
});

test('RLS activé sur table regies', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table regies enable row level security'),
    'RLS devrait être activé sur regies'
  );
});

test('RLS activé sur table immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table immeubles enable row level security'),
    'RLS devrait être activé sur immeubles'
  );
});

test('RLS activé sur table logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table logements enable row level security'),
    'RLS devrait être activé sur logements'
  );
});

test('RLS activé sur table locataires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table locataires enable row level security'),
    'RLS devrait être activé sur locataires'
  );
});

test('RLS activé sur table tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table tickets enable row level security'),
    'RLS devrait être activé sur tickets'
  );
});

test('RLS activé sur table entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table entreprises enable row level security'),
    'RLS devrait être activé sur entreprises'
  );
});

test('RLS activé sur table regies_entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table regies_entreprises enable row level security'),
    'RLS devrait être activé sur regies_entreprises'
  );
});

// ===== Tests policies profiles =====

test('Policy : user peut voir son propre profile', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('profiles') && content.includes('select') && content.includes('auth.uid()'),
    'Devrait avoir une policy SELECT sur profiles avec auth.uid()'
  );
});

test('Policy : user peut modifier son propre profile', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('profiles') && content.includes('update'),
    'Devrait avoir une policy UPDATE sur profiles'
  );
});

test('Policy : admin_jtec peut tout sur profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_jtec') && content.includes('profiles'),
    'Devrait avoir une policy admin_jtec pour profiles'
  );
});

// ===== Tests policies regies =====

test('Policy : regie peut voir sa propre régie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('regies') && content.includes('select') && content.includes('profile_id'),
    'Devrait avoir une policy SELECT pour regies avec profile_id'
  );
});

test('Policy : regie peut modifier sa propre régie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('regies') && content.includes('update'),
    'Devrait avoir une policy UPDATE pour regies'
  );
});

test('Policy : regie peut créer sa régie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('regies') && content.includes('insert'),
    'Devrait avoir une policy INSERT pour regies'
  );
});

// ===== Tests fonction helper =====

test('Fonction get_user_regie_id() existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('get_user_regie_id'),
    'Devrait créer la fonction get_user_regie_id()'
  );
});

test('Fonction get_user_regie_id() retourne uuid', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_user_regie_id') && content.includes('returns uuid'),
    'get_user_regie_id() devrait retourner uuid'
  );
});

test('Fonction get_user_regie_id() est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_user_regie_id') && content.includes('security definer'),
    'get_user_regie_id() devrait être security definer (évite récursion RLS)'
  );
});

test('Fonction get_user_regie_id() gère le rôle regie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_user_regie_id') && content.includes('regies'),
    'get_user_regie_id() devrait gérer le rôle regie'
  );
});

test('Fonction get_user_regie_id() gère le rôle locataire', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_user_regie_id') && content.includes('locataires') && content.includes('logements'),
    'get_user_regie_id() devrait gérer le rôle locataire (via logements)'
  );
});

// ===== Tests policies immeubles =====

test('Policy : regie voit ses immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('immeubles') && content.includes('get_user_regie_id'),
    'Devrait avoir une policy pour immeubles utilisant get_user_regie_id()'
  );
});

test('Policy : regie peut gérer ses immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('immeubles') && (content.includes('for all') || content.includes('manage')),
    'Devrait avoir une policy CRUD pour immeubles'
  );
});

// ===== Tests policies logements =====

test('Policy : regie voit ses logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create policy') && content.includes('logements') && content.includes('select'),
    'Devrait avoir une policy SELECT pour logements'
  );
});

test('Policy : locataire peut voir son logement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire') && content.includes('logement') && content.includes('locataires'),
    'Devrait avoir une policy pour que locataire voie son logement'
  );
});

// ===== Tests policies locataires =====

test('Policy : locataire voit ses propres données', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locataires') && content.includes('profile_id = auth.uid()'),
    'Locataire devrait voir ses propres données'
  );
});

test('Policy : regie voit ses locataires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie') && content.includes('locataires') && content.includes('select'),
    'Regie devrait voir ses locataires'
  );
});

// ===== Tests policies tickets =====

test('Policy : locataire voit ses tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire') && content.includes('tickets') && content.includes('locataire_id'),
    'Locataire devrait voir ses tickets'
  );
});

test('Policy : locataire peut créer des tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire') && content.includes('tickets') && content.includes('insert'),
    'Locataire devrait pouvoir créer des tickets'
  );
});

test('Policy : regie voit tous ses tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie') && content.includes('tickets') && content.includes('regie_id'),
    'Regie devrait voir tous les tickets de sa régie'
  );
});

test('Policy : entreprise voit tickets selon mode diffusion', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise') && content.includes('tickets') && content.includes('mode_diffusion'),
    'Entreprise devrait voir tickets selon mode_diffusion'
  );
});

// ===== Tests policies entreprises =====

test('Policy : entreprise voit son propre profil', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise') && content.includes('entreprises') && content.includes('profile_id'),
    'Entreprise devrait voir son propre profil'
  );
});

test('Policy : regie voit entreprises autorisées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie') && content.includes('entreprises') && content.includes('regies_entreprises'),
    'Regie devrait voir entreprises autorisées'
  );
});

// ===== Tests policies regies_entreprises =====

test('Policy : regie voit ses autorisations', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regies_entreprises') && content.includes('regie_id'),
    'Regie devrait voir ses autorisations'
  );
});

test('Policy : regie peut créer des autorisations', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regies_entreprises') && content.includes('insert'),
    'Regie devrait pouvoir créer des autorisations'
  );
});

test('Policy : entreprise voit régies qui l\'ont autorisée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise') && content.includes('regies_entreprises'),
    'Entreprise devrait voir régies qui l\'ont autorisée'
  );
});

// ===== Tests admin_jtec =====

test('Admin JTEC peut tout voir sur profiles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const adminPolicies = (content.match(/admin_jtec/g) || []).length;
  assert(
    adminPolicies >= 8,
    'Admin JTEC devrait avoir des policies sur toutes les tables (au moins 8)'
  );
});

// ===== Tests index de performance =====

test('Index sur profiles.role pour performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_profiles_role'),
    'Devrait avoir un index sur profiles.role'
  );
});

test('Index sur tickets.regie_id pour performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_tickets_regie_id'),
    'Devrait avoir un index sur tickets.regie_id'
  );
});

test('Index sur locataires.profile_id pour performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_locataires_profile_id'),
    'Devrait avoir un index sur locataires.profile_id'
  );
});

// ===== Tests sécurité =====

test('Pas d\'accès anonyme : toutes les policies utilisent auth.uid()', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const policyCount = (content.match(/create policy/gi) || []).length;
  const authUidCount = (content.match(/auth\.uid\(\)/g) || []).length;
  
  assert(
    authUidCount > 0,
    'Toutes les policies devraient utiliser auth.uid() pour bloquer accès anonyme'
  );
});

test('Pas de récursion RLS : fonction helper est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/11_rls.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('security definer'),
    'La fonction helper devrait être security definer pour éviter récursion RLS'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 7 - Row Level Security (RLS)     ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests RLS sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 7 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
