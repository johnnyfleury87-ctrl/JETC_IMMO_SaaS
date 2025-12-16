/**
 * Tests d'authentification JETC_IMMO
 * ÉTAPE 3 - Validation profils & rôles
 * 
 * Usage:
 *   node tests/auth.test.js
 * 
 * Prérequis:
 *   - Serveur démarré sur localhost:3000
 *   - Supabase configuré avec 04_users.sql exécuté
 */

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = `test-${Date.now()}@jetc-immo.com`;
const TEST_PASSWORD = 'motdepasse123';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// Fonction helper pour faire des requêtes HTTP
function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

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

test('Healthcheck API est accessible', async () => {
  const res = await makeRequest('/api/healthcheck');
  assert(res.status === 200, 'Statut devrait être 200');
  assert(res.data.ok === true, 'ok devrait être true');
  assert(res.data.project === 'JETC_IMMO', 'Projet devrait être JETC_IMMO');
});

test('Inscription d\'un nouvel utilisateur', async () => {
  const res = await makeRequest('/api/auth/register', 'POST', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    language: 'fr'
  });
  
  assert(res.status === 200, `Statut devrait être 200, reçu: ${res.status}`);
  assert(res.data.success === true, 'success devrait être true');
  assert(res.data.user !== undefined, 'user devrait être défini');
  assert(res.data.user.email === TEST_EMAIL, `Email devrait être ${TEST_EMAIL}`);
});

test('Connexion avec les identifiants créés', async () => {
  const res = await makeRequest('/api/auth/login', 'POST', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  
  assert(res.status === 200, `Statut devrait être 200, reçu: ${res.status}`);
  assert(res.data.success === true, 'success devrait être true');
  assert(res.data.user !== undefined, 'user devrait être défini');
  assert(res.data.session !== undefined, 'session devrait être définie');
  assert(res.data.session.access_token !== undefined, 'access_token devrait être défini');
  
  // Sauvegarder le token pour les tests suivants
  global.ACCESS_TOKEN = res.data.session.access_token;
  global.USER = res.data.user;
});

test('Le profil est automatiquement créé avec un rôle par défaut', async () => {
  assert(global.USER !== undefined, 'USER devrait être défini (test précédent)');
  assert(global.USER.role !== undefined, 'Le profil devrait avoir un rôle');
  assert(global.USER.role === 'regie', `Le rôle par défaut devrait être "regie", reçu: ${global.USER.role}`);
  assert(global.USER.language === 'fr', `La langue devrait être "fr", reçu: ${global.USER.language}`);
  assert(global.USER.is_demo === false, `is_demo devrait être false, reçu: ${global.USER.is_demo}`);
});

test('Route /api/auth/me retourne le profil avec token valide', async () => {
  assert(global.ACCESS_TOKEN !== undefined, 'ACCESS_TOKEN devrait être défini');
  
  const res = await makeRequest('/api/auth/me', 'GET', null, {
    'Authorization': `Bearer ${global.ACCESS_TOKEN}`
  });
  
  assert(res.status === 200, `Statut devrait être 200, reçu: ${res.status}`);
  assert(res.data.success === true, 'success devrait être true');
  assert(res.data.user !== undefined, 'user devrait être défini');
  assert(res.data.user.email === TEST_EMAIL, `Email devrait correspondre`);
  assert(res.data.user.role === 'regie', 'Rôle devrait être regie');
});

test('Route /api/auth/me refuse un token invalide', async () => {
  const res = await makeRequest('/api/auth/me', 'GET', null, {
    'Authorization': 'Bearer token_invalide_12345'
  });
  
  assert(res.status === 401, `Statut devrait être 401, reçu: ${res.status}`);
  assert(res.data.success === false, 'success devrait être false');
});

test('Route /api/auth/me refuse une requête sans token', async () => {
  const res = await makeRequest('/api/auth/me', 'GET');
  
  assert(res.status === 401, `Statut devrait être 401, reçu: ${res.status}`);
  assert(res.data.success === false, 'success devrait être false');
});

test('Inscription avec email existant est refusée', async () => {
  const res = await makeRequest('/api/auth/register', 'POST', {
    email: TEST_EMAIL, // Même email que précédemment
    password: 'autremotdepasse',
    language: 'en'
  });
  
  assert(res.status === 400, `Statut devrait être 400, reçu: ${res.status}`);
  assert(res.data.success === false, 'success devrait être false');
});

test('Connexion avec mot de passe incorrect est refusée', async () => {
  const res = await makeRequest('/api/auth/login', 'POST', {
    email: TEST_EMAIL,
    password: 'mauvais_mot_de_passe'
  });
  
  assert(res.status === 401, `Statut devrait être 401, reçu: ${res.status}`);
  assert(res.data.success === false, 'success devrait être false');
});

// ==================== EXÉCUTION ====================

async function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 3 - Profils & Rôles               ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`);

  for (const { name, fn } of tests) {
    try {
      await fn();
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
    console.log(`${colors.yellow}⚠️  Certains tests ont échoué.${colors.reset}`);
    console.log(`${colors.yellow}Vérifiez que:${colors.reset}`);
    console.log(`  - Le serveur tourne sur localhost:3000`);
    console.log(`  - Supabase est configuré dans .env.local`);
    console.log(`  - Le fichier supabase/schema/04_users.sql est exécuté\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Tous les tests sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 3 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

// Gestion des erreurs globales
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Erreur non gérée:${colors.reset}`, error);
  process.exit(1);
});

// Lancer les tests
runTests();
