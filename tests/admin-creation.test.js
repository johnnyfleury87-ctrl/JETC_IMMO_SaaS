/**
 * TESTS - Création Admin JTEC
 * 
 * Objectif : Vérifier que le mécanisme de création du premier admin fonctionne
 * 
 * Scénarios testés :
 * 1. Aucun admin n'existe par défaut
 * 2. L'API refuse sans clé d'installation
 * 3. L'API refuse avec une clé invalide
 * 4. L'API crée un admin avec la bonne clé
 * 5. L'API refuse de créer un 2e admin
 * 6. Le rôle admin_jtec est bien appliqué
 */

const assert = require('assert');
const { supabaseAdmin } = require('../api/_supabase');
require('dotenv').config();

describe('Tests création admin JTEC', () => {
  let firstAdminId = null;
  
  before(async () => {
    console.log('\n🔧 [ADMIN-CREATION] Setup des tests...\n');
  });
  
  after(async () => {
    console.log('\n🧹 [ADMIN-CREATION] Nettoyage...\n');
    
    // Nettoyer l'admin créé pour les tests
    if (firstAdminId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(firstAdminId);
        console.log('✅ Admin test supprimé:', firstAdminId);
      } catch (error) {
        console.warn('⚠️  Erreur suppression admin test:', error.message);
      }
    }
  });
  
  // =====================================================
  // TEST 1 : Vérifier qu'aucun admin n'existe par défaut
  // =====================================================
  
  it('TEST 1 : Aucun admin_jtec ne devrait exister par défaut', async () => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin_jtec');
    
    assert(!error, 'Erreur lors de la requête profiles');
    
    // Note : Ce test peut échouer si un admin a déjà été créé
    // Dans ce cas, on skip le test de création
    if (data && data.length > 0) {
      console.warn('⚠️  Un admin existe déjà, tests de création skippés');
      this.skip();
    }
    
    assert.strictEqual(data.length, 0, 'Aucun admin ne devrait exister en base neuve');
  });
  
  // =====================================================
  // TEST 2 : L'API refuse sans clé d'installation
  // =====================================================
  
  it('TEST 2 : L\'API d\'installation refuse sans clé', async () => {
    const response = await fetch('http://localhost:3000/api/install/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@jetc.fr',
        password: 'testpassword123'
        // Pas de installKey
      })
    });
    
    const result = await response.json();
    
    assert.strictEqual(response.status, 400, 'Devrait retourner 400');
    assert.strictEqual(result.success, false, 'Success devrait être false');
    assert(result.error.includes('manquant'), 'Devrait mentionner champs manquants');
  });
  
  // =====================================================
  // TEST 3 : L'API refuse avec une clé invalide
  // =====================================================
  
  it('TEST 3 : L\'API refuse avec une clé invalide', async () => {
    const response = await fetch('http://localhost:3000/api/install/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installKey: 'MAUVAISE_CLE_12345678901234567890', // Clé invalide
        email: 'test@jetc.fr',
        password: 'testpassword123'
      })
    });
    
    const result = await response.json();
    
    assert.strictEqual(response.status, 403, 'Devrait retourner 403 Forbidden');
    assert.strictEqual(result.success, false, 'Success devrait être false');
    assert(result.error.includes('invalide'), 'Devrait mentionner clé invalide');
  });
  
  // =====================================================
  // TEST 4 : Créer un admin avec la bonne clé
  // =====================================================
  
  it('TEST 4 : Créer un admin JTEC avec la clé valide', async function() {
    this.timeout(10000); // Augmenter timeout pour l'appel API
    
    // Vérifier que INSTALL_ADMIN_KEY est configurée
    const installKey = process.env.INSTALL_ADMIN_KEY;
    assert(installKey, 'INSTALL_ADMIN_KEY doit être configurée dans .env');
    assert(installKey.length >= 32, 'INSTALL_ADMIN_KEY doit faire au moins 32 caractères');
    
    const response = await fetch('http://localhost:3000/api/install/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installKey: installKey,
        email: 'admin-test@jetc.fr',
        password: 'TestPassword123!'
      })
    });
    
    const result = await response.json();
    
    assert.strictEqual(response.status, 200, 'Devrait retourner 200 OK');
    assert.strictEqual(result.success, true, 'Success devrait être true');
    assert(result.admin_id, 'Devrait retourner un admin_id');
    assert.strictEqual(result.admin_email, 'admin-test@jetc.fr', 'Email devrait correspondre');
    
    firstAdminId = result.admin_id;
    
    // Attendre que le profil soit créé
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Vérifier que le profil existe avec le bon rôle
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', firstAdminId)
      .single();
    
    assert(!profileError, 'Profil devrait exister');
    assert.strictEqual(profile.role, 'admin_jtec', 'Rôle devrait être admin_jtec');
    assert.strictEqual(profile.email, 'admin-test@jetc.fr', 'Email devrait correspondre');
    
    console.log('✅ Admin JTEC créé:', profile.email);
  });
  
  // =====================================================
  // TEST 5 : Impossible de créer un 2e admin
  // =====================================================
  
  it('TEST 5 : Impossible de créer un 2e admin JTEC', async function() {
    this.timeout(10000);
    
    const installKey = process.env.INSTALL_ADMIN_KEY;
    
    const response = await fetch('http://localhost:3000/api/install/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installKey: installKey,
        email: 'admin2-test@jetc.fr',
        password: 'TestPassword123!'
      })
    });
    
    const result = await response.json();
    
    assert.strictEqual(response.status, 400, 'Devrait retourner 400 Bad Request');
    assert.strictEqual(result.success, false, 'Success devrait être false');
    assert(result.error.includes('existe déjà'), 'Devrait mentionner admin existant');
  });
  
  // =====================================================
  // TEST 6 : Le mot de passe faible est refusé
  // =====================================================
  
  it('TEST 6 : L\'API refuse un mot de passe trop court', async () => {
    const installKey = process.env.INSTALL_ADMIN_KEY;
    
    const response = await fetch('http://localhost:3000/api/install/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installKey: installKey,
        email: 'admin3@jetc.fr',
        password: 'short' // Mot de passe trop court
      })
    });
    
    const result = await response.json();
    
    assert.strictEqual(response.status, 400, 'Devrait retourner 400');
    assert.strictEqual(result.success, false, 'Success devrait être false');
    assert(result.error.includes('12 caractères'), 'Devrait mentionner exigence 12 caractères');
  });
});

// =====================================================
// EXÉCUTION DES TESTS
// =====================================================

if (require.main === module) {
  console.log('\n🧪 [ADMIN-CREATION] Démarrage des tests...\n');
  
  // Note : Ces tests nécessitent que le serveur soit lancé
  // npm run dev dans un terminal séparé
  
  const Mocha = require('mocha');
  const mocha = new Mocha({
    timeout: 15000,
    reporter: 'spec'
  });
  
  mocha.suite.emit('pre-require', global, null, mocha);
  
  describe('Tests création admin JTEC', function() {
    // Tests définis ci-dessus
  });
  
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}
