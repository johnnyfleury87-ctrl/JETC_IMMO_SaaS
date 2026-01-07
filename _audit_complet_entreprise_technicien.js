/**
 * AUDIT COMPLET - MODÈLE DE DONNÉES ENTREPRISE→TECHNICIEN→MISSION
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditDataModel() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 AUDIT COMPLET - ENTREPRISE → TECHNICIEN → MISSION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // ============================================================
    // CHECK 1: Missions orphelines (technicien_id sans correspondance)
    // ============================================================
    console.log('═══ CHECK 1: MISSIONS ORPHELINES ═══\n');
    
    const { data: orphelines, error: err1 } = await supabase.rpc('exec_sql', {
      query: `
        select m.id as mission_id, m.technicien_id, m.statut
        from missions m
        left join techniciens t on t.id = m.technicien_id
        where m.technicien_id is not null
          and t.id is null;
      `
    });
    
    if (err1) {
      // Fallback sans RPC
      const { data: missions } = await supabase.from('missions').select('id, technicien_id, statut');
      const { data: techniciens } = await supabase.from('techniciens').select('id');
      
      const techIds = new Set(techniciens?.map(t => t.id) || []);
      const orphelinesManual = missions?.filter(m => m.technicien_id && !techIds.has(m.technicien_id)) || [];
      
      if (orphelinesManual.length > 0) {
        console.log('❌ MISSIONS ORPHELINES DÉTECTÉES:', orphelinesManual.length);
        orphelinesManual.forEach(m => {
          console.log(`   Mission ${m.id.substring(0, 8)} → technicien_id ${m.technicien_id.substring(0, 8)} (INEXISTANT)`);
        });
      } else {
        console.log('✅ Aucune mission orpheline');
      }
    } else {
      if (orphelines && orphelines.length > 0) {
        console.log('❌ MISSIONS ORPHELINES DÉTECTÉES:', orphelines.length);
        orphelines.forEach(m => {
          console.log(`   Mission ${m.mission_id?.substring(0, 8)} → technicien_id ${m.technicien_id?.substring(0, 8)} (INEXISTANT)`);
        });
      } else {
        console.log('✅ Aucune mission orpheline');
      }
    }
    
    console.log('');

    // ============================================================
    // CHECK 2: Missions où technicien_id = profile_id (mauvais ID)
    // ============================================================
    console.log('═══ CHECK 2: MISSIONS AVEC MAUVAIS ID (profile au lieu de technicien) ═══\n');
    
    const { data: missions } = await supabase.from('missions').select('id, technicien_id');
    const { data: profiles } = await supabase.from('profiles').select('id, email, role');
    
    const profileIds = new Set(profiles?.map(p => p.id) || []);
    const mauvaisId = missions?.filter(m => m.technicien_id && profileIds.has(m.technicien_id)) || [];
    
    if (mauvaisId.length > 0) {
      console.log('⚠️ MISSIONS UTILISANT profile_id AU LIEU DE technicien.id:', mauvaisId.length);
      for (const m of mauvaisId) {
        const profile = profiles.find(p => p.id === m.technicien_id);
        console.log(`   Mission ${m.id.substring(0, 8)} → technicien_id=${m.technicien_id.substring(0, 8)} (= profile ${profile?.email})`);
        console.log(`   ⚠️ ERREUR: devrait pointer vers techniciens.id, pas profiles.id`);
      }
    } else {
      console.log('✅ Aucune mission n\'utilise directement profile_id');
    }
    
    console.log('');

    // ============================================================
    // CHECK 3: Cohérence techniciens (id vs profile_id)
    // ============================================================
    console.log('═══ CHECK 3: COHÉRENCE TECHNICIENS (id vs profile_id) ═══\n');
    
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('id, profile_id, email, nom, prenom');
    
    console.log(`Total techniciens: ${techniciens?.length || 0}`);
    
    if (techniciens) {
      const incohérents = techniciens.filter(t => t.id !== t.profile_id);
      
      if (incohérents.length > 0) {
        console.log(`⚠️ Techniciens où id ≠ profile_id: ${incohérents.length}`);
        incohérents.forEach(t => {
          console.log(`   Technicien ${t.email}`);
          console.log(`      id:         ${t.id.substring(0, 8)}`);
          console.log(`      profile_id: ${t.profile_id.substring(0, 8)}`);
        });
      } else {
        console.log('✅ Tous les techniciens ont id == profile_id (cohérent)');
      }
    }
    
    console.log('');

    // ============================================================
    // CHECK 4: Mission JOIN complet
    // ============================================================
    console.log('═══ CHECK 4: MISSIONS AVEC JOIN COMPLET ═══\n');
    
    const { data: missionsComplete, error: err4 } = await supabase
      .from('missions')
      .select(`
        id,
        statut,
        technicien_id,
        ticket_id,
        technicien:techniciens!missions_technicien_id_fkey(
          id,
          profile_id,
          email,
          nom,
          prenom,
          profile:profiles(email, role)
        )
      `);
    
    if (err4) {
      console.log('❌ Erreur JOIN:', err4.message);
    } else {
      console.log(`Total missions: ${missionsComplete?.length || 0}`);
      
      if (missionsComplete && missionsComplete.length > 0) {
        console.log('\nDétail missions:');
        missionsComplete.forEach((m, idx) => {
          console.log(`\n${idx + 1}. Mission ${m.id.substring(0, 8)} (${m.statut})`);
          console.log(`   technicien_id: ${m.technicien_id?.substring(0, 8) || 'NULL'}`);
          
          if (m.technicien) {
            console.log(`   ✅ Technicien trouvé: ${m.technicien.email} (${m.technicien.nom} ${m.technicien.prenom})`);
            console.log(`      technicien.id: ${m.technicien.id.substring(0, 8)}`);
            console.log(`      technicien.profile_id: ${m.technicien.profile_id.substring(0, 8)}`);
            
            if (m.technicien.profile) {
              console.log(`      profile auth: ${m.technicien.profile.email} (${m.technicien.profile.role})`);
            }
          } else {
            console.log(`   ❌ Technicien NULL (orpheline ou JOIN échoué)`);
          }
          
          console.log(`   ticket_id: ${m.ticket_id?.substring(0, 8) || 'NULL'}`);
        });
      }
    }
    
    console.log('\n');

    // ============================================================
    // CHECK 5: Vérification FK constraint
    // ============================================================
    console.log('═══ CHECK 5: CONTRAINTES FK ═══\n');
    
    // Test si on peut insérer une mission avec technicien_id invalide
    console.log('Test: Peut-on créer une mission avec technicien_id invalide ?');
    
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const testMission = {
      id: '99999999-0000-0000-0000-000000000001',
      ticket_id: '99999999-0000-0000-0000-000000000002',
      entreprise_id: '99999999-0000-0000-0000-000000000003',
      technicien_id: fakeId,
      statut: 'en_attente'
    };
    
    const { error: fkError } = await supabase
      .from('missions')
      .insert(testMission);
    
    if (fkError) {
      if (fkError.message.includes('foreign key constraint') || fkError.code === '23503') {
        console.log('✅ FK EXISTE et bloque les insertions invalides');
        console.log(`   Erreur: ${fkError.message}`);
      } else {
        console.log('⚠️ Erreur mais pas FK:', fkError.message);
      }
    } else {
      console.log('❌ FK ABSENTE ! La mission invalide a été insérée');
      console.log('⚠️ Il faut ajouter la contrainte FK');
      
      // Nettoyer
      await supabase.from('missions').delete().eq('id', testMission.id);
    }
    
    console.log('\n');

    // ============================================================
    // RÉSUMÉ
    // ============================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ AUDIT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Structure attendue:');
    console.log('  auth.users.id');
    console.log('       ║');
    console.log('       ↓');
    console.log('  profiles.id (id = auth.users.id)');
    console.log('       ║');
    console.log('       ↓');
    console.log('  techniciens.profile_id → profiles.id');
    console.log('  techniciens.id (PK, normalement = profile_id)');
    console.log('       ║');
    console.log('       ↓');
    console.log('  missions.technicien_id → techniciens.id\n');
    
  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

auditDataModel();
