/**
 * Tests de validation - ÉTAPE 13 : Facturation
 * 
 * Vérifie :
 * - Table factures (structure, colonnes calculées, contraintes)
 * - Fonctions SQL (generate, update_status, cancel)
 * - Numérotation automatique des factures
 * - Calcul des commissions JTEC
 * - Contrainte UNIQUE sur mission_id (1 mission = 1 facture)
 * - RLS par rôle
 * - Vues de statistiques
 * - APIs de facturation
 * 
 * Usage:
 *   node tests/facturation.test.js
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

test('Fichier 17_facturation.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  assert(fs.existsSync(filePath), '17_facturation.sql devrait exister');
});

// ===== Tests structure table factures =====

test('Table factures créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('factures'),
    'Table factures devrait être créée'
  );
});

test('Colonne mission_id avec contrainte UNIQUE', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mission_id') && content.includes('unique'),
    'mission_id devrait avoir une contrainte UNIQUE'
  );
});

test('Colonnes montant_ht, taux_tva présentes', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('montant_ht') && content.includes('taux_tva'),
    'Colonnes montant_ht et taux_tva devraient exister'
  );
});

test('Colonne montant_tva calculée automatiquement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('montant_tva') && content.includes('generated always'),
    'montant_tva devrait être une colonne calculée'
  );
});

test('Colonne montant_ttc calculée automatiquement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('montant_ttc') && content.includes('generated always'),
    'montant_ttc devrait être une colonne calculée'
  );
});

test('Colonne taux_commission avec valeur par défaut', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('taux_commission') && content.includes('default'),
    'taux_commission devrait avoir une valeur par défaut'
  );
});

test('Colonne montant_commission calculée automatiquement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('montant_commission') && content.includes('generated always'),
    'montant_commission devrait être une colonne calculée'
  );
});

test('Colonne statut avec check constraint', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut') && content.includes('check') && content.includes('brouillon'),
    'statut devrait avoir un check constraint avec brouillon, envoyee, payee, annulee'
  );
});

test('Colonne numero unique', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('numero') && content.includes('unique'),
    'numero devrait être unique'
  );
});

test('Colonnes date_emission, date_echeance, date_envoi, date_paiement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_emission') && 
    content.includes('date_echeance') &&
    content.includes('date_envoi') &&
    content.includes('date_paiement'),
    'Toutes les dates devraient être présentes'
  );
});

// ===== Tests fonction generate_facture_from_mission =====

test('Fonction generate_facture_from_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('generate_facture_from_mission'),
    'Fonction generate_facture_from_mission devrait être créée'
  );
});

test('Fonction generate vérifie mission validée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('validee') && content.includes('generate_facture'),
    'Fonction devrait vérifier que mission est validée'
  );
});

test('Fonction generate vérifie unicité mission_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('exists') && content.includes('mission_id'),
    'Fonction devrait vérifier qu\'aucune facture n\'existe pour cette mission'
  );
});

test('Fonction generate crée numéro auto (format FAC-YYYY-NNNN)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('FAC-') && content.includes('lpad'),
    'Fonction devrait générer un numéro au format FAC-YYYY-NNNN'
  );
});

test('Fonction generate est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('generate_facture_from_mission') && content.includes('security definer'),
    'Fonction devrait être security definer'
  );
});

// ===== Tests fonction update_facture_status =====

test('Fonction update_facture_status créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('update_facture_status'),
    'Fonction update_facture_status devrait être créée'
  );
});

test('Fonction update_status vérifie transitions valides', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('update_facture_status') && content.includes('annulee'),
    'Fonction devrait vérifier les transitions (ex: pas de modif si annulée)'
  );
});

test('Fonction update_status empêche modification facture payée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('payee') && content.includes('raise exception'),
    'Fonction devrait empêcher modification d\'une facture payée'
  );
});

test('Fonction update_status met à jour date_envoi si envoyee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_envoi') && content.includes('envoyee'),
    'Fonction devrait mettre à jour date_envoi'
  );
});

test('Fonction update_status met à jour date_paiement si payee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_paiement') && content.includes('payee'),
    'Fonction devrait mettre à jour date_paiement'
  );
});

// ===== Tests fonction cancel_facture =====

test('Fonction cancel_facture créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('cancel_facture'),
    'Fonction cancel_facture devrait être créée'
  );
});

test('Fonction cancel empêche annulation facture payée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('cancel_facture') && content.includes('payee') && content.includes('raise exception'),
    'Fonction devrait empêcher annulation d\'une facture payée'
  );
});

test('Fonction cancel enregistre raison dans notes', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('notes') && content.includes('Annulation'),
    'Fonction devrait enregistrer la raison d\'annulation'
  );
});

// ===== Tests vues =====

test('Vue factures_stats créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('view') && content.includes('factures_stats'),
    'Vue factures_stats devrait être créée'
  );
});

test('Vue factures_stats compte par statut', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('factures_brouillon') && content.includes('factures_payees'),
    'Vue devrait compter les factures par statut'
  );
});

test('Vue factures_stats calcule CA total et commissions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('ca_') && content.includes('commissions_jtec'),
    'Vue devrait calculer CA et commissions'
  );
});

test('Vue factures_stats calcule taux de paiement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('taux_paiement'),
    'Vue devrait calculer le taux de paiement'
  );
});

test('Vue factures_commissions_jtec créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('view') && content.includes('factures_commissions_jtec'),
    'Vue factures_commissions_jtec devrait être créée'
  );
});

test('Vue commissions affiche statut commission', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut_commission') && content.includes('percue'),
    'Vue devrait afficher le statut de la commission'
  );
});

// ===== Tests RLS =====

test('RLS activée sur table factures', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('enable row level security') && content.includes('factures'),
    'RLS devrait être activée sur factures'
  );
});

test('Politique RLS pour entreprises (leurs factures)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('policy') && content.includes('entreprise') && content.includes('entreprise_id'),
    'Politique RLS pour entreprises devrait exister'
  );
});

test('Politique RLS pour régies (factures de leurs biens)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('policy') && content.includes('regie') && content.includes('regie_id'),
    'Politique RLS pour régies devrait exister'
  );
});

test('Politique RLS pour admin JTEC (toutes factures)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('policy') && content.includes('admin_jtec'),
    'Politique RLS pour admin JTEC devrait exister'
  );
});

// ===== Tests index =====

test('Index sur mission_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_factures_mission'),
    'Index sur mission_id devrait exister'
  );
});

test('Index sur entreprise_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_factures_entreprise'),
    'Index sur entreprise_id devrait exister'
  );
});

test('Index sur statut', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_factures_statut'),
    'Index sur statut devrait exister'
  );
});

// ===== Tests trigger =====

test('Trigger notify_facture_status_change créé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('facture_status_change'),
    'Trigger de notification devrait exister'
  );
});

test('Trigger utilise pg_notify', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('pg_notify') && content.includes('facture_status_change'),
    'Trigger devrait utiliser pg_notify'
  );
});

// ===== Tests APIs =====

test('API generate facture existe', () => {
  const filePath = path.join(__dirname, '../api/factures/generate.js');
  assert(fs.existsSync(filePath), 'API factures/generate.js devrait exister');
});

test('API generate vérifie rôle entreprise', () => {
  const filePath = path.join(__dirname, '../api/factures/generate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('403'),
    'API generate devrait vérifier le rôle entreprise'
  );
});

test('API generate vérifie mission validée', () => {
  const filePath = path.join(__dirname, '../api/factures/generate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('validee') && content.includes('statut'),
    'API generate devrait vérifier que mission est validée'
  );
});

test('API generate appelle generate_facture_from_mission', () => {
  const filePath = path.join(__dirname, '../api/factures/generate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('generate_facture_from_mission'),
    'API generate devrait appeler la fonction RPC'
  );
});

test('API list factures existe', () => {
  const filePath = path.join(__dirname, '../api/factures/list.js');
  assert(fs.existsSync(filePath), 'API factures/list.js devrait exister');
});

test('API list supporte filtrage par statut', () => {
  const filePath = path.join(__dirname, '../api/factures/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut') && content.includes('query'),
    'API list devrait supporter le filtrage par statut'
  );
});

test('API list supporte pagination', () => {
  const filePath = path.join(__dirname, '../api/factures/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('limit') && content.includes('offset'),
    'API list devrait supporter la pagination'
  );
});

test('API status existe', () => {
  const filePath = path.join(__dirname, '../api/factures/status.js');
  assert(fs.existsSync(filePath), 'API factures/status.js devrait exister');
});

test('API status vérifie permissions selon rôle', () => {
  const filePath = path.join(__dirname, '../api/factures/status.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('regie') && content.includes('403'),
    'API status devrait vérifier les permissions selon le rôle'
  );
});

test('API status permet entreprise → envoyee', () => {
  const filePath = path.join(__dirname, '../api/factures/status.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('envoyee') && content.includes('entreprise'),
    'API status devrait permettre à entreprise de marquer envoyee'
  );
});

test('API status permet régie → payee', () => {
  const filePath = path.join(__dirname, '../api/factures/status.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('payee') && content.includes('regie'),
    'API status devrait permettre à régie de marquer payee'
  );
});

test('API status appelle update_facture_status', () => {
  const filePath = path.join(__dirname, '../api/factures/status.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('update_facture_status'),
    'API status devrait appeler la fonction RPC'
  );
});

// ===== Tests grants =====

test('Grants sur table factures', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('grant') && content.includes('factures') && content.includes('authenticated'),
    'Grants sur factures devraient être définis'
  );
});

test('Grants sur vues', () => {
  const filePath = path.join(__dirname, '../supabase/schema/17_facturation.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('grant') && content.includes('factures_stats'),
    'Grants sur vues devraient être définis'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 13 - Facturation                 ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests facturation sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 13 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
