// =====================================================
// AUDIT COMPLET DB TECHNICIEN
// =====================================================
// Vérifie structure missions, RLS, RPC pour vue technicien
// =====================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// UTILITAIRES
// =====================================================

function section(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

function subsection(title) {
  console.log(`\n🔹 ${title}`);
  console.log('-'.repeat(50));
}

// =====================================================
// 1. STRUCTURE TABLE MISSIONS
// =====================================================

async function auditTableMissions() {
  section('STRUCTURE TABLE missions');
  
  try {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Erreur lecture table missions:', error.message);
      return null;
    }
    
    console.log('✅ Table missions accessible');
    
    if (data && data.length > 0) {
      console.log('\n📊 Colonnes détectées:');
      Object.keys(data[0]).forEach(col => {
        console.log(`   - ${col}`);
      });
    }
    
    // Vérifier colonnes critiques
    subsection('Colonnes critiques pour technicien');
    const requiredColumns = [
      'id',
      'entreprise_id', 
      'technicien_id',
      'statut',
      'started_at',
      'completed_at',
      'notes',
      'photos_urls'
    ];
    
    const sample = data[0] || {};
    requiredColumns.forEach(col => {
      if (col in sample) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MANQUANTE`);
      }
    });
    
    return sample;
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return null;
  }
}

// =====================================================
// 2. STRUCTURE TABLE mission_signalements
// =====================================================

async function auditTableSignalements() {
  section('STRUCTURE TABLE mission_signalements');
  
  try {
    const { data, error } = await supabase
      .from('mission_signalements')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('⚠️ Table mission_signalements introuvable ou inaccessible:', error.message);
      return null;
    }
    
    console.log('✅ Table mission_signalements accessible');
    
    if (data && data.length > 0) {
      console.log('\n📊 Colonnes détectées:');
      Object.keys(data[0]).forEach(col => {
        console.log(`   - ${col}`);
      });
    }
    
    return true;
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return null;
  }
}

// =====================================================
// 3. POLICIES RLS MISSIONS POUR TECHNICIEN
// =====================================================

async function auditPoliciesMissions() {
  section('POLICIES RLS missions POUR TECHNICIEN');
  
  try {
    // Liste toutes les policies sur missions
    const { data: policies, error } = await supabase
      .rpc('exec_sql', {
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
          WHERE tablename = 'missions'
          ORDER BY policyname;
        `
      });
      
    if (error) {
      // Fallback : query directe
      const { data: policiesRaw, error: err2 } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'missions');
        
      if (err2) {
        console.log('⚠️ Impossible de lire pg_policies via RPC ou direct');
        console.log('   Raison:', err2.message);
        return await auditPoliciesViaSQL();
      }
      
      return policiesRaw;
    }
    
    if (!policies || policies.length === 0) {
      console.log('⚠️ Aucune policy trouvée pour missions');
      return [];
    }
    
    console.log(`✅ ${policies.length} policies trouvées:\n`);
    
    policies.forEach(p => {
      console.log(`📜 ${p.policyname}`);
      console.log(`   Commande: ${p.cmd}`);
      console.log(`   Rôles: ${p.roles}`);
      console.log(`   USING: ${p.qual || 'N/A'}`);
      console.log(`   WITH CHECK: ${p.with_check || 'N/A'}`);
      console.log('');
    });
    
    // Vérifier policies technicien spécifiques
    subsection('Policies attendues pour technicien');
    
    const techPolicies = policies.filter(p => 
      p.policyname.toLowerCase().includes('technicien') ||
      (p.qual && p.qual.toLowerCase().includes('technicien'))
    );
    
    if (techPolicies.length === 0) {
      console.log('⚠️ Aucune policy spécifique technicien détectée');
    } else {
      console.log(`✅ ${techPolicies.length} policies technicien détectées`);
      techPolicies.forEach(p => {
        console.log(`   - ${p.policyname} (${p.cmd})`);
      });
    }
    
    return policies;
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

// Fallback si RPC non dispo
async function auditPoliciesViaSQL() {
  console.log('\n🔄 Tentative lecture policies via SQL direct...');
  
  try {
    const { data, error } = await supabase.rpc('get_missions_policies');
    
    if (error) {
      console.log('⚠️ RPC get_missions_policies introuvable');
      return [];
    }
    
    return data;
  } catch (err) {
    console.log('⚠️ Méthode alternative échouée');
    return [];
  }
}

// =====================================================
// 4. RPC FUNCTIONS TECHNICIEN
// =====================================================

async function auditRPCFunctions() {
  section('RPC FUNCTIONS POUR TECHNICIEN');
  
  const expectedRPCs = [
    'start_mission',
    'complete_mission',
    'add_mission_photos',
    'create_mission_signalement',
    'get_technicien_missions'
  ];
  
  console.log('🔍 Fonctions RPC attendues:\n');
  
  for (const rpcName of expectedRPCs) {
    try {
      // Tester si la RPC existe en l'appelant avec des params invalides
      const { error } = await supabase.rpc(rpcName, {});
      
      if (!error) {
        console.log(`   ✅ ${rpcName} - existe (retour OK)`);
      } else if (error.message.includes('Could not find')) {
        console.log(`   ❌ ${rpcName} - N'EXISTE PAS`);
      } else if (error.message.includes('missing') || error.message.includes('required')) {
        console.log(`   ✅ ${rpcName} - existe (params requis)`);
      } else {
        console.log(`   ⚠️  ${rpcName} - existe mais erreur: ${error.message.substring(0, 60)}`);
      }
    } catch (err) {
      console.log(`   ❌ ${rpcName} - Exception: ${err.message.substring(0, 60)}`);
    }
  }
}

// =====================================================
// 5. VÉRIFIER LIEN TECHNICIEN ↔ PROFILE
// =====================================================

async function auditLienTechnicienProfile() {
  section('LIEN TECHNICIEN ↔ PROFILE');
  
  try {
    // Récupérer un technicien exemple
    const { data: techniciens, error } = await supabase
      .from('techniciens')
      .select('id, nom, profile_id, entreprise_id')
      .limit(3);
    
    if (error) {
      console.log('❌ Impossible de lire table techniciens:', error.message);
      return;
    }
    
    if (!techniciens || techniciens.length === 0) {
      console.log('⚠️ Aucun technicien dans la base');
      return;
    }
    
    console.log(`✅ ${techniciens.length} techniciens trouvés\n`);
    
    for (const tech of techniciens) {
      console.log(`👤 ${tech.nom} (ID: ${tech.id})`);
      console.log(`   - profile_id: ${tech.profile_id || '❌ NULL'}`);
      console.log(`   - entreprise_id: ${tech.entreprise_id || '❌ NULL'}`);
      
      if (tech.profile_id) {
        // Vérifier que le profile existe
        const { data: profile, error: errProfile } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', tech.profile_id)
          .single();
        
        if (errProfile) {
          console.log(`   ❌ Profile introuvable`);
        } else {
          console.log(`   ✅ Profile: ${profile.email} (role: ${profile.role})`);
        }
      }
      console.log('');
    }
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
}

// =====================================================
// 6. TESTER LECTURE MISSIONS EN TANT QUE TECHNICIEN
// =====================================================

async function testLectureMissionsTechnicien() {
  section('TEST LECTURE MISSIONS (simulation technicien)');
  
  try {
    // Récupérer un technicien avec profile_id
    const { data: tech, error: errTech } = await supabase
      .from('techniciens')
      .select('id, nom, profile_id')
      .not('profile_id', 'is', null)
      .limit(1)
      .single();
    
    if (errTech || !tech) {
      console.log('⚠️ Aucun technicien avec profile_id trouvé pour tester');
      return;
    }
    
    console.log(`🧪 Test avec technicien: ${tech.nom} (profile_id: ${tech.profile_id})`);
    
    // Créer un client authentifié (simulation)
    // Note: en vrai il faudrait un JWT valide, ici on utilise service_role
    
    const { data: missions, error } = await supabase
      .from('missions')
      .select('*')
      .eq('technicien_id', tech.id);
    
    if (error) {
      console.log('❌ Erreur lecture missions:', error.message);
      return;
    }
    
    console.log(`✅ ${missions ? missions.length : 0} missions assignées à ce technicien`);
    
    if (missions && missions.length > 0) {
      console.log('\n📋 Exemples:');
      missions.slice(0, 3).forEach(m => {
        console.log(`   - Mission ${m.id.substring(0, 8)}...`);
        console.log(`     Statut: ${m.statut}`);
        console.log(`     Started: ${m.started_at || 'Non démarrée'}`);
        console.log(`     Completed: ${m.completed_at || 'Non terminée'}`);
      });
    }
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AUDIT COMPLET BASE DE DONNÉES - VUE TECHNICIEN          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  await auditTableMissions();
  await auditTableSignalements();
  await auditPoliciesMissions();
  await auditRPCFunctions();
  await auditLienTechnicienProfile();
  await testLectureMissionsTechnicien();
  
  section('FIN AUDIT');
  console.log('✅ Audit terminé');
  console.log('📄 Générez maintenant le rapport: audit/REPORT_TECHNICIEN_DB_STATE.md');
  console.log('');
}

main().catch(err => {
  console.error('❌ ERREUR FATALE:', err);
  process.exit(1);
});
