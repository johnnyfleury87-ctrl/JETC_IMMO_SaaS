#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔧 Création mission de test\n');
  
  // 1. Trouver ou créer une entreprise
  let { data: entreprise } = await supabase
    .from('entreprises')
    .select('id, nom')
    .limit(1)
    .single();
  
  if (!entreprise) {
    console.log('Création entreprise test...');
    const { data: newEnt } = await supabase
      .from('entreprises')
      .insert({ nom: 'Entreprise Test' })
      .select()
      .single();
    entreprise = newEnt;
  }
  
  console.log('✅ Entreprise:', entreprise.nom, entreprise.id);
  
  // 2. Associer technicien test à l'entreprise
  const techId = '5ebad9e5-4a91-4ace-be25-248a1b34125b';
  
  const { data: existingTech } = await supabase
    .from('techniciens')
    .select('id')
    .eq('profile_id', techId)
    .single();
  
  if (!existingTech) {
    console.log('Création fiche technicien...');
    await supabase
      .from('techniciens')
      .insert({
        profile_id: techId,
        entreprise_id: entreprise.id,
        nom: 'Test',
        prenom: 'Tech',
        email: 'tech.test@jetc.ch',
        specialites: ['plomberie']
      });
  }
  
  // 3. Trouver un ticket existant
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .limit(1)
    .single();
  
  if (!ticket) {
    console.log('❌ Aucun ticket disponible en base');
    process.exit(1);
  }
  
  console.log('✅ Ticket:', ticket.id);
  
  // 4. Créer une mission en_attente
  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
      ticket_id: ticket.id,
      entreprise_id: entreprise.id,
      technicien_id: techId,
      statut: 'en_attente'
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Mission créée:', mission.id);
  console.log('   Statut:', mission.statut);
  console.log('   Technicien:', mission.technicien_id);
  console.log('\n🧪 Commande test:');
  console.log(`curl -X POST http://localhost:3000/api/missions/start \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -H 'Authorization: Bearer [TOKEN]' \\`);
  console.log(`  -d '{"mission_id":"${mission.id}"}'`);
  
})();
