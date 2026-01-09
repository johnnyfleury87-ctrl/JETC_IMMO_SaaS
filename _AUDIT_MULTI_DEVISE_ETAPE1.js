/**
 * AUDIT MULTI-DEVISE - ÉTAPE 1
 * Analyse complète de la structure actuelle pour la gestion EUR/CHF
 * Date: 2026-01-09
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditMultiDevise() {
  console.log('🔍 AUDIT MULTI-DEVISE - ÉTAPE 1\n');
  
  const rapport = {
    date: new Date().toISOString(),
    tables: {},
    analyse: {
      champsCurrency: [],
      champsMonetaires: [],
      recommendations: []
    }
  };

  // ========================================
  // 1. ANALYSE TABLE REGIES
  // ========================================
  console.log('📊 1. Analyse table REGIES...');
  const { data: regies, error: regiesError } = await supabase
    .from('regies')
    .select('*')
    .limit(5);

  if (regiesError) {
    console.error('❌ Erreur regies:', regiesError);
  } else {
    rapport.tables.regies = {
      count: regies.length,
      colonnes: regies.length > 0 ? Object.keys(regies[0]) : [],
      sample: regies[0] || null,
      champsMonetaires: []
    };
    
    // Chercher les champs liés à la devise/montants
    const colonnes = rapport.tables.regies.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('prix') || c.includes('montant') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva')
    );
    
    rapport.tables.regies.champsDevise = champsDevise;
    rapport.tables.regies.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${regies.length} régies trouvées`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 2. ANALYSE TABLE ENTREPRISES
  // ========================================
  console.log('\n📊 2. Analyse table ENTREPRISES...');
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('*')
    .limit(5);

  if (entreprisesError) {
    console.error('❌ Erreur entreprises:', entreprisesError);
  } else {
    rapport.tables.entreprises = {
      count: entreprises.length,
      colonnes: entreprises.length > 0 ? Object.keys(entreprises[0]) : [],
      sample: entreprises[0] || null
    };
    
    const colonnes = rapport.tables.entreprises.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('prix') || c.includes('montant') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva')
    );
    
    rapport.tables.entreprises.champsDevise = champsDevise;
    rapport.tables.entreprises.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${entreprises.length} entreprises trouvées`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 3. ANALYSE TABLE LOCATAIRES
  // ========================================
  console.log('\n📊 3. Analyse table LOCATAIRES...');
  const { data: locataires, error: locatairesError } = await supabase
    .from('locataires')
    .select('*')
    .limit(5);

  if (locatairesError) {
    console.error('❌ Erreur locataires:', locatairesError);
  } else {
    rapport.tables.locataires = {
      count: locataires.length,
      colonnes: locataires.length > 0 ? Object.keys(locataires[0]) : [],
      sample: locataires[0] || null
    };
    
    const colonnes = rapport.tables.locataires.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('prix') || c.includes('montant') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva')
    );
    
    rapport.tables.locataires.champsDevise = champsDevise;
    rapport.tables.locataires.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${locataires.length} locataires trouvés`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 4. ANALYSE TABLE TICKETS
  // ========================================
  console.log('\n📊 4. Analyse table TICKETS...');
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .limit(5);

  if (ticketsError) {
    console.error('❌ Erreur tickets:', ticketsError);
  } else {
    rapport.tables.tickets = {
      count: tickets.length,
      colonnes: tickets.length > 0 ? Object.keys(tickets[0]) : [],
      sample: tickets[0] || null
    };
    
    const colonnes = rapport.tables.tickets.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('prix') || c.includes('montant') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva') || c.includes('cout')
    );
    
    rapport.tables.tickets.champsDevise = champsDevise;
    rapport.tables.tickets.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${tickets.length} tickets trouvés`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 5. ANALYSE TABLE MISSIONS
  // ========================================
  console.log('\n📊 5. Analyse table MISSIONS...');
  const { data: missions, error: missionsError } = await supabase
    .from('missions')
    .select('*')
    .limit(5);

  if (missionsError) {
    console.error('❌ Erreur missions:', missionsError);
  } else {
    rapport.tables.missions = {
      count: missions.length,
      colonnes: missions.length > 0 ? Object.keys(missions[0]) : [],
      sample: missions[0] || null
    };
    
    const colonnes = rapport.tables.missions.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('prix') || c.includes('montant') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva') || c.includes('cout')
    );
    
    rapport.tables.missions.champsDevise = champsDevise;
    rapport.tables.missions.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${missions.length} missions trouvées`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 6. ANALYSE TABLE FACTURES
  // ========================================
  console.log('\n📊 6. Analyse table FACTURES...');
  const { data: factures, error: facturesError } = await supabase
    .from('factures')
    .select('*')
    .limit(5);

  if (facturesError) {
    console.error('❌ Erreur factures:', facturesError);
  } else {
    rapport.tables.factures = {
      count: factures.length,
      colonnes: factures.length > 0 ? Object.keys(factures[0]) : [],
      sample: factures[0] || null
    };
    
    const colonnes = rapport.tables.factures.colonnes;
    const champsDevise = colonnes.filter(c => 
      c.includes('currency') || c.includes('devise') || c.includes('monnaie')
    );
    const champsMontant = colonnes.filter(c => 
      c.includes('montant') || c.includes('total') || c.includes('price') || 
      c.includes('tarif') || c.includes('tva') || c.includes('ht') || c.includes('ttc')
    );
    
    rapport.tables.factures.champsDevise = champsDevise;
    rapport.tables.factures.champsMonetaires = champsMontant;
    
    console.log(`   ✓ ${factures.length} factures trouvées`);
    console.log(`   → Champs devise: ${champsDevise.length > 0 ? champsDevise.join(', ') : 'AUCUN'}`);
    console.log(`   → Champs monétaires: ${champsMontant.length > 0 ? champsMontant.join(', ') : 'AUCUN'}`);
  }

  // ========================================
  // 7. ANALYSE DES RELATIONS
  // ========================================
  console.log('\n📊 7. Analyse des relations hiérarchiques...');
  
  // Vérifier si les tables ont des FK vers regies
  rapport.relations = {
    entreprises_to_regies: rapport.tables.entreprises?.colonnes.includes('regie_id'),
    locataires_to_regies: rapport.tables.locataires?.colonnes.includes('regie_id'),
    locataires_to_entreprises: rapport.tables.locataires?.colonnes.includes('entreprise_id'),
    tickets_to_locataires: rapport.tables.tickets?.colonnes.includes('locataire_id'),
    tickets_to_regies: rapport.tables.tickets?.colonnes.includes('regie_id'),
    missions_to_tickets: rapport.tables.missions?.colonnes.includes('ticket_id'),
    missions_to_entreprises: rapport.tables.missions?.colonnes.includes('entreprise_id'),
    factures_to_missions: rapport.tables.factures?.colonnes.includes('mission_id'),
    factures_to_entreprises: rapport.tables.factures?.colonnes.includes('entreprise_id'),
    factures_to_regies: rapport.tables.factures?.colonnes.includes('regie_id')
  };
  
  console.log('   Relations détectées:');
  Object.entries(rapport.relations).forEach(([key, value]) => {
    console.log(`   ${value ? '✓' : '✗'} ${key}`);
  });

  // ========================================
  // 8. SYNTHÈSE & RECOMMANDATIONS
  // ========================================
  console.log('\n\n📋 SYNTHÈSE DE L\'AUDIT\n');
  console.log('='.repeat(60));
  
  // Compter les champs currency existants
  let totalCurrencyFields = 0;
  let totalMonetaryFields = 0;
  
  Object.entries(rapport.tables).forEach(([table, data]) => {
    if (data.champsDevise) {
      totalCurrencyFields += data.champsDevise.length;
      if (data.champsDevise.length > 0) {
        console.log(`\n✓ ${table.toUpperCase()} a des champs devise: ${data.champsDevise.join(', ')}`);
      }
    }
    if (data.champsMonetaires) {
      totalMonetaryFields += data.champsMonetaires.length;
      if (data.champsMonetaires.length > 0) {
        console.log(`  ${table.toUpperCase()} a ${data.champsMonetaires.length} champs monétaires: ${data.champsMonetaires.join(', ')}`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 TOTAL: ${totalCurrencyFields} champs devise, ${totalMonetaryFields} champs monétaires`);
  
  // Recommandations
  rapport.analyse.recommendations.push({
    niveau: 'CRITIQUE',
    message: totalCurrencyFields === 0 ? 
      '❌ AUCUN champ currency détecté - Implémentation complète nécessaire' :
      `✓ ${totalCurrencyFields} champs currency détectés - Vérifier cohérence`
  });
  
  if (totalMonetaryFields > 0) {
    rapport.analyse.recommendations.push({
      niveau: 'IMPORTANT',
      message: `${totalMonetaryFields} champs monétaires trouvés - Tous doivent être associés à une devise`
    });
  }
  
  // Vérifier la hiérarchie
  if (!rapport.relations.entreprises_to_regies) {
    rapport.analyse.recommendations.push({
      niveau: 'BLOQUANT',
      message: '❌ Relation entreprises → regies manquante'
    });
  }
  
  console.log('\n\n🎯 RECOMMANDATIONS:\n');
  rapport.analyse.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. [${rec.niveau}] ${rec.message}`);
  });
  
  // Sauvegarder le rapport
  const filename = '_AUDIT_MULTI_DEVISE_ETAPE1_RESULTS.json';
  fs.writeFileSync(filename, JSON.stringify(rapport, null, 2));
  console.log(`\n✅ Rapport sauvegardé: ${filename}`);
  
  return rapport;
}

// Exécution
auditMultiDevise()
  .then(() => {
    console.log('\n✅ Audit terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur lors de l\'audit:', error);
    process.exit(1);
  });
