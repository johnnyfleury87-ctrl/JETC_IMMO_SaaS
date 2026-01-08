#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Vérification ENUM mission_status en base\n');

// Méthode : Essayer d'insérer une mission test avec chaque statut
async function testStatuts() {
  const statutsATest = ['en_attente', 'planifiee', 'planifiée', 'en_cours', 'terminee'];
  
  console.log('Test des statuts possibles:\n');
  
  for (const statut of statutsATest) {
    // Essayer de sélectionner des missions avec ce statut
    const { data, error } = await supabase
      .from('missions')
      .select('id, statut')
      .eq('statut', statut)
      .limit(1);
    
    if (error) {
      console.log(`❌ "${statut}": ${error.message}`);
    } else {
      console.log(`✅ "${statut}": valide (${data?.length || 0} missions trouvées)`);
    }
  }
  
  // Vérifier les statuts existants
  console.log('\n📊 Statuts actuellement en base:\n');
  
  const { data: missions, error: missionsError } = await supabase
    .from('missions')
    .select('statut')
    .limit(100);
  
  if (!missionsError && missions) {
    const uniques = [...new Set(missions.map(m => m.statut))];
    console.log('Statuts trouvés:', uniques.join(', '));
  }
}

testStatuts().catch(console.error);
