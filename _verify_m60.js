/**
 * VÉRIFICATION MIGRATION M60: MULTI-DEVISE EUR/CHF
 * Date: 2026-01-09
 * 
 * Vérifie que la migration a été correctement appliquée
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyM60() {
  console.log('🔍 VÉRIFICATION MIGRATION M60: MULTI-DEVISE\n');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60), '\n');

  const rapport = {
    date: new Date().toISOString(),
    success: true,
    errors: [],
    warnings: [],
    stats: {}
  };

  try {
    // ========================================
    // 1. VÉRIFIER STRUCTURE DES TABLES
    // ========================================
    console.log('1️⃣  VÉRIFICATION STRUCTURE\n');

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
      if (entreprisesError.message.includes('currency')) {
        rapport.errors.push('❌ entreprises.currency n\'existe pas');
        rapport.success = false;
        console.log('   ❌ entreprises.currency: MANQUANT');
      }
      if (entreprisesError.message.includes('regie_id')) {
        rapport.errors.push('❌ entreprises.regie_id n\'existe pas');
        rapport.success = false;
        console.log('   ❌ entreprises.regie_id: MANQUANT');
      }
    } else {
      const hasCurrency = entreprises.length > 0 && 'currency' in entreprises[0];
      const hasRegieId = entreprises.length > 0 && 'regie_id' in entreprises[0];
      
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
      console.log('\n❌ MIGRATION NON APPLIQUÉE');
      console.log('\n📝 Actions requises:');
      console.log('   1. Exécuter _M60_EXECUTE_IN_SUPABASE.sql dans Supabase SQL Editor');
      console.log('   2. Relancer ce script de vérification');
      return rapport;
    }

    // ========================================
    // 2. VÉRIFIER LES DONNÉES
    // ========================================
    console.log('\n2️⃣  VÉRIFICATION DONNÉES\n');

    // 2.1 Régies
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
      regiesNull.forEach(r => console.log(`         - ${r.nom}`));
    }

    // 2.2 Entreprises
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

    if (entreprisesNoCurrency.length > 0) {
      rapport.warnings.push(`⚠️  ${entreprisesNoCurrency.length} entreprises sans devise`);
    }
    if (entreprisesNoRegie.length > 0) {
      rapport.warnings.push(`⚠️  ${entreprisesNoRegie.length} entreprises sans regie_id`);
    }

    // 2.3 Factures
    const { data: allFactures } = await supabase
      .from('factures')
      .select('id, numero, currency, montant_ttc, regie_id');

    const facturesOk = allFactures.filter(f => f.currency);
    const facturesNull = allFactures.filter(f => !f.currency);

    rapport.stats.factures = {
      total: allFactures.length,
      ok: facturesOk.length,
      null: facturesNull.length
    };

    console.log(`\n   FACTURES: ${allFactures.length} total`);
    allFactures.slice(0, 5).forEach(f => {
      const icon = f.currency === 'EUR' ? '€' : f.currency === 'CHF' ? 'CHF' : '?';
      console.log(`      ${icon} ${f.numero}: ${f.montant_ttc} ${f.currency || 'NULL'}`);
    });

    if (facturesNull.length > 0) {
      rapport.warnings.push(`⚠️  ${facturesNull.length} factures sans devise`);
      console.log(`      ⚠️  ${facturesNull.length} factures sans devise`);
    }

    // ========================================
    // 3. VÉRIFIER LA COHÉRENCE
    // ========================================
    console.log('\n3️⃣  VÉRIFICATION COHÉRENCE\n');

    let coherenceOk = true;

    // Vérifier que les entreprises ont la même devise que leur régie
    for (const entreprise of allEntreprises) {
      if (entreprise.regie_id && entreprise.currency) {
        const regie = allRegies.find(r => r.id === entreprise.regie_id);
        if (regie && regie.currency !== entreprise.currency) {
          rapport.errors.push(
            `❌ Incohérence: ${entreprise.nom} (${entreprise.currency}) != régie ${regie.nom} (${regie.currency})`
          );
          coherenceOk = false;
          console.log(`   ❌ ${entreprise.nom}: ${entreprise.currency} != ${regie.currency} (régie)`);
        }
      }
    }

    // Vérifier que les factures ont la même devise que leur régie
    const facturesIncoherentes = [];
    for (const facture of allFactures) {
      if (facture.regie_id && facture.currency) {
        const regie = allRegies.find(r => r.id === facture.regie_id);
        if (regie && regie.currency !== facture.currency) {
          facturesIncoherentes.push(facture);
          coherenceOk = false;
        }
      }
    }

    if (facturesIncoherentes.length > 0) {
      rapport.errors.push(`❌ ${facturesIncoherentes.length} factures avec devise incohérente`);
      console.log(`   ❌ ${facturesIncoherentes.length} factures incohérentes`);
    }

    if (coherenceOk) {
      console.log('   ✅ Toutes les devises sont cohérentes');
    }

    // ========================================
    // 4. RÉSUMÉ
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
    console.log('='.repeat(60), '\n');

    console.log('📈 STATISTIQUES:');
    console.log(`   Régies: ${rapport.stats.regies.total} (${rapport.stats.regies.eur} EUR, ${rapport.stats.regies.chf} CHF)`);
    console.log(`   Entreprises: ${rapport.stats.entreprises.total} (${rapport.stats.entreprises.ok} OK)`);
    console.log(`   Factures: ${rapport.stats.factures.total} (${rapport.stats.factures.ok} avec devise)`);

    if (rapport.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      rapport.warnings.forEach(w => console.log(`   ${w}`));
    }

    if (rapport.errors.length > 0) {
      console.log('\n❌ ERREURS:');
      rapport.errors.forEach(e => console.log(`   ${e}`));
      rapport.success = false;
    }

    console.log('\n' + '='.repeat(60));
    
    if (rapport.success && rapport.warnings.length === 0) {
      console.log('✅ MIGRATION M60 COMPLÈTE ET VALIDE');
      console.log('='.repeat(60));
      console.log('\n🎉 Prochaine étape: ÉTAPE 3 - Mise à jour des formulaires UI');
    } else if (rapport.success && rapport.warnings.length > 0) {
      console.log('⚠️  MIGRATION M60 APPLIQUÉE AVEC AVERTISSEMENTS');
      console.log('='.repeat(60));
      console.log('\n📝 Actions recommandées:');
      console.log('   - Vérifier les données manquantes');
      console.log('   - Compléter manuellement si nécessaire');
    } else {
      console.log('❌ MIGRATION M60 INCOMPLÈTE OU INCORRECTE');
      console.log('='.repeat(60));
      console.log('\n📝 Actions requises:');
      console.log('   1. Corriger les erreurs identifiées');
      console.log('   2. Relancer ce script de vérification');
    }

    // Sauvegarder le rapport
    fs.writeFileSync('_M60_VERIFICATION_RESULTS.json', JSON.stringify(rapport, null, 2));
    console.log('\n📁 Rapport sauvegardé: _M60_VERIFICATION_RESULTS.json');

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
  verifyM60()
    .then((rapport) => {
      process.exit(rapport.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Script terminé avec erreur:', error);
      process.exit(1);
    });
}

module.exports = { verifyM60 };
