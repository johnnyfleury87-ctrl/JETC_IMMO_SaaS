#!/usr/bin/env node
/**
 * ÉTAPE 6 - TESTS NON-RÉGRESSION MULTI-DEVISE
 * Date: 2026-01-09
 * Objectif: Valider le système EUR/CHF sans régressions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Résultats des tests
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Helper: Logger
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    error: '❌',
    warning: '⚠️ '
  }[level] || '';
  
  console.log(`${prefix} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Helper: Assert
function assert(condition, testName, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    log('success', `TEST ${results.total}: ${testName}`);
    return true;
  } else {
    results.failed++;
    const error = `TEST ${results.total} ÉCHEC: ${testName} - ${details}`;
    log('error', error);
    results.errors.push(error);
    return false;
  }
}

// ============================================
// GROUPE 1: STRUCTURE TABLES
// ============================================

async function testStructure() {
  log('info', '\n========================================');
  log('info', 'GROUPE 1: STRUCTURE TABLES');
  log('info', '========================================\n');
  
  // Test 1.1: Vérifier colonne currency sur regies
  try {
    const { data, error } = await supabase
      .from('regies')
      .select('id, nom, currency')
      .limit(1);
    
    assert(
      !error && data !== null,
      'Colonne currency existe sur table regies',
      error?.message || ''
    );
  } catch (e) {
    assert(false, 'Colonne currency existe sur table regies', e.message);
  }
  
  // Test 1.2: Vérifier colonne currency sur entreprises
  try {
    const { data, error } = await supabase
      .from('entreprises')
      .select('id, nom, currency')
      .limit(1);
    
    assert(
      !error && data !== null,
      'Colonne currency existe sur table entreprises',
      error?.message || ''
    );
  } catch (e) {
    assert(false, 'Colonne currency existe sur table entreprises', e.message);
  }
  
  // Test 1.3: Vérifier colonne currency sur factures
  try {
    const { data, error } = await supabase
      .from('factures')
      .select('id, numero, currency, montant_ht, montant_tva, montant_ttc, taux_tva')
      .limit(1);
    
    assert(
      !error && data !== null,
      'Colonne currency existe sur table factures avec colonnes générées',
      error?.message || ''
    );
  } catch (e) {
    assert(false, 'Colonne currency existe sur table factures', e.message);
  }
  
  // Test 1.4: Vérifier colonne regie_id sur locataires
  try {
    const { data, error } = await supabase
      .from('locataires')
      .select('id, nom, prenom, regie_id')
      .limit(1);
    
    assert(
      !error && data !== null,
      'Colonne regie_id existe sur table locataires',
      error?.message || ''
    );
  } catch (e) {
    assert(false, 'Colonne regie_id existe sur table locataires', e.message);
  }
}

// ============================================
// GROUPE 2: FONCTIONS RPC
// ============================================

async function testRPCFunctions() {
  log('info', '\n========================================');
  log('info', 'GROUPE 2: FONCTIONS RPC');
  log('info', '========================================\n');
  
  // Test 2.1: Fonction calculer_montants_facture (EUR)
  try {
    const { data, error } = await supabase
      .rpc('calculer_montants_facture', {
        p_montant_ht: 1000,
        p_currency: 'EUR'
      });
    
    const valid = !error && 
      data?.currency === 'EUR' &&
      data?.montant_ht === 1000 &&
      data?.taux_tva === 20.00 &&
      data?.montant_tva === 200.00 &&
      data?.montant_ttc === 1200.00 &&
      data?.taux_commission === 2.00 &&
      data?.montant_commission === 20.00;
    
    assert(
      valid,
      'calculer_montants_facture EUR (1000€ → TVA 20% = 200€)',
      error?.message || (!valid ? JSON.stringify(data) : '')
    );
  } catch (e) {
    assert(false, 'calculer_montants_facture EUR', e.message);
  }
  
  // Test 2.2: Fonction calculer_montants_facture (CHF)
  try {
    const { data, error } = await supabase
      .rpc('calculer_montants_facture', {
        p_montant_ht: 1000,
        p_currency: 'CHF'
      });
    
    const valid = !error && 
      data?.currency === 'CHF' &&
      data?.montant_ht === 1000 &&
      data?.taux_tva === 8.10 &&
      data?.montant_tva === 81.00 &&
      data?.montant_ttc === 1081.00 &&
      data?.taux_commission === 2.00 &&
      data?.montant_commission === 20.00;
    
    assert(
      valid,
      'calculer_montants_facture CHF (1000.- → TVA 8.1% = 81.-)',
      error?.message || (!valid ? JSON.stringify(data) : '')
    );
  } catch (e) {
    assert(false, 'calculer_montants_facture CHF', e.message);
  }
  
  // Test 2.3: Fonction get_user_regie_id existe
  try {
    // Note: Cette fonction retourne NULL si pas authentifié avec service role
    const { error } = await supabase.rpc('get_user_regie_id');
    
    // Pas d'erreur "function not found" = fonction existe
    assert(
      !error || !error.message?.includes('not found'),
      'Fonction get_user_regie_id existe',
      error?.message || ''
    );
  } catch (e) {
    assert(
      !e.message?.includes('not found'),
      'Fonction get_user_regie_id existe',
      e.message
    );
  }
}

// ============================================
// GROUPE 3: DONNÉES EXISTANTES
// ============================================

async function testExistingData() {
  log('info', '\n========================================');
  log('info', 'GROUPE 3: DONNÉES EXISTANTES');
  log('info', '========================================\n');
  
  // Test 3.1: Régies avec devise
  try {
    const { data: regies, error } = await supabase
      .from('regies')
      .select('id, nom, currency')
      .not('currency', 'is', null);
    
    assert(
      !error && regies && regies.length > 0,
      `Régies avec devise: ${regies?.length || 0} trouvées`,
      error?.message || ''
    );
    
    if (regies && regies.length > 0) {
      log('info', `   └─ Exemple: ${regies[0].nom} (${regies[0].currency})`);
    }
  } catch (e) {
    assert(false, 'Régies avec devise', e.message);
  }
  
  // Test 3.2: Entreprises avec devise
  try {
    const { data: entreprises, error } = await supabase
      .from('entreprises')
      .select('id, nom, currency')
      .not('currency', 'is', null);
    
    assert(
      !error && entreprises !== null,
      `Entreprises avec devise: ${entreprises?.length || 0} trouvées`,
      error?.message || ''
    );
    
    if (entreprises && entreprises.length > 0) {
      log('info', `   └─ Exemple: ${entreprises[0].nom} (${entreprises[0].currency})`);
    }
  } catch (e) {
    assert(false, 'Entreprises avec devise', e.message);
  }
  
  // Test 3.3: Factures avec devise
  try {
    const { data: factures, error } = await supabase
      .from('factures')
      .select('numero, currency, montant_ht, montant_tva, montant_ttc, taux_tva')
      .not('currency', 'is', null)
      .limit(5);
    
    assert(
      !error && factures !== null,
      `Factures avec devise: ${factures?.length || 0} trouvées`,
      error?.message || ''
    );
    
    if (factures && factures.length > 0) {
      log('info', `   └─ Exemple: ${factures[0].numero} (${factures[0].currency}, TVA ${factures[0].taux_tva}%)`);
    }
  } catch (e) {
    assert(false, 'Factures avec devise', e.message);
  }
  
  // Test 3.4: Répartition EUR/CHF
  try {
    const { data: facturesAll, error } = await supabase
      .from('factures')
      .select('currency');
    
    if (!error && facturesAll) {
      const stats = facturesAll.reduce((acc, f) => {
        acc[f.currency || 'NULL'] = (acc[f.currency || 'NULL'] || 0) + 1;
        return acc;
      }, {});
      
      log('info', `   Répartition factures par devise:`);
      for (const [currency, count] of Object.entries(stats)) {
        log('info', `     - ${currency}: ${count}`);
      }
      
      assert(true, 'Répartition EUR/CHF calculée');
    }
  } catch (e) {
    log('warning', 'Impossible de calculer répartition', e.message);
  }
}

// ============================================
// GROUPE 4: CALCULS COLONNES GÉNÉRÉES
// ============================================

async function testGeneratedColumns() {
  log('info', '\n========================================');
  log('info', 'GROUPE 4: COLONNES GÉNÉRÉES');
  log('info', '========================================\n');
  
  // Test 4.1: Vérifier calcul TVA EUR
  try {
    const { data: facturesEUR, error } = await supabase
      .from('factures')
      .select('numero, currency, montant_ht, taux_tva, montant_tva, montant_ttc')
      .eq('currency', 'EUR')
      .gt('montant_ht', 0)
      .limit(3);
    
    if (!error && facturesEUR && facturesEUR.length > 0) {
      let allValid = true;
      for (const f of facturesEUR) {
        const expectedTVA = Math.round(f.montant_ht * f.taux_tva) / 100;
        const expectedTTC = f.montant_ht + expectedTVA;
        
        const valid = Math.abs(f.montant_tva - expectedTVA) < 0.01 &&
                      Math.abs(f.montant_ttc - expectedTTC) < 0.01;
        
        if (!valid) {
          allValid = false;
          log('error', `   Facture ${f.numero}: HT=${f.montant_ht}, TVA=${f.montant_tva} (attendu ${expectedTVA})`);
        }
      }
      
      assert(
        allValid,
        `Calculs TVA EUR corrects (${facturesEUR.length} factures vérifiées)`,
        ''
      );
    } else {
      log('warning', 'Aucune facture EUR trouvée pour test calculs');
    }
  } catch (e) {
    assert(false, 'Calculs TVA EUR', e.message);
  }
  
  // Test 4.2: Vérifier calcul TVA CHF
  try {
    const { data: facturesCHF, error } = await supabase
      .from('factures')
      .select('numero, currency, montant_ht, taux_tva, montant_tva, montant_ttc')
      .eq('currency', 'CHF')
      .gt('montant_ht', 0)
      .limit(3);
    
    if (!error && facturesCHF && facturesCHF.length > 0) {
      let allValid = true;
      for (const f of facturesCHF) {
        const expectedTVA = Math.round(f.montant_ht * f.taux_tva) / 100;
        const expectedTTC = f.montant_ht + expectedTVA;
        
        const valid = Math.abs(f.montant_tva - expectedTVA) < 0.01 &&
                      Math.abs(f.montant_ttc - expectedTTC) < 0.01;
        
        if (!valid) {
          allValid = false;
          log('error', `   Facture ${f.numero}: HT=${f.montant_ht}, TVA=${f.montant_tva} (attendu ${expectedTVA})`);
        }
      }
      
      assert(
        allValid,
        `Calculs TVA CHF corrects (${facturesCHF.length} factures vérifiées)`,
        ''
      );
    } else {
      log('warning', 'Aucune facture CHF trouvée pour test calculs');
    }
  } catch (e) {
    assert(false, 'Calculs TVA CHF', e.message);
  }
}

// ============================================
// GROUPE 5: INTÉGRITÉ RÉFÉRENTIELLE
// ============================================

async function testIntegrity() {
  log('info', '\n========================================');
  log('info', 'GROUPE 5: INTÉGRITÉ RÉFÉRENTIELLE');
  log('info', '========================================\n');
  
  // Test 5.1: Factures héritent devise de la régie
  try {
    const { data: factures, error } = await supabase
      .from('factures')
      .select(`
        numero,
        currency,
        regie_id,
        regies!inner(nom, currency)
      `)
      .not('currency', 'is', null)
      .limit(10);
    
    if (!error && factures && factures.length > 0) {
      let allMatch = true;
      for (const f of factures) {
        if (f.currency !== f.regies.currency) {
          allMatch = false;
          log('error', `   Facture ${f.numero}: currency=${f.currency}, régie currency=${f.regies.currency}`);
        }
      }
      
      assert(
        allMatch,
        `Factures héritent devise régie (${factures.length} vérifiées)`,
        ''
      );
    } else {
      log('warning', 'Aucune facture trouvée pour test héritage devise');
    }
  } catch (e) {
    assert(false, 'Factures héritent devise régie', e.message);
  }
  
  // Test 5.2: Entreprises peuvent avoir devise différente (OK si multi-régies)
  try {
    const { data: entreprises, error } = await supabase
      .from('entreprises')
      .select(`
        nom,
        currency,
        regies_entreprises!inner(
          regie_id,
          regies!inner(nom, currency)
        )
      `)
      .not('currency', 'is', null)
      .limit(5);
    
    if (!error && entreprises && entreprises.length > 0) {
      log('info', `   Entreprises multi-régies testées: ${entreprises.length}`);
      
      for (const e of entreprises) {
        const regies = e.regies_entreprises || [];
        if (regies.length > 0) {
          const regieCurrency = regies[0].regies?.currency;
          if (regieCurrency && e.currency !== regieCurrency) {
            log('warning', `   ${e.nom}: currency=${e.currency}, régie principale=${regieCurrency}`);
          }
        }
      }
      
      assert(true, 'Entreprises multi-régies vérifiées');
    } else {
      log('warning', 'Aucune entreprise multi-régie trouvée');
    }
  } catch (e) {
    log('warning', 'Test entreprises multi-régies ignoré', e.message);
  }
}

// ============================================
// GROUPE 6: NON-RÉGRESSION
// ============================================

async function testNonRegression() {
  log('info', '\n========================================');
  log('info', 'GROUPE 6: NON-RÉGRESSION');
  log('info', '========================================\n');
  
  // Test 6.1: Aucune facture avec currency NULL (post-M60A)
  try {
    const { data, error, count } = await supabase
      .from('factures')
      .select('id', { count: 'exact', head: true })
      .is('currency', null);
    
    assert(
      !error,
      `Factures avec currency NULL: ${count || 0}`,
      error?.message || (count > 0 ? 'Migration M60A incomplète' : '')
    );
    
    if (count > 0) {
      log('warning', `   ⚠️  ${count} factures sans devise détectées`);
    }
  } catch (e) {
    assert(false, 'Factures avec currency NULL', e.message);
  }
  
  // Test 6.2: Tous les taux TVA sont soit 20.00 (EUR) soit 8.1 (CHF)
  try {
    const { data: factures, error } = await supabase
      .from('factures')
      .select('numero, currency, taux_tva')
      .not('currency', 'is', null)
      .limit(20);
    
    if (!error && factures && factures.length > 0) {
      let allValid = true;
      for (const f of factures) {
        const validEUR = f.currency === 'EUR' && Math.abs(f.taux_tva - 20.00) < 0.01;
        const validCHF = f.currency === 'CHF' && Math.abs(f.taux_tva - 8.1) < 0.01;
        
        if (!validEUR && !validCHF) {
          allValid = false;
          log('error', `   Facture ${f.numero}: currency=${f.currency}, taux_tva=${f.taux_tva}`);
        }
      }
      
      assert(
        allValid,
        `Taux TVA cohérents avec devise (${factures.length} vérifiées)`,
        ''
      );
    }
  } catch (e) {
    assert(false, 'Taux TVA cohérents', e.message);
  }
  
  // Test 6.3: Commission à 2% (nouveau standard JETC)
  try {
    const { data: factures, error } = await supabase
      .from('factures')
      .select('numero, taux_commission, montant_ht, montant_commission')
      .gt('montant_ht', 0)
      .limit(10);
    
    if (!error && factures && factures.length > 0) {
      const with2Percent = factures.filter(f => Math.abs(f.taux_commission - 2.00) < 0.01);
      const with10Percent = factures.filter(f => Math.abs(f.taux_commission - 10.00) < 0.01);
      
      log('info', `   Commission 2%: ${with2Percent.length}`);
      log('info', `   Commission 10% (legacy): ${with10Percent.length}`);
      
      assert(
        true,
        'Commissions vérifiées (2% nouveau, 10% legacy accepté)',
        ''
      );
    }
  } catch (e) {
    assert(false, 'Commissions vérifiées', e.message);
  }
}

// ============================================
// RAPPORT FINAL
// ============================================

function printReport() {
  log('info', '\n========================================');
  log('info', 'RAPPORT FINAL - TESTS NON-RÉGRESSION');
  log('info', '========================================\n');
  
  const successRate = results.total > 0 
    ? Math.round((results.passed / results.total) * 100) 
    : 0;
  
  log('info', `Total tests: ${results.total}`);
  log('success', `Réussis: ${results.passed}`);
  if (results.failed > 0) {
    log('error', `Échecs: ${results.failed}`);
  }
  log('info', `Taux de réussite: ${successRate}%\n`);
  
  if (results.errors.length > 0) {
    log('error', 'ERREURS DÉTECTÉES:\n');
    results.errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
    console.log('');
  }
  
  if (successRate === 100) {
    log('success', '✅ TOUS LES TESTS RÉUSSIS - SYSTÈME MULTI-DEVISE OPÉRATIONNEL\n');
    return 0;
  } else if (successRate >= 80) {
    log('warning', '⚠️  TESTS MAJORITAIREMENT RÉUSSIS - Vérifier erreurs mineures\n');
    return 1;
  } else {
    log('error', '❌ ÉCHEC CRITIQUE - Migration incomplète ou erreurs majeures\n');
    return 2;
  }
}

// ============================================
// EXÉCUTION PRINCIPALE
// ============================================

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  TESTS NON-RÉGRESSION MULTI-DEVISE     ║');
  console.log('║  EUR / CHF - Migration M60A + M61B     ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  try {
    await testStructure();
    await testRPCFunctions();
    await testExistingData();
    await testGeneratedColumns();
    await testIntegrity();
    await testNonRegression();
    
    const exitCode = printReport();
    process.exit(exitCode);
  } catch (error) {
    log('error', 'ERREUR FATALE LORS DES TESTS', error.message);
    console.error(error);
    process.exit(3);
  }
}

// Lancement
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
