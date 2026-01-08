/**
 * CHECKLIST FINALE AVANT APPLICATION
 * Vérifier que tout est prêt
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 CHECKLIST FINALE - WORKFLOW FACTURATION\n');
console.log('='.repeat(60));

const checks = [];

// 1. Vérifier que les fichiers existent
console.log('\n1️⃣  FICHIERS REQUIS\n');

const fichiersRequis = [
  'supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql',
  'public/entreprise/dashboard.html',
  '_TEST_WORKFLOW_FACTURATION_COMPLET.js',
  '_GUIDE_TEST_WORKFLOW_FACTURATION.md',
  '_LIVRABLE_WORKFLOW_FACTURATION.md'
];

fichiersRequis.forEach(file => {
  const fullPath = path.join('/workspaces/JETC_IMMO_SaaS', file);
  const existe = fs.existsSync(fullPath);
  console.log(`${existe ? '✅' : '❌'} ${file}`);
  checks.push({ type: 'fichier', nom: file, ok: existe });
});

// 2. Vérifier que le fichier HTML a bien été modifié
console.log('\n2️⃣  MODIFICATIONS FRONTEND\n');

const htmlContent = fs.readFileSync('/workspaces/JETC_IMMO_SaaS/public/entreprise/dashboard.html', 'utf8');

const modificationsRequises = [
  { pattern: 'editerFacture', description: 'Fonction editerFacture()' },
  { pattern: 'envoyerFactureRegie', description: 'Fonction envoyerFactureRegie()' },
  { pattern: 'currentFactureIdForEdit', description: 'Variable currentFactureIdForEdit' },
  { pattern: 'btn btn-primary.*Éditer', description: 'Bouton Éditer' },
  { pattern: 'Envoyer à la régie', description: 'Bouton Envoyer' }
];

modificationsRequises.forEach(({ pattern, description }) => {
  const regex = new RegExp(pattern, 'i');
  const trouve = regex.test(htmlContent);
  console.log(`${trouve ? '✅' : '❌'} ${description}`);
  checks.push({ type: 'frontend', nom: description, ok: trouve });
});

// 3. Vérifier la migration SQL
console.log('\n3️⃣  MIGRATION SQL M54\n');

const sqlContent = fs.readFileSync('/workspaces/JETC_IMMO_SaaS/supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql', 'utf8');

const rpcRequises = [
  'CREATE OR REPLACE FUNCTION editer_facture',
  'CREATE OR REPLACE FUNCTION envoyer_facture',
  'CREATE OR REPLACE FUNCTION valider_paiement_facture',
  'CREATE OR REPLACE FUNCTION refuser_facture'
];

rpcRequises.forEach(rpc => {
  const trouve = sqlContent.includes(rpc);
  console.log(`${trouve ? '✅' : '❌'} ${rpc}`);
  checks.push({ type: 'sql', nom: rpc, ok: trouve });
});

// 4. Résumé
console.log('\n' + '='.repeat(60));
console.log('\n📊 RÉSUMÉ\n');

const totalChecks = checks.length;
const checksOK = checks.filter(c => c.ok).length;
const checksKO = checks.filter(c => !c.ok).length;

console.log(`✅ Vérifications réussies: ${checksOK}/${totalChecks}`);
console.log(`❌ Vérifications échouées: ${checksKO}/${totalChecks}`);

if (checksKO === 0) {
  console.log('\n🎉 TOUT EST PRÊT POUR L\'APPLICATION !\n');
  console.log('📋 PROCHAINES ÉTAPES:\n');
  console.log('1. Appliquer la migration M54 dans Supabase SQL Editor');
  console.log('   Fichier: supabase/migrations/20260108120000_m54_rpc_editer_envoyer_factures.sql');
  console.log('');
  console.log('2. Tester les RPC:');
  console.log('   node _TEST_WORKFLOW_FACTURATION_COMPLET.js');
  console.log('');
  console.log('3. Déployer le frontend:');
  console.log('   git add -A');
  console.log('   git commit -m "fix(facturation): Workflow édition/envoi complet"');
  console.log('   git push');
  console.log('');
  console.log('4. Suivre le guide de test:');
  console.log('   Voir: _GUIDE_TEST_WORKFLOW_FACTURATION.md');
  console.log('');
  console.log('5. Générer les preuves et captures d\'écran');
  console.log('');
  console.log('📖 Documentation complète: _LIVRABLE_WORKFLOW_FACTURATION.md');
} else {
  console.log('\n⚠️  DES ÉLÉMENTS SONT MANQUANTS\n');
  checks.filter(c => !c.ok).forEach(check => {
    console.log(`❌ ${check.type}: ${check.nom}`);
  });
  console.log('\nVérifier que tous les fichiers ont bien été créés/modifiés.');
}

console.log('\n' + '='.repeat(60));
