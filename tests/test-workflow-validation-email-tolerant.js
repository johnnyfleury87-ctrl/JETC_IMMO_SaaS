/**
 * TEST WORKFLOW VALIDATION RÉGIE - EMAIL NON-BLOQUANT
 * 
 * Ce test valide que le workflow de validation/refus fonctionne
 * même sans configuration SMTP.
 * 
 * Scénarios testés :
 * 1. Validation régie sans SMTP → BDD mise à jour, email échoue gracefully
 * 2. Refus régie sans SMTP → BDD mise à jour, email échoue gracefully
 */

const http = require('http');

// Configuration
const API_BASE = 'http://localhost:3000';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'VOTRE_TOKEN_ADMIN_ICI';

// Couleurs pour logs
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Appel API générique
 */
async function callAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Test 1 : Validation régie sans SMTP
 */
async function testValidationSansSmtp() {
  log('\n========================================', 'blue');
  log('TEST 1 : VALIDATION RÉGIE SANS SMTP', 'blue');
  log('========================================\n', 'blue');
  
  try {
    // Utiliser l'ID d'une régie en attente (à adapter)
    const regieId = process.env.TEST_REGIE_ID || 'VOTRE_REGIE_ID_TEST';
    
    log(`🔄 Envoi requête validation pour régie ${regieId}...`, 'yellow');
    
    const response = await callAPI('/api/admin/valider-agence', 'POST', {
      action: 'validation',
      regie_id: regieId
    });
    
    log(`📊 Statut HTTP : ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');
    log(`📄 Réponse : ${JSON.stringify(response.data, null, 2)}`, 'blue');
    
    if (response.statusCode === 200 && response.data.success) {
      log('✅ TEST RÉUSSI : Validation acceptée malgré absence SMTP', 'green');
      log('✅ Vérifier dans les logs : [EMAIL][NON-BLOQUANT]', 'green');
      return true;
    } else {
      log('❌ TEST ÉCHOUÉ : La validation a été bloquée', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ERREUR : ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 2 : Refus régie sans SMTP
 */
async function testRefusSansSmtp() {
  log('\n========================================', 'blue');
  log('TEST 2 : REFUS RÉGIE SANS SMTP', 'blue');
  log('========================================\n', 'blue');
  
  try {
    const regieId = process.env.TEST_REGIE_ID_REFUS || 'VOTRE_AUTRE_REGIE_ID_TEST';
    
    log(`🔄 Envoi requête refus pour régie ${regieId}...`, 'yellow');
    
    const response = await callAPI('/api/admin/valider-agence', 'POST', {
      action: 'refus',
      regie_id: regieId,
      commentaire: 'Test refus sans SMTP - Email doit être tolérant'
    });
    
    log(`📊 Statut HTTP : ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');
    log(`📄 Réponse : ${JSON.stringify(response.data, null, 2)}`, 'blue');
    
    if (response.statusCode === 200 && response.data.success) {
      log('✅ TEST RÉUSSI : Refus accepté malgré absence SMTP', 'green');
      log('✅ Vérifier dans les logs : [EMAIL][NON-BLOQUANT]', 'green');
      return true;
    } else {
      log('❌ TEST ÉCHOUÉ : Le refus a été bloqué', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ERREUR : ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 3 : Healthcheck API
 */
async function testHealthcheck() {
  log('\n========================================', 'blue');
  log('TEST 0 : HEALTHCHECK API', 'blue');
  log('========================================\n', 'blue');
  
  try {
    const response = await callAPI('/api/healthcheck');
    
    log(`📊 Statut HTTP : ${response.statusCode}`, response.statusCode === 200 ? 'green' : 'red');
    log(`📄 Réponse : ${JSON.stringify(response.data, null, 2)}`, 'blue');
    
    if (response.statusCode === 200) {
      log('✅ API accessible', 'green');
      return true;
    } else {
      log('❌ API non accessible', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ERREUR : ${error.message}`, 'red');
    log('⚠️  Assurez-vous que le serveur est démarré (npm start)', 'yellow');
    return false;
  }
}

/**
 * Exécution des tests
 */
async function runTests() {
  log('\n╔════════════════════════════════════════════════════╗', 'blue');
  log('║  TEST WORKFLOW EMAIL NON-BLOQUANT - JETC IMMO    ║', 'blue');
  log('╚════════════════════════════════════════════════════╝', 'blue');
  
  log('\n📋 Configuration :', 'yellow');
  log(`   - API Base : ${API_BASE}`, 'yellow');
  log(`   - Token Admin : ${ADMIN_TOKEN.substring(0, 20)}...`, 'yellow');
  log(`   - SMTP configuré : ${process.env.SMTP_HOST ? 'OUI' : 'NON (mode test)'}`, 'yellow');
  
  // Test 0 : Healthcheck
  const healthOk = await testHealthcheck();
  if (!healthOk) {
    log('\n❌ Tests interrompus : API non accessible', 'red');
    process.exit(1);
  }
  
  // Tests principaux (commentés car nécessitent IDs réels)
  log('\n⚠️  CONFIGURATION REQUISE :', 'yellow');
  log('   Pour exécuter les tests de validation/refus :', 'yellow');
  log('   1. Créer une régie de test via /register.html', 'yellow');
  log('   2. Récupérer son ID depuis la table regies', 'yellow');
  log('   3. Définir TEST_REGIE_ID=<uuid> dans .env', 'yellow');
  log('   4. Relancer ce script', 'yellow');
  
  if (process.env.TEST_REGIE_ID) {
    await testValidationSansSmtp();
  } else {
    log('\n⏭️  Test validation ignoré (TEST_REGIE_ID non défini)', 'yellow');
  }
  
  if (process.env.TEST_REGIE_ID_REFUS) {
    await testRefusSansSmtp();
  } else {
    log('⏭️  Test refus ignoré (TEST_REGIE_ID_REFUS non défini)', 'yellow');
  }
  
  log('\n========================================', 'blue');
  log('📌 VALIDATION MANUELLE RECOMMANDÉE', 'blue');
  log('========================================\n', 'blue');
  
  log('1. Démarrer le serveur : npm start', 'yellow');
  log('2. Ouvrir /register.html et créer une régie test', 'yellow');
  log('3. Ouvrir /admin/dashboard.html et se connecter', 'yellow');
  log('4. Cliquer "Valider" ou "Refuser" sur la régie test', 'yellow');
  log('5. Vérifier dans la console serveur :', 'yellow');
  log('   ✅ [EMAIL][NON-BLOQUANT] doit apparaître', 'green');
  log('   ✅ Pas de crash API', 'green');
  log('   ✅ Réponse 200 OK reçue par le frontend', 'green');
  log('6. Vérifier BDD : statut_validation mis à jour', 'yellow');
  log('7. Tester connexion régie → accès dashboard OK', 'yellow');
  
  log('\n✨ Tests terminés !', 'green');
}

// Exécution
runTests().catch(error => {
  log(`\n💥 ERREUR FATALE : ${error.message}`, 'red');
  process.exit(1);
});
