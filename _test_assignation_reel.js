const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAvecMissionExistante() {
  console.log('🔍 TEST ASSIGNATION SUR MISSION EXISTANTE');
  console.log('='.repeat(60));
  
  try {
    // 1. Trouver N'IMPORTE QUELLE mission
    console.log('\n📋 1. RECHERCHE MISSION EXISTANTE');
    console.log('-'.repeat(60));
    
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select('id, ticket_id, entreprise_id, technicien_id, statut')
      .limit(10);

    if (missionsError) {
      console.error('❌ Erreur récup missions:', missionsError.message);
      if (missionsError.message.includes('user_id')) {
        console.error('\n🔥 PROBLÈME CONFIRMÉ: Policy SELECT missions utilise "user_id"');
        console.error('📝 Policy concernée: Une des policies missions');
        console.error('\n💡 SOLUTION:');
        console.error('   1. Vérifier que M46 a bien été appliquée');
        console.error('   2. Supprimer et recréer les policies missions');
        console.error('   3. Ou policies ont été recréées après M46\n');
      }
      return;
    }

    if (!missions || missions.length === 0) {
      console.log('⚠️ Aucune mission trouvée dans la base');
      return;
    }

    console.log(`✅ ${missions.length} mission(s) trouvée(s)`);
    missions.forEach(m => {
      console.log(`  - Mission ${m.id}: statut=${m.statut}, technicien=${m.technicien_id || 'null'}, entreprise=${m.entreprise_id}`);
    });

    // 2. Trouver techniciens
    console.log('\n📋 2. RECHERCHE TECHNICIENS');
    console.log('-'.repeat(60));
    
    const { data: techniciens, error: techError } = await supabase
      .from('techniciens')
      .select('id, nom, prenom, entreprise_id, actif')
      .limit(10);

    if (techError) {
      console.error('❌ Erreur récup techniciens:', techError.message);
      if (techError.message.includes('user_id')) {
        console.error('\n🔥 PROBLÈME CONFIRMÉ: Policy SELECT techniciens utilise "user_id"');
        console.error('📝 Policy concernée: Une des policies techniciens');
        console.error('\n💡 SOLUTION:');
        console.error('   1. Vérifier que M46 a bien été appliquée');
        console.error('   2. Supprimer et recréer les policies techniciens');
        console.error('   3. Ou policies ont été recréées après M46\n');
      }
      return;
    }

    if (!techniciens || techniciens.length === 0) {
      console.log('⚠️ Aucun technicien trouvé dans la base');
      return;
    }

    console.log(`✅ ${techniciens.length} technicien(s) trouvé(s)`);
    techniciens.forEach(t => {
      console.log(`  - Technicien ${t.id}: ${t.nom} ${t.prenom}, entreprise=${t.entreprise_id}, actif=${t.actif}`);
    });

    // 3. Trouver une combinaison valide mission/technicien de même entreprise
    console.log('\n📋 3. RECHERCHE COMBINAISON VALIDE');
    console.log('-'.repeat(60));
    
    let missionTest = null;
    let technicienTest = null;

    for (const mission of missions) {
      const tech = techniciens.find(t => t.entreprise_id === mission.entreprise_id && t.actif);
      if (tech) {
        missionTest = mission;
        technicienTest = tech;
        break;
      }
    }

    if (!missionTest || !technicienTest) {
      console.log('⚠️ Aucune combinaison mission/technicien de même entreprise trouvée');
      console.log('\nEntreprises missions:', [...new Set(missions.map(m => m.entreprise_id))].join(', '));
      console.log('Entreprises techniciens:', [...new Set(techniciens.map(t => t.entreprise_id))].join(', '));
      return;
    }

    console.log(`✅ Combinaison trouvée:`);
    console.log(`  Mission ${missionTest.id} + Technicien ${technicienTest.id} (${technicienTest.nom})`);
    console.log(`  Entreprise: ${missionTest.entreprise_id}`);

    // 4. TEST RPC assign_technicien_to_mission
    console.log('\n📋 4. TEST FONCTION RPC');
    console.log('-'.repeat(60));
    console.log(`\n🧪 Appel: assign_technicien_to_mission(${missionTest.id}, ${technicienTest.id})`);
    
    const { data: assignData, error: assignError } = await supabase
      .rpc('assign_technicien_to_mission', {
        p_mission_id: missionTest.id,
        p_technicien_id: technicienTest.id
      });

    if (assignError) {
      console.error('\n❌ ERREUR RPC:');
      console.error('Message:', assignError.message);
      console.error('Details:', assignError.details || 'N/A');
      console.error('Hint:', assignError.hint || 'N/A');
      console.error('Code:', assignError.code || 'N/A');
      
      // Analyse de l'erreur
      if (assignError.message.includes('user_id')) {
        console.error('\n🔥 PROBLÈME CONFIRMÉ: Erreur "user_id" dans RPC');
        console.error('🔍 Une policy RLS (SELECT/UPDATE) utilise "user_id"');
        console.error('\n💡 SOLUTION IMMÉDIATE:');
        console.error('   Exécuter ce SQL dans Supabase Dashboard SQL Editor:\n');
        console.error('   -- SUPPRIMER policies problématiques');
        console.error('   DROP POLICY IF EXISTS "Entreprise can view own missions" ON missions;');
        console.error('   DROP POLICY IF EXISTS "Entreprise can update own missions" ON missions;');
        console.error('   DROP POLICY IF EXISTS "Entreprise can view own techniciens" ON techniciens;');
        console.error('   ');
        console.error('   -- RECRÉER sans user_id');
        console.error('   CREATE POLICY "Entreprise can view own missions" ON missions');
        console.error('   FOR SELECT USING (');
        console.error('     entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())');
        console.error('   );');
        console.error('   ');
        console.error('   CREATE POLICY "Entreprise can update own missions" ON missions');
        console.error('   FOR UPDATE USING (');
        console.error('     entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())');
        console.error('   );');
        console.error('   ');
        console.error('   CREATE POLICY "Entreprise can view own techniciens" ON techniciens');
        console.error('   FOR SELECT USING (');
        console.error('     entreprise_id = (SELECT id FROM entreprises WHERE profile_id = auth.uid())');
        console.error('   );\n');
      } else if (assignError.message.includes('planifiee')) {
        console.error('\n🔥 PROBLÈME: Statut "planifiee" utilisé');
        console.error('🔍 Fonction RPC utilise encore statut invalide');
      } else if (assignError.message.includes('function') && assignError.message.includes('does not exist')) {
        console.error('\n🔥 PROBLÈME: Fonction RPC inexistante');
        console.error('🔍 M51 n\'a pas été appliquée');
        console.error('💡 Appliquer M51 via Dashboard SQL Editor');
      } else if (assignError.message.includes('permission') || assignError.message.includes('denied')) {
        console.error('\n🔥 PROBLÈME: Permission refusée');
        console.error('🔍 RLS bloque l\'opération via policies');
      }
    } else {
      console.log('\n✅ ASSIGNATION RÉUSSIE!');
      console.log('Résultat:', JSON.stringify(assignData, null, 2));
      
      // Vérifier l'état final
      const { data: finalMission } = await supabase
        .from('missions')
        .select('id, technicien_id, statut')
        .eq('id', missionTest.id)
        .single();
      
      if (finalMission) {
        console.log('\n📊 État mission après assignation:');
        console.log('  ID:', finalMission.id);
        console.log('  Technicien ID:', finalMission.technicien_id);
        console.log('  Statut:', finalMission.statut);
        
        if (finalMission.technicien_id === technicienTest.id) {
          console.log('\n✅ VALIDATION: Technicien correctement assigné');
        } else {
          console.log('\n⚠️ ATTENTION: Technicien non assigné correctement');
        }
      }
    }

    // 5. Test UPDATE direct
    console.log('\n📋 5. TEST UPDATE DIRECT (bypass RPC)');
    console.log('-'.repeat(60));
    
    const { data: updateData, error: updateError } = await supabase
      .from('missions')
      .update({ 
        notes: 'Test diagnostic - ' + new Date().toISOString()
      })
      .eq('id', missionTest.id)
      .select();

    if (updateError) {
      console.error('❌ Erreur UPDATE direct:', updateError.message);
      if (updateError.message.includes('user_id')) {
        console.error('\n🔥 CONFIRMATION: Policy UPDATE missions utilise "user_id"');
      }
    } else {
      console.log('✅ UPDATE direct fonctionne');
    }

  } catch (error) {
    console.error('\n💥 ERREUR FATALE:', error.message);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIN DIAGNOSTIC');
  console.log('='.repeat(60));
}

testAvecMissionExistante().catch(console.error);
