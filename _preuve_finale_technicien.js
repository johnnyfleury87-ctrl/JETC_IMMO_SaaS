/**
 * =====================================================
 * PREUVE FINALE - TECHNICIEN VOIT SES MISSIONS
 * =====================================================
 * Simule un login technicien et vérifie la visibilité
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Client anon (comme le frontend)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Client service (pour vérification)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function preuveFinale() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ PREUVE FINALE - TECHNICIEN VOIT SES MISSIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // ========================================
    // ÉTAPE 1: Login technicien
    // ========================================
    console.log('═══ ÉTAPE 1: LOGIN TECHNICIEN ═══\n');
    
    const email = 'demo.technicien@test.app';
    const password = 'Demo1234!';
    
    console.log(`Login avec: ${email}`);
    
    const { data: authData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    });
    
    if (loginError) {
      console.log('❌ Erreur login:', loginError.message);
      console.log('⚠️ Ce compte existe-t-il encore ? Vérifier avec admin.');
      return;
    }
    
    console.log('✅ Login réussi');
    console.log(`   User ID (auth.uid): ${authData.user.id}`);
    console.log('');

    // ========================================
    // ÉTAPE 2: Vérifier profile/technicien
    // ========================================
    console.log('═══ ÉTAPE 2: VÉRIFICATION PROFILE/TECHNICIEN ═══\n');
    
    const userId = authData.user.id;
    
    // Via admin (pour debug)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();
    
    console.log(`Profile: ${profile?.email} (${profile?.role})`);
    
    const { data: technicien } = await supabaseAdmin
      .from('techniciens')
      .select('id, profile_id, email')
      .eq('profile_id', userId)
      .single();
    
    if (technicien) {
      console.log(`Technicien:`);
      console.log(`   id:         ${technicien.id}`);
      console.log(`   profile_id: ${technicien.profile_id}`);
      console.log(`   ${technicien.id === technicien.profile_id ? '✅ id == profile_id' : '❌ INCOHÉRENT'}`);
    } else {
      console.log('❌ Aucun technicien trouvé pour ce profile_id');
    }
    
    console.log('');

    // ========================================
    // ÉTAPE 3: Missions visibles (RLS actif)
    // ========================================
    console.log('═══ ÉTAPE 3: MISSIONS VISIBLES (avec RLS) ═══\n');
    
    // Via client anon (RLS actif)
    const { data: missionsRLS, error: rlsError } = await supabaseAnon
      .from('missions')
      .select(`
        id,
        statut,
        technicien_id,
        ticket:tickets(
          id,
          categorie,
          description,
          locataire:locataires(nom, prenom, telephone)
        )
      `);
    
    if (rlsError) {
      console.log('❌ Erreur RLS:', rlsError.message);
    } else {
      console.log(`✅ Missions visibles: ${missionsRLS?.length || 0}`);
      
      if (missionsRLS && missionsRLS.length > 0) {
        missionsRLS.forEach((m, idx) => {
          console.log(`\n${idx + 1}. Mission ${m.id.substring(0, 8)} (${m.statut})`);
          console.log(`   technicien_id: ${m.technicien_id?.substring(0, 8)}`);
          
          if (m.ticket) {
            console.log(`   Ticket: ${m.ticket.categorie}`);
            console.log(`   Description: ${m.ticket.description?.substring(0, 50)}...`);
            
            if (m.ticket.locataire) {
              console.log(`   Locataire: ${m.ticket.locataire.prenom} ${m.ticket.locataire.nom}`);
              console.log(`   Tel: ${m.ticket.locataire.telephone}`);
            }
          }
        });
      } else {
        console.log('⚠️ Aucune mission visible');
        console.log('   Causes possibles:');
        console.log('   - Aucune mission assignée à ce technicien');
        console.log('   - RLS policy ne matche pas');
      }
    }
    
    console.log('\n');

    // ========================================
    // ÉTAPE 4: Comparaison avec service_role
    // ========================================
    console.log('═══ ÉTAPE 4: COMPARAISON AVEC SERVICE_ROLE ═══\n');
    
    if (technicien) {
      const { data: missionsAdmin } = await supabaseAdmin
        .from('missions')
        .select('id, statut, technicien_id')
        .eq('technicien_id', technicien.id);
      
      console.log(`Missions assignées (service_role): ${missionsAdmin?.length || 0}`);
      console.log(`Missions visibles (RLS anon):      ${missionsRLS?.length || 0}`);
      
      if ((missionsAdmin?.length || 0) === (missionsRLS?.length || 0)) {
        console.log('✅ PARFAIT: RLS fonctionne correctement');
      } else {
        console.log('⚠️ ÉCART détecté:');
        console.log(`   ${(missionsAdmin?.length || 0) - (missionsRLS?.length || 0)} mission(s) cachée(s) par RLS`);
      }
    }
    
    console.log('\n');

    // ========================================
    // RÉSUMÉ
    // ========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ PREUVE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const nbMissions = missionsRLS?.length || 0;
    
    if (nbMissions > 0) {
      console.log('✅ LE TECHNICIEN VOIT SES MISSIONS !');
      console.log(`   ${nbMissions} mission(s) visible(s)`);
      console.log('   Avec toutes les infos: ticket, locataire, etc.');
      console.log('');
      console.log('🎉 PROBLÈME RÉSOLU');
    } else {
      console.log('⚠️ Aucune mission visible');
      console.log('   Vérifier:');
      console.log('   1. Qu\'une mission est assignée à ce technicien');
      console.log('   2. Que technicien.id == profile_id');
      console.log('   3. Que la policy RLS existe et est correcte');
    }
    
    // Cleanup: logout
    await supabaseAnon.auth.signOut();

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

preuveFinale();
