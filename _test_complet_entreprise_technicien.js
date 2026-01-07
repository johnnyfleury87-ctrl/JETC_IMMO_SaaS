/**
 * =====================================================
 * TEST COMPLET: ENTREPRISE → TECHNICIEN → MISSION
 * =====================================================
 * Teste la chaîne complète avec validation
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testComplet() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST COMPLET - ENTREPRISE → TECHNICIEN → MISSION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // ========================================
    // TEST 1: Récupérer techniciens et missions
    // ========================================
    console.log('═══ TEST 1: ÉTAT ACTUEL ═══\n');
    
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('id, profile_id, email, nom, prenom, entreprise_id, actif');
    
    console.log(`Techniciens: ${techniciens?.length || 0}`);
    
    if (techniciens && techniciens.length > 0) {
      let coherents = 0;
      let incoherents = 0;
      
      techniciens.forEach(t => {
        const coherent = t.id === t.profile_id;
        if (coherent) coherents++;
        else incoherents++;
        
        console.log(`  ${coherent ? '✅' : '❌'} ${t.email}`);
        console.log(`     id:         ${t.id.substring(0, 8)}`);
        console.log(`     profile_id: ${t.profile_id.substring(0, 8)}`);
        if (!coherent) {
          console.log(`     ⚠️ INCOHÉRENCE DÉTECTÉE`);
        }
      });
      
      console.log(`\n📊 ${coherents} cohérents, ${incoherents} incohérents\n`);
    }
    
    const { data: missions } = await supabase
      .from('missions')
      .select('id, technicien_id, statut, entreprise_id');
    
    console.log(`Missions: ${missions?.length || 0}`);
    
    if (missions && missions.length > 0) {
      missions.forEach(m => {
        console.log(`  Mission ${m.id.substring(0, 8)} (${m.statut})`);
        console.log(`     technicien_id: ${m.technicien_id?.substring(0, 8) || 'NULL'}`);
      });
    }
    
    console.log('\n');

    // ========================================
    // TEST 2: Vérifier qu'on NE PEUT PAS créer mission orpheline
    // ========================================
    console.log('═══ TEST 2: PROTECTION FK (tentative création mission orpheline) ═══\n');
    
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    // Trouver une entreprise et un ticket existants
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('id')
      .limit(1)
      .single();
    
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .is('locked_at', null)
      .limit(1)
      .single();
    
    if (entreprise && ticket) {
      const testMission = {
        ticket_id: ticket.id,
        entreprise_id: entreprise.id,
        technicien_id: fakeId,
        statut: 'en_attente'
      };
      
      console.log('Tentative d\'insertion avec technicien_id invalide...');
      
      const { error } = await supabase
        .from('missions')
        .insert(testMission);
      
      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key')) {
          console.log('✅ FK PROTÈGE: Insertion bloquée par contrainte FK');
          console.log(`   Erreur: ${error.message}`);
        } else {
          console.log('⚠️ Erreur autre que FK:', error.message);
        }
      } else {
        console.log('❌ DANGER: Mission créée avec technicien_id invalide !');
        console.log('⚠️ La FK est ABSENTE ou DÉSACTIVÉE');
        
        // Nettoyer
        await supabase.from('missions').delete().eq('technicien_id', fakeId);
      }
    } else {
      console.log('⚠️ Skip test: entreprise ou ticket non trouvé');
    }
    
    console.log('\n');

    // ========================================
    // TEST 3: Simuler assignation via RPC
    // ========================================
    console.log('═══ TEST 3: RPC ASSIGNATION ═══\n');
    
    if (missions && missions.length > 0 && techniciens && techniciens.length > 0) {
      const mission = missions[0];
      const technicien = techniciens.find(t => t.actif);
      
      if (mission && technicien) {
        console.log(`Assignation mission ${mission.id.substring(0, 8)} → technicien ${technicien.email}`);
        
        const { data, error } = await supabase.rpc('assign_technicien_to_mission', {
          p_mission_id: mission.id,
          p_technicien_id: technicien.id
        });
        
        if (error) {
          console.log('❌ Erreur RPC:', error.message);
        } else {
          console.log('✅ RPC SUCCESS:', data);
          
          // Vérifier que l'assignation a fonctionné
          const { data: missionUpdated } = await supabase
            .from('missions')
            .select('id, technicien_id')
            .eq('id', mission.id)
            .single();
          
          if (missionUpdated && missionUpdated.technicien_id === technicien.id) {
            console.log('✅ Mission correctement assignée en DB');
          } else {
            console.log('⚠️ Mission non mise à jour en DB');
          }
        }
      }
    }
    
    console.log('\n');

    // ========================================
    // TEST 4: Visibilité côté technicien (simulation RLS)
    // ========================================
    console.log('═══ TEST 4: VISIBILITÉ TECHNICIEN (simulation RLS) ═══\n');
    
    if (techniciens && techniciens.length > 0) {
      for (const tech of techniciens) {
        // Récupérer missions assignées à ce technicien
        const { data: missionsVisibles, error } = await supabase
          .from('missions')
          .select('id, statut, technicien_id')
          .eq('technicien_id', tech.id);
        
        console.log(`Technicien: ${tech.email}`);
        console.log(`  ID utilisé: ${tech.id.substring(0, 8)}`);
        console.log(`  Missions visibles (service_role): ${missionsVisibles?.length || 0}`);
        
        if (missionsVisibles && missionsVisibles.length > 0) {
          missionsVisibles.forEach(m => {
            console.log(`    - Mission ${m.id.substring(0, 8)} (${m.statut})`);
          });
        }
        
        // Vérifier cohérence pour RLS
        if (tech.id === tech.profile_id) {
          console.log(`  ✅ RLS OK: technicien.id == profile_id (auth.uid() matchera)`);
        } else {
          console.log(`  ❌ RLS FAIL: technicien.id ≠ profile_id`);
          console.log(`     auth.uid() = ${tech.profile_id.substring(0, 8)}`);
          console.log(`     missions filtrera sur technicien_id = ${tech.id.substring(0, 8)}`);
          console.log(`     → AUCUNE MISSION VISIBLE pour ce technicien`);
        }
        
        console.log('');
      }
    }

    // ========================================
    // RÉSUMÉ
    // ========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ TEST COMPLET');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const coherents = techniciens?.filter(t => t.id === t.profile_id).length || 0;
    const incoherents = (techniciens?.length || 0) - coherents;
    
    console.log(`Techniciens cohérents: ${coherents}`);
    console.log(`Techniciens incohérents: ${incoherents}`);
    console.log('');
    
    if (incoherents > 0) {
      console.log('⚠️ ACTIONS REQUISES:');
      console.log('  1. Appliquer migration: _migration_fix_techniciens_id_consistency.sql');
      console.log('  2. Vérifier que api/techniciens/create.js est fixé');
      console.log('  3. Redéployer RPC: _migration_improve_rpc_assign.sql');
    } else {
      console.log('✅ Tous les techniciens sont cohérents !');
      console.log('✅ Les missions peuvent être correctement assignées');
      console.log('✅ Les techniciens peuvent voir leurs missions via RLS');
    }

  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

testComplet();
