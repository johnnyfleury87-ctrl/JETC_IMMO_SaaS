#!/usr/bin/env node
/**
 * VÉRIFICATION RLS EN BASE - ÉTAPE 4
 * Connecte directement à PostgreSQL pour vérifier les policies
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(70));
console.log('VÉRIFICATION RLS EN BASE - ÉTAPE 4');
console.log('='.repeat(70));
console.log();

async function checkRLSViaSQL() {
  console.log('🔍 Vérification directe via SQL');
  console.log('-'.repeat(70));
  
  // 1. Vérifier si RLS est activé sur les tables
  console.log('\n1. Tables avec RLS activé :');
  
  const tables = [
    'missions',
    'tickets',
    'techniciens',
    'entreprises',
    'regies',
    'logements',
    'locataires',
    'immeubles',
    'factures'
  ];
  
  for (const table of tables) {
    try {
      // Utiliser une connexion avec ANON key pour vérifier le RLS
      const anonClient = createClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
      );
      
      const { data, error, count } = await anonClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.message.includes('row-level security') || 
            error.message.includes('policy') ||
            error.message.includes('permission denied')) {
          console.log(`  ✅ ${table.padEnd(25)} : RLS activé (accès refusé sans auth)`);
        } else {
          console.log(`  ⚠️  ${table.padEnd(25)} : Erreur - ${error.message.substring(0, 30)}...`);
        }
      } else {
        // Si on peut accéder, c'est soit RLS désactivé, soit policy publique
        console.log(`  ❌ ${table.padEnd(25)} : Accessible sans authentification ! (${count} lignes)`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${table.padEnd(25)} : Exception - ${err.message}`);
    }
  }
  
  console.log();
  
  // 2. Lister les policies de la table missions
  console.log('2. Policies sur la table MISSIONS :');
  console.log();
  
  try {
    // Requête directe SQL via RPC si disponible
    const { data: policies } = await supabase
      .rpc('get_policies_for_table', { table_name: 'missions' })
      .catch(() => ({ data: null }));
    
    if (policies) {
      console.log(`  Trouvées : ${policies.length} policies`);
      policies.forEach(p => {
        console.log(`    - ${p.policyname} (${p.cmd})`);
      });
    } else {
      console.log('  ℹ️  Fonction RPC get_policies_for_table non disponible');
      console.log('  → Vérifier manuellement dans Supabase Dashboard > Database > Policies');
    }
  } catch (err) {
    console.log(`  ℹ️  Impossible de lire les policies via RPC`);
  }
  
  console.log();
  
  // 3. Test d'isolation technicien
  console.log('3. Test isolation TECHNICIEN :');
  console.log();
  
  // Récupérer un technicien de test
  const { data: techniciens } = await supabase
    .from('techniciens')
    .select('id, profile_id')
    .limit(1);
  
  if (techniciens && techniciens.length > 0) {
    const tech = techniciens[0];
    console.log(`  Technicien test : ${tech.id.substring(0, 8)}...`);
    console.log(`  Profile ID : ${tech.profile_id.substring(0, 8)}...`);
    console.log();
    
    // Compter les missions totales (admin)
    const { count: totalMissions } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  Missions totales (vue admin) : ${totalMissions}`);
    
    // Compter les missions assignées à ce technicien
    const { count: assignedMissions } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('technicien_id', tech.id);
    
    console.log(`  Missions assignées au technicien : ${assignedMissions}`);
    
    if (assignedMissions < totalMissions) {
      console.log(`  ✅ Le technicien ne devrait voir que ${assignedMissions} mission(s)`);
      console.log(`  → À vérifier depuis le dashboard technicien avec authentification`);
    } else if (totalMissions === assignedMissions && totalMissions > 0) {
      console.log(`  ⚠️  Toutes les missions sont assignées au même technicien`);
    } else {
      console.log(`  ℹ️  Aucune mission à tester`);
    }
  } else {
    console.log('  ℹ️  Aucun technicien disponible pour test');
  }
  
  console.log();
  
  // 4. Résumé et recommandations
  console.log('='.repeat(70));
  console.log('RÉSUMÉ ET ACTIONS');
  console.log('='.repeat(70));
  console.log();
  console.log('✅ Policies RLS définies dans les fichiers SQL :');
  console.log('   - supabase/schema/13_missions.sql');
  console.log('   - supabase/schema/11_techniciens.sql');
  console.log('   - supabase/schema/15_facturation.sql');
  console.log('   - etc.');
  console.log();
  console.log('🔍 Vérifications à effectuer :');
  console.log('   1. Supabase Dashboard > Database > Tables > missions > Policies');
  console.log('      → Vérifier que les policies sont listées');
  console.log();
  console.log('   2. Tester depuis le dashboard technicien :');
  console.log('      → Se connecter comme technicien');
  console.log('      → Vérifier que seules SES missions sont visibles');
  console.log();
  console.log('   3. Tester depuis le dashboard entreprise :');
  console.log('      → Se connecter comme entreprise');
  console.log('      → Vérifier que seules les missions de SES techniciens sont visibles');
  console.log();
  console.log('   4. Si policies non appliquées :');
  console.log('      → Exécuter les migrations SQL dans Supabase SQL Editor');
  console.log('      → Fichier : supabase/schema/13_missions.sql (à partir de ligne 186)');
  console.log();
}

checkRLSViaSQL().catch(console.error);
