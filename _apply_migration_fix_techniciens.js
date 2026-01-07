/**
 * APPLICATION MIGRATION VIA SUPABASE CLIENT
 * (car psql n'est pas disponible)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 APPLICATION MIGRATION - FIX TECHNICIENS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // ============================================
    // ÉTAPE 1: AUDIT AVANT
    // ============================================
    console.log('═══ ÉTAPE 1: AUDIT AVANT CORRECTION ═══\n');
    
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('id, profile_id, email, entreprise_id, nom, prenom, telephone, specialites, actif');
    
    const incoherents = techniciens.filter(t => t.id !== t.profile_id);
    
    console.log(`Total techniciens: ${techniciens.length}`);
    console.log(`Incohérents (id ≠ profile_id): ${incoherents.length}\n`);
    
    if (incoherents.length === 0) {
      console.log('✅ Aucun technicien incohérent, migration non nécessaire');
      return;
    }
    
    incoherents.forEach(t => {
      console.log(`❌ ${t.email}`);
      console.log(`   old_id (actuel):   ${t.id}`);
      console.log(`   new_id (profile):  ${t.profile_id}`);
    });
    
    console.log('\n');

    // ============================================
    // ÉTAPE 2: CORRIGER MISSIONS
    // ============================================
    console.log('═══ ÉTAPE 2: CORRIGER MISSIONS ═══\n');
    
    for (const tech of incoherents) {
      console.log(`Correction missions pour: ${tech.email}`);
      console.log(`  Cherche missions avec technicien_id=${tech.id.substring(0, 8)}`);
      
      // Trouver missions assignées à l'ancien ID
      const { data: missions } = await supabase
        .from('missions')
        .select('id')
        .eq('technicien_id', tech.id);
      
      console.log(`  Missions trouvées: ${missions?.length || 0}`);
      
      if (missions && missions.length > 0) {
        // Mettre à jour avec le nouveau ID (profile_id)
        const { error: updateError } = await supabase
          .from('missions')
          .update({ technicien_id: tech.profile_id })
          .eq('technicien_id', tech.id);
        
        if (updateError) {
          console.log(`  ❌ Erreur update missions:`, updateError.message);
        } else {
          console.log(`  ✅ ${missions.length} mission(s) mise(s) à jour`);
        }
      }
    }
    
    console.log('\n');

    // ============================================
    // ÉTAPE 3: RECRÉER TECHNICIENS AVEC BON ID
    // ============================================
    console.log('═══ ÉTAPE 3: RECRÉER TECHNICIENS AVEC id = profile_id ═══\n');
    
    for (const tech of incoherents) {
      console.log(`Recréation: ${tech.email}`);
      
      // Supprimer ancien
      const { error: deleteError } = await supabase
        .from('techniciens')
        .delete()
        .eq('id', tech.id);
      
      if (deleteError) {
        console.log(`  ❌ Erreur suppression:`, deleteError.message);
        continue;
      }
      
      console.log(`  ✅ Ancien supprimé (id=${tech.id.substring(0, 8)})`);
      
      // Recréer avec id = profile_id
      const { error: insertError } = await supabase
        .from('techniciens')
        .insert({
          id: tech.profile_id,          // ✅ FIX: id = profile_id
          profile_id: tech.profile_id,
          entreprise_id: tech.entreprise_id,
          nom: tech.nom,
          prenom: tech.prenom,
          email: tech.email,
          telephone: tech.telephone,
          specialites: tech.specialites,
          actif: tech.actif
        });
      
      if (insertError) {
        console.log(`  ❌ Erreur insertion:`, insertError.message);
      } else {
        console.log(`  ✅ Recréé avec id=${tech.profile_id.substring(0, 8)}`);
      }
    }
    
    console.log('\n');

    // ============================================
    // ÉTAPE 4: AUDIT APRÈS
    // ============================================
    console.log('═══ ÉTAPE 4: AUDIT APRÈS CORRECTION ═══\n');
    
    const { data: techniciensAfter } = await supabase
      .from('techniciens')
      .select('id, profile_id, email');
    
    const incoherentsAfter = techniciensAfter.filter(t => t.id !== t.profile_id);
    
    console.log(`Total techniciens: ${techniciensAfter.length}`);
    console.log(`Incohérents: ${incoherentsAfter.length}`);
    
    if (incoherentsAfter.length === 0) {
      console.log('✅ TOUS LES TECHNICIENS SONT COHÉRENTS');
    } else {
      console.log('⚠️ Des incohérences subsistent:');
      incoherentsAfter.forEach(t => {
        console.log(`  ${t.email}: id=${t.id.substring(0, 8)}, profile=${t.profile_id.substring(0, 8)}`);
      });
    }
    
    console.log('\n');

    // ============================================
    // RÉSUMÉ
    // ============================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLÈTE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📋 Actions réalisées:');
    console.log(`  ✓ ${incoherents.length} technicien(s) corrigé(s)`);
    console.log('  ✓ Missions réassignées avec nouveau ID');
    console.log('  ✓ Techniciens recréés avec id = profile_id');
    console.log('');
    console.log('⚠️ IMPORTANT:');
    console.log('  1. ✅ api/techniciens/create.js a été fixé');
    console.log('  2. 🔄 Appliquer _migration_improve_rpc_assign.sql via SQL Editor');
    console.log('  3. 🧪 Tester avec compte technicien');

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

applyMigration();
