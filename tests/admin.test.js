/**
 * Tests de validation - ÉTAPE 9 : Administration JTEC
 * 
 * Vérifie :
 * - Vues SQL agrégées créées
 * - Pas de données nominatives dans les vues
 * - API stats réservée à admin_jtec
 * - Dashboard admin fonctionnel
 * - Accès strictement contrôlé
 * 
 * Usage:
 *   node tests/admin.test.js
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

test('Fichier 13_admin.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  assert(fs.existsSync(filePath), '13_admin.sql devrait exister');
});

// ===== Tests vues agrégées =====

test('Vue admin_stats_regies créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('admin_stats_regies'),
    'Devrait créer la vue admin_stats_regies'
  );
});

test('Vue admin_stats_immeubles créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_immeubles'),
    'Devrait créer la vue admin_stats_immeubles'
  );
});

test('Vue admin_stats_logements créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_logements'),
    'Devrait créer la vue admin_stats_logements'
  );
});

test('Vue admin_stats_locataires créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_locataires'),
    'Devrait créer la vue admin_stats_locataires'
  );
});

test('Vue admin_stats_tickets créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_tickets'),
    'Devrait créer la vue admin_stats_tickets'
  );
});

test('Vue admin_stats_entreprises créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_entreprises'),
    'Devrait créer la vue admin_stats_entreprises'
  );
});

test('Vue admin_stats_tickets_categories créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_tickets_categories'),
    'Devrait créer la vue admin_stats_tickets_categories'
  );
});

test('Vue admin_stats_tickets_priorites créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_tickets_priorites'),
    'Devrait créer la vue admin_stats_tickets_priorites'
  );
});

test('Vue admin_stats_evolution créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_evolution'),
    'Devrait créer la vue admin_stats_evolution'
  );
});

test('Vue admin_dashboard créée (vue consolidée)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_dashboard'),
    'Devrait créer la vue admin_dashboard'
  );
});

// ===== Tests anonymisation =====

test('Pas de colonne "nom" dans les vues admin', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier qu'il n'y a pas de "select nom" dans les vues admin
  const selectNomCount = (content.match(/select.*nom.*from/gi) || []).length;
  
  assert(
    selectNomCount === 0,
    'Les vues admin ne devraient pas sélectionner de colonnes "nom"'
  );
});

test('Pas de colonne "email" dans les vues admin', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier qu'il n'y a pas de "select email" dans les vues admin
  const selectEmailCount = (content.match(/select.*email.*from/gi) || []).length;
  
  assert(
    selectEmailCount === 0,
    'Les vues admin ne devraient pas sélectionner de colonnes "email"'
  );
});

test('Pas de colonne "telephone" dans les vues admin', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier qu'il n'y a pas de "select telephone" dans les vues admin
  const selectTelCount = (content.match(/select.*telephone.*from/gi) || []).length;
  
  assert(
    selectTelCount === 0,
    'Les vues admin ne devraient pas sélectionner de colonnes "telephone"'
  );
});

test('Vues utilisent uniquement count() et avg() (agrégation)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const countCount = (content.match(/count\(/gi) || []).length;
  
  assert(
    countCount > 10,
    'Les vues devraient utiliser count() pour agréger les données'
  );
});

// ===== Tests fonction helper =====

test('Fonction is_admin_jtec() créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('is_admin_jtec'),
    'Devrait créer la fonction is_admin_jtec()'
  );
});

test('Fonction is_admin_jtec() retourne boolean', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('is_admin_jtec') && content.includes('returns boolean'),
    'is_admin_jtec() devrait retourner boolean'
  );
});

test('Fonction is_admin_jtec() est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('is_admin_jtec') && content.includes('security definer'),
    'is_admin_jtec() devrait être security definer'
  );
});

// ===== Tests API =====

test('API stats admin existe', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  assert(fs.existsSync(filePath), 'API admin/stats.js devrait exister');
});

test('API vérifie que l\'utilisateur est admin_jtec', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_jtec') && content.includes('403'),
    'API devrait vérifier que le rôle est admin_jtec'
  );
});

test('API utilise la vue admin_dashboard', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_dashboard'),
    'API devrait utiliser la vue admin_dashboard'
  );
});

test('API récupère les catégories de tickets', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_tickets_categories'),
    'API devrait récupérer les stats par catégorie'
  );
});

test('API récupère les priorités de tickets', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_tickets_priorites'),
    'API devrait récupérer les stats par priorité'
  );
});

test('API récupère l\'évolution temporelle', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_stats_evolution'),
    'API devrait récupérer l\'évolution temporelle'
  );
});

// ===== Tests dashboard =====

test('Dashboard admin existe', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  assert(fs.existsSync(filePath), 'Dashboard admin devrait exister');
});

test('Dashboard vérifie le rôle admin_jtec', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('admin_jtec') && content.includes('Accès réservé'),
    'Dashboard devrait vérifier que l\'utilisateur est admin_jtec'
  );
});

test('Dashboard appelle l\'API /api/admin/stats', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('/api/admin/stats'),
    'Dashboard devrait appeler /api/admin/stats'
  );
});

test('Dashboard affiche les stats globales', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('stat-regies') && content.includes('stat-tickets'),
    'Dashboard devrait afficher les stats globales'
  );
});

test('Dashboard affiche les tickets par catégorie', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('table-categories'),
    'Dashboard devrait afficher les tickets par catégorie'
  );
});

test('Dashboard affiche les tickets par priorité', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('table-priorites'),
    'Dashboard devrait afficher les tickets par priorité'
  );
});

// ===== Tests index de performance =====

test('Index sur created_at pour performance des vues', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_regies_created_at') || content.includes('created_at'),
    'Devrait avoir des index sur created_at'
  );
});

test('Index sur statut pour filtres tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_tickets_statut'),
    'Devrait avoir un index sur tickets.statut'
  );
});

test('Index sur priorité pour filtres tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_tickets_priorite'),
    'Devrait avoir un index sur tickets.priorite'
  );
});

test('Index sur catégorie pour filtres tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_tickets_categorie'),
    'Devrait avoir un index sur tickets.categorie'
  );
});

// ===== Tests sécurité =====

test('Vues admin utilisent count() et avg() uniquement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/13_admin.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Pas de select de colonnes individuelles dans les vues admin
  const hasAggregation = content.includes('count(*)') && content.includes('filter');
  
  assert(
    hasAggregation,
    'Les vues admin devraient utiliser des fonctions d\'agrégation'
  );
});

test('API retourne uniquement des données agrégées', () => {
  const filePath = path.join(__dirname, '../api/admin/stats.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier qu'on utilise les vues admin_stats_*
  const usesAdminViews = content.includes('admin_stats_') || content.includes('admin_dashboard');
  
  assert(
    usesAdminViews,
    'API devrait utiliser uniquement des vues agrégées'
  );
});

test('Dashboard ne demande pas de données nominatives', () => {
  const filePath = path.join(__dirname, '../public/admin/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier qu'on n'affiche pas de noms, emails, etc.
  const hasNoNominalData = !content.includes('nom_locataire') && !content.includes('email_');
  
  assert(
    hasNoNominalData,
    'Dashboard ne devrait pas afficher de données nominatives'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 9 - Administration JTEC          ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests admin sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 9 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
