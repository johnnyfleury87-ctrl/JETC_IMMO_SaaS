/**
 * Tests de validation - ÉTAPE 12 : Intervention & clôture
 * 
 * Vérifie :
 * - Colonnes ajoutées à missions (rapport_url, signatures, en_retard)
 * - Fonctions de cycle de vie (start, complete, validate, cancel)
 * - Transitions de statuts cohérentes
 * - Gestion des retards
 * - Vues créées (missions_en_retard, missions_stats)
 * - APIs du cycle de vie
 * 
 * Usage:
 *   node tests/intervention.test.js
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

test('Fichier 16_intervention.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  assert(fs.existsSync(filePath), '16_intervention.sql devrait exister');
});

// ===== Tests structure SQL =====

test('Colonne rapport_url ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table missions') && content.includes('rapport_url'),
    'Devrait ajouter rapport_url à missions'
  );
});

test('Colonne signature_locataire_url ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('signature_locataire_url'),
    'Devrait ajouter signature_locataire_url'
  );
});

test('Colonne signature_technicien_url ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('signature_technicien_url'),
    'Devrait ajouter signature_technicien_url'
  );
});

test('Colonne en_retard (calculée) ajoutée à missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('en_retard') && content.includes('generated always'),
    'Devrait ajouter en_retard comme colonne calculée'
  );
});

test('Colonne en_retard vérifie date_intervention_prevue < now()', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_intervention_prevue') && content.includes('< now()'),
    'en_retard devrait comparer date_intervention_prevue avec now()'
  );
});

// ===== Tests fonction start_mission =====

test('Fonction start_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('function') && content.includes('start_mission'),
    'Devrait créer la fonction start_mission'
  );
});

test('Fonction start_mission est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('start_mission') && content.includes('security definer'),
    'start_mission devrait être security definer'
  );
});

test('Fonction start_mission vérifie statut = en_attente', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('en_attente') && content.includes('statut'),
    'Fonction devrait vérifier que statut = en_attente'
  );
});

test('Fonction start_mission met à jour statut → en_cours', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut = \'en_cours\''),
    'Fonction devrait mettre statut à en_cours'
  );
});

test('Fonction start_mission met à jour started_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('started_at = now()'),
    'Fonction devrait mettre à jour started_at'
  );
});

// ===== Tests fonction complete_mission =====

test('Fonction complete_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('complete_mission'),
    'Devrait créer la fonction complete_mission'
  );
});

test('Fonction complete_mission vérifie statut = en_cours', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const completeIndex = content.indexOf('complete_mission');
  const hasCheck = content.includes('en_cours', completeIndex);
  
  assert(
    hasCheck,
    'Fonction devrait vérifier que statut = en_cours'
  );
});

test('Fonction complete_mission vérifie technicien assigné', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('technicien_id is null') && content.includes('complete_mission'),
    'Fonction devrait vérifier qu\'un technicien est assigné'
  );
});

test('Fonction complete_mission met à jour statut → terminee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut = \'terminee\''),
    'Fonction devrait mettre statut à terminee'
  );
});

test('Fonction complete_mission met à jour completed_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('completed_at = now()'),
    'Fonction devrait mettre à jour completed_at'
  );
});

test('Fonction complete_mission met à jour date_intervention_realisee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('date_intervention_realisee'),
    'Fonction devrait mettre à jour date_intervention_realisee'
  );
});

// ===== Tests fonction validate_mission =====

test('Fonction validate_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('validate_mission'),
    'Devrait créer la fonction validate_mission'
  );
});

test('Fonction validate_mission vérifie statut = terminee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const validateIndex = content.indexOf('validate_mission');
  const hasCheck = content.includes('terminee', validateIndex);
  
  assert(
    hasCheck,
    'Fonction devrait vérifier que statut = terminee'
  );
});

test('Fonction validate_mission vérifie signatures présentes', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('signature_locataire_url') && content.includes('signature_technicien_url'),
    'Fonction devrait vérifier les signatures'
  );
});

test('Fonction validate_mission met à jour statut → validee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut = \'validee\''),
    'Fonction devrait mettre statut à validee'
  );
});

test('Fonction validate_mission met à jour validated_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('validated_at = now()'),
    'Fonction devrait mettre à jour validated_at'
  );
});

// ===== Tests fonction cancel_mission =====

test('Fonction cancel_mission créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('cancel_mission'),
    'Devrait créer la fonction cancel_mission'
  );
});

test('Fonction cancel_mission vérifie statut != validee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('cancel_mission') && content.includes('validee'),
    'Fonction devrait vérifier que mission n\'est pas validee'
  );
});

test('Fonction cancel_mission met à jour statut → annulee', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('statut = \'annulee\''),
    'Fonction devrait mettre statut à annulee'
  );
});

test('Fonction cancel_mission déverrouille le ticket', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('update tickets') && content.includes('locked_at = null'),
    'Fonction devrait déverrouiller le ticket'
  );
});

// ===== Tests vues =====

test('Vue missions_en_retard créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('missions_en_retard'),
    'Devrait créer la vue missions_en_retard'
  );
});

test('Vue missions_en_retard filtre en_retard = true', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('missions_en_retard') && content.includes('en_retard = true'),
    'Vue devrait filtrer en_retard = true'
  );
});

test('Vue missions_en_retard calcule heures_retard', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('heures_retard'),
    'Vue devrait calculer les heures de retard'
  );
});

test('Vue missions_stats créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create') && content.includes('view') && content.includes('missions_stats'),
    'Devrait créer la vue missions_stats'
  );
});

test('Vue missions_stats compte par statut', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('missions_en_attente') && content.includes('missions_validees'),
    'Vue devrait compter les missions par statut'
  );
});

test('Vue missions_stats calcule délais moyens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('delai_moyen') || content.includes('duree_moyenne'),
    'Vue devrait calculer les délais moyens'
  );
});

test('Vue missions_stats calcule taux de signature', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('taux_signature'),
    'Vue devrait calculer le taux de signature'
  );
});

// ===== Tests APIs =====

test('API start mission existe', () => {
  const filePath = path.join(__dirname, '../api/missions/start.js');
  assert(fs.existsSync(filePath), 'API missions/start.js devrait exister');
});

test('API start vérifie entreprise ou technicien', () => {
  const filePath = path.join(__dirname, '../api/missions/start.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise') && content.includes('technicien'),
    'API devrait accepter entreprise ou technicien'
  );
});

test('API start appelle start_mission', () => {
  const filePath = path.join(__dirname, '../api/missions/start.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('start_mission'),
    'API devrait appeler la fonction start_mission'
  );
});

test('API complete mission existe', () => {
  const filePath = path.join(__dirname, '../api/missions/complete.js');
  assert(fs.existsSync(filePath), 'API missions/complete.js devrait exister');
});

test('API complete accepte rapport_url optionnel', () => {
  const filePath = path.join(__dirname, '../api/missions/complete.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rapport_url'),
    'API devrait accepter rapport_url'
  );
});

test('API complete appelle complete_mission', () => {
  const filePath = path.join(__dirname, '../api/missions/complete.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('complete_mission'),
    'API devrait appeler la fonction complete_mission'
  );
});

test('API validate mission existe', () => {
  const filePath = path.join(__dirname, '../api/missions/validate.js');
  assert(fs.existsSync(filePath), 'API missions/validate.js devrait exister');
});

test('API validate vérifie rôle régie', () => {
  const filePath = path.join(__dirname, '../api/missions/validate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie') && content.includes('403'),
    'API devrait vérifier rôle régie'
  );
});

test('API validate appelle validate_mission', () => {
  const filePath = path.join(__dirname, '../api/missions/validate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('validate_mission'),
    'API devrait appeler la fonction validate_mission'
  );
});

test('API validate gère warnings signatures', () => {
  const filePath = path.join(__dirname, '../api/missions/validate.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('warning'),
    'API devrait gérer les warnings'
  );
});

test('API retards existe', () => {
  const filePath = path.join(__dirname, '../api/missions/retards.js');
  assert(fs.existsSync(filePath), 'API missions/retards.js devrait exister');
});

test('API retards utilise vue missions_en_retard', () => {
  const filePath = path.join(__dirname, '../api/missions/retards.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('missions_en_retard'),
    'API devrait utiliser la vue missions_en_retard'
  );
});

// ===== Tests index =====

test('Index sur missions.en_retard', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_en_retard'),
    'Devrait avoir un index sur en_retard'
  );
});

test('Index sur missions.completed_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_completed_at'),
    'Devrait avoir un index sur completed_at'
  );
});

test('Index sur missions.validated_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_missions_validated_at'),
    'Devrait avoir un index sur validated_at'
  );
});

// ===== Tests trigger =====

test('Trigger notify_mission_status_change créé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/16_intervention.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('mission_status_change'),
    'Devrait avoir un trigger pour notifier changements statut'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 12 - Intervention & Clôture      ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests intervention sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 12 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
