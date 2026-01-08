/**
 * AUDIT DÉTAILLÉ FACTURATION
 * Sans utiliser exec_sql
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const report = {
  timestamp: new Date().toISOString(),
  diagnostics: [],
  fixes_needed: []
};

async function auditFactures() {
  console.log('\n=== 1. FACTURES EXISTANTES ===');
  
  const { data: factures, error } = await supabase
    .from('factures')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    report.diagnostics.push({ section: 'factures', error: error.message });
    return;
  }
  
  console.log(`Nombre total: ${factures.length}`);
  factures.forEach(f => {
    console.log(`\n  Facture ${f.numero}:`);
    console.log(`    ID: ${f.id}`);
    console.log(`    Mission: ${f.mission_id || 'NULL'}`);
    console.log(`    Entreprise: ${f.entreprise_id}`);
    console.log(`    Statut: ${f.statut}`);
    console.log(`    Montant TTC: ${f.montant_ttc || 'NULL'}`);
    console.log(`    IBAN: ${f.iban || 'NULL'}`);
    console.log(`    Créée: ${f.created_at}`);
    
    // Vérifier les problèmes
    if (!f.mission_id) {
      report.diagnostics.push({
        type: 'DATA_INTEGRITY',
        severity: 'HIGH',
        message: `Facture ${f.numero} sans mission_id`,
        facture_id: f.id
      });
    }
    
    if (!f.montant_ttc || f.montant_ttc === 0) {
      report.diagnostics.push({
        type: 'DATA_MISSING',
        severity: 'MEDIUM',
        message: `Facture ${f.numero} sans montant`,
        facture_id: f.id
      });
    }
  });
  
  report.factures = factures;
}

async function auditMissionsTerminees() {
  console.log('\n\n=== 2. MISSIONS TERMINÉES ===');
  
  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('statut', 'terminee')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    report.diagnostics.push({ section: 'missions', error: error.message });
    return;
  }
  
  console.log(`Nombre total: ${missions.length}`);
  
  for (const mission of missions) {
    console.log(`\n  Mission ${mission.id.substring(0, 8)}...`);
    console.log(`    Entreprise: ${mission.entreprise_id}`);
    console.log(`    Ticket: ${mission.ticket_id || 'NULL'}`);
    console.log(`    Statut: ${mission.statut}`);
    console.log(`    Créée: ${mission.created_at}`);
    
    // Chercher la facture associée
    const { data: factures, error: fError } = await supabase
      .from('factures')
      .select('*')
      .eq('mission_id', mission.id);
    
    if (fError) {
      console.error('    ❌ Erreur recherche facture:', fError.message);
    } else if (!factures || factures.length === 0) {
      console.log('    ⚠️  AUCUNE FACTURE ASSOCIÉE');
      report.diagnostics.push({
        type: 'MISSING_FACTURE',
        severity: 'CRITICAL',
        message: `Mission terminée ${mission.id} sans facture`,
        mission_id: mission.id,
        entreprise_id: mission.entreprise_id
      });
      
      report.fixes_needed.push({
        type: 'CREATE_FACTURE',
        mission_id: mission.id,
        entreprise_id: mission.entreprise_id,
        action: 'Créer une facture pour cette mission terminée'
      });
    } else {
      console.log(`    ✅ ${factures.length} facture(s) trouvée(s): ${factures.map(f => f.numero).join(', ')}`);
    }
  }
  
  report.missions = missions;
}

async function testRLSEntreprise() {
  console.log('\n\n=== 3. TEST RLS ENTREPRISE ===');
  
  // Prendre une entreprise qui a des factures
  const { data: factures } = await supabase
    .from('factures')
    .select('entreprise_id')
    .limit(1);
  
  if (!factures || factures.length === 0) {
    console.log('Pas de factures pour tester');
    return;
  }
  
  const entrepriseId = factures[0].entreprise_id;
  console.log(`Test avec entreprise: ${entrepriseId}`);
  
  // Créer un client avec un token simulé entreprise
  // On ne peut pas vraiment tester sans le vrai token, mais on peut vérifier les policies
  
  console.log('\n⚠️  Test RLS nécessite une connexion authentifiée côté entreprise');
  console.log('→ À tester manuellement via l\'interface web');
  
  report.diagnostics.push({
    type: 'RLS_TEST',
    severity: 'HIGH',
    message: 'Impossible de tester RLS automatiquement - test manuel requis',
    test_needed: 'Connexion entreprise → lecture/édition facture brouillon'
  });
}

async function checkRPCFunctions() {
  console.log('\n\n=== 4. VÉRIFICATION RPC ===');
  
  const rpcTests = [
    { name: 'editer_facture', params: { facture_id: '00000000-0000-0000-0000-000000000000', updates: {} } },
    { name: 'envoyer_facture', params: { facture_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'valider_paiement_facture', params: { facture_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'refuser_facture', params: { facture_id: '00000000-0000-0000-0000-000000000000', raison: 'test' } }
  ];
  
  for (const test of rpcTests) {
    console.log(`\n  Test RPC: ${test.name}`);
    const { error } = await supabase.rpc(test.name, test.params);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(`    ❌ N'existe pas`);
        report.diagnostics.push({
          type: 'RPC_MISSING',
          severity: 'CRITICAL',
          message: `RPC ${test.name} n'existe pas`,
          rpc_name: test.name
        });
      } else {
        console.log(`    ✅ Existe (erreur params: ${error.message.substring(0, 50)}...)`);
      }
    } else {
      console.log(`    ✅ Existe et fonctionne`);
    }
  }
}

async function analyzeUIFiles() {
  console.log('\n\n=== 5. ANALYSE FICHIERS UI ===');
  
  const filesToCheck = [
    'app/entreprise/factures/page.tsx',
    'app/entreprise/factures/[id]/page.tsx',
    'components/factures/FactureForm.tsx',
    'components/factures/FactureDetail.tsx'
  ];
  
  for (const file of filesToCheck) {
    try {
      const fullPath = `/workspaces/JETC_IMMO_SaaS/${file}`;
      const exists = require('fs').existsSync(fullPath);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
      
      if (!exists) {
        report.diagnostics.push({
          type: 'UI_MISSING',
          severity: 'HIGH',
          message: `Fichier UI manquant: ${file}`,
          file
        });
      }
    } catch (err) {
      console.log(`  ⚠️  ${file}: ${err.message}`);
    }
  }
}

async function genererRapport() {
  console.log('\n\n=== RAPPORT FINAL ===\n');
  
  const critical = report.diagnostics.filter(d => d.severity === 'CRITICAL');
  const high = report.diagnostics.filter(d => d.severity === 'HIGH');
  const medium = report.diagnostics.filter(d => d.severity === 'MEDIUM');
  
  console.log(`🔴 Problèmes critiques: ${critical.length}`);
  critical.forEach(d => {
    console.log(`   - ${d.message}`);
  });
  
  console.log(`\n🟠 Problèmes importants: ${high.length}`);
  high.forEach(d => {
    console.log(`   - ${d.message}`);
  });
  
  console.log(`\n🟡 Problèmes moyens: ${medium.length}`);
  medium.forEach(d => {
    console.log(`   - ${d.message}`);
  });
  
  console.log(`\n\n✅ CORRECTIONS À APPLIQUER: ${report.fixes_needed.length}`);
  report.fixes_needed.forEach((fix, idx) => {
    console.log(`\n${idx + 1}. ${fix.action}`);
    console.log(`   Type: ${fix.type}`);
    if (fix.mission_id) console.log(`   Mission: ${fix.mission_id}`);
    if (fix.entreprise_id) console.log(`   Entreprise: ${fix.entreprise_id}`);
  });
  
  // Sauvegarder
  fs.writeFileSync('_RAPPORT_AUDIT_FACTURATION.json', JSON.stringify(report, null, 2));
  console.log('\n\n📄 Rapport complet: _RAPPORT_AUDIT_FACTURATION.json');
}

async function main() {
  console.log('🔍 AUDIT DÉTAILLÉ WORKFLOW FACTURATION');
  console.log('======================================');
  
  await auditFactures();
  await auditMissionsTerminees();
  await testRLSEntreprise();
  await checkRPCFunctions();
  await analyzeUIFiles();
  await genererRapport();
}

main().catch(console.error);
