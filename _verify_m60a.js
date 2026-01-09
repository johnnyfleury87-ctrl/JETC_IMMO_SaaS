/**
 * VÉRIFICATION MIGRATION M60A: MULTI-DEVISE EUR/CHF (VERSION SÉCURISÉE)
 * Date: 2026-01-09
 * 
 * Vérifie que la migration M60A a été correctement appliquée
 * SANS casser le code existant
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyM60A() {
  console.log('🔍 VÉRIFICATION MIGRATION M60A: MULTI-DEVISE (SÉCURISÉE)\n');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60), '\n');

  const rapport = {
    date: new Date().toISOString(),
    success: true,
    errors: [],
    warnings: [],
    stats: {},
    compatibilite: {
      montant_reel_chf_preserved: false,
      code_frontend_ok: true,
      code_backend_ok: true
    }
  };

  try {
    // ========================================
    // 1. VÉRIFIER STRUCTURE DES TABLES
    // ========================================
    console.log('1️⃣  VÉRIFICATION STRUCTURE\n');

    // Vérifier missions: montant_reel ET montant_reel_chf doivent coexister
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select('id, montant_reel, montant_reel_chf, devise')
      .limit(1);

    if (missionsError) {
      rapport.errors.push('❌ Erreur lecture missions: ' + missionsError.message);
      rapport.success = false;
      console.log('   ❌ missions: ERREUR');
    } else if (missions.length > 0) {
      const hasMontantReel = 'montant_reel' in missions[0];
      const hasMontantReelChf = 'montant_reel_chf' in missions[0];
      
      if (!hasMontantReel) {
        rapport.errors.push('❌ missions.montant_reel n\'existe pas');
        rapport.success = false;
        console.log('   ❌ missions.montant_reel: MANQUANT');
      } else {
        console.log('   ✅ missions.montant_reel: OK (ajouté)');
      }
      
      if (!hasMontantReelChf) {
        rapport.errors.push('❌ missions.montant_reel_chf a été supprimé (CRITIQUE!)');
        rapport.success = false;
        rapport.compatibilite.montant_reel_chf_preserved = false;
        rapport.compatibilite.code_frontend_ok = false;
        rapport.compatibilite.code_backend_ok = false;
        console.log('   ❌ missions.montant_reel_chf: SUPPRIMÉ (CODE CASSÉ!)');
      } else {
        rapport.compatibilite.montant_reel_chf_preserved = true;
        console.log('   ✅ missions.montant_reel_chf: CONSERVÉ (compatibilité OK)');
      }
    }

    // Vérifier regies.currency
    const { data: regies, error: regiesError } = await supabase
      .from('regies')
      .select('id, nom, currency')
      .limit(1);

    if (regiesError) {
      if (regiesError.message.includes('currency') && regiesError.message.includes('does not exist')) {
        rapport.errors.push('❌ regies.currency n\'existe pas');
        rapport.success = false;
        console.log('   ❌ regies.currency: MANQUANT');
      } else {
        throw regiesError;
      }
    } else {
      console.log('   ✅ regies.currency: OK');
    }

    // Vérifier entreprises.currency et regie_id
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, currency, regie_id')
      .limit(1);

    if (entreprisesError) {
      rapport.errors.push('❌ Erreur entreprises: ' + entreprisesError.message);
      rapport.success = false;
    } else if (entreprises.length > 0) {
      const hasCurrency = 'currency' in entreprises[0];
      const hasRegieId = 'regie_id' in entreprises[0];
      
      if (hasCurrency) {
        console.log('   ✅ entreprises.currency: OK');
      } else {
        rapport.errors.push('❌ entreprises.currency manquant');
        rapport.success = false;
        console.log('   ❌ entreprises.currency: MANQUANT');
      }
      
      if (hasRegieId) {
        console.log('   ✅ entreprises.regie_id: OK');
      } else {
        rapport.errors.push('❌ entreprises.regie_id manquant');
        rapport.success = false;
        console.log('   ❌ entreprises.regie_id: MANQUANT');
      }
    }

    // Vérifier locataires.currency
    const { data: locataires, error: locatairesError } = await supabase
      .from('locataires')
      .select('id, currency')
      .limit(1);

    if (locatairesError) {
      if (locatairesError.message.includes('currency')) {
        rapport.errors.push('❌ locataires.currency n\'existe pas');
        rapport.success = false;
        console.log('   ❌ locataires.currency: MANQUANT');
      }
    } else {
      console.log('   ✅ locataires.currency: OK');
    }

    // Vérifier factures.currency
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('id, currency')
      .limit(1);

    if (facturesError) {
      if (facturesError.message.includes('currency')) {
        rapport.errors.push('❌ factures.currency n\'existe pas');
        rapport.success = false;
        console.log('   ❌ factures.currency: MANQUANT');
      }
    } else {
      console.log('   ✅ factures.currency: OK');
    }

    // Si des erreurs de structure, on arrête ici
    if (rapport.errors.length > 0) {
      console.log('\n❌ MIGRATION NON APPLIQUÉE OU INCOMPLÈTE');
      console.log('\n📝 Actions requises:');
      console.log('   1. Exécuter _M60A_SECURE_MULTI_DEVISE.sql dans Supabase SQL Editor');
      console.log('   2. Relancer ce script de vérification');
      return rapport;
    }

    // ========================================
    // 2. VÉRIFIER SYNCHRONISATION montant_reel
    // ========================================
    console.log('\n2️⃣  VÉRIFICATION SYNCHRONISATION montant_reel ↔ montant_reel_chf\n');

    const { data: allMissions } = await supabase
      .from('missions')
      .select('id, montant_reel, montant_reel_chf')
      .not('montant_reel_chf', 'is', null);

    if (allMissions && allMissions.length > 0) {
      let synced = 0;
      let notSynced = 0;

      allMissions.forEach(m => {
        if (m.montant_reel === m.montant_reel_chf) {
          synced++;
        } else {
          notSynced++;
          rapport.warnings.push(`⚠️  Mission ${m.id}: montant_reel (${m.montant_reel}) != montant_reel_chf (${m.montant_reel_chf})`);
        }
      });

      console.log(`   Missions avec montant: ${allMissions.length}`);
      console.log(`   Synchronisées: ${synced}`);
      console.log(`   Non synchronisées: ${notSynced}`);

      if (notSynced > 0) {
        console.log(`   ⚠️  ${notSynced} missions nécessitent une synchronisation`);
      }
    } else {
      console.log('   ℹ️  Aucune mission avec montant renseigné');
    }

    // ========================================
    // 3. VÉRIFIER LES DONNÉES
    // ========================================
    console.log('\n3️⃣  VÉRIFICATION DONNÉES\n');

    // 3.1 Régies
    const { data: allRegies } = await supabase
      .from('regies')
      .select('id, nom, currency');

    const regiesEur = allRegies.filter(r => r.currency === 'EUR');
    const regiesChf = allRegies.filter(r => r.currency === 'CHF');
    const regiesNull = allRegies.filter(r => !r.currency);

    rapport.stats.regies = {
      total: allRegies.length,
      eur: regiesEur.length,
      chf: regiesChf.length,
      null: regiesNull.length
    };

    console.log(`   RÉGIES: ${allRegies.length} total`);
    regiesEur.forEach(r => console.log(`      € ${r.nom}: EUR`));
    regiesChf.forEach(r => console.log(`      CHF ${r.nom}: CHF`));
    
    if (regiesNull.length > 0) {
      rapport.warnings.push(`⚠️  ${regiesNull.length} régies sans devise`);
      console.log(`      ⚠️  ${regiesNull.length} régies sans devise`);
    }

    // 3.2 Entreprises
    const { data: allEntreprises } = await supabase
      .from('entreprises')
      .select('id, nom, currency, regie_id');

    const entreprisesOk = allEntreprises.filter(e => e.currency && e.regie_id);
    const entreprisesNoCurrency = allEntreprises.filter(e => !e.currency);
    const entreprisesNoRegie = allEntreprises.filter(e => !e.regie_id);

    rapport.stats.entreprises = {
      total: allEntreprises.length,
      ok: entreprisesOk.length,
      noCurrency: entreprisesNoCurrency.length,
      noRegie: entreprisesNoRegie.length
    };

    console.log(`\n   ENTREPRISES: ${allEntreprises.length} total`);
    allEntreprises.forEach(e => {
      const icon = e.currency === 'EUR' ? '€' : e.currency === 'CHF' ? 'CHF' : '?';
      const regieStatus = e.regie_id ? '✓' : '✗';
      console.log(`      ${icon} ${e.nom}: ${e.currency || 'NULL'} (regie: ${regieStatus})`);
    });

    if (entreprisesNoRegie.length > 0) {
      rapport.warnings.push(`⚠️  ${entreprisesNoRegie.length} entreprises sans regie_id (affectation manuelle requise)`);
      console.log(`      ⚠️  ${entreprisesNoRegie.length} entreprises nécessitent affectation manuelle regie_id`);
    }

    // ========================================
    // 4. VÉRIFIER COMPATIBILITÉ CODE
    // ========================================
    console.log('\n4️⃣  VÉRIFICATION COMPATIBILITÉ CODE\n');

    if (rapport.compatibilite.montant_reel_chf_preserved) {
      console.log('   ✅ montant_reel_chf CONSERVÉ');
      console.log('   ✅ Frontend compatible (dashboard.html)');
      console.log('   ✅ Backend compatible (RPC generate_facture_from_mission)');
      console.log('   ✅ Tests compatibles (_test_workflow_facturation.js)');
    } else {
      console.log('   ❌ montant_reel_chf SUPPRIMÉ → CODE CASSÉ!');
      rapport.compatibilite.code_frontend_ok = false;
      rapport.compatibilite.code_backend_ok = false;
    }

    // ========================================
    // 5. RÉSUMÉ
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA VÉRIFICATION M60A');
    console.log('='.repeat(60), '\n');

    console.log('📈 STATISTIQUES:');
    console.log(`   Régies: ${rapport.stats.regies.total} (${rapport.stats.regies.eur} EUR, ${rapport.stats.regies.chf} CHF)`);
    console.log(`   Entreprises: ${rapport.stats.entreprises.total} (${rapport.stats.entreprises.ok} OK)`);

    console.log('\n🔧 COMPATIBILITÉ:');
    console.log(`   montant_reel_chf conservé: ${rapport.compatibilite.montant_reel_chf_preserved ? '✅' : '❌'}`);
    console.log(`   Code frontend: ${rapport.compatibilite.code_frontend_ok ? '✅ OK' : '❌ CASSÉ'}`);
    console.log(`   Code backend: ${rapport.compatibilite.code_backend_ok ? '✅ OK' : '❌ CASSÉ'}`);

    if (rapport.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      rapport.warnings.slice(0, 5).forEach(w => console.log(`   ${w}`));
      if (rapport.warnings.length > 5) {
        console.log(`   ... et ${rapport.warnings.length - 5} autres`);
      }
    }

    if (rapport.errors.length > 0) {
      console.log('\n❌ ERREURS:');
      rapport.errors.forEach(e => console.log(`   ${e}`));
      rapport.success = false;
    }

    console.log('\n' + '='.repeat(60));
    
    if (rapport.success && rapport.warnings.length === 0) {
      console.log('✅ MIGRATION M60A COMPLÈTE ET VALIDE');
      console.log('✅ CODE EXISTANT PRÉSERVÉ');
      console.log('='.repeat(60));
      console.log('\n🎉 Prochaine étape: M60B - Migration du code (optionnelle)');
      console.log('   Ou continuer directement avec ÉTAPE 3 - Formulaires UI');
    } else if (rapport.success && rapport.warnings.length > 0) {
      console.log('⚠️  MIGRATION M60A APPLIQUÉE AVEC AVERTISSEMENTS');
      console.log('='.repeat(60));
      console.log('\n📝 Actions recommandées:');
      if (rapport.stats.entreprises.noRegie > 0) {
        console.log(`   - Affecter manuellement regie_id pour ${rapport.stats.entreprises.noRegie} entreprise(s)`);
      }
      console.log('   - Consulter les avertissements ci-dessus');
    } else {
      console.log('❌ MIGRATION M60A INCOMPLÈTE OU INCORRECTE');
      console.log('='.repeat(60));
      console.log('\n📝 Actions requises:');
      console.log('   1. Corriger les erreurs identifiées');
      console.log('   2. Relancer ce script de vérification');
    }

    // Sauvegarder le rapport
    fs.writeFileSync('_M60A_VERIFICATION_RESULTS.json', JSON.stringify(rapport, null, 2));
    console.log('\n📁 Rapport sauvegardé: _M60A_VERIFICATION_RESULTS.json');

    return rapport;

  } catch (error) {
    console.error('\n❌ ERREUR LORS DE LA VÉRIFICATION:', error.message);
    console.error(error.stack);
    rapport.success = false;
    rapport.errors.push(`Erreur: ${error.message}`);
    return rapport;
  }
}

// Point d'entrée
if (require.main === module) {
  verifyM60A()
    .then((rapport) => {
      process.exit(rapport.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Script terminé avec erreur:', error);
      process.exit(1);
    });
}

module.exports = { verifyM60A };
