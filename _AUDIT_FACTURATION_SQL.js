/**
 * AUDIT SQL DIRECT - FACTURATION
 * Vérifier via requêtes SQL directes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const results = {
  timestamp: new Date().toISOString(),
  checks: {}
};

async function execSQL(sql, description) {
  console.log(`\n--- ${description} ---`);
  console.log(`SQL: ${sql.substring(0, 100)}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return { error: error.message };
    }
    
    console.log('✅ Résultat:', JSON.stringify(data, null, 2));
    return { data };
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return { error: err.message };
  }
}

async function main() {
  console.log('🔍 AUDIT SQL DIRECT FACTURATION\n');
  
  // 1. Vérifier les factures existantes
  const r1 = await execSQL(
    `SELECT id, mission_id, entreprise_id, numero, statut, montant_ttc, iban, created_at FROM factures ORDER BY created_at DESC LIMIT 10;`,
    '1. Liste des factures'
  );
  results.checks.factures = r1;
  
  // 2. Vérifier les missions terminées
  const r2 = await execSQL(
    `SELECT id, statut, entreprise_id, ticket_id, created_at FROM missions WHERE statut = 'terminee' ORDER BY created_at DESC LIMIT 5;`,
    '2. Missions terminées'
  );
  results.checks.missions_terminees = r2;
  
  // 3. Vérifier la relation mission → facture
  const r3 = await execSQL(
    `SELECT m.id as mission_id, m.statut as mission_statut, f.id as facture_id, f.numero, f.statut as facture_statut 
     FROM missions m 
     LEFT JOIN factures f ON f.mission_id = m.id 
     WHERE m.statut = 'terminee'
     ORDER BY m.created_at DESC LIMIT 5;`,
    '3. Relation missions → factures'
  );
  results.checks.relation_mission_facture = r3;
  
  // 4. Vérifier les RLS policies sur factures
  const r4 = await execSQL(
    `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
     FROM pg_policies 
     WHERE tablename = 'factures' 
     ORDER BY policyname;`,
    '4. RLS Policies factures'
  );
  results.checks.rls_policies = r4;
  
  // 5. Vérifier les fonctions RPC de facturation
  const r5 = await execSQL(
    `SELECT routine_name, routine_type, routine_definition 
     FROM information_schema.routines 
     WHERE routine_schema = 'public' 
     AND routine_name IN ('editer_facture', 'envoyer_facture', 'valider_paiement_facture', 'refuser_facture')
     ORDER BY routine_name;`,
    '5. Fonctions RPC facturation'
  );
  results.checks.rpc_functions = r5;
  
  // 6. Vérifier si RLS est activé sur factures
  const r6 = await execSQL(
    `SELECT tablename, rowsecurity 
     FROM pg_tables 
     WHERE schemaname = 'public' 
     AND tablename = 'factures';`,
    '6. RLS activé sur factures'
  );
  results.checks.rls_enabled = r6;
  
  // 7. Vérifier les triggers sur missions/factures
  const r7 = await execSQL(
    `SELECT event_object_table, trigger_name, event_manipulation, action_statement 
     FROM information_schema.triggers 
     WHERE event_object_table IN ('missions', 'factures')
     ORDER BY event_object_table, trigger_name;`,
    '7. Triggers missions/factures'
  );
  results.checks.triggers = r7;
  
  // Sauvegarder
  fs.writeFileSync('_AUDIT_FACTURATION_SQL_RESULTS.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Résultats sauvegardés: _AUDIT_FACTURATION_SQL_RESULTS.json');
}

main().catch(console.error);
