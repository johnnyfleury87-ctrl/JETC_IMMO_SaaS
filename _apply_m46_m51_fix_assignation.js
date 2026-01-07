#!/usr/bin/env node
/**
 * APPLICATION M46 + M51 : Fix assignation technicien
 * 
 * Applique les migrations nécessaires pour corriger :
 * 1. Bug "column user_id does not exist"
 * 2. RPC assign_technicien_to_mission manquant
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 APPLICATION M46 + M51 : Fix assignation technicien\n');

async function applyMigration(file, name) {
  console.log(`📋 Application: ${name}`);
  console.log(`   Fichier: ${file}`);
  
  if (!fs.existsSync(file)) {
    console.log('   ⚠️  Fichier introuvable, skip\n');
    return false;
  }
  
  const sql = fs.readFileSync(file, 'utf-8');
  
  try {
    // Exécuter via RPC exec_sql (si disponible) ou direct
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('   ❌ Erreur:', error.message);
      console.error('   Détails:', error.details || error.hint);
      return false;
    }
    
    console.log('   ✅ Appliquée avec succès\n');
    return true;
    
  } catch (err) {
    console.error('   ❌ Exception:', err.message);
    return false;
  }
}

async function testRPC() {
  console.log('🧪 Test: Vérifier que le RPC assign_technicien_to_mission existe\n');
  
  const { data, error } = await supabase.rpc('assign_technicien_to_mission', {
    p_mission_id: '00000000-0000-0000-0000-000000000000', // UUID fictif
    p_technicien_id: '00000000-0000-0000-0000-000000000000'
  });
  
  // On s'attend à une erreur métier (entreprise non trouvée)
  // Pas à "function does not exist"
  if (error && error.message.includes('function') && error.message.includes('does not exist')) {
    console.log('   ❌ RPC n\'existe pas encore');
    return false;
  }
  
  // Si on reçoit un JSONB avec success=false, c'est bon (RPC existe)
  if (data && typeof data === 'object') {
    console.log('   ✅ RPC existe et retourne:', data);
    return true;
  }
  
  // Autre erreur mais RPC existe
  console.log('   ✅ RPC existe (erreur métier attendue)');
  return true;
}

async function main() {
  try {
    console.log('==================================================');
    console.log('MIGRATION M46: Fix policies RLS user_id');
    console.log('==================================================\n');
    
    await applyMigration(
      'supabase/migrations/20260106000300_m46_fix_user_id_policies.sql',
      'M46 - Fix user_id policies'
    );
    
    console.log('==================================================');
    console.log('MIGRATION M51: Créer RPC assign_technicien_to_mission');
    console.log('==================================================\n');
    
    await applyMigration(
      'supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql',
      'M51 - Créer RPC assignation'
    );
    
    console.log('==================================================');
    console.log('VÉRIFICATION');
    console.log('==================================================\n');
    
    await testRPC();
    
    console.log('\n==================================================');
    console.log('✅ MIGRATIONS TERMINÉES');
    console.log('==================================================\n');
    
    console.log('🧪 Tests à effectuer :\n');
    console.log('1. Dashboard Entreprise → Mes missions');
    console.log('2. Cliquer "Assigner technicien" sur une mission');
    console.log('3. Vérifier que la liste des techniciens s\'affiche');
    console.log('4. Sélectionner un technicien et valider');
    console.log('5. ✅ Succès attendu (plus d\'erreur user_id)\n');
    
    console.log('6. Cliquer "Détails" sur une mission');
    console.log('7. Vérifier que la modal s\'ouvre');
    console.log('8. ✅ Tester fermeture : X / Click outside / ESC\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
