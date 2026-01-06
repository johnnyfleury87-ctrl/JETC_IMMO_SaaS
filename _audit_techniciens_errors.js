/**
 * AUDIT COMPLET : DIAGNOSTIC DES ERREURS TECHNICIENS
 * Vérifie la structure DB et les liaisons profiles->entreprises
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditDatabase() {
  console.log('\n🔍 AUDIT COMPLET - DIAGNOSTIC TECHNICIENS\n');
  console.log('='.repeat(60));
  
  // 1️⃣ Vérifier la structure de la table entreprises
  console.log('\n1️⃣ STRUCTURE TABLE ENTREPRISES');
  console.log('-'.repeat(60));
  
  const { data: entreprises, error: entError } = await supabase
    .from('entreprises')
    .select('*')
    .limit(5);
  
  if (entError) {
    console.error('❌ Erreur:', entError.message);
  } else {
    console.log(`✅ ${entreprises.length} entreprises trouvées`);
    if (entreprises.length > 0) {
      console.log('\nColonnes disponibles:', Object.keys(entreprises[0]).join(', '));
      console.log('\nExemple d\'entreprise:');
      entreprises.forEach(ent => {
        console.log(`  - ID: ${ent.id}`);
        console.log(`    Nom: ${ent.nom}`);
        console.log(`    profile_id: ${ent.profile_id || '❌ NULL'}`);
        console.log('');
      });
    }
  }
  
  // 2️⃣ Vérifier les profiles avec role='entreprise'
  console.log('\n2️⃣ PROFILES AVEC ROLE "entreprise"');
  console.log('-'.repeat(60));
  
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, email, role, entreprise_id, created_at')
    .eq('role', 'entreprise');
  
  if (profError) {
    console.error('❌ Erreur:', profError.message);
  } else {
    console.log(`✅ ${profiles.length} profiles entreprise trouvés`);
    profiles.forEach(prof => {
      console.log(`  - Profile ID: ${prof.id}`);
      console.log(`    Email: ${prof.email}`);
      console.log(`    entreprise_id: ${prof.entreprise_id || '❌ NULL'}`);
      console.log('');
    });
  }
  
  // 3️⃣ Vérifier la liaison profiles <-> entreprises
  console.log('\n3️⃣ VÉRIFICATION DES LIAISONS');
  console.log('-'.repeat(60));
  
  if (profiles && profiles.length > 0) {
    for (const prof of profiles) {
      console.log(`\n📋 Profile: ${prof.email} (${prof.id})`);
      
      // Vérifier si une entreprise pointe vers ce profile via profile_id
      const { data: entByProfileId, error: err1 } = await supabase
        .from('entreprises')
        .select('id, nom, profile_id')
        .eq('profile_id', prof.id);
      
      if (entByProfileId && entByProfileId.length > 0) {
        console.log(`  ✅ Entreprise liée via profile_id:`);
        entByProfileId.forEach(e => {
          console.log(`     - ${e.nom} (ID: ${e.id})`);
        });
      } else {
        console.log(`  ❌ AUCUNE entreprise avec profile_id = ${prof.id}`);
      }
      
      // Vérifier si le profile a un entreprise_id
      if (prof.entreprise_id) {
        const { data: entById, error: err2 } = await supabase
          .from('entreprises')
          .select('id, nom, profile_id')
          .eq('id', prof.entreprise_id);
        
        if (entById && entById.length > 0) {
          console.log(`  ✅ Profile pointe vers entreprise_id: ${entById[0].nom}`);
          if (entById[0].profile_id === prof.id) {
            console.log(`     ✅ LIAISON BIDIRECTIONNELLE OK`);
          } else {
            console.log(`     ⚠️ profile_id ne correspond pas (${entById[0].profile_id})`);
          }
        } else {
          console.log(`  ❌ entreprise_id ${prof.entreprise_id} introuvable`);
        }
      } else {
        console.log(`  ⚠️ Profile n'a pas de entreprise_id`);
      }
    }
  }
  
  // 4️⃣ Vérifier auth.users
  console.log('\n\n4️⃣ VÉRIFICATION AUTH.USERS');
  console.log('-'.repeat(60));
  
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Erreur:', authError.message);
  } else {
    console.log(`✅ ${authUsers.users.length} utilisateurs auth trouvés`);
    
    // Filtrer les entreprises
    const entrepriseUsers = authUsers.users.filter(u => {
      const prof = profiles?.find(p => p.id === u.id);
      return prof?.role === 'entreprise';
    });
    
    console.log(`\n👔 ${entrepriseUsers.length} utilisateurs avec role entreprise:`);
    entrepriseUsers.forEach(user => {
      const prof = profiles?.find(p => p.id === user.id);
      console.log(`  - ${user.email}`);
      console.log(`    Auth ID: ${user.id}`);
      console.log(`    Profile exists: ${prof ? '✅' : '❌'}`);
      console.log(`    entreprise_id dans profile: ${prof?.entreprise_id || '❌ NULL'}`);
      console.log('');
    });
  }
  
  // 5️⃣ Diagnostic final
  console.log('\n5️⃣ DIAGNOSTIC FINAL');
  console.log('='.repeat(60));
  
  let hasIssues = false;
  
  if (profiles && profiles.length > 0) {
    for (const prof of profiles) {
      const { data: entByProfileId } = await supabase
        .from('entreprises')
        .select('id')
        .eq('profile_id', prof.id);
      
      if (!entByProfileId || entByProfileId.length === 0) {
        hasIssues = true;
        console.log(`\n❌ PROBLÈME DÉTECTÉ:`);
        console.log(`   Profile: ${prof.email} (${prof.id})`);
        console.log(`   Aucune entreprise avec profile_id = ${prof.id}`);
        console.log(`\n   💡 SOLUTION: Exécuter SQL de correction pour lier une entreprise`);
      }
      
      if (!prof.entreprise_id) {
        hasIssues = true;
        console.log(`\n⚠️ ATTENTION:`);
        console.log(`   Profile: ${prof.email} (${prof.id})`);
        console.log(`   Le champ entreprise_id est NULL`);
        console.log(`\n   💡 SOLUTION: Mettre à jour profiles.entreprise_id`);
      }
    }
  }
  
  if (!hasIssues) {
    console.log('\n✅ Aucun problème détecté dans les liaisons');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ AUDIT TERMINÉ\n');
}

auditDatabase().catch(console.error);
