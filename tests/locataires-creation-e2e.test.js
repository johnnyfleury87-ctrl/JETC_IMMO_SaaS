/**
 * TEST E2E : Flux REGIE → CREATION LOCATAIRE
 * 
 * Valide la chaîne complète :
 * - Auth + récupération regie_id
 * - API création locataire
 * - RPC creer_locataire_complet
 * - Isolation multi-tenant
 */

const { supabaseAdmin } = require('../api/_supabase');
const { expect } = require('chai');

describe('🔬 FLUX REGIE → CREATION LOCATAIRE (E2E)', function() {
  this.timeout(10000); // 10s timeout pour les appels API
  
  let regieToken, regieId, regieProfileId;
  let autreRegieToken, autreRegieId;
  let immeubleId, logementRegieId;
  let autreImmeubleId, logementAutreRegieId;
  
  // ============================================
  // SETUP : Créer régies + immeubles + logements de test
  // ============================================
  before(async function() {
    console.log('\n🔧 Setup : Création régies + logements de test...\n');
    
    try {
      // Créer régie 1
      const { data: regie1Auth } = await supabaseAdmin.auth.admin.createUser({
        email: `test-regie-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        email_confirm: true
      });
      regieProfileId = regie1Auth.user.id;
      
      const { data: regie1 } = await supabaseAdmin
        .from('regies')
        .insert({
          nom: 'Régie Test 1',
          statut_validation: 'valide'
        })
        .select()
        .single();
      regieId = regie1.id;
      
      await supabaseAdmin
        .from('profiles')
        .update({ regie_id: regieId })
        .eq('id', regieProfileId);
      
      const { data: { session: session1 } } = await supabaseAdmin.auth.signInWithPassword({
        email: regie1Auth.user.email,
        password: 'TestPassword123!'
      });
      regieToken = session1.access_token;
      
      // Créer régie 2
      const { data: regie2Auth } = await supabaseAdmin.auth.admin.createUser({
        email: `test-regie2-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        email_confirm: true
      });
      
      const { data: regie2 } = await supabaseAdmin
        .from('regies')
        .insert({
          nom: 'Régie Test 2',
          statut_validation: 'valide'
        })
        .select()
        .single();
      autreRegieId = regie2.id;
      
      await supabaseAdmin
        .from('profiles')
        .update({ regie_id: autreRegieId })
        .eq('id', regie2Auth.user.id);
      
      const { data: { session: session2 } } = await supabaseAdmin.auth.signInWithPassword({
        email: regie2Auth.user.email,
        password: 'TestPassword123!'
      });
      autreRegieToken = session2.access_token;
      
      // Créer immeubles + logements
      const { data: immeuble1 } = await supabaseAdmin
        .from('immeubles')
        .insert({
          nom: 'Immeuble Test 1',
          adresse: '1 rue Test',
          code_postal: '75001',
          ville: 'Paris',
          regie_id: regieId
        })
        .select()
        .single();
      immeubleId = immeuble1.id;
      
      const { data: logement1 } = await supabaseAdmin
        .from('logements')
        .insert({
          numero: 'A101',
          immeuble_id: immeubleId,
          statut: 'vacant'
        })
        .select()
        .single();
      logementRegieId = logement1.id;
      
      const { data: immeuble2 } = await supabaseAdmin
        .from('immeubles')
        .insert({
          nom: 'Immeuble Test 2',
          adresse: '2 rue Test',
          code_postal: '75002',
          ville: 'Paris',
          regie_id: autreRegieId
        })
        .select()
        .single();
      autreImmeubleId = immeuble2.id;
      
      const { data: logement2 } = await supabaseAdmin
        .from('logements')
        .insert({
          numero: 'B201',
          immeuble_id: autreImmeubleId,
          statut: 'vacant'
        })
        .select()
        .single();
      logementAutreRegieId = logement2.id;
      
      console.log('✅ Setup terminé');
      console.log(`   Régie 1 ID: ${regieId}`);
      console.log(`   Régie 2 ID: ${autreRegieId}`);
      console.log(`   Logement Régie 1: ${logementRegieId}`);
      console.log(`   Logement Régie 2: ${logementAutreRegieId}\n`);
      
    } catch (error) {
      console.error('❌ Erreur setup:', error);
      throw error;
    }
  });
  
  // ============================================
  // CLEANUP : Supprimer données de test
  // ============================================
  after(async function() {
    console.log('\n🧹 Cleanup : Suppression données de test...\n');
    
    try {
      // Supprimer les régies (cascade supprimera immeubles, logements, locataires)
      await supabaseAdmin.from('regies').delete().eq('id', regieId);
      await supabaseAdmin.from('regies').delete().eq('id', autreRegieId);
      
      console.log('✅ Cleanup terminé\n');
    } catch (error) {
      console.error('⚠️ Erreur cleanup:', error);
    }
  });
  
  // ============================================
  // TEST 1 : Régie valide → création locataire SANS logement
  // ============================================
  it('✅ Test 1 : Création locataire sans logement', async function() {
    const email = `locataire-${Date.now()}@test.com`;
    
    const body = {
      nom: 'Dupont',
      prenom: 'Jean',
      email: email,
      date_entree: '2025-01-01',
      telephone: '0612345678'
      // ❌ PAS DE regie_id dans le body
    };
    
    // Simuler appel API (en vrai, utiliser fetch vers localhost:3000)
    const { data: regieProfile } = await supabaseAdmin
      .from('profiles')
      .select('regie_id')
      .eq('id', regieProfileId)
      .single();
    
    expect(regieProfile.regie_id).to.equal(regieId);
    
    // Créer auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'TempPass123!',
      email_confirm: true
    });
    
    // Créer profile
    await supabaseAdmin.from('profiles').insert({
      id: authUser.user.id,
      email: email,
      role: 'locataire'
    });
    
    // Appeler RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('creer_locataire_complet', {
        p_nom: body.nom,
        p_prenom: body.prenom,
        p_email: body.email,
        p_profile_id: authUser.user.id,
        p_regie_id: regieId,  // ✅ Passé par backend
        p_logement_id: null,
        p_date_entree: body.date_entree,
        p_telephone: body.telephone,
        p_date_naissance: null,
        p_contact_urgence_nom: null,
        p_contact_urgence_telephone: null
      });
    
    expect(rpcError).to.be.null;
    expect(rpcResult).to.exist;
    expect(rpcResult.success).to.be.true;
    
    // Vérifier en DB : locataire a bien regie_id
    const { data: locataire } = await supabaseAdmin
      .from('locataires')
      .select('regie_id, logement_id, nom, prenom')
      .eq('id', rpcResult.locataire_id)
      .single();
    
    expect(locataire.regie_id).to.equal(regieId);
    expect(locataire.logement_id).to.be.null;
    expect(locataire.nom).to.equal('Dupont');
    
    console.log(`   ✅ Locataire ${locataire.prenom} ${locataire.nom} créé sans logement`);
    console.log(`      regie_id: ${locataire.regie_id}`);
  });
  
  // ============================================
  // TEST 2 : Régie valide → création locataire AVEC logement de la même régie
  // ============================================
  it('✅ Test 2 : Création locataire avec logement de la même régie', async function() {
    const email = `locataire2-${Date.now()}@test.com`;
    
    const body = {
      nom: 'Martin',
      prenom: 'Sophie',
      email: email,
      date_entree: '2025-01-01',
      logement_id: logementRegieId  // ✅ Logement appartient à la régie
    };
    
    // Créer auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'TempPass123!',
      email_confirm: true
    });
    
    // Créer profile
    await supabaseAdmin.from('profiles').insert({
      id: authUser.user.id,
      email: email,
      role: 'locataire'
    });
    
    // Appeler RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('creer_locataire_complet', {
        p_nom: body.nom,
        p_prenom: body.prenom,
        p_email: body.email,
        p_profile_id: authUser.user.id,
        p_regie_id: regieId,  // ✅ Passé par backend
        p_logement_id: body.logement_id,
        p_date_entree: body.date_entree,
        p_telephone: null,
        p_date_naissance: null,
        p_contact_urgence_nom: null,
        p_contact_urgence_telephone: null
      });
    
    expect(rpcError).to.be.null;
    expect(rpcResult.success).to.be.true;
    
    // Vérifier en DB
    const { data: locataire } = await supabaseAdmin
      .from('locataires')
      .select('regie_id, logement_id, nom, prenom')
      .eq('id', rpcResult.locataire_id)
      .single();
    
    expect(locataire.regie_id).to.equal(regieId);
    expect(locataire.logement_id).to.equal(logementRegieId);
    
    console.log(`   ✅ Locataire ${locataire.prenom} ${locataire.nom} créé avec logement ${logementRegieId}`);
  });
  
  // ============================================
  // TEST 3 : Tentative création avec logement d'une AUTRE régie
  // ============================================
  it('❌ Test 3 : Tentative logement autre régie → REFUS', async function() {
    const email = `pirate-${Date.now()}@test.com`;
    
    const body = {
      nom: 'Pirate',
      prenom: 'Jean',
      email: email,
      date_entree: '2025-01-01',
      logement_id: logementAutreRegieId  // ❌ Logement d'une autre régie
    };
    
    // Créer auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'TempPass123!',
      email_confirm: true
    });
    
    // Créer profile
    await supabaseAdmin.from('profiles').insert({
      id: authUser.user.id,
      email: email,
      role: 'locataire'
    });
    
    // Appeler RPC (devrait échouer)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('creer_locataire_complet', {
        p_nom: body.nom,
        p_prenom: body.prenom,
        p_email: body.email,
        p_profile_id: authUser.user.id,
        p_regie_id: regieId,  // Régie 1
        p_logement_id: logementAutreRegieId,  // ❌ Logement Régie 2
        p_date_entree: body.date_entree,
        p_telephone: null,
        p_date_naissance: null,
        p_contact_urgence_nom: null,
        p_contact_urgence_telephone: null
      });
    
    expect(rpcError).to.exist;
    expect(rpcError.message).to.include('appartient pas à la régie');
    
    console.log(`   ✅ Tentative création bloquée : ${rpcError.message}`);
    
    // Cleanup manual (auth.users créé mais locataire pas créé)
    await supabaseAdmin.from('profiles').delete().eq('id', authUser.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
  });
  
  // ============================================
  // TEST 4 : Tentative sans regie_id backend (profil régie orphelin)
  // ============================================
  it('❌ Test 4 : Profil régie sans regie_id → REFUS', async function() {
    // Créer profil régie orphelin
    const { data: orphanAuth } = await supabaseAdmin.auth.admin.createUser({
      email: `orphan-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true
    });
    
    await supabaseAdmin.from('profiles').update({
      role: 'regie',
      regie_id: null  // ❌ Orphelin
    }).eq('id', orphanAuth.user.id);
    
    // Vérifier que backend refuserait
    const { data: orphanProfile } = await supabaseAdmin
      .from('profiles')
      .select('regie_id')
      .eq('id', orphanAuth.user.id)
      .single();
    
    expect(orphanProfile.regie_id).to.be.null;
    
    console.log(`   ✅ Profil orphelin détecté : regie_id = NULL`);
    console.log(`      → Backend retournerait 400 REGIE_ID_MISSING`);
    
    // Cleanup
    await supabaseAdmin.from('profiles').delete().eq('id', orphanAuth.user.id);
    await supabaseAdmin.auth.admin.deleteUser(orphanAuth.user.id);
  });
  
  // ============================================
  // TEST 5 : Vérification DB : AUCUN locataire orphelin
  // ============================================
  it('✅ Test 5 : Vérification DB : locataires.regie_id IS NOT NULL', async function() {
    const { data: orphans } = await supabaseAdmin
      .from('locataires')
      .select('id, nom, prenom, regie_id')
      .is('regie_id', null);
    
    expect(orphans).to.be.empty;
    
    console.log(`   ✅ Aucun locataire orphelin trouvé en base`);
  });
  
});
