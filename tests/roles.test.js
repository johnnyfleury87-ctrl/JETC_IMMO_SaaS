/**
 * Tests de vérification des rôles
 * ÉTAPE 3 - Validation profils & rôles
 * 
 * Vérifie que chaque rôle peut accéder à son dashboard
 * 
 * Usage:
 *   node tests/roles.test.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PUBLIC_DIR = path.join(__dirname, '../public');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// Mapping des rôles vers les dashboards attendus
const ROLE_DASHBOARD_MAPPING = {
  'locataire': '/locataire/dashboard.html',
  'regie': '/regie/dashboard.html',
  'entreprise': '/entreprise/dashboard.html',
  'technicien': '/technicien/dashboard.html',
  'proprietaire': '/proprietaire/dashboard.html',
  'admin_jtec': '/admin/dashboard.html'
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

test('Dossier public existe', () => {
  assert(fs.existsSync(PUBLIC_DIR), 'Le dossier public/ devrait exister');
});

test('Tous les dashboards existent', () => {
  for (const [role, dashboardPath] of Object.entries(ROLE_DASHBOARD_MAPPING)) {
    const fullPath = path.join(__dirname, '..', 'public', dashboardPath);
    assert(
      fs.existsSync(fullPath),
      `Le dashboard ${dashboardPath} devrait exister pour le rôle ${role}`
    );
  }
});

test('Chaque dashboard contient le code de vérification d\'authentification', () => {
  for (const [role, dashboardPath] of Object.entries(ROLE_DASHBOARD_MAPPING)) {
    const fullPath = path.join(__dirname, '..', 'public', dashboardPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    assert(
      content.includes('jetc_access_token'),
      `${dashboardPath} devrait vérifier le token jetc_access_token`
    );
    
    assert(
      content.includes('jetc_user'),
      `${dashboardPath} devrait lire jetc_user du localStorage`
    );
  }
});

test('Chaque dashboard vérifie le rôle de l\'utilisateur', () => {
  for (const [role, dashboardPath] of Object.entries(ROLE_DASHBOARD_MAPPING)) {
    const fullPath = path.join(__dirname, '..', 'public', dashboardPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    assert(
      content.includes(role) || content.includes('user.role'),
      `${dashboardPath} devrait vérifier le rôle "${role}"`
    );
  }
});

test('Chaque dashboard a un bouton de déconnexion', () => {
  for (const [role, dashboardPath] of Object.entries(ROLE_DASHBOARD_MAPPING)) {
    const fullPath = path.join(__dirname, '..', 'public', dashboardPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    assert(
      content.includes('Déconnexion') || content.includes('logout'),
      `${dashboardPath} devrait avoir un bouton de déconnexion`
    );
  }
});

test('Chaque dashboard redirige vers /login.html si non authentifié', () => {
  for (const [role, dashboardPath] of Object.entries(ROLE_DASHBOARD_MAPPING)) {
    const fullPath = path.join(__dirname, '..', 'public', dashboardPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    assert(
      content.includes('/login.html') || content.includes('login.html'),
      `${dashboardPath} devrait rediriger vers login.html si non authentifié`
    );
  }
});

test('La page de login stocke les informations dans localStorage', () => {
  const loginPath = path.join(__dirname, '../public/login.html');
  assert(fs.existsSync(loginPath), 'login.html devrait exister');
  
  const content = fs.readFileSync(loginPath, 'utf8');
  
  assert(
    content.includes('localStorage.setItem'),
    'login.html devrait utiliser localStorage.setItem'
  );
  
  assert(
    content.includes('jetc_access_token'),
    'login.html devrait stocker jetc_access_token'
  );
  
  assert(
    content.includes('jetc_user'),
    'login.html devrait stocker jetc_user'
  );
});

test('La page de login redirige vers le bon dashboard selon le rôle', () => {
  const loginPath = path.join(__dirname, '../public/login.html');
  const content = fs.readFileSync(loginPath, 'utf8');
  
  // Vérifier que la redirection se fait selon le rôle
  assert(
    content.includes('user.role') || content.includes('role'),
    'login.html devrait vérifier le rôle pour la redirection'
  );
  
  // Vérifier qu'au moins 3 rôles sont gérés dans la redirection
  let roleCount = 0;
  for (const role of Object.keys(ROLE_DASHBOARD_MAPPING)) {
    if (content.includes(role)) {
      roleCount++;
    }
  }
  
  assert(
    roleCount >= 3,
    `login.html devrait gérer au moins 3 rôles différents, trouvé: ${roleCount}`
  );
});

test('Le fichier 04_users.sql contient le trigger de création de profil', () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/04_users.sql');
  assert(fs.existsSync(sqlPath), '04_users.sql devrait exister');
  
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes('function public.handle_new_user'),
    '04_users.sql devrait contenir la fonction handle_new_user()'
  );
  
  assert(
    content.includes('trigger') && content.includes('on_auth_user_created'),
    '04_users.sql devrait contenir le trigger on_auth_user_created'
  );
  
  assert(
    content.includes('insert into profiles') || content.includes('insert into public.profiles'),
    'La fonction handle_new_user() devrait insérer dans profiles'
  );
});

test('La table profiles a un rôle par défaut', () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/04_users.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("default 'regie'"),
    'La colonne role devrait avoir "regie" comme valeur par défaut'
  );
});

test('La route /api/auth/me existe', () => {
  const mePath = path.join(__dirname, '../api/auth/me.js');
  assert(fs.existsSync(mePath), '/api/auth/me.js devrait exister');
  
  const content = fs.readFileSync(mePath, 'utf8');
  
  assert(
    content.includes('Authorization'),
    'me.js devrait vérifier le header Authorization'
  );
  
  assert(
    content.includes('Bearer'),
    'me.js devrait gérer les tokens Bearer'
  );
  
  assert(
    content.includes('profiles'),
    'me.js devrait requêter la table profiles'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS RÔLES - ÉTAPE 3                         ║${colors.reset}`);
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
    console.log(`${colors.red}❌ Certains tests de vérification des rôles ont échoué${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Tous les tests de rôles sont passés !${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
