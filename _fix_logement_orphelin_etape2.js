#!/usr/bin/env node
/**
 * CORRECTIF - Logement sans immeuble_id
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(60));
console.log('CORRECTIF - Logement sans immeuble_id');
console.log('='.repeat(60));
console.log();

async function fix() {
  // 1. Identifier le logement problématique
  console.log('1️⃣ Identification du logement sans immeuble_id...');
  const { data: logementOrphelin, error: e1 } = await supabase
    .from('logements')
    .select('*')
    .is('immeuble_id', null)
    .single();
  
  if (e1 || !logementOrphelin) {
    console.log('✅ Aucun logement orphelin trouvé');
    return;
  }
  
  console.log(`⚠️ Logement orphelin trouvé :`);
  console.log(`   ID : ${logementOrphelin.id}`);
  console.log(`   Adresse : ${logementOrphelin.adresse || 'N/A'}`);
  console.log(`   Numéro : ${logementOrphelin.numero || 'N/A'}`);
  console.log(`   Étage : ${logementOrphelin.etage || 'N/A'}`);
  console.log();
  
  // 2. Lister les immeubles disponibles
  console.log('2️⃣ Immeubles disponibles :');
  const { data: immeubles, error: e2 } = await supabase
    .from('immeubles')
    .select('*');
  
  if (e2 || !immeubles || immeubles.length === 0) {
    console.log('❌ Aucun immeuble disponible pour rattachement');
    return;
  }
  
  immeubles.forEach((imm, idx) => {
    console.log(`   ${idx + 1}. ${imm.id.substring(0, 8)} - ${imm.adresse} (${imm.nom_residence || 'Sans nom'})`);
  });
  console.log();
  
  // 3. Stratégie de rattachement
  console.log('3️⃣ Stratégie de rattachement :');
  
  // Si le logement a une adresse similaire à un immeuble
  let immeubleCorrespondant = null;
  if (logementOrphelin.adresse) {
    immeubleCorrespondant = immeubles.find(imm => 
      imm.adresse && 
      imm.adresse.toLowerCase().includes(logementOrphelin.adresse.toLowerCase().substring(0, 10))
    );
  }
  
  // Si pas de correspondance par adresse, prendre le premier immeuble
  if (!immeubleCorrespondant) {
    immeubleCorrespondant = immeubles[0];
    console.log(`   ℹ️ Aucune correspondance par adresse`);
    console.log(`   → Rattachement au premier immeuble : ${immeubleCorrespondant.id}`);
  } else {
    console.log(`   ✅ Correspondance trouvée par adresse`);
    console.log(`   → Rattachement à l'immeuble : ${immeubleCorrespondant.id}`);
  }
  console.log();
  
  // 4. Appliquer la correction
  console.log('4️⃣ Application de la correction...');
  const { data: updated, error: e3 } = await supabase
    .from('logements')
    .update({ immeuble_id: immeubleCorrespondant.id })
    .eq('id', logementOrphelin.id)
    .select();
  
  if (e3) {
    console.log(`❌ Erreur lors de la mise à jour : ${e3.message}`);
    return;
  }
  
  console.log('✅ Logement rattaché avec succès !');
  console.log(`   Logement ${logementOrphelin.id} → Immeuble ${immeubleCorrespondant.id}`);
  console.log();
  
  // 5. Vérification
  console.log('5️⃣ Vérification...');
  const { data: verification, error: e4 } = await supabase
    .from('logements')
    .select('*')
    .is('immeuble_id', null);
  
  if (e4) {
    console.log(`❌ Erreur vérification : ${e4.message}`);
    return;
  }
  
  console.log(`✅ Logements sans immeuble_id : ${verification.length}`);
  console.log();
  console.log('='.repeat(60));
  console.log('CORRECTION TERMINÉE');
  console.log('='.repeat(60));
}

fix().catch(console.error);
