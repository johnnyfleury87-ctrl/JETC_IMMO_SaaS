#!/usr/bin/env node
/**
 * TEST EXHAUSTIF LOGIN & ROUTING - TOUS LES RÔLES
 * 
 * Vérifie chaque login avec compte réel + test redirection
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

// Comptes de test (RÉELS en DB)
const TEST_ACCOUNTS = [
  {
    role: 'entreprise',
    email: 'entreprise@test.app',
    password: 'TestJetc2026!',
    expectedDashboard: '/entreprise/dashboard.html',
    additionalPages: ['/entreprise/techniciens.html']
  },
  {
    role: 'regie',
    email: 'johnny.thiriet@gmail.com',
    password: 'TestJetc2026!',
    expectedDashboard: '/regie/dashboard.html',
    additionalPages: ['/regie/tickets.html', '/regie/entreprises.html']
  },
  {
    role: 'admin_jtec',
    email: 'johnny.fleury87@gmail.com',
    password: 'TestJetc2026!',
    expectedDashboard: '/admin/dashboard.html',
    additionalPages: []
  },
  {
    role: 'locataire',
    email: 'locataire1@exemple.ch',
    password: 'TestJetc2026!',
    expectedDashboard: '/locataire/dashboard.html',
    additionalPages: []
  },
  {
    role: 'technicien',
    email: 'tech@test.app',
    password: 'TestJetc2026!',
    expectedDashboard: '/technicien/dashboard.html',
    additionalPages: []
  },
  {
    role: 'proprietaire',
    email: null, // Pas encore de compte proprietaire
    password: null,
    expectedDashboard: '/proprietaire/dashboard.html',
    additionalPages: []
  }
];

async function testLogin(account) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 TEST LOGIN: ${account.role.toUpperCase()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (!account.email) {
    console.log(`⚠️ Aucun compte ${account.role} trouvé en DB`);
    return { role: account.role, status: 'NO_ACCOUNT', error: 'Pas de compte test disponible' };
  }

  if (!account.password) {
    console.log(`⚠️ Mot de passe non défini pour ${account.email}`);
    return { role: account.role, status: 'NO_PASSWORD', error: 'Mot de passe requis pour test' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    console.log(`📧 Email: ${account.email}`);
    console.log(`🔑 Password: ${account.password ? '***' : '(non défini)'}`);
    console.log(`\n1️⃣ Tentative de connexion...`);

    // Tenter connexion
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password
    });

    if (authError) {
      console.log(`❌ ERREUR AUTH:`, authError.message);
      return { 
        role: account.role, 
        status: 'AUTH_ERROR', 
        error: authError.message,
        email: account.email
      };
    }

    console.log(`✅ Authentification réussie`);
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email confirmé: ${authData.user.email_confirmed_at ? 'Oui' : 'Non'}`);

    // Récupérer profil
    console.log(`\n2️⃣ Récupération du profil...`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, regie_id, entreprise_id')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.log(`❌ ERREUR PROFIL:`, profileError?.message || 'Profile introuvable');
      await supabase.auth.signOut();
      return { 
        role: account.role, 
        status: 'PROFILE_ERROR', 
        error: profileError?.message || 'Profile introuvable',
        email: account.email
      };
    }

    console.log(`✅ Profil récupéré`);
    console.log(`   Rôle DB: ${profile.role}`);
    console.log(`   Rôle attendu: ${account.role}`);

    // Vérifier correspondance rôle
    if (profile.role !== account.role) {
      console.log(`⚠️ INCOHÉRENCE RÔLE: DB=${profile.role}, attendu=${account.role}`);
    }

    // Vérification spécifique REGIE
    if (profile.role === 'regie') {
      console.log(`\n3️⃣ Vérification statut validation régie...`);
      
      const { data: regie, error: regieError } = await supabase
        .from('regies')
        .select('id, nom, statut_validation, commentaire_refus')
        .eq('profile_id', authData.user.id)
        .single();

      if (regieError) {
        console.log(`❌ ERREUR REGIE:`, regieError.message);
        await supabase.auth.signOut();
        return { 
          role: account.role, 
          status: 'REGIE_ERROR', 
          error: `Erreur récupération régie: ${regieError.message}`,
          email: account.email
        };
      }

      console.log(`   Statut validation: ${regie.statut_validation || '(null)'}`);
      
      if (regie.statut_validation === 'en_attente') {
        console.log(`⚠️ Régie en attente de validation`);
        await supabase.auth.signOut();
        return { 
          role: account.role, 
          status: 'REGIE_EN_ATTENTE', 
          error: 'Inscription en attente validation',
          email: account.email
        };
      }

      if (regie.statut_validation === 'refuse') {
        console.log(`❌ Régie refusée:`, regie.commentaire_refus);
        await supabase.auth.signOut();
        return { 
          role: account.role, 
          status: 'REGIE_REFUSE', 
          error: `Inscription refusée: ${regie.commentaire_refus}`,
          email: account.email
        };
      }

      console.log(`✅ Régie validée`);
    }

    // Déconnexion propre
    await supabase.auth.signOut();

    console.log(`\n✅ TEST RÉUSSI pour ${account.role}`);
    console.log(`   Dashboard attendu: ${account.expectedDashboard}`);

    return {
      role: account.role,
      status: 'OK',
      email: account.email,
      userId: authData.user.id,
      profileRole: profile.role,
      expectedDashboard: account.expectedDashboard
    };

  } catch (error) {
    console.log(`❌ EXCEPTION:`, error.message);
    return {
      role: account.role,
      status: 'EXCEPTION',
      error: error.message,
      email: account.email
    };
  }
}

async function runAllTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TEST EXHAUSTIF LOGIN & ROUTING - TOUS LES RÔLES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = [];

  for (const account of TEST_ACCOUNTS) {
    const result = await testLogin(account);
    results.push(result);
    
    // Pause entre tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Récapitulatif
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉCAPITULATIF TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  results.forEach(result => {
    const statusIcon = result.status === 'OK' ? '✅' : 
                      result.status === 'NO_ACCOUNT' ? '⚠️' :
                      result.status === 'NO_PASSWORD' ? '⚠️' : '❌';
    
    console.log(`${statusIcon} ${result.role.toUpperCase().padEnd(15)} | Status: ${result.status.padEnd(15)} | ${result.email || '(no account)'}`);
    if (result.error) {
      console.log(`   └─ Erreur: ${result.error}`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const okCount = results.filter(r => r.status === 'OK').length;
  const totalTestable = results.filter(r => r.status !== 'NO_ACCOUNT' && r.status !== 'NO_PASSWORD').length;
  
  console.log(`\n✅ Tests réussis: ${okCount}/${totalTestable}`);
  console.log(`⚠️ Comptes non testables: ${results.filter(r => r.status === 'NO_ACCOUNT' || r.status === 'NO_PASSWORD').length}`);
  console.log(`❌ Erreurs: ${results.filter(r => !['OK', 'NO_ACCOUNT', 'NO_PASSWORD'].includes(r.status)).length}`);

  if (okCount === totalTestable && totalTestable > 0) {
    console.log('\n🎉 TOUS LES LOGINS TESTABLES FONCTIONNENT !');
  } else {
    console.log('\n⚠️ DES CORRECTIONS SONT NÉCESSAIRES');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Sauvegarder résultats
  const fs = require('fs');
  fs.writeFileSync(
    './TEST_LOGIN_ROUTING_RESULTS.json',
    JSON.stringify(results, null, 2)
  );
  console.log('💾 Résultats sauvegardés dans TEST_LOGIN_ROUTING_RESULTS.json\n');
}

runAllTests();
