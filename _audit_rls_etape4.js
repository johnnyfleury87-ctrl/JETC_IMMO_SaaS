#!/usr/bin/env node
/**
 * AUDIT RLS (ROW LEVEL SECURITY) - ÉTAPE 4
 * Vérifie toutes les policies de sécurité par table et par rôle
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(70));
console.log('AUDIT RLS (ROW LEVEL SECURITY) - ÉTAPE 4');
console.log('='.repeat(70));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  tables: {},
  policies: [],
  missing_policies: [],
  security_issues: [],
  recommendations: []
};

// Tables critiques à vérifier
const CRITICAL_TABLES = [
  'missions',
  'tickets',
  'techniciens',
  'entreprises',
  'regies',
  'logements',
  'locataires',
  'immeubles',
  'factures',
  'factures_commissions_jetc'
];

// Requêtes pour obtenir les informations RLS
async function getPolicies() {
  console.log('📋 1. RÉCUPÉRATION DES POLICIES RLS');
  console.log('-'.repeat(70));
  
  // Requête PostgreSQL pour lister toutes les policies
  const query = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql_query', { 
      sql_query: query 
    }).catch(() => ({ data: null, error: { message: 'exec_sql_query not available' } }));
    
    if (error) {
      console.log('  ⚠️  Impossible de récupérer les policies via RPC');
      console.log('  → Utilisation de la méthode alternative...');
      
      // Méthode alternative : vérifier table par table
      for (const table of CRITICAL_TABLES) {
        results.tables[table] = {
          name: table,
          rls_enabled: null,
          policies: [],
          note: 'Vérification manuelle nécessaire'
        };
      }
    } else {
      console.log(`  ✅ ${data?.length || 0} policies trouvées`);
      results.policies = data || [];
      
      // Organiser par table
      (data || []).forEach(policy => {
        if (!results.tables[policy.tablename]) {
          results.tables[policy.tablename] = {
            name: policy.tablename,
            rls_enabled: true,
            policies: []
          };
        }
        results.tables[policy.tablename].policies.push(policy);
      });
    }
  } catch (err) {
    console.log(`  ❌ Erreur : ${err.message}`);
  }
  
  console.log();
}

// Vérifier RLS activé sur chaque table
async function checkRLSEnabled() {
  console.log('🔒 2. VÉRIFICATION RLS ACTIVÉ');
  console.log('-'.repeat(70));
  
  for (const table of CRITICAL_TABLES) {
    // Test simple : essayer de sélectionner sans authentification
    const { data, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      if (error.message.includes('row-level security') || error.message.includes('policy')) {
        console.log(`  ✅ ${table.padEnd(30)} : RLS activé`);
        if (!results.tables[table]) results.tables[table] = { name: table, policies: [] };
        results.tables[table].rls_enabled = true;
      } else {
        console.log(`  ⚠️  ${table.padEnd(30)} : Erreur - ${error.message.substring(0, 40)}...`);
      }
    } else {
      console.log(`  ⚠️  ${table.padEnd(30)} : Accessible sans RLS ?`);
      if (!results.tables[table]) results.tables[table] = { name: table, policies: [] };
      results.tables[table].rls_enabled = false;
      results.security_issues.push({
        type: 'RLS_NOT_ENABLED',
        table: table,
        severity: 'CRITIQUE'
      });
    }
  }
  
  console.log();
}

// Vérifier policies spécifiques pour MISSIONS (table critique)
async function checkMissionsPolicies() {
  console.log('🎯 3. AUDIT POLICIES TABLE MISSIONS');
  console.log('-'.repeat(70));
  
  const expectedPolicies = {
    technicien: {
      SELECT: 'Technicien peut voir uniquement SES missions',
      UPDATE: 'Technicien peut modifier uniquement SES missions (notes, photos, statut)',
      INSERT: 'Technicien ne peut PAS créer de missions',
      DELETE: 'Technicien ne peut PAS supprimer de missions'
    },
    entreprise: {
      SELECT: 'Entreprise peut voir les missions de SES techniciens',
      UPDATE: 'Entreprise peut modifier les missions de son entreprise (assignation, etc.)',
      INSERT: 'Entreprise peut créer des missions',
      DELETE: 'Entreprise ne peut PAS supprimer (ou seulement les siennes non démarrées)'
    },
    regie: {
      SELECT: 'Régie peut voir les missions liées à SES biens',
      UPDATE: 'Régie peut valider/refuser des missions',
      INSERT: 'Régie ne crée pas directement de missions',
      DELETE: 'Régie ne peut PAS supprimer'
    },
    admin: {
      SELECT: 'Admin JETC peut tout voir',
      UPDATE: 'Admin JETC peut tout modifier',
      INSERT: 'Admin JETC peut tout créer',
      DELETE: 'Admin JETC peut tout supprimer'
    }
  };
  
  console.log('  Policies attendues :');
  Object.keys(expectedPolicies).forEach(role => {
    console.log(`\n  ${role.toUpperCase()} :`);
    Object.keys(expectedPolicies[role]).forEach(cmd => {
      console.log(`    ${cmd.padEnd(8)} : ${expectedPolicies[role][cmd]}`);
    });
  });
  
  console.log();
  
  const missionsPolicies = results.tables['missions']?.policies || [];
  console.log(`  Policies trouvées : ${missionsPolicies.length}`);
  
  missionsPolicies.forEach(p => {
    console.log(`    - ${p.policyname} (${p.cmd}) pour ${p.roles}`);
  });
  
  console.log();
}

// Vérifier policies pour TECHNICIENS
async function checkTechniciensPolicies() {
  console.log('👷 4. AUDIT POLICIES TABLE TECHNICIENS');
  console.log('-'.repeat(70));
  
  const techniciensPolicies = results.tables['techniciens']?.policies || [];
  console.log(`  Policies trouvées : ${techniciensPolicies.length}`);
  
  if (techniciensPolicies.length === 0) {
    console.log('  ⚠️  Aucune policy trouvée - vérification manuelle nécessaire');
    results.missing_policies.push({
      table: 'techniciens',
      severity: 'CRITIQUE',
      note: 'Pas de policies RLS détectées'
    });
  } else {
    techniciensPolicies.forEach(p => {
      console.log(`    - ${p.policyname} (${p.cmd}) pour ${p.roles}`);
    });
  }
  
  console.log();
}

// Recommandations de sécurité
function generateRecommendations() {
  console.log('💡 5. RECOMMANDATIONS DE SÉCURITÉ');
  console.log('-'.repeat(70));
  
  // Règle 1 : RLS activé partout
  const tablesWithoutRLS = Object.values(results.tables)
    .filter(t => t.rls_enabled === false)
    .map(t => t.name);
  
  if (tablesWithoutRLS.length > 0) {
    const rec = `Activer RLS sur : ${tablesWithoutRLS.join(', ')}`;
    console.log(`  ❌ ${rec}`);
    results.recommendations.push({
      priority: 'CRITIQUE',
      action: rec,
      sql: tablesWithoutRLS.map(t => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`).join('\n')
    });
  }
  
  // Règle 2 : Vérifier isolation technicien
  console.log('\n  Règles à vérifier manuellement :');
  console.log('    1. Technicien voit UNIQUEMENT ses missions (WHERE technicien_id = auth.uid())');
  console.log('    2. Entreprise voit missions de SES techniciens (JOIN via entreprise_id)');
  console.log('    3. Régie voit missions liées à SES biens (JOIN complexe)');
  console.log('    4. Admin JETC a accès complet (role = admin_jetc)');
  
  // Règle 3 : Aucune policy permissive non justifiée
  const permissivePolicies = results.policies.filter(p => p.permissive === 'PERMISSIVE');
  if (permissivePolicies.length > 0) {
    console.log(`\n  ⚠️  ${permissivePolicies.length} policies PERMISSIVE détectées`);
    console.log('      → Vérifier que chacune est justifiée');
  }
  
  console.log();
}

// Test d'isolation (simulation)
async function testIsolation() {
  console.log('🧪 6. TEST D\'ISOLATION (SIMULATION)');
  console.log('-'.repeat(70));
  
  console.log('  Test 1 : Un technicien ne doit voir que SES missions');
  console.log('    → Nécessite un test avec authentification réelle');
  console.log('    → À effectuer manuellement depuis le dashboard technicien');
  
  console.log('\n  Test 2 : Une entreprise ne doit voir que les missions de SES techniciens');
  console.log('    → Nécessite un test avec authentification réelle');
  console.log('    → À effectuer manuellement depuis le dashboard entreprise');
  
  console.log('\n  Test 3 : Une régie ne doit voir que les missions de SES biens');
  console.log('    → Nécessite un test avec authentification réelle');
  console.log('    → À effectuer manuellement depuis le dashboard régie');
  
  console.log();
}

// Résumé
function summary() {
  console.log('='.repeat(70));
  console.log('RÉSUMÉ');
  console.log('='.repeat(70));
  
  const totalTables = Object.keys(results.tables).length;
  const tablesWithRLS = Object.values(results.tables).filter(t => t.rls_enabled === true).length;
  const totalPolicies = results.policies.length;
  const criticalIssues = results.security_issues.filter(i => i.severity === 'CRITIQUE').length;
  
  console.log(`Tables auditées : ${totalTables}`);
  console.log(`Tables avec RLS activé : ${tablesWithRLS}`);
  console.log(`Policies totales : ${totalPolicies}`);
  console.log(`Problèmes critiques : ${criticalIssues}`);
  console.log(`Recommandations : ${results.recommendations.length}`);
  
  if (criticalIssues > 0) {
    console.log('\n🚨 PROBLÈMES CRITIQUES DÉTECTÉS :');
    results.security_issues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [${issue.severity}] ${issue.type} - ${issue.table || 'N/A'}`);
    });
  }
  
  if (results.recommendations.length > 0) {
    console.log('\n💡 ACTIONS RECOMMANDÉES :');
    results.recommendations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. [${rec.priority}] ${rec.action}`);
    });
  }
  
  console.log();
  
  // Sauvegarder
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '_AUDIT_RLS_ETAPE4_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
  console.log();
}

// Exécution
async function run() {
  try {
    await getPolicies();
    await checkRLSEnabled();
    await checkMissionsPolicies();
    await checkTechniciensPolicies();
    generateRecommendations();
    await testIsolation();
    summary();
    
    process.exit(results.security_issues.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();
