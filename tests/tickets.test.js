/**
 * Tests de validation - ÉTAPE 5 : Création de tickets
 * 
 * Vérifie :
 * - Existence des fichiers (table SQL, API, formulaire)
 * - Contraintes de sécurité (locataire ne crée que pour son logement)
 * - Liaison automatique à la régie
 * 
 * Usage:
 *   node tests/tickets.test.js
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

test('Fichier 09_tickets.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  assert(fs.existsSync(filePath), '09_tickets.sql devrait exister');
});

test('Table tickets a les colonnes requises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const requiredColumns = [
    'id', 'titre', 'description', 'categorie', 'priorite', 'statut',
    'logement_id', 'locataire_id', 'regie_id', 'created_at'
  ];
  
  for (const col of requiredColumns) {
    assert(
      content.includes(col),
      `La table tickets devrait avoir la colonne ${col}`
    );
  }
});

test('Table tickets a des FK vers logements et locataires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('logement_id') && content.includes('references logements'),
    'tickets devrait avoir une FK vers logements'
  );
  
  assert(
    content.includes('locataire_id') && content.includes('references locataires'),
    'tickets devrait avoir une FK vers locataires'
  );
  
  assert(
    content.includes('logement_id') && content.includes('not null'),
    'logement_id devrait être NOT NULL'
  );
  
  assert(
    content.includes('locataire_id') && content.includes('not null'),
    'locataire_id devrait être NOT NULL'
  );
});

test('Table tickets a une colonne regie_id (calculée automatiquement)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie_id'),
    'tickets devrait avoir une colonne regie_id'
  );
  
  assert(
    content.includes('regie_id') && content.includes('not null'),
    'regie_id devrait être NOT NULL'
  );
});

test('Trigger set_ticket_regie_id existe pour calculer regie_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('set_ticket_regie_id'),
    'Devrait avoir une fonction set_ticket_regie_id()'
  );
  
  assert(
    content.includes('trigger') && content.includes('set_ticket_regie_id'),
    'Devrait avoir un trigger qui appelle set_ticket_regie_id()'
  );
  
  assert(
    content.includes('before insert on tickets'),
    'Le trigger devrait s\'exécuter BEFORE INSERT'
  );
});

test('Trigger calcule regie_id via logement → immeuble → regie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('logements') && content.includes('immeubles') && content.includes('regie_id'),
    'Le trigger devrait faire un JOIN logements → immeubles pour obtenir regie_id'
  );
});

test('Table tickets a des contraintes de validation', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('check_priorite') || (content.includes('check') && content.includes('priorite')),
    'Devrait avoir une contrainte sur la priorité'
  );
  
  assert(
    content.includes('check_categorie') || (content.includes('check') && content.includes('categorie')),
    'Devrait avoir une contrainte sur la catégorie'
  );
  
  // Vérifier les valeurs valides
  assert(
    content.includes('plomberie') && content.includes('électricité'),
    'Les catégories devraient inclure plomberie et électricité'
  );
});

test('Table tickets a un statut par défaut "ouvert"', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut') && content.includes('default') && content.includes('ouvert'),
    'Le statut par défaut devrait être "ouvert"'
  );
});

test('Route API /api/tickets/create existe', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  assert(fs.existsSync(filePath), 'La route /api/tickets/create.js devrait exister');
});

test('API vérifie que l\'utilisateur est un locataire', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locataire') && content.includes('role'),
    'L\'API devrait vérifier que le role est "locataire"'
  );
  
  assert(
    content.includes('403') || content.includes('Seuls les locataires'),
    'L\'API devrait retourner 403 si l\'utilisateur n\'est pas un locataire'
  );
});

test('API récupère le logement_id du locataire', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('logement_id'),
    'L\'API devrait récupérer le logement_id du locataire'
  );
  
  assert(
    content.includes('locataires') && content.includes('profile_id'),
    'L\'API devrait requêter la table locataires avec profile_id'
  );
});

test('API vérifie que le locataire a un logement', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('!locataire.logement_id') || content.includes('logement_id') && content.includes('null'),
    'L\'API devrait vérifier que le locataire a un logement_id'
  );
  
  assert(
    content.includes('rattaché') || content.includes('logement'),
    'L\'API devrait refuser si le locataire n\'a pas de logement'
  );
});

test('API valide les champs obligatoires', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('titre') && content.includes('description') && content.includes('categorie'),
    'L\'API devrait valider titre, description et catégorie'
  );
  
  assert(
    content.includes('400') || content.includes('obligatoire'),
    'L\'API devrait retourner 400 si les champs sont manquants'
  );
});

test('API utilise le logement_id du locataire (pas celui du body)', () => {
  const filePath = path.join(__dirname, '../api/tickets/create.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Vérifier que l'API utilise locataire.logement_id et non pas un logement_id du body
  assert(
    content.includes('locataire.logement_id') || 
    (content.includes('logement_id:') && content.includes('locataire')),
    'L\'API devrait utiliser le logement_id du locataire authentifié'
  );
});

test('Dashboard locataire a un bouton de création de ticket', () => {
  const filePath = path.join(__dirname, '../public/locataire/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('ticket') && (content.includes('Créer') || content.includes('créer')),
    'Le dashboard devrait avoir un bouton de création de ticket'
  );
});

test('Dashboard locataire a un formulaire de ticket', () => {
  const filePath = path.join(__dirname, '../public/locataire/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const requiredFields = ['ticketTitre', 'ticketCategorie', 'ticketDescription'];
  
  for (const field of requiredFields) {
    assert(
      content.includes(field),
      `Le formulaire devrait avoir le champ ${field}`
    );
  }
});

test('Dashboard locataire appelle /api/tickets/create', () => {
  const filePath = path.join(__dirname, '../public/locataire/dashboard.html');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('/api/tickets/create'),
    'Le dashboard devrait appeler l\'API /api/tickets/create'
  );
  
  assert(
    content.includes('POST') || content.includes('method:'),
    'L\'appel devrait utiliser la méthode POST'
  );
});

test('Enum ticket_status mis à jour avec les bons statuts', () => {
  const filePath = path.join(__dirname, '../supabase/schema/02_enums.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('ticket_status'),
    'Devrait avoir un enum ticket_status'
  );
  
  assert(
    content.includes('ouvert'),
    'ticket_status devrait inclure "ouvert"'
  );
  
  assert(
    content.includes('en_cours') || content.includes('termine'),
    'ticket_status devrait inclure des statuts de progression'
  );
});

test('Table tickets a des index de performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/09_tickets.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const indexesToCheck = [
    'idx_tickets_logement_id',
    'idx_tickets_locataire_id',
    'idx_tickets_regie_id',
    'idx_tickets_statut'
  ];
  
  for (const idx of indexesToCheck) {
    assert(
      content.includes(idx) || (content.includes('create index') && content.includes(idx.split('_').pop())),
      `Devrait avoir l'index ${idx}`
    );
  }
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 5 - Création de tickets          ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests de création de tickets sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 5 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
