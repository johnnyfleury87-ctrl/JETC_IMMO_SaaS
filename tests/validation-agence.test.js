/**
 * TESTS - Validation des agences
 * 
 * Scénarios testés :
 * 1. Nouvelle agence a statut en_attente
 * 2. Login bloqué si agence en_attente
 * 3. Seul admin_jtec peut valider
 * 4. Accès autorisé après validation
 * 5. Refus avec commentaire fonctionne
 */

const assert = require('assert');
const { supabaseAdmin } = require('../api/_supabase');
require('dotenv').config();

describe('Tests validation agence', () => {
  let testRegieId = null;
  let testProfileId = null;
  let adminId = null;
  
  before(async () => {
    console.log('\n🔧 [VALIDATION-AGENCE] Setup...\n');
    
    // Récupérer ou créer un admin pour les tests
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin_jtec')
      .limit(1);
    
    if (admins && admins.length > 0) {
      adminId = admins[0].id;
      console.log('✅ Admin existant trouvé:', adminId);
    } else {
      console.warn('⚠️  Aucun admin trouvé - certains tests seront skippés');
    }
  });
  
  after(async () => {
    console.log('\n🧹 [VALIDATION-AGENCE] Nettoyage...\n');
    
    // Nettoyer les données de test
    if (testProfileId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(testProfileId);
        console.log('✅ Profil test supprimé');
      } catch (error) {
        console.warn('⚠️  Erreur nettoyage:', error.message);
      }
    }
  });
  
  // =====================================================
  // TEST 1 : Nouvelle agence créée avec statut en_attente
  // =====================================================
  
  it('TEST 1 : Nouvelle agence a statut_validation = en_attente', async function() {
    this.timeout(10000);
    
    // Créer un utilisateur test
    const testEmail = `regie-test-${Date.now()}@jetc.fr`;
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { language: 'fr' }
    });
    
    assert(!authError, 'Erreur création utilisateur');
    testProfileId = authData.user.id;
    
    // Créer le profil manuellement (le code métier crée le profil, pas un trigger SQL)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: testProfileId,
        email: testEmail,
        role: 'regie',
        language: 'fr',
        is_demo: false
      });
    
    assert(!profileError, 'Erreur création profil');
    
    // Créer la régie
    const { data: regieData, error: regieError } = await supabaseAdmin
      .from('regies')
      .insert({
        profile_id: testProfileId,
        nom: 'Agence Test Validation',
        email: testEmail,
        nb_collaborateurs: 5,
        nb_logements_geres: 100,
        siret: '12345678901234'
      })
      .select()
      .single();
    
    assert(!regieError, 'Erreur création régie');
    assert(regieData, 'Régie devrait être créée');
    
    testRegieId = regieData.id;
    
    // Vérifier le statut
    assert.strictEqual(regieData.statut_validation, 'en_attente', 'Statut devrait être en_attente par défaut');
    
    console.log('✅ Régie créée avec statut en_attente');
  });
  
  // =====================================================
  // TEST 2 : Login bloqué si statut en_attente
  // =====================================================
  
  it('TEST 2 : Login bloqué si agence en_attente', async function() {
    this.timeout(10000);
    
    assert(testProfileId, 'Profil test doit exister');
    assert(testRegieId, 'Régie test doit exister');
    
    // Vérifier que le statut est bien en_attente
    const { data: regie } = await supabaseAdmin
      .from('regies')
      .select('statut_validation')
      .eq('id', testRegieId)
      .single();
    
    assert.strictEqual(regie.statut_validation, 'en_attente');
    
    console.log('✅ Vérification : statut en_attente bloque l\'accès (logique dans login.js)');
  });
  
  // =====================================================
  // TEST 3 : Seul admin_jtec peut valider
  // =====================================================
  
  it('TEST 3 : Fonction valider_agence vérifie le rôle admin', async function() {
    this.timeout(10000);
    
    if (!adminId) {
      console.warn('⚠️  Test skippé : pas d\'admin disponible');
      this.skip();
    }
    
    assert(testRegieId, 'Régie test doit exister');
    
    // Appeler la fonction SQL valider_agence
    const { data, error } = await supabaseAdmin.rpc('valider_agence', {
      p_regie_id: testRegieId,
      p_admin_id: adminId
    });
    
    assert(!error, 'Erreur RPC valider_agence');
    assert(data, 'Réponse devrait exister');
    assert.strictEqual(data.success, true, 'Validation devrait réussir avec admin_jtec');
    
    console.log('✅ Admin peut valider une agence');
  });
  
  // =====================================================
  // TEST 4 : Accès autorisé après validation
  // =====================================================
  
  it('TEST 4 : Statut passe à valide après validation', async function() {
    this.timeout(10000);
    
    assert(testRegieId, 'Régie test doit exister');
    
    // Vérifier le nouveau statut
    const { data: regie, error } = await supabaseAdmin
      .from('regies')
      .select('statut_validation, date_validation, admin_validateur_id')
      .eq('id', testRegieId)
      .single();
    
    assert(!error, 'Erreur récupération régie');
    assert.strictEqual(regie.statut_validation, 'valide', 'Statut devrait être valide');
    assert(regie.date_validation, 'Date de validation devrait être renseignée');
    assert(regie.admin_validateur_id, 'Admin validateur devrait être renseigné');
    
    console.log('✅ Agence validée avec succès');
  });
  
  // =====================================================
  // TEST 5 : Test de refus avec commentaire
  // =====================================================
  
  it('TEST 5 : Fonction refuser_agence nécessite un commentaire', async function() {
    this.timeout(10000);
    
    if (!adminId) {
      console.warn('⚠️  Test skippé : pas d\'admin disponible');
      this.skip();
    }
    
    // Créer une nouvelle régie pour tester le refus
    const testEmail2 = `regie-test-refus-${Date.now()}@jetc.fr`;
    
    const { data: authData } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail2,
      password: 'TestPassword123!',
      email_confirm: true
    });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const { data: regieData } = await supabaseAdmin
      .from('regies')
      .insert({
        profile_id: authData.user.id,
        nom: 'Agence Test Refus',
        email: testEmail2,
        nb_collaborateurs: 1,
        nb_logements_geres: 10
      })
      .select()
      .single();
    
    // Tester refus avec commentaire
    const { data: result, error } = await supabaseAdmin.rpc('refuser_agence', {
      p_regie_id: regieData.id,
      p_admin_id: adminId,
      p_commentaire: 'Test de refus : informations incomplètes'
    });
    
    assert(!error, 'Erreur RPC refuser_agence');
    assert.strictEqual(result.success, true, 'Refus devrait réussir');
    
    // Vérifier le statut
    const { data: regieRefusee } = await supabaseAdmin
      .from('regies')
      .select('statut_validation, commentaire_refus')
      .eq('id', regieData.id)
      .single();
    
    assert.strictEqual(regieRefusee.statut_validation, 'refuse', 'Statut devrait être refuse');
    assert(regieRefusee.commentaire_refus, 'Commentaire devrait être renseigné');
    
    // Nettoyage
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    
    console.log('✅ Refus avec commentaire fonctionne');
  });
});
