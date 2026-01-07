/**
 * ═════════════════════════════════════════════════════════════
 * AUDIT FORENSIC - BUG "DÉMARRER MISSION"
 * ═════════════════════════════════════════════════════════════
 * 
 * OBJECTIFS:
 * 1. Vérifier structure table missions
 * 2. Auditer RLS policies (SELECT + UPDATE)
 * 3. Tester fonction update_mission_statut()
 * 4. Vérifier liaison techniciens <-> missions
 * 5. Identifier blocages potentiels
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 AUDIT FORENSIC - BUG "DÉMARRER MISSION"');
console.log('═══════════════════════════════════════════════════════════════\n');

async function main() {
  const results = {
    structure_db: null,
    rls_policies: null,
    test_rpc: null,
    test_user_technicien: null,
    recommendations: []
  };

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 1: STRUCTURE TABLE MISSIONS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 ÉTAPE 1: VÉRIFICATION STRUCTURE TABLE MISSIONS\n');
  
  try {
    const { data: columns, error } = await supabase.rpc('get_table_columns', { 
      table_name: 'missions' 
    }).catch(async () => {
      // Fallback: requête directe
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .limit(1);
      
      if (data && data[0]) {
        return { data: Object.keys(data[0]), error: null };
      }
      return { data: null, error };
    });

    if (error) {
      console.log('⚠️  Impossible de récupérer structure (test avec SELECT)');
      
      // Test direct
      const { data: sample, error: err2 } = await supabase
        .from('missions')
        .select('id, statut, started_at, completed_at, validated_at, technicien_id, entreprise_id, ticket_id, notes, updated_at')
        .limit(1);
      
      if (err2) {
        console.log('❌ Erreur SELECT missions:', err2.message);
        results.structure_db = { error: err2.message };
      } else {
        const cols = sample && sample[0] ? Object.keys(sample[0]) : [];
        console.log('✅ Colonnes détectées:', cols.join(', '));
        results.structure_db = { columns: cols };
      }
    } else {
      console.log('✅ Colonnes table missions:', columns);
      results.structure_db = { columns };
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
    results.structure_db = { error: err.message };
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 2: VÉRIFIER RLS POLICIES
  // ═══════════════════════════════════════════════════════════
  console.log('🔐 ÉTAPE 2: AUDIT RLS POLICIES SUR MISSIONS\n');
  
  try {
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'missions')
      .order('policyname');

    if (error) {
      console.log('❌ Erreur lecture policies:', error.message);
      results.rls_policies = { error: error.message };
    } else {
      console.log(`📊 ${policies.length} policies trouvées sur table missions:\n`);
      
      policies.forEach(p => {
        console.log(`  • ${p.policyname}`);
        console.log(`    CMD: ${p.cmd} | ROLES: ${p.roles}`);
        console.log(`    USING: ${p.qual || 'N/A'}`);
        console.log(`    WITH CHECK: ${p.with_check || 'N/A'}`);
        console.log('');
      });

      // Vérifier policies UPDATE pour techniciens
      const updatePolicies = policies.filter(p => 
        p.cmd === 'UPDATE' && p.policyname.toLowerCase().includes('technicien')
      );

      if (updatePolicies.length === 0) {
        console.log('⚠️  ATTENTION: Aucune policy UPDATE trouvée pour les techniciens!');
        results.recommendations.push('Créer policy UPDATE pour techniciens sur table missions');
      } else {
        console.log('✅ Policy UPDATE techniciens trouvée:', updatePolicies.map(p => p.policyname).join(', '));
      }

      results.rls_policies = { 
        count: policies.length, 
        policies: policies.map(p => ({
          name: p.policyname,
          cmd: p.cmd,
          roles: p.roles,
          using: p.qual,
          with_check: p.with_check
        }))
      };
    }
  } catch (err) {
    console.log('❌ Exception policies:', err.message);
    results.rls_policies = { error: err.message };
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 3: TESTER RPC update_mission_statut
  // ═══════════════════════════════════════════════════════════
  console.log('⚙️  ÉTAPE 3: TEST FONCTION update_mission_statut\n');

  try {
    // Trouver une mission test en_attente
    const { data: missions, error: errMissions } = await supabase
      .from('missions')
      .select('id, statut, technicien_id, ticket_id')
      .eq('statut', 'en_attente')
      .limit(1);

    if (errMissions || !missions || missions.length === 0) {
      console.log('⚠️  Aucune mission en_attente trouvée pour test (ou erreur)');
      if (errMissions) console.log('   Erreur:', errMissions.message);
      
      results.test_rpc = { error: 'Aucune mission test disponible' };
    } else {
      const testMission = missions[0];
      console.log('📌 Mission test trouvée:', testMission.id);
      console.log('   Statut actuel:', testMission.statut);
      console.log('   Technicien ID:', testMission.technicien_id || 'NON ASSIGNÉ');
      console.log('');

      // Test DRY-RUN: appeler RPC avec rôle technicien
      console.log('🧪 Test RPC update_mission_statut (DRY-RUN):');
      console.log('   Mission:', testMission.id);
      console.log('   Transition: en_attente → en_cours');
      console.log('   Rôle: technicien');
      console.log('');

      // NE PAS EXÉCUTER RÉELLEMENT - juste vérifier que la fonction existe
      const { data: funcExists, error: funcError } = await supabase
        .rpc('update_mission_statut', {
          p_mission_id: '00000000-0000-0000-0000-000000000000', // UUID bidon
          p_nouveau_statut: 'en_cours',
          p_role: 'technicien'
        });

      if (funcError) {
        if (funcError.message.includes('Mission non trouvée')) {
          console.log('✅ Fonction update_mission_statut existe et fonctionne (retour attendu: mission non trouvée)');
          results.test_rpc = { status: 'OK', function_exists: true };
        } else {
          console.log('❌ Erreur RPC:', funcError.message);
          results.test_rpc = { error: funcError.message };
        }
      } else {
        console.log('⚠️  Résultat inattendu:', funcExists);
        results.test_rpc = { status: 'UNEXPECTED', data: funcExists };
      }
    }
  } catch (err) {
    console.log('❌ Exception test RPC:', err.message);
    results.test_rpc = { error: err.message };
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 4: TEST AVEC UTILISATEUR TECHNICIEN RÉEL
  // ═══════════════════════════════════════════════════════════
  console.log('👤 ÉTAPE 4: TEST AVEC COMPTE TECHNICIEN (RLS ACTIVÉ)\n');

  try {
    // Récupérer un technicien test
    const { data: techniciens, error: errTech } = await supabase
      .from('techniciens')
      .select('id, profile_id, nom, prenom, entreprise_id')
      .limit(1);

    if (errTech || !techniciens || techniciens.length === 0) {
      console.log('⚠️  Aucun technicien trouvé en DB');
      results.test_user_technicien = { error: 'Aucun technicien en DB' };
    } else {
      const tech = techniciens[0];
      console.log('📌 Technicien trouvé:', tech.nom, tech.prenom);
      console.log('   ID:', tech.id);
      console.log('   Profile ID:', tech.profile_id);
      console.log('   Entreprise:', tech.entreprise_id);
      console.log('');

      // Trouver une mission assignée à ce technicien
      const { data: missions, error: errMissions } = await supabase
        .from('missions')
        .select('id, statut, ticket_id')
        .eq('technicien_id', tech.id)
        .eq('statut', 'en_attente')
        .limit(1);

      if (errMissions || !missions || missions.length === 0) {
        console.log('⚠️  Aucune mission en_attente assignée à ce technicien');
        results.test_user_technicien = { 
          technicien_found: true,
          mission_found: false,
          message: 'Créer une mission assignée au technicien pour tester'
        };
      } else {
        console.log('✅ Mission test trouvée:', missions[0].id);
        console.log('   Statut:', missions[0].statut);
        console.log('');
        console.log('⚠️  Pour test réel, se connecter avec ce compte:');
        console.log('   Profile ID:', tech.profile_id);
        console.log('   Puis appeler depuis front: startMission(\'' + missions[0].id + '\')');
        console.log('');

        results.test_user_technicien = {
          technicien: tech,
          mission_test: missions[0],
          ready_for_test: true
        };
      }
    }
  } catch (err) {
    console.log('❌ Exception test technicien:', err.message);
    results.test_user_technicien = { error: err.message };
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 5: VÉRIFICATIONS COMPLÉMENTAIRES
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 ÉTAPE 5: VÉRIFICATIONS COMPLÉMENTAIRES\n');

  // Vérifier si RLS est activé sur table missions
  try {
    const { data: rlsStatus, error } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .eq('tablename', 'missions')
      .single();

    if (error) {
      console.log('⚠️  Impossible de vérifier statut RLS');
    } else {
      console.log('RLS sur table missions:', rlsStatus.rowsecurity ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ');
      
      if (!rlsStatus.rowsecurity) {
        results.recommendations.push('⚠️  RLS DÉSACTIVÉ sur table missions - Sécurité compromise!');
      }
    }
  } catch (err) {
    console.log('⚠️  Erreur vérification RLS:', err.message);
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════
  // RAPPORT FINAL
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('1️⃣  Structure DB:', results.structure_db ? '✅' : '❌');
  console.log('2️⃣  RLS Policies:', results.rls_policies ? '✅' : '❌');
  console.log('3️⃣  RPC Fonction:', results.test_rpc?.function_exists ? '✅' : '⚠️');
  console.log('4️⃣  Test Technicien:', results.test_user_technicien?.ready_for_test ? '✅' : '⚠️');
  console.log('');

  if (results.recommendations.length > 0) {
    console.log('⚠️  RECOMMANDATIONS:\n');
    results.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    console.log('');
  }

  // Sauvegarder résultats
  const fs = require('fs');
  fs.writeFileSync(
    '_audit_bug_demarrer_mission_results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Résultats sauvegardés: _audit_bug_demarrer_mission_results.json\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
