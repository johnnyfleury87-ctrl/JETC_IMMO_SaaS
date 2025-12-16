/**
 * Tests de validation - ÉTAPE 10 : Acceptation ticket & création mission
 * 
 * Vérifie :
 * - Table missions créée avec contrainte unique sur ticket_id
 * - Colonne locked_at ajoutée à tickets
 * - Fonction accept_ticket_and_create_mission fonctionnelle
 * - Entreprise autorisée uniquement
 * - Une seule mission par ticket
 * - RLS sur missions
 * - API /api/tickets/accept
 * 
 * Usage:
 *   node tests/missions.test.js
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

test('Fichier 14_missions.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  assert(fs.existsSync(filePath), '14_missions.sql devrait exister');
});

// ===== Tests structure SQL =====

test('Colonne locked_at ajoutée à tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table tickets') && content.includes('locked_at'),
    'Devrait ajouter la colonne locked_at à tickets'
  );
});

test('Table missions créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('missions'),
    'Devrait créer la table missions'
  );
});

test('Colonne ticket_id est unique dans missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('ticket_id') && content.includes('unique'),
    'ticket_id devrait avoir une contrainte unique'
  );
});

test('Colonne entreprise_id référence entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise_id') && content.includes('references entreprises'),
    'entreprise_id devrait référencer la table entreprises'
  );
});

test('Colonne statut avec valeurs contrôlées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut') && content.includes('check') && content.includes('en_attente'),
    'statut devrait avoir une contrainte check avec les valeurs possibles'
  );
});

test('Colonnes temporelles créées (created_at, started_at, completed_at, validated_at)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasCreatedAt = content.includes('created_at');
  const hasStartedAt = content.includes('started_at');
  const hasCompletedAt = content.includes('completed_at');
  const hasValidatedAt = content.includes('validated_at');
  
  assert(
    hasCreatedAt && hasStartedAt && hasCompletedAt && hasValidatedAt,
    'Devrait avoir toutes les colonnes temporelles'
  );
});

test('Colonnes optionnelles (devis_url, facture_url, montant)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasDevisUrl = content.includes('devis_url');
  const hasfactureUrl = content.includes('facture_url');
  const hasMontant = content.includes('montant');
  
  assert(
    hasDevisUrl && hasfactureUrl && hasMontant,
    'Devrait avoir devis_url, facture_url, montant'
  );
});

// ===== Tests fonction SQL =====

test('Fonction accept_ticket_and_create_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('accept_ticket_and_create_mission'),
    'Devrait créer la fonction accept_ticket_and_create_mission'
  );
});

test('Fonction est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('accept_ticket_and_create_mission') && content.includes('security definer'),
    'Fonction devrait être security definer'
  );
});

test('Fonction vérifie que le ticket existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Ticket non trouvé') || content.includes('not found'),
    'Fonction devrait vérifier que le ticket existe'
  );
});

test('Fonction vérifie que le ticket n\'est pas verrouillé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locked') || content.includes('verrouillé'),
    'Fonction devrait vérifier que le ticket n\'est pas verrouillé'
  );
});

test('Fonction vérifie que l\'entreprise est autorisée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regies_entreprises') && content.includes('autorise'),
    'Fonction devrait vérifier que l\'entreprise est autorisée'
  );
});

test('Fonction crée la mission', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('insert into missions'),
    'Fonction devrait créer une mission'
  );
});

test('Fonction verrouille le ticket (update locked_at)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('update tickets') && content.includes('locked_at'),
    'Fonction devrait verrouiller le ticket'
  );
});

test('Fonction met à jour le statut du ticket', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Chercher une mise à jour du statut après la création de mission
  const updateTicketIndex = content.indexOf('update tickets');
  const hasStatutUpdate = content.includes('statut', updateTicketIndex);
  
  assert(
    hasStatutUpdate,
    'Fonction devrait mettre à jour le statut du ticket'
  );
});

test('Fonction retourne un jsonb avec success et mission_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('jsonb_build_object') && content.includes('mission_id'),
    'Fonction devrait retourner un jsonb avec mission_id'
  );
});

// ===== Tests RLS =====

test('RLS activé sur table missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table missions enable row level security'),
    'RLS devrait être activé sur missions'
  );
});

test('Policy : Régie peut voir missions de ses tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view missions') && content.includes('get_user_regie_id'),
    'Policy pour régie devrait exister'
  );
});

test('Policy : Entreprise peut voir ses missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can view own missions'),
    'Policy pour entreprise devrait exister'
  );
});

test('Policy : Locataire peut voir missions de ses tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire can view missions'),
    'Policy pour locataire devrait exister'
  );
});

test('Policy : Entreprise peut mettre à jour ses missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can update own missions'),
    'Policy update pour entreprise devrait exister'
  );
});

test('Policy : Régie peut mettre à jour missions de ses tickets', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can update missions'),
    'Policy update pour régie devrait exister'
  );
});

test('Policy : Admin JTEC peut voir toutes les missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Admin JTEC can view all missions'),
    'Policy pour admin JTEC devrait exister'
  );
});

// ===== Tests vue =====

test('Vue missions_details créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('missions_details'),
    'Devrait créer la vue missions_details'
  );
});

test('Vue missions_details joint toutes les tables nécessaires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasMissionsJoin = content.includes('from missions');
  const hasTicketsJoin = content.includes('join tickets');
  const hasEntreprisesJoin = content.includes('join entreprises');
  const hasLocatairesJoin = content.includes('join locataires');
  const hasLogementsJoin = content.includes('join logements');
  const hasImmeublesJoin = content.includes('join immeubles');
  const hasRegiesJoin = content.includes('join regies');
  
  assert(
    hasMissionsJoin && hasTicketsJoin && hasEntreprisesJoin && hasLocatairesJoin && hasLogementsJoin && hasImmeublesJoin && hasRegiesJoin,
    'Vue devrait joindre missions, tickets, entreprises, locataires, logements, immeubles, regies'
  );
});

// ===== Tests API =====

test('API accept existe', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  assert(fs.existsSync(filePath), 'API tickets/accept.js devrait exister');
});

test('API vérifie que l\'utilisateur est une entreprise', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est une entreprise'
  );
});

test('API récupère l\'ID de l\'entreprise', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('from(\'entreprises\')') && content.includes('profile_id'),
    'API devrait récupérer l\'ID de l\'entreprise via profile_id'
  );
});

test('API appelle la fonction accept_ticket_and_create_mission', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('accept_ticket_and_create_mission'),
    'API devrait appeler la fonction SQL accept_ticket_and_create_mission'
  );
});

test('API passe ticket_id et entreprise_id à la fonction', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('p_ticket_id') && content.includes('p_entreprise_id'),
    'API devrait passer les paramètres p_ticket_id et p_entreprise_id'
  );
});

test('API gère les erreurs de la fonction SQL', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('result.success') || content.includes('!result.success'),
    'API devrait vérifier result.success'
  );
});

test('API retourne le mission_id en cas de succès', () => {
  const filePath = path.join(__dirname, '../api/tickets/accept.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mission_id') && content.includes('201'),
    'API devrait retourner mission_id avec status 201'
  );
});

// ===== Tests index =====

test('Index sur missions.ticket_id pour performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_ticket_id'),
    'Devrait avoir un index sur missions.ticket_id'
  );
});

test('Index sur missions.entreprise_id pour performance', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_entreprise_id'),
    'Devrait avoir un index sur missions.entreprise_id'
  );
});

test('Index sur missions.statut pour filtres', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_statut'),
    'Devrait avoir un index sur missions.statut'
  );
});

// ===== Tests trigger =====

test('Trigger pour updated_at sur missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/14_missions.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('missions_updated_at'),
    'Devrait avoir un trigger pour mettre à jour updated_at'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 10 - Missions & Acceptation      ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests missions sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 10 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
