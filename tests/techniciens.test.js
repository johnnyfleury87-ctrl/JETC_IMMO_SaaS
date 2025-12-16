/**
 * Tests de validation - ÉTAPE 11 : Techniciens & planning
 * 
 * Vérifie :
 * - Table techniciens créée avec FK entreprise_id et profile_id
 * - Colonnes ajoutées à missions (technicien_id, dates intervention)
 * - Fonction assign_technicien_to_mission
 * - RLS : technicien voit uniquement SES missions
 * - APIs : list techniciens, assign technicien, planning
 * 
 * Usage:
 *   node tests/techniciens.test.js
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

test('Fichier 15_techniciens.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  assert(fs.existsSync(filePath), '15_techniciens.sql devrait exister');
});

// ===== Tests structure SQL =====

test('Table techniciens créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('techniciens'),
    'Devrait créer la table techniciens'
  );
});

test('Colonne profile_id référence auth.users', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('profile_id') && content.includes('references auth.users'),
    'profile_id devrait référencer auth.users'
  );
});

test('Colonne profile_id est unique', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('profile_id') && content.includes('unique'),
    'profile_id devrait être unique (un profil = un technicien)'
  );
});

test('Colonne entreprise_id référence entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise_id') && content.includes('references entreprises'),
    'entreprise_id devrait référencer la table entreprises'
  );
});

test('Colonnes nom, prenom, telephone, email créées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasNom = content.includes('nom text');
  const hasPrenom = content.includes('prenom text');
  const hasTelephone = content.includes('telephone');
  const hasEmail = content.includes('email');
  
  assert(
    hasNom && hasPrenom && hasTelephone && hasEmail,
    'Devrait avoir les colonnes nom, prenom, telephone, email'
  );
});

test('Colonne specialites (array) créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('specialites') && content.includes('text[]'),
    'specialites devrait être un array de text'
  );
});

test('Colonne actif (boolean) créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('actif') && content.includes('boolean'),
    'actif devrait être un boolean'
  );
});

test('Colonne technicien_id ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table missions') && content.includes('technicien_id'),
    'Devrait ajouter technicien_id à missions'
  );
});

test('Colonne technicien_id référence techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('technicien_id') && content.includes('references techniciens'),
    'technicien_id devrait référencer la table techniciens'
  );
});

test('Colonne date_intervention_prevue ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_intervention_prevue'),
    'Devrait ajouter date_intervention_prevue à missions'
  );
});

test('Colonne date_intervention_realisee ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_intervention_realisee'),
    'Devrait ajouter date_intervention_realisee à missions'
  );
});

// ===== Tests fonction helper =====

test('Fonction get_user_technicien_id() créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('get_user_technicien_id'),
    'Devrait créer la fonction get_user_technicien_id()'
  );
});

test('Fonction get_user_technicien_id() est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_user_technicien_id') && content.includes('security definer'),
    'get_user_technicien_id() devrait être security definer'
  );
});

// ===== Tests fonction assignation =====

test('Fonction assign_technicien_to_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('assign_technicien_to_mission'),
    'Devrait créer la fonction assign_technicien_to_mission'
  );
});

test('Fonction est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('assign_technicien_to_mission') && content.includes('security definer'),
    'assign_technicien_to_mission devrait être security definer'
  );
});

test('Fonction vérifie que la mission existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Mission non trouvée') || content.includes('select entreprise_id into'),
    'Fonction devrait vérifier que la mission existe'
  );
});

test('Fonction vérifie que le technicien est actif', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('actif = true') || content.includes('inactif'),
    'Fonction devrait vérifier que le technicien est actif'
  );
});

test('Fonction vérifie que technicien appartient à même entreprise', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('v_mission_entreprise_id') && content.includes('v_technicien_entreprise_id'),
    'Fonction devrait vérifier que technicien et mission sont de la même entreprise'
  );
});

test('Fonction met à jour missions.technicien_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('update missions') && content.includes('technicien_id = p_technicien_id'),
    'Fonction devrait mettre à jour missions.technicien_id'
  );
});

test('Fonction retourne un jsonb avec success', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('jsonb_build_object') && content.includes('success'),
    'Fonction devrait retourner un jsonb avec success'
  );
});

// ===== Tests RLS techniciens =====

test('RLS activé sur table techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table techniciens enable row level security'),
    'RLS devrait être activé sur techniciens'
  );
});

test('Policy : Entreprise peut voir ses techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can view own techniciens'),
    'Policy pour entreprise devrait exister'
  );
});

test('Policy : Entreprise peut créer ses techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can insert own techniciens'),
    'Policy insert pour entreprise devrait exister'
  );
});

test('Policy : Entreprise peut mettre à jour ses techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can update own techniciens'),
    'Policy update pour entreprise devrait exister'
  );
});

test('Policy : Technicien voit son profil', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Technicien can view own profile'),
    'Policy pour technicien devrait exister'
  );
});

test('Policy : Technicien peut mettre à jour son profil', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Technicien can update own profile'),
    'Policy update pour technicien devrait exister'
  );
});

test('Policy : Régie voit techniciens des entreprises autorisées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view techniciens'),
    'Policy pour régie devrait exister'
  );
});

test('Policy : Admin JTEC voit tous les techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Admin JTEC can view all techniciens'),
    'Policy pour admin JTEC devrait exister'
  );
});

// ===== Tests RLS missions (technicien) =====

test('Policy : Technicien peut voir SES missions assignées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Technicien can view assigned missions') && content.includes('get_user_technicien_id'),
    'Policy pour technicien sur missions devrait exister'
  );
});

test('Policy : Technicien peut mettre à jour SES missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Technicien can update assigned missions'),
    'Policy update pour technicien sur missions devrait exister'
  );
});

// ===== Tests vues =====

test('Vue planning_technicien créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('planning_technicien'),
    'Devrait créer la vue planning_technicien'
  );
});

test('Vue planning_technicien joint toutes les tables nécessaires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasMissions = content.includes('from missions');
  const hasTechniciens = content.includes('join techniciens');
  const hasTickets = content.includes('join tickets');
  const hasLogements = content.includes('join logements');
  const hasImmeubles = content.includes('join immeubles');
  
  assert(
    hasMissions && hasTechniciens && hasTickets && hasLogements && hasImmeubles,
    'Vue devrait joindre missions, techniciens, tickets, logements, immeubles'
  );
});

test('Vue missions_non_assignees créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('missions_non_assignees'),
    'Devrait créer la vue missions_non_assignees'
  );
});

test('Vue missions_non_assignees filtre technicien_id IS NULL', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('missions_non_assignees') && content.includes('technicien_id is null'),
    'Vue devrait filtrer les missions non assignées'
  );
});

// ===== Tests APIs =====

test('API list techniciens existe', () => {
  const filePath = path.join(__dirname, '../api/techniciens/list.js');
  assert(fs.existsSync(filePath), 'API techniciens/list.js devrait exister');
});

test('API list vérifie que l\'utilisateur est une entreprise', () => {
  const filePath = path.join(__dirname, '../api/techniciens/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est une entreprise'
  );
});

test('API list récupère techniciens de l\'entreprise', () => {
  const filePath = path.join(__dirname, '../api/techniciens/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('from(\'techniciens\')') && content.includes('entreprise_id'),
    'API devrait récupérer les techniciens de l\'entreprise'
  );
});

test('API assign-technicien existe', () => {
  const filePath = path.join(__dirname, '../api/missions/assign-technicien.js');
  assert(fs.existsSync(filePath), 'API missions/assign-technicien.js devrait exister');
});

test('API assign vérifie que l\'utilisateur est une entreprise', () => {
  const filePath = path.join(__dirname, '../api/missions/assign-technicien.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est une entreprise'
  );
});

test('API assign appelle assign_technicien_to_mission', () => {
  const filePath = path.join(__dirname, '../api/missions/assign-technicien.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('assign_technicien_to_mission'),
    'API devrait appeler la fonction SQL'
  );
});

test('API assign passe mission_id, technicien_id et date', () => {
  const filePath = path.join(__dirname, '../api/missions/assign-technicien.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('p_mission_id') && content.includes('p_technicien_id') && content.includes('p_date_intervention_prevue'),
    'API devrait passer les 3 paramètres'
  );
});

test('API planning existe', () => {
  const filePath = path.join(__dirname, '../api/techniciens/planning.js');
  assert(fs.existsSync(filePath), 'API techniciens/planning.js devrait exister');
});

test('API planning vérifie que l\'utilisateur est un technicien', () => {
  const filePath = path.join(__dirname, '../api/techniciens/planning.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('technicien') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est un technicien'
  );
});

test('API planning récupère uniquement les missions du technicien', () => {
  const filePath = path.join(__dirname, '../api/techniciens/planning.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('planning_technicien') && content.includes('technicien_id'),
    'API devrait utiliser la vue planning_technicien avec filtre technicien_id'
  );
});

// ===== Tests index =====

test('Index sur techniciens.profile_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_techniciens_profile_id'),
    'Devrait avoir un index sur profile_id'
  );
});

test('Index sur techniciens.entreprise_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_techniciens_entreprise_id'),
    'Devrait avoir un index sur entreprise_id'
  );
});

test('Index sur missions.technicien_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_technicien_id'),
    'Devrait avoir un index sur missions.technicien_id'
  );
});

test('Index sur missions.date_intervention_prevue', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_date_intervention_prevue'),
    'Devrait avoir un index sur date_intervention_prevue'
  );
});

// ===== Tests trigger =====

test('Trigger pour updated_at sur techniciens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/15_techniciens.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('techniciens_updated_at'),
    'Devrait avoir un trigger pour mettre à jour updated_at'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 11 - Techniciens & Planning      ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests techniciens sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 11 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
