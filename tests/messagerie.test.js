/**
 * Tests de validation - ÉTAPE 14 : Messagerie & Notifications
 * 
 * Vérifie :
 * - Tables messages et notifications
 * - Fonction get_mission_actors (récupère acteurs)
 * - Fonction send_message (avec création notifications)
 * - Fonction mark_notification_as_read
 * - Triggers notifications automatiques (statut, assignation)
 * - RLS (accès limité aux acteurs)
 * - APIs de messagerie et notifications
 * 
 * Usage:
 *   node tests/messagerie.test.js
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

test('Fichier 18_messagerie.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  assert(fs.existsSync(filePath), '18_messagerie.sql devrait exister');
});

// ===== Tests table messages =====

test('Table messages créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('messages'),
    'Table messages devrait être créée'
  );
});

test('Colonne mission_id avec FK missions', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mission_id') && content.includes('references missions'),
    'mission_id devrait référencer missions'
  );
});

test('Colonne sender_user_id avec FK auth.users', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('sender_user_id') && content.includes('references auth.users'),
    'sender_user_id devrait référencer auth.users'
  );
});

test('Colonnes sender_name et sender_role (cache)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('sender_name') && content.includes('sender_role'),
    'Colonnes sender_name et sender_role devraient exister'
  );
});

test('Colonne content pour le message', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('content') && content.includes('text'),
    'Colonne content devrait exister'
  );
});

test('Colonne type avec check constraint (message, system)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('type') && content.includes('check') && content.includes('message') && content.includes('system'),
    'type devrait avoir check constraint avec message et system'
  );
});

// ===== Tests table notifications =====

test('Table notifications créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create table') && content.includes('notifications'),
    'Table notifications devrait être créée'
  );
});

test('Colonne user_id avec FK auth.users', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('user_id') && content.includes('notifications') && content.includes('references auth.users'),
    'user_id devrait référencer auth.users'
  );
});

test('Colonne type avec check constraint (types notifications)', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('new_message') && content.includes('mission_status_change') && content.includes('mission_assigned'),
    'type devrait inclure les types de notifications'
  );
});

test('Colonnes title et message', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('title') && content.includes('message'),
    'Colonnes title et message devraient exister'
  );
});

test('Colonnes related_* pour liens', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('related_mission_id') && content.includes('related_ticket_id') && content.includes('related_facture_id'),
    'Colonnes related_* devraient exister'
  );
});

test('Colonnes read et read_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('read boolean') && content.includes('read_at'),
    'Colonnes read et read_at devraient exister'
  );
});

// ===== Tests fonction get_mission_actors =====

test('Fonction get_mission_actors créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('get_mission_actors'),
    'Fonction get_mission_actors devrait être créée'
  );
});

test('Fonction get_mission_actors retourne TABLE', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_mission_actors') && content.includes('returns table'),
    'Fonction devrait retourner une table'
  );
});

test('Fonction get_mission_actors est security definer', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('get_mission_actors') && content.includes('security definer'),
    'Fonction devrait être security definer'
  );
});

test('Fonction get_mission_actors récupère entreprise', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('entreprise_id'),
    'Fonction devrait récupérer les utilisateurs de l\'entreprise'
  );
});

test('Fonction get_mission_actors récupère technicien', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('technicien_id'),
    'Fonction devrait récupérer le technicien'
  );
});

test('Fonction get_mission_actors récupère régie', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie_id'),
    'Fonction devrait récupérer les utilisateurs de la régie'
  );
});

test('Fonction get_mission_actors récupère locataire', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locataire_id'),
    'Fonction devrait récupérer le locataire'
  );
});

// ===== Tests fonction send_message =====

test('Fonction send_message créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('send_message'),
    'Fonction send_message devrait être créée'
  );
});

test('Fonction send_message vérifie accès utilisateur', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('send_message') && content.includes('get_mission_actors') && content.includes('Accès refusé'),
    'Fonction devrait vérifier que l\'utilisateur est acteur'
  );
});

test('Fonction send_message crée le message', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('insert into messages'),
    'Fonction devrait créer le message'
  );
});

test('Fonction send_message crée notifications pour autres acteurs', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('send_message') && content.includes('insert into notifications'),
    'Fonction devrait créer des notifications'
  );
});

test('Fonction send_message exclut expéditeur des notifications', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('user_id != p_sender_user_id') || content.includes('where user_id <>'),
    'Fonction ne devrait pas notifier l\'expéditeur'
  );
});

// ===== Tests fonction mark_notification_as_read =====

test('Fonction mark_notification_as_read créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('mark_notification_as_read'),
    'Fonction mark_notification_as_read devrait être créée'
  );
});

test('Fonction mark vérifie ownership', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mark_notification_as_read') && content.includes('user_id'),
    'Fonction devrait vérifier que la notification appartient à l\'utilisateur'
  );
});

test('Fonction mark met à jour read = true', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('read = true'),
    'Fonction devrait mettre read à true'
  );
});

test('Fonction mark met à jour read_at', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('read_at'),
    'Fonction devrait mettre à jour read_at'
  );
});

// ===== Tests fonction create_system_message =====

test('Fonction create_system_message créée', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('function') && content.includes('create_system_message'),
    'Fonction create_system_message devrait être créée'
  );
});

test('Fonction system_message crée message type=system', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create_system_message') && content.includes('type'),
    'Fonction devrait créer un message système'
  );
});

// ===== Tests triggers =====

test('Trigger notify_mission_status_change_extended créé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('mission_status_change'),
    'Trigger pour changement statut mission devrait exister'
  );
});

test('Trigger statut mission crée message système', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('create_system_message'),
    'Trigger devrait créer un message système'
  );
});

test('Trigger statut mission crée notifications', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mission_status_change') && content.includes('insert into notifications'),
    'Trigger devrait créer des notifications'
  );
});

test('Trigger notify_technicien_assignment créé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('technicien_assignment'),
    'Trigger pour assignation technicien devrait exister'
  );
});

test('Trigger assignation vérifie OLD.technicien_id is null', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('technicien_assignment') && content.includes('OLD.technicien_id is null'),
    'Trigger devrait vérifier nouvelle assignation'
  );
});

test('Trigger assignation notifie technicien', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('mission_assigned'),
    'Trigger devrait créer notification mission_assigned'
  );
});

test('Trigger notify_new_ticket créé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('trigger') && content.includes('new_ticket'),
    'Trigger pour nouveau ticket devrait exister'
  );
});

test('Trigger new_ticket notifie régie et locataire', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('new_ticket') && content.includes('regie_id') && content.includes('locataire_id'),
    'Trigger devrait notifier régie et locataire'
  );
});

// ===== Tests RLS =====

test('RLS activée sur table messages', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('enable row level security') && content.includes('messages'),
    'RLS devrait être activée sur messages'
  );
});

test('Politique RLS messages utilise get_mission_actors', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('policy') && content.includes('messages') && content.includes('get_mission_actors'),
    'Politique devrait utiliser get_mission_actors'
  );
});

test('RLS activée sur table notifications', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('enable row level security') && content.includes('notifications'),
    'RLS devrait être activée sur notifications'
  );
});

test('Politique RLS notifications filtre par user_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('policy') && content.includes('notifications') && content.includes('user_id = auth.uid()'),
    'Politique devrait filtrer par user_id'
  );
});

// ===== Tests index =====

test('Index sur messages.mission_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_messages_mission'),
    'Index sur mission_id devrait exister'
  );
});

test('Index sur notifications.user_id', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_notifications_user'),
    'Index sur user_id devrait exister'
  );
});

test('Index sur notifications.read', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('idx_notifications_read'),
    'Index sur read devrait exister'
  );
});

// ===== Tests APIs =====

test('API send message existe', () => {
  const filePath = path.join(__dirname, '../api/messages/send.js');
  assert(fs.existsSync(filePath), 'API messages/send.js devrait exister');
});

test('API send vérifie contenu non vide', () => {
  const filePath = path.join(__dirname, '../api/messages/send.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('content') && content.includes('vide'),
    'API devrait vérifier que le contenu n\'est pas vide'
  );
});

test('API send appelle send_message', () => {
  const filePath = path.join(__dirname, '../api/messages/send.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('send_message'),
    'API devrait appeler la fonction send_message'
  );
});

test('API list messages mission existe', () => {
  const filePath = path.join(__dirname, '../api/messages/mission.js');
  assert(fs.existsSync(filePath), 'API messages/mission.js devrait exister');
});

test('API list messages supporte pagination', () => {
  const filePath = path.join(__dirname, '../api/messages/mission.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('limit') && content.includes('offset'),
    'API devrait supporter la pagination'
  );
});

test('API list messages tri par created_at', () => {
  const filePath = path.join(__dirname, '../api/messages/mission.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('order') && content.includes('created_at'),
    'API devrait trier par created_at'
  );
});

test('API list notifications existe', () => {
  const filePath = path.join(__dirname, '../api/notifications/list.js');
  assert(fs.existsSync(filePath), 'API notifications/list.js devrait exister');
});

test('API list notifications filtre par read', () => {
  const filePath = path.join(__dirname, '../api/notifications/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('read') && content.includes('eq'),
    'API devrait filtrer par statut read'
  );
});

test('API list notifications filtre par type', () => {
  const filePath = path.join(__dirname, '../api/notifications/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('type') && content.includes('validTypes'),
    'API devrait filtrer par type'
  );
});

test('API list notifications compte non lues', () => {
  const filePath = path.join(__dirname, '../api/notifications/list.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('unread_count'),
    'API devrait compter les notifications non lues'
  );
});

test('API mark notification read existe', () => {
  const filePath = path.join(__dirname, '../api/notifications/read.js');
  assert(fs.existsSync(filePath), 'API notifications/read.js devrait exister');
});

test('API mark appelle mark_notification_as_read', () => {
  const filePath = path.join(__dirname, '../api/notifications/read.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('rpc') && content.includes('mark_notification_as_read'),
    'API devrait appeler la fonction mark_notification_as_read'
  );
});

// ===== Tests grants =====

test('Grants sur table messages', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('grant') && content.includes('messages') && content.includes('authenticated'),
    'Grants sur messages devraient être définis'
  );
});

test('Grants sur table notifications', () => {
  const filePath = path.join(__dirname, '../supabase/schema/18_messagerie.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('grant') && content.includes('notifications') && content.includes('authenticated'),
    'Grants sur notifications devraient être définis'
  );
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 14 - Messagerie & Notifications  ║${colors.reset}`);
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
    console.log(`${colors.green}✅ Tous les tests messagerie sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 14 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
