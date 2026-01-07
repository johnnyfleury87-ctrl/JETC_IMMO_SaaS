// =====================================================
// ROLLBACK V1 + APPLY V2 - FIX RÉCURSION INFINIE
// =====================================================
// Ce script:
// 1. Supprime les policies V1 (récursion infinie)
// 2. Applique les policies V2 (SECURITY DEFINER functions)
// 3. Teste le résultat avec compte technicien
// =====================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables manquantes: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔧 ROLLBACK V1 + APPLY V2 - FIX RÉCURSION INFINIE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Lire le fichier SQL V2
  const migrationSQL = fs.readFileSync('_migration_rls_techniciens_tickets_v2.sql', 'utf8');

  console.log('📄 Lecture migration V2...');
  console.log(`   Taille: ${migrationSQL.length} caractères\n`);

  console.log('🚀 Exécution migration via service_role...\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ ERREUR lors de l\'exécution:');
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      process.exit(1);
    }

    console.log('✅ Migration V2 appliquée avec succès!\n');

  } catch (err) {
    console.error('❌ Exception:', err.message);
    
    // Fallback: afficher le SQL pour copier/coller manuellement
    console.log('\n⚠️ Impossible d\'exécuter via RPC.');
    console.log('📋 COPIER/COLLER CE SQL DANS SUPABASE SQL EDITOR:\n');
    console.log('─────────────────────────────────────────────────────────');
    console.log(migrationSQL);
    console.log('─────────────────────────────────────────────────────────\n');
    process.exit(1);
  }

  // Test avec compte technicien
  console.log('═══ TEST AVEC COMPTE TECHNICIEN ═══\n');

  const testEmail = 'demo.technicien@test.app';
  const testPassword = 'Demo1234!';

  console.log(`🔑 Login: ${testEmail}...`);

  const supabaseClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authError) {
    console.error('❌ Erreur login:', authError.message);
    process.exit(1);
  }

  console.log('✅ Login OK');
  console.log(`   auth.uid(): ${authData.user.id}\n`);

  // Test 1: Accès direct tickets
  console.log('--- Test 1: Accès direct table tickets ---');
  
  const { data: tickets, error: ticketsError } = await supabaseClient
    .from('tickets')
    .select('id, categorie')
    .limit(1);

  if (ticketsError) {
    console.error('❌ ERREUR:', ticketsError.message);
    console.error('   Code:', ticketsError.code);
  } else {
    console.log('✅ Accès tickets OK');
    console.log('   Nombre:', tickets.length);
    if (tickets.length > 0) {
      console.log('   Premier ticket:', tickets[0].id.substring(0, 8));
      console.log('   Catégorie:', tickets[0].categorie);
    }
  }

  // Test 2: Mission avec JOIN ticket
  console.log('\n--- Test 2: Mission avec JOIN ticket (comme dashboard) ---');

  const { data: missions, error: missionsError } = await supabaseClient
    .from('missions')
    .select(`
      id,
      ticket_id,
      ticket:tickets(
        id,
        categorie,
        sous_categorie,
        locataire:locataires(nom, prenom),
        logement:logements(adresse, ville)
      )
    `)
    .eq('technicien_id', '3196179e-5258-457f-b31f-c88a4760ebe0')
    .limit(1);

  if (missionsError) {
    console.error('❌ ERREUR:', missionsError.message);
    console.error('   Code:', missionsError.code);
  } else if (!missions || missions.length === 0) {
    console.log('⚠️ Aucune mission trouvée');
  } else {
    const mission = missions[0];
    console.log('✅ Mission récupérée');
    console.log('   Mission ID:', mission.id.substring(0, 8));
    console.log('   Ticket ID:', mission.ticket_id?.substring(0, 8));
    
    if (mission.ticket) {
      console.log('   ✅ mission.ticket: PRÉSENT');
      console.log('      Catégorie:', mission.ticket.categorie);
      console.log('      Locataire:', mission.ticket.locataire ? 'PRÉSENT' : 'NULL');
      console.log('      Logement:', mission.ticket.logement ? 'PRÉSENT' : 'NULL');
    } else {
      console.log('   ❌ mission.ticket: NULL (PROBLÈME PERSISTE)');
    }
  }

  // Test 3: Vérifier fonctions créées
  console.log('\n--- Test 3: Vérification fonctions SECURITY DEFINER ---');

  const { data: functions, error: funcError } = await supabase
    .rpc('exec_sql', { 
      sql: `
        SELECT proname, prosecdef
        FROM pg_proc
        WHERE proname LIKE 'technicien_can_view_%'
        ORDER BY proname;
      `
    });

  if (funcError) {
    console.log('⚠️ Impossible de vérifier les fonctions');
  } else {
    console.log('✅ Fonctions SECURITY DEFINER:');
    if (functions && functions.length > 0) {
      functions.forEach(f => {
        console.log(`   ✓ ${f.proname} (SECURITY DEFINER: ${f.prosecdef})`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ SCRIPT TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

applyMigration().catch(err => {
  console.error('💥 Erreur fatale:', err);
  process.exit(1);
});
