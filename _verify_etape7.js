#!/usr/bin/env node

const fs = require('fs');

console.log('============================================');
console.log('VÉRIFICATION ÉTAPE 7 - ADMIN JETC VIEW');
console.log('============================================\n');

const dashboardPath = './public/admin/dashboard.html';

if (!fs.existsSync(dashboardPath)) {
  console.error('❌ Fichier non trouvé:', dashboardPath);
  process.exit(1);
}

const content = fs.readFileSync(dashboardPath, 'utf-8');

const checks = [
  {
    name: '✅ Compteur Techniciens',
    test: () => content.includes('stat-techniciens') && content.includes('<h3>Techniciens</h3>')
  },
  {
    name: '✅ Compteur Propriétaires',
    test: () => content.includes('stat-proprietaires') && content.includes('<h3>Propriétaires</h3>')
  },
  {
    name: '✅ Fonction loadInterventionsByRegie()',
    test: () => content.includes('async function loadInterventionsByRegie()')
  },
  {
    name: '✅ Tableau interventions par régie',
    test: () => content.includes('table-interventions-regie') && content.includes('Total missions')
  },
  {
    name: '✅ Fonction loadFacturesMensuelles()',
    test: () => content.includes('async function loadFacturesMensuelles()')
  },
  {
    name: '✅ Tableau factures mensuelles',
    test: () => content.includes('table-factures-mensuelles') && content.includes('Commission 2%')
  },
  {
    name: '✅ Carte commission JETC',
    test: () => content.includes('commission-jetc-mois') && content.includes('Commission JETC')
  },
  {
    name: '✅ Appel loadInterventionsByRegie() dans init',
    test: () => content.includes('await loadInterventionsByRegie()')
  },
  {
    name: '✅ Appel loadFacturesMensuelles() dans init',
    test: () => content.includes('await loadFacturesMensuelles()')
  },
  {
    name: '✅ Chargement techniciens dans loadStats()',
    test: () => content.includes('from(\'techniciens\')') && content.includes('stat-techniciens-30j')
  },
  {
    name: '✅ Chargement propriétaires dans loadStats()',
    test: () => content.includes('eq(\'role\', \'proprietaire\')') && content.includes('stat-proprietaires-30j')
  }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  try {
    if (check.test()) {
      console.log(check.name);
      passed++;
    } else {
      console.log('❌', check.name.replace('✅ ', ''));
      failed++;
    }
  } catch (error) {
    console.log('❌', check.name.replace('✅ ', ''), '- Erreur:', error.message);
    failed++;
  }
});

console.log('\n============================================');
console.log(`RÉSULTAT: ${passed}/${checks.length} vérifications réussies`);
console.log('============================================\n');

if (failed > 0) {
  console.log('⚠️ ', failed, 'vérifications ont échoué\n');
  process.exit(1);
} else {
  console.log('✅ ÉTAPE 7 COMPLÈTE - Tous les contrôles passent !\n');
  console.log('📋 FONCTIONNALITÉS IMPLÉMENTÉES:');
  console.log('  - Compteurs temps réel (régies, immeubles, logements, locataires, tickets, entreprises, techniciens, propriétaires)');
  console.log('  - Section interventions par régie avec statuts');
  console.log('  - Section factures mensuelles avec commission 2% JETC');
  console.log('  - Carte de synthèse commission mensuelle');
  console.log('  - Workflow validation régies existant\n');
  process.exit(0);
}
