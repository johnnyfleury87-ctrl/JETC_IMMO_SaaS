// =====================================================
// AUDIT DB STATE - Mission Copilot Vues/Logins
// =====================================================
// Objectif : Vérifier structure DB réelle vs repo
// Date : 2025-01-06

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// AUDIT TABLES
// =====================================================

async function auditTable(tableName, expectedColumns = []) {
  console.log(`\n📋 Table: ${tableName}`);
  console.log('='.repeat(60));

  try {
    // Test lecture
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Erreur lecture: ${error.message}`);
      return { exists: false, error: error.message };
    }

    console.log(`✅ Table accessible`);

    // Structure
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`📌 Colonnes trouvées (${columns.length}):`, columns.join(', '));
      
      if (expectedColumns.length > 0) {
        const missing = expectedColumns.filter(col => !columns.includes(col));
        const extra = columns.filter(col => !expectedColumns.includes(col));
        
        if (missing.length > 0) {
          console.log(`⚠️  Colonnes manquantes:`, missing.join(', '));
        }
        if (extra.length > 0) {
          console.log(`ℹ️  Colonnes supplémentaires:`, extra.join(', '));
        }
      }
    } else {
      console.log(`📌 Table vide - structure non vérifiable par SELECT`);
    }

    // Count
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Nombre de lignes: ${count}`);
    }

    return { exists: true, accessible: true };

  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return { exists: false, error: err.message };
  }
}

// =====================================================
// AUDIT VUES
// =====================================================

async function auditView(viewName) {
  console.log(`\n👁️  Vue: ${viewName}`);
  console.log('='.repeat(60));

  try {
    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Vue non accessible: ${error.message}`);
      return { exists: false, error: error.message };
    }

    console.log(`✅ Vue accessible`);

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`📌 Colonnes (${columns.length}):`, columns.join(', '));
    } else {
      console.log(`📌 Vue vide`);
    }

    const { count, error: countError } = await supabase
      .from(viewName)
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Nombre de lignes: ${count}`);
    }

    return { exists: true, accessible: true };

  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return { exists: false, error: err.message };
  }
}

// =====================================================
// AUDIT RPC
// =====================================================

async function auditRPC(rpcName) {
  console.log(`\n⚙️  RPC: ${rpcName}`);
  console.log('='.repeat(60));

  try {
    // Test avec paramètres vides - juste pour voir si fonction existe
    const { data, error } = await supabase.rpc(rpcName, {});

    if (error) {
      // Erreur de paramètres = fonction existe
      if (error.message.includes('parameter') || error.message.includes('argument')) {
        console.log(`✅ Fonction existe (erreur paramètres attendue)`);
        return { exists: true, error: error.message };
      }
      console.log(`❌ Fonction inaccessible: ${error.message}`);
      return { exists: false, error: error.message };
    }

    console.log(`✅ Fonction accessible (retour OK avec params vides)`);
    return { exists: true, accessible: true };

  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return { exists: false, error: err.message };
  }
}

// =====================================================
// AUDIT POLICIES RLS
// =====================================================

async function auditPolicies(tableName) {
  console.log(`\n🔒 Policies RLS: ${tableName}`);
  console.log('='.repeat(60));

  try {
    // Query metadata via SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
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
        WHERE tablename = '${tableName}'
        ORDER BY policyname;
      `
    });

    if (error) {
      // RPC exec_sql peut ne pas exister - alternative
      console.log(`⚠️  Impossible de lire policies via RPC: ${error.message}`);
      console.log(`ℹ️  Vérification manuelle nécessaire via Dashboard Supabase`);
      return { exists: 'unknown', error: error.message };
    }

    if (!data || data.length === 0) {
      console.log(`⚠️  Aucune policy trouvée`);
      return { exists: false, count: 0 };
    }

    console.log(`✅ ${data.length} policies trouvées`);
    data.forEach(policy => {
      console.log(`  - ${policy.policyname} [${policy.cmd}] roles: ${policy.roles}`);
    });

    return { exists: true, count: data.length, policies: data };

  } catch (err) {
    console.log(`⚠️  Exception: ${err.message}`);
    return { exists: 'unknown', error: err.message };
  }
}

// =====================================================
// MAIN AUDIT
// =====================================================

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 AUDIT DB STATE - JETC IMMO SAAS');
  console.log('='.repeat(60));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔗 URL: ${supabaseUrl}`);
  console.log('='.repeat(60));

  const report = {
    date: new Date().toISOString(),
    url: supabaseUrl,
    tables: {},
    views: {},
    rpcs: {},
    policies: {}
  };

  // =====================================================
  // 1. AUDIT TABLES PRINCIPALES
  // =====================================================

  console.log('\n\n📚 SECTION 1: TABLES PRINCIPALES');
  console.log('='.repeat(60));

  // Tickets
  report.tables.tickets = await auditTable('tickets', [
    'id', 'titre', 'description', 'statut', 'priorite',
    'locataire_id', 'regie_id', 'entreprise_id', 'technicien_id',
    'locked_at', 'locked_by', 'mode_diffusion',
    'created_at', 'updated_at'
  ]);

  // Missions
  report.tables.missions = await auditTable('missions', [
    'id', 'ticket_id', 'entreprise_id', 'technicien_id',
    'statut', 'montant_ht', 'montant_tva', 'montant_ttc',
    'started_at', 'completed_at', 'validated_at',
    'created_at', 'updated_at'
  ]);

  // Factures
  report.tables.factures = await auditTable('factures', [
    'id', 'mission_id', 'numero_facture', 'statut',
    'montant_ht', 'montant_tva', 'montant_ttc', 'montant_commission',
    'date_emission', 'date_echeance', 'date_paiement',
    'regie_id', 'entreprise_id', 'created_at', 'updated_at'
  ]);

  // Profiles
  report.tables.profiles = await auditTable('profiles', [
    'id', 'email', 'nom', 'prenom', 'role',
    'locataire_id', 'regie_id', 'entreprise_id',
    'created_at', 'updated_at'
  ]);

  // =====================================================
  // 2. AUDIT VUES
  // =====================================================

  console.log('\n\n👁️  SECTION 2: VUES');
  console.log('='.repeat(60));

  report.views.tickets_visibles_entreprise = await auditView('tickets_visibles_entreprise');
  report.views.missions_details = await auditView('missions_details');
  report.views.admin_factures_mensuelles_regies = await auditView('admin_factures_mensuelles_regies');

  // =====================================================
  // 3. AUDIT RPC
  // =====================================================

  console.log('\n\n⚙️  SECTION 3: RPC FUNCTIONS');
  console.log('='.repeat(60));

  report.rpcs.accept_ticket_and_create_mission = await auditRPC('accept_ticket_and_create_mission');
  report.rpcs.assign_technicien_to_mission = await auditRPC('assign_technicien_to_mission');
  report.rpcs.start_mission = await auditRPC('start_mission');
  report.rpcs.complete_mission = await auditRPC('complete_mission');
  report.rpcs.validate_mission = await auditRPC('validate_mission');

  // =====================================================
  // 4. AUDIT POLICIES (si possible)
  // =====================================================

  console.log('\n\n🔒 SECTION 4: POLICIES RLS');
  console.log('='.repeat(60));

  report.policies.tickets = await auditPolicies('tickets');
  report.policies.missions = await auditPolicies('missions');

  // =====================================================
  // RÉSUMÉ
  // =====================================================

  console.log('\n\n📊 RÉSUMÉ AUDIT');
  console.log('='.repeat(60));

  const tablesOK = Object.values(report.tables).filter(t => t.exists).length;
  const viewsOK = Object.values(report.views).filter(v => v.exists).length;
  const rpcsOK = Object.values(report.rpcs).filter(r => r.exists).length;

  console.log(`✅ Tables accessibles: ${tablesOK}/${Object.keys(report.tables).length}`);
  console.log(`✅ Vues accessibles: ${viewsOK}/${Object.keys(report.views).length}`);
  console.log(`✅ RPC accessibles: ${rpcsOK}/${Object.keys(report.rpcs).length}`);

  // Save report
  const fs = require('fs');
  const reportPath = '/workspaces/JETC_IMMO_SaaS/audit/_AUDIT_DB_STATE_RAW.json';
  fs.mkdirSync('/workspaces/JETC_IMMO_SaaS/audit', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Rapport sauvegardé: ${reportPath}`);

  console.log('\n✅ Audit terminé');
}

main().catch(console.error);
