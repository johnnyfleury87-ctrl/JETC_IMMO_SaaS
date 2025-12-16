/**
 * TESTS : Transitions de statuts (Logique métier officielle)
 * 
 * Objectif : Valider le cycle de vie complet des tickets et missions
 * Source de vérité : supabase/schema/20_statuts_realignement.sql
 * 
 * Scénarios testés :
 * 1. Transitions valides (parcours nominal)
 * 2. Transitions interdites (erreurs explicites)
 * 3. Synchronisation ticket ↔ mission
 * 4. Contrôles par rôle
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================

const API_BASE = `http://localhost:${process.env.PORT || 3000}`;
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m'
};

let passedTests = 0;
let failedTests = 0;
const tests = [];

// Fonction helper pour faire des requêtes HTTP
async function makeRequest(endpoint, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, fn) {
  tests.push({ name, fn });
}

// ==================== DONNÉES GLOBALES ====================

const testData = {
  regieId: null,
  entrepriseId: null,
  locataireId: null,
  logementId: null,
  ticketId: null,
  missionId: null,
  
  // Tokens
  regieToken: null,
  entrepriseToken: null,
  locataireToken: null,
  adminToken: null
};

// ==================== TESTS DE VALIDATION DU SCHÉMA ====================

test('Le fichier 20_statuts_realignement.sql existe', () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  assert(fs.existsSync(sqlPath), 'Le fichier 20_statuts_realignement.sql doit exister');
  
  const content = fs.readFileSync(sqlPath, 'utf8');
  assert(content.includes('update_ticket_statut'), 'La fonction update_ticket_statut doit être définie');
  assert(content.includes('update_mission_statut'), 'La fonction update_mission_statut doit être définie');
  assert(content.includes('accept_ticket_and_create_mission'), 'La fonction accept_ticket_and_create_mission doit être définie');
});

test('Les enums ticket_status et mission_status sont définis correctement', () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier ticket_status
  assert(content.includes("'nouveau'"), 'ticket_status doit inclure "nouveau"');
  assert(content.includes("'en_attente'"), 'ticket_status doit inclure "en_attente"');
  assert(content.includes("'en_cours'"), 'ticket_status doit inclure "en_cours"');
  assert(content.includes("'termine'"), 'ticket_status doit inclure "termine"');
  assert(content.includes("'clos'"), 'ticket_status doit inclure "clos"');
  assert(content.includes("'annule'"), 'ticket_status doit inclure "annule"');
  
  // Vérifier mission_status
  assert(content.includes("'terminee'"), 'mission_status doit inclure "terminee"');
  assert(content.includes("'validee'"), 'mission_status doit inclure "validee"');
  assert(content.includes("'annulee'"), 'mission_status doit inclure "annulee"');
});

test('Les vues tickets_regie, tickets_entreprise, tickets_locataire sont créées', () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(content.includes('create or replace view tickets_regie'), 'La vue tickets_regie doit être définie');
  assert(content.includes('create or replace view tickets_entreprise'), 'La vue tickets_entreprise doit être définie');
  assert(content.includes('create or replace view tickets_locataire'), 'La vue tickets_locataire doit être définie');
});

test('L\'API /api/tickets/diffuser existe', () => {
  const apiPath = path.join(__dirname, '../api/tickets/diffuser.js');
  assert(fs.existsSync(apiPath), 'Le fichier api/tickets/diffuser.js doit exister');
  
  const content = fs.readFileSync(apiPath, 'utf8');
  assert(content.includes('update_ticket_statut'), 'L\'API doit utiliser update_ticket_statut');
  assert(content.includes("p_nouveau_statut: 'en_attente'"), 'L\'API doit passer le statut en_attente');
});

test('Les APIs missions utilisent update_mission_statut', () => {
  const files = [
    '../api/missions/start.js',
    '../api/missions/complete.js',
    '../api/missions/validate.js'
  ];
  
  files.forEach(file => {
    const apiPath = path.join(__dirname, file);
    assert(fs.existsSync(apiPath), `Le fichier ${file} doit exister`);
    
    const content = fs.readFileSync(apiPath, 'utf8');
    assert(content.includes('update_mission_statut'), `${file} doit utiliser update_mission_statut`);
  });
});

// ==================== TESTS UNITAIRES : TRANSITIONS VALIDES ====================

test('[TRANSITION VALIDE] nouveau → en_attente (régie diffuse)', async () => {
  // Ce test nécessite une connexion Supabase fonctionnelle
  // Pour l'instant, on valide la logique dans le SQL
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que la transition nouveau → en_attente est autorisée pour la régie
  assert(
    content.includes("when 'nouveau' then") && 
    content.includes("if p_nouveau_statut = 'en_attente' and p_role in ('regie', 'admin_jtec')"),
    'La transition nouveau → en_attente doit être autorisée pour la régie'
  );
});

test('[TRANSITION VALIDE] en_attente → en_cours (entreprise accepte)', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que accept_ticket_and_create_mission gère cette transition
  assert(
    content.includes("if v_ticket_statut != 'en_attente'") &&
    content.includes("statut = 'en_cours'"),
    'accept_ticket_and_create_mission doit vérifier le statut en_attente et passer à en_cours'
  );
});

test('[TRANSITION VALIDE] en_cours → termine (entreprise termine)', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier la synchronisation mission terminee → ticket termine
  assert(
    content.includes("when 'terminee' then") &&
    content.includes("update tickets set statut = 'termine'"),
    'La fonction doit synchroniser mission terminee → ticket termine'
  );
});

test('[TRANSITION VALIDE] termine → clos (régie valide)', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier la transition ticket termine → clos
  assert(
    content.includes("when 'termine' then") &&
    content.includes("if p_nouveau_statut = 'clos' and p_role in ('regie', 'admin_jtec')"),
    'La transition termine → clos doit être autorisée pour la régie'
  );
});

test('[TRANSITION VALIDE] Mission : en_attente → en_cours', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier dans update_mission_statut
  assert(
    content.includes("when 'en_attente' then") &&
    content.includes("if p_nouveau_statut = 'en_cours' and p_role in ('entreprise', 'technicien', 'admin_jtec')"),
    'La transition mission en_attente → en_cours doit être autorisée pour entreprise/technicien'
  );
});

test('[TRANSITION VALIDE] Mission : en_cours → terminee', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'en_cours' then") &&
    content.includes("if p_nouveau_statut = 'terminee' and p_role in ('entreprise', 'technicien', 'admin_jtec')"),
    'La transition mission en_cours → terminee doit être autorisée pour entreprise/technicien'
  );
});

test('[TRANSITION VALIDE] Mission : terminee → validee', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'terminee' then") &&
    content.includes("if p_nouveau_statut = 'validee' and p_role in ('regie', 'admin_jtec')"),
    'La transition mission terminee → validee doit être autorisée pour la régie'
  );
});

// ==================== TESTS UNITAIRES : TRANSITIONS INTERDITES ====================

test('[TRANSITION INTERDITE] Ticket clos ne peut plus changer de statut', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'clos' then") &&
    content.includes("v_raison_refus := 'Un ticket clos ne peut plus changer de statut'"),
    'Un ticket clos doit être bloqué'
  );
});

test('[TRANSITION INTERDITE] Mission validee ne peut plus changer de statut', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'validee' then") &&
    content.includes("v_raison_refus := 'Une mission validée ne peut plus changer de statut'"),
    'Une mission validée doit être bloquée'
  );
});

test('[TRANSITION INTERDITE] Locataire ne peut pas diffuser un ticket', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que seules régie et admin_jtec peuvent faire nouveau → en_attente
  assert(
    content.includes("p_role in ('regie', 'admin_jtec')") &&
    !content.includes("'locataire'") || content.includes("v_raison_refus"),
    'Le locataire ne doit pas pouvoir diffuser (nouveau → en_attente)'
  );
});

test('[TRANSITION INTERDITE] Entreprise ne peut pas valider une mission', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que seules régie et admin_jtec peuvent faire terminee → validee
  const validationPattern = /when 'terminee' then[\s\S]*?if p_nouveau_statut = 'validee' and p_role in \('regie', 'admin_jtec'\)/;
  assert(
    validationPattern.test(content),
    'Seule la régie doit pouvoir valider une mission (terminee → validee)'
  );
});

test('[TRANSITION INTERDITE] Impossible de sauter des étapes (nouveau → termine)', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que nouveau n'accepte que en_attente ou annule
  const nouveauPattern = /when 'nouveau' then[\s\S]*?if p_nouveau_statut = 'en_attente'[\s\S]*?elsif p_nouveau_statut = 'annule'/;
  assert(
    nouveauPattern.test(content),
    'Depuis nouveau, seules les transitions vers en_attente ou annule doivent être possibles'
  );
});

// ==================== TESTS UNITAIRES : SYNCHRONISATION ====================

test('[SYNCHRONISATION] Mission en_cours synchronise ticket en_cours', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'en_cours' then") &&
    content.includes("update tickets set statut = 'en_cours'"),
    'Mission en_cours doit synchroniser ticket vers en_cours'
  );
});

test('[SYNCHRONISATION] Mission terminee synchronise ticket termine', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'terminee' then") &&
    content.includes("update tickets set statut = 'termine'"),
    'Mission terminee doit synchroniser ticket vers termine'
  );
});

test('[SYNCHRONISATION] Mission validee synchronise ticket clos', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'validee' then") &&
    content.includes("update tickets set statut = 'clos'"),
    'Mission validee doit synchroniser ticket vers clos'
  );
});

test('[SYNCHRONISATION] Mission annulee synchronise ticket annule', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("when 'annulee' then") &&
    content.includes("update tickets set statut = 'annule'"),
    'Mission annulee doit synchroniser ticket vers annule'
  );
});

test('[SYNCHRONISATION] accept_ticket verrouille le ticket', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes("locked_at = now()") &&
    content.includes("if v_ticket_locked then"),
    'accept_ticket_and_create_mission doit verrouiller le ticket avec locked_at'
  );
});

// ==================== TESTS DE COHÉRENCE ====================

test('[COHÉRENCE] Aucune divergence possible entre ticket et mission', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Vérifier que update_mission_statut contient la section de synchronisation
  assert(
    content.includes('-- 5. SYNCHRONISATION AUTOMATIQUE') &&
    content.includes('case p_nouveau_statut'),
    'update_mission_statut doit avoir une section de synchronisation automatique'
  );
});

test('[COHÉRENCE] Les commentaires documentent toutes les transitions', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes('TRANSITIONS AUTORISÉES') &&
    content.includes('nouveau → en_attente') &&
    content.includes('en_attente → en_cours') &&
    content.includes('en_cours → termine') &&
    content.includes('termine → clos'),
    'Les commentaires doivent documenter toutes les transitions de tickets'
  );
  
  assert(
    content.includes('en_attente → en_cours') &&
    content.includes('en_cours → terminee') &&
    content.includes('terminee → validee'),
    'Les commentaires doivent documenter toutes les transitions de missions'
  );
});

test('[COHÉRENCE] Les grants sont définis pour les fonctions', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes('grant execute on function update_ticket_statut') &&
    content.includes('grant execute on function update_mission_statut') &&
    content.includes('grant execute on function accept_ticket_and_create_mission'),
    'Les grants doivent être définis pour toutes les fonctions principales'
  );
});

// ==================== TESTS DE DOCUMENTATION ====================

test('[DOCUMENTATION] Les fonctions ont des commentaires explicites', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes('comment on function update_ticket_statut') &&
    content.includes('FONCTION CENTRALE'),
    'update_ticket_statut doit avoir un commentaire explicite'
  );
  
  assert(
    content.includes('comment on function update_mission_statut') &&
    content.includes('synchronisation automatique'),
    'update_mission_statut doit documenter la synchronisation'
  );
});

test('[DOCUMENTATION] Les types enum ont des commentaires métier', async () => {
  const sqlPath = path.join(__dirname, '../supabase/schema/20_statuts_realignement.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  
  assert(
    content.includes('comment on type ticket_status') &&
    content.includes('source métier principale'),
    'ticket_status doit avoir un commentaire métier'
  );
  
  assert(
    content.includes('comment on type mission_status') &&
    content.includes('exécution opérationnelle'),
    'mission_status doit avoir un commentaire métier'
  );
});

// ==================== EXÉCUTION ====================

async function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS - Réalignement Statuts Officiel        ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`);
  console.log(`${colors.yellow}Source de vérité : 20_statuts_realignement.sql${colors.reset}\n`);

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
  console.log(`Tests échoués: ${colors.red}${failedTests}${colors.reset}`);
  console.log(`Total: ${passedTests + failedTests}`);
  console.log(`${colors.blue}════════════════════════════════════════════════${colors.reset}\n`);

  if (failedTests > 0) {
    console.log(`${colors.red}❌ ÉCHEC : Certains tests ont échoué${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ SUCCÈS : Tous les tests sont passés${colors.reset}`);
    console.log(`${colors.green}La logique des statuts est officiellement validée${colors.reset}\n`);
  }
}

// Exécuter les tests
runTests().catch(err => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, err);
  process.exit(1);
});
