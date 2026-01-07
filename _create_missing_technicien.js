#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMissingTechnicien() {
  console.log('===== CRÉATION ENTRÉE TECHNICIEN MANQUANTE =====\n');
  
  const profileId = '3196179e-5258-457f-b31f-c88a4760ebe0';
  
  // 1. Vérifier le profile
  console.log('1️⃣  Vérification du profile...\n');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, nom, prenom, role')
    .eq('id', profileId)
    .single();
  
  if (profileError || !profile) {
    console.error('❌ Profile non trouvé:', profileError);
    return;
  }
  
  console.log('Profile :', profile.email);
  console.log('Role    :', profile.role);
  console.log('Nom     :', profile.nom, profile.prenom);
  
  // 2. Vérifier si technicien existe déjà
  console.log('\n2️⃣  Vérification table techniciens...\n');
  const { data: existingTech, error: checkError } = await supabase
    .from('techniciens')
    .select('id, user_id, entreprise_id')
    .eq('user_id', profileId)
    .maybeSingle();
  
  if (existingTech) {
    console.log('✅ Technicien existe déjà!');
    console.log('ID:', existingTech.id);
    console.log('Entreprise:', existingTech.entreprise_id);
    return;
  }
  
  console.log('❌ Technicien absent de la table');
  
  // 3. Trouver une entreprise pour l'associer
  console.log('\n3️⃣  Recherche entreprise...\n');
  const { data: entreprises, error: entError } = await supabase
    .from('entreprises')
    .select('id, nom')
    .limit(1);
  
  if (entError || !entreprises || entreprises.length === 0) {
    console.error('❌ Aucune entreprise trouvée');
    console.log('   Création impossible sans entreprise associée');
    return;
  }
  
  const entrepriseId = entreprises[0].id;
  console.log('Entreprise trouvée:', entreprises[0].nom);
  console.log('ID:', entrepriseId.substring(0, 13) + '...');
  
  // 4. Créer l'entrée technicien
  console.log('\n4️⃣  Création entrée techniciens...\n');
  
  const { data: newTech, error: createError } = await supabase
    .from('techniciens')
    .insert({
      user_id: profileId,
      entreprise_id: entrepriseId,
      nom: profile.nom || 'Technicien',
      prenom: profile.prenom || 'Demo',
      telephone: '+33600000000',
      specialites: ['plomberie', 'électricité'],
      statut: 'actif'
    })
    .select()
    .single();
  
  if (createError) {
    console.error('❌ Erreur création:', createError);
    return;
  }
  
  console.log('✅ Technicien créé avec succès!');
  console.log('ID:', newTech.id);
  console.log('User ID:', newTech.user_id);
  console.log('Entreprise:', newTech.entreprise_id);
  
  // 5. Vérifier la mission
  console.log('\n5️⃣  Mise à jour de la mission...\n');
  const { data: missions } = await supabase
    .from('missions')
    .select('id, technicien_id')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (missions && missions.length > 0) {
    const mission = missions[0];
    
    // Si la mission a un technicien_id qui correspond au profile
    if (mission.technicien_id === profileId) {
      console.log('⚠️  La mission référence directement le profile_id');
      console.log('    Correction : mise à jour vers le nouveau technicien_id');
      
      const { error: updateError } = await supabase
        .from('missions')
        .update({ technicien_id: newTech.id })
        .eq('id', mission.id);
      
      if (updateError) {
        console.error('❌ Erreur update mission:', updateError);
      } else {
        console.log('✅ Mission mise à jour avec le bon technicien_id');
      }
    } else {
      console.log('ℹ️  Mission déjà correctement référencée');
    }
  }
  
  console.log('\n===== TERMINÉ =====');
}

fixMissingTechnicien().catch(console.error);
