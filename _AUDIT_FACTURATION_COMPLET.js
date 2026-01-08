/**
 * AUDIT COMPLET WORKFLOW FACTURATION
 * 
 * Mission: Diagnostiquer pourquoi l'entreprise ne peut pas éditer les factures
 * Workflow attendu: Mission terminée → Facture brouillon → Entreprise édite → 
 * Entreprise envoie → Régie valide/refuse → Clos si payé
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const results = {
  timestamp: new Date().toISOString(),
  environment: supabaseUrl,
  audit: {},
  issues: [],
  recommendations: []
};

async function auditStructureFactures() {
  console.log('\n=== 1. STRUCTURE TABLE FACTURES ===');
  
  try {
    // Vérifier la structure de la table factures
    const { data: factures, error } = await supabase
      .from('factures')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur lecture factures:', error.message);
      results.issues.push({
        type: 'STRUCTURE',
        severity: 'CRITIQUE',
        message: `Table factures inaccessible: ${error.message}`
      });
      return;
    }
    
    if (factures && factures.length > 0) {
      console.log('✅ Table factures accessible');
      console.log('Colonnes détectées:', Object.keys(factures[0]));
      results.audit.structure = {
        accessible: true,
        columns: Object.keys(factures[0])
      };
    }
    
    // Compter les factures par statut
    const { data: stats, error: statsError } = await supabase
      .from('factures')
      .select('statut');
    
    if (!statsError && stats) {
      const statutCounts = stats.reduce((acc, f) => {
        acc[f.statut] = (acc[f.statut] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nRépartition par statut:', statutCounts);
      results.audit.factures_stats = statutCounts;
    }
    
  } catch (err) {
    console.error('❌ Erreur audit structure:', err.message);
    results.issues.push({
      type: 'STRUCTURE',
      severity: 'CRITIQUE',
      message: err.message
    });
  }
}

async function auditDonneesFacture() {
  console.log('\n=== 2. AUDIT DONNÉES FACTURES TERMINÉES ===');
  
  try {
    // Trouver des missions terminées avec factures
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select(`
        id,
        statut,
        entreprise_id,
        ticket_id,
        factures (
          id,
          numero,
          statut,
          montant_ht,
          montant_ttc,
          taux_tva,
          montant_tva,
          iban,
          notes,
          created_at,
          updated_at
        )
      `)
      .eq('statut', 'terminee')
      .limit(5);
    
    if (missionsError) {
      console.error('❌ Erreur lecture missions:', missionsError.message);
      results.issues.push({
        type: 'DATA',
        severity: 'HAUTE',
        message: `Impossible de lire les missions terminées: ${missionsError.message}`
      });
      return;
    }
    
    console.log(`Missions terminées trouvées: ${missions?.length || 0}`);
    
    if (missions && missions.length > 0) {
      missions.forEach((mission, idx) => {
        console.log(`\nMission ${idx + 1}:`, {
          id: mission.id,
          statut: mission.statut,
          entreprise_id: mission.entreprise_id,
          factures: mission.factures?.length || 0
        });
        
        if (mission.factures && mission.factures.length > 0) {
          mission.factures.forEach(facture => {
            console.log('  Facture:', {
              numero: facture.numero,
              statut: facture.statut,
              montant_ht: facture.montant_ht,
              montant_ttc: facture.montant_ttc,
              taux_tva: facture.taux_tva,
              iban: facture.iban ? '✅' : '❌',
              notes: facture.notes ? '✅' : '❌'
            });
            
            // Vérifier les champs manquants
            const champsManquants = [];
            if (!facture.iban) champsManquants.push('iban');
            if (!facture.notes) champsManquants.push('notes');
            if (!facture.montant_ttc || facture.montant_ttc === 0) champsManquants.push('montant_ttc');
            
            if (champsManquants.length > 0) {
              results.issues.push({
                type: 'DATA',
                severity: 'MOYENNE',
                message: `Facture ${facture.numero} - Champs manquants: ${champsManquants.join(', ')}`,
                facture_id: facture.id
              });
            }
          });
        } else {
          results.issues.push({
            type: 'DATA',
            severity: 'HAUTE',
            message: `Mission terminée ${mission.id} sans facture associée`
          });
        }
      });
      
      results.audit.missions_terminees = missions;
    }
    
  } catch (err) {
    console.error('❌ Erreur audit données:', err.message);
    results.issues.push({
      type: 'DATA',
      severity: 'CRITIQUE',
      message: err.message
    });
  }
}

async function auditRLSPolicies() {
  console.log('\n=== 3. AUDIT RLS POLICIES FACTURES ===');
  
  try {
    // Vérifier les policies sur la table factures
    const { data: policies, error } = await supabase
      .rpc('exec_sql', {
        sql: `
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
          WHERE tablename = 'factures'
          ORDER BY policyname;
        `
      });
    
    if (error) {
      console.log('⚠️  Impossible de lire les policies (méthode RPC non disponible)');
      
      // Tentative alternative via requête directe
      const { data: altPolicies, error: altError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'factures');
      
      if (altError) {
        console.log('⚠️  Méthode alternative échouée aussi');
        results.issues.push({
          type: 'RLS',
          severity: 'HAUTE',
          message: 'Impossible de vérifier les RLS policies - vérification manuelle requise'
        });
      } else if (altPolicies) {
        console.log(`Policies trouvées: ${altPolicies.length}`);
        results.audit.rls_policies = altPolicies;
      }
    } else if (policies) {
      console.log(`✅ ${policies.length} policies trouvées sur factures`);
      
      policies.forEach(policy => {
        console.log(`\nPolicy: ${policy.policyname}`);
        console.log(`  Command: ${policy.cmd}`);
        console.log(`  Roles: ${policy.roles}`);
      });
      
      results.audit.rls_policies = policies;
      
      // Vérifier les policies critiques attendues
      const hasEntrepriseSelect = policies.some(p => 
        p.policyname.toLowerCase().includes('entreprise') && p.cmd === 'SELECT'
      );
      const hasEntrepriseUpdate = policies.some(p => 
        p.policyname.toLowerCase().includes('entreprise') && p.cmd === 'UPDATE'
      );
      const hasRegieSelect = policies.some(p => 
        p.policyname.toLowerCase().includes('regie') && p.cmd === 'SELECT'
      );
      
      if (!hasEntrepriseSelect) {
        results.issues.push({
          type: 'RLS',
          severity: 'CRITIQUE',
          message: 'Pas de policy SELECT pour les entreprises sur les factures'
        });
      }
      
      if (!hasEntrepriseUpdate) {
        results.issues.push({
          type: 'RLS',
          severity: 'CRITIQUE',
          message: 'Pas de policy UPDATE pour les entreprises sur les factures'
        });
      }
      
      if (!hasRegieSelect) {
        results.issues.push({
          type: 'RLS',
          severity: 'HAUTE',
          message: 'Pas de policy SELECT pour la régie sur les factures'
        });
      }
    }
    
  } catch (err) {
    console.error('❌ Erreur audit RLS:', err.message);
    results.issues.push({
      type: 'RLS',
      severity: 'CRITIQUE',
      message: `Erreur audit RLS: ${err.message}`
    });
  }
}

async function auditRPCFacturation() {
  console.log('\n=== 4. AUDIT RPC/FUNCTIONS FACTURATION ===');
  
  try {
    // Lister les fonctions RPC liées à la facturation
    const { data: functions, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            routine_name,
            routine_type,
            data_type as return_type
          FROM information_schema.routines
          WHERE routine_schema = 'public'
          AND routine_name LIKE '%factur%'
          ORDER BY routine_name;
        `
      });
    
    if (error) {
      console.log('⚠️  Impossible de lire les RPC (méthode non disponible)');
      
      // Vérifier manuellement les RPC connues
      const knownRPCs = [
        'editer_facture',
        'envoyer_facture',
        'valider_paiement_facture',
        'refuser_facture'
      ];
      
      console.log('\nTest des RPC connues...');
      for (const rpcName of knownRPCs) {
        try {
          // Tenter un appel pour voir si la fonction existe
          const { error: testError } = await supabase.rpc(rpcName, {});
          if (testError) {
            if (testError.message.includes('function') && testError.message.includes('does not exist')) {
              console.log(`❌ RPC ${rpcName}: n'existe pas`);
              results.issues.push({
                type: 'RPC',
                severity: 'HAUTE',
                message: `Fonction RPC ${rpcName} manquante`
              });
            } else {
              console.log(`✅ RPC ${rpcName}: existe (erreur params attendue)`);
            }
          }
        } catch (err) {
          console.log(`⚠️  RPC ${rpcName}: test échoué`);
        }
      }
      
    } else if (functions) {
      console.log(`✅ ${functions.length} fonctions de facturation trouvées`);
      
      functions.forEach(func => {
        console.log(`  - ${func.routine_name} (${func.routine_type})`);
      });
      
      results.audit.rpc_functions = functions;
    }
    
  } catch (err) {
    console.error('❌ Erreur audit RPC:', err.message);
    results.issues.push({
      type: 'RPC',
      severity: 'HAUTE',
      message: `Erreur audit RPC: ${err.message}`
    });
  }
}

async function auditCodeUI() {
  console.log('\n=== 5. AUDIT CODE UI FACTURATION ===');
  
  const filesToCheck = [
    'app/entreprise/factures/page.tsx',
    'app/entreprise/factures/[id]/edit/page.tsx',
    'components/factures/',
    'app/api/factures/',
  ];
  
  const uiIssues = [];
  
  // On va juste noter les fichiers à vérifier manuellement
  console.log('Fichiers UI à vérifier:');
  filesToCheck.forEach(file => {
    console.log(`  - ${file}`);
  });
  
  results.audit.ui_files_to_check = filesToCheck;
}

async function genererRecommandations() {
  console.log('\n=== 6. RECOMMANDATIONS ===');
  
  // Analyser les issues et générer des recommandations
  const critiques = results.issues.filter(i => i.severity === 'CRITIQUE');
  const hautes = results.issues.filter(i => i.severity === 'HAUTE');
  const moyennes = results.issues.filter(i => i.severity === 'MOYENNE');
  
  console.log(`\n📊 BILAN:`);
  console.log(`  - Issues critiques: ${critiques.length}`);
  console.log(`  - Issues hautes: ${hautes.length}`);
  console.log(`  - Issues moyennes: ${moyennes.length}`);
  
  if (critiques.length > 0) {
    console.log('\n🚨 ISSUES CRITIQUES:');
    critiques.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [${issue.type}] ${issue.message}`);
    });
  }
  
  // Recommandations basées sur les issues trouvées
  if (results.issues.some(i => i.type === 'RLS' && i.message.includes('UPDATE'))) {
    results.recommendations.push({
      priority: 1,
      action: 'Créer/corriger les RLS policies pour permettre UPDATE des factures par les entreprises',
      details: 'Policy: entreprise peut UPDATE facture WHERE statut IN (brouillon, a_editer) AND entreprise_id = auth.uid()'
    });
  }
  
  if (results.issues.some(i => i.type === 'RPC')) {
    results.recommendations.push({
      priority: 2,
      action: 'Créer les RPC functions manquantes pour le workflow de facturation',
      details: 'Functions nécessaires: editer_facture, envoyer_facture, valider_paiement_facture, refuser_facture'
    });
  }
  
  if (results.issues.some(i => i.type === 'DATA' && i.message.includes('Champs manquants'))) {
    results.recommendations.push({
      priority: 3,
      action: 'Compléter les données manquantes sur les factures existantes',
      details: 'Ajouter les valeurs par défaut pour iban, adresse_facturation, etc.'
    });
  }
  
  console.log('\n✅ RECOMMANDATIONS:');
  results.recommendations.forEach((rec, idx) => {
    console.log(`\n${idx + 1}. [P${rec.priority}] ${rec.action}`);
    console.log(`   → ${rec.details}`);
  });
}

async function main() {
  console.log('🔍 AUDIT COMPLET WORKFLOW FACTURATION');
  console.log('=====================================');
  
  await auditStructureFactures();
  await auditDonneesFacture();
  await auditRLSPolicies();
  await auditRPCFacturation();
  await auditCodeUI();
  await genererRecommandations();
  
  // Sauvegarder les résultats
  const outputFile = '_AUDIT_FACTURATION_COMPLET_RESULTS.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Résultats sauvegardés: ${outputFile}`);
  console.log('\n=== FIN AUDIT ===');
}

main().catch(console.error);
