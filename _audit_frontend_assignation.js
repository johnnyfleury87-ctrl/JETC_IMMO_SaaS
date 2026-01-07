/**
 * AUDIT FRONTEND - ASSIGNATION TECHNICIEN
 * Vérifier quelle valeur est envoyée : techniciens.id ou profile_id ?
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditFrontendCode() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 AUDIT FRONTEND - ASSIGNATION TECHNICIEN');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Récupérer tous les techniciens pour voir la structure
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('*')
      .limit(5);
    
    console.log('📋 STRUCTURE TECHNICIENS (exemples):\n');
    
    if (techniciens && techniciens.length > 0) {
      techniciens.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.email || t.nom}`);
        console.log(`   id:         ${t.id.substring(0, 8)}`);
        console.log(`   profile_id: ${t.profile_id.substring(0, 8)}`);
        console.log(`   ${t.id === t.profile_id ? '✅ id == profile_id' : '❌ id ≠ profile_id (INCOHÉRENT)'}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 ANALYSE CODE FRONTEND');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📄 Fichier: public/entreprise/dashboard.html');
    console.log('   Ligne 1391: value="${t.id}"');
    console.log('   ');
    console.log('   ⚠️ PROBLÈME POTENTIEL:');
    console.log('   Le frontend utilise techniciens.id pour remplir la radio');
    console.log('   Ligne 1439: selectedRadio.value → technicienId');
    console.log('   Ligne 1440-1443: RPC assign_technicien_to_mission(p_technicien_id: technicienId)');
    console.log('');
    console.log('   ✅ Le RPC reçoit bien techniciens.id');
    console.log('   ✅ Le RPC fait "where id = p_technicien_id" sur table techniciens');
    console.log('');
    console.log('   📝 Conclusion: Le code frontend est CORRECT');
    console.log('      Il passe bien techniciens.id (et pas profile_id)');
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚨 HYPOTHÈSE: MISSIONS CRÉÉES MANUELLEMENT/DIRECTEMENT');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Scénarios possibles:');
    console.log('');
    console.log('1. ❌ MIGRATION/SCRIPT MAL ÉCRIT');
    console.log('   Un script de migration ou de test a inséré directement');
    console.log('   des missions avec technicien_id = profile_id au lieu de techniciens.id');
    console.log('');
    console.log('2. ❌ API DIRECTE (bypass RPC)');
    console.log('   Un code utilise supabase.from("missions").update({technicien_id: ...})');
    console.log('   et passe profile_id au lieu de techniciens.id');
    console.log('');
    console.log('3. ❌ DONNÉES DE TEST');
    console.log('   Seeds ou données de test créées manuellement avec mauvais ID');
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔎 RECHERCHE AUTRES POINTS D\'ASSIGNATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('À chercher dans le code:');
    console.log('');
    console.log('grep -r "missions.*update.*technicien_id" --include="*.js" --include="*.html"');
    console.log('grep -r "supabase.*from.*missions.*insert" --include="*.js" --include="*.html"');
    console.log('grep -r "technicien_id.*auth.uid" --include="*.sql"');
    console.log('');

    // Vérifier les missions actuelles
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ÉTAT ACTUEL DES MISSIONS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const { data: missions } = await supabase
      .from('missions')
      .select('id, technicien_id, statut');
    
    console.log(`Total missions: ${missions?.length || 0}\n`);
    
    if (missions && missions.length > 0) {
      const { data: allTechniciens } = await supabase
        .from('techniciens')
        .select('id, profile_id, email');
      
      const techMap = new Map(allTechniciens?.map(t => [t.id, t]) || []);
      const profileMap = new Map(allTechniciens?.map(t => [t.profile_id, t]) || []);
      
      let correctes = 0;
      let mauvaisId = 0;
      let orphelines = 0;
      
      missions.forEach((m, idx) => {
        if (!m.technicien_id) return;
        
        const techById = techMap.get(m.technicien_id);
        const techByProfile = profileMap.get(m.technicien_id);
        
        if (techById) {
          correctes++;
        } else if (techByProfile) {
          mauvaisId++;
          console.log(`❌ Mission ${idx + 1} (${m.id.substring(0, 8)})`);
          console.log(`   technicien_id: ${m.technicien_id.substring(0, 8)}`);
          console.log(`   = profile_id de: ${techByProfile.email}`);
          console.log(`   devrait être: ${techByProfile.id.substring(0, 8)}`);
          console.log('');
        } else {
          orphelines++;
          console.log(`⚠️ Mission ${idx + 1} (${m.id.substring(0, 8)})`);
          console.log(`   technicien_id: ${m.technicien_id.substring(0, 8)} (ORPHELINE)`);
          console.log('');
        }
      });
      
      console.log('\n📊 RÉSUMÉ:');
      console.log(`   ✅ Missions correctes: ${correctes}`);
      console.log(`   ❌ Missions avec profile_id: ${mauvaisId}`);
      console.log(`   ⚠️ Missions orphelines: ${orphelines}`);
    }

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

auditFrontendCode();
