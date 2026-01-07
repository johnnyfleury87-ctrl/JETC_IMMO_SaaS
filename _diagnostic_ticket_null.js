/**
 * DIAGNOSTIC COMPLET - POURQUOI mission.ticket EST NULL
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Service role (admin)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Anon (comme le frontend)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnosticTicketNull() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC - POURQUOI mission.ticket EST NULL');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // ========================================
    // ÉTAPE 1: Vérifier données brutes (admin)
    // ========================================
    console.log('═══ ÉTAPE 1: VÉRIFICATION DONNÉES (service_role) ═══\n');
    
    const { data: missions } = await supabaseAdmin
      .from('missions')
      .select('id, technicien_id, ticket_id, statut')
      .not('ticket_id', 'is', null)
      .limit(1);
    
    if (!missions || missions.length === 0) {
      console.log('⚠️ Aucune mission avec ticket_id trouvée');
      return;
    }
    
    const mission = missions[0];
    console.log(`Mission: ${mission.id.substring(0, 8)}`);
    console.log(`  ticket_id: ${mission.ticket_id.substring(0, 8)}`);
    console.log(`  technicien_id: ${mission.technicien_id?.substring(0, 8) || 'NULL'}`);
    console.log('');
    
    // Vérifier que le ticket existe
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('id, categorie, sous_categorie, description, locataire_id, logement_id')
      .eq('id', mission.ticket_id)
      .single();
    
    if (!ticket) {
      console.log('❌ Ticket introuvable en DB');
      return;
    }
    
    console.log(`✅ Ticket existe: ${ticket.categorie}`);
    console.log(`   locataire_id: ${ticket.locataire_id?.substring(0, 8) || 'NULL'}`);
    console.log(`   logement_id: ${ticket.logement_id?.substring(0, 8) || 'NULL'}`);
    console.log('');

    // ========================================
    // ÉTAPE 2: Tester requête avec JOIN (admin)
    // ========================================
    console.log('═══ ÉTAPE 2: TEST JOIN AVEC service_role ═══\n');
    
    const { data: missionWithTicket, error: joinError } = await supabaseAdmin
      .from('missions')
      .select(`
        id,
        ticket_id,
        ticket:tickets(
          id,
          categorie,
          sous_categorie,
          description,
          locataire:locataires(nom, prenom, telephone),
          logement:logements(adresse, npa, ville)
        )
      `)
      .eq('id', mission.id)
      .single();
    
    if (joinError) {
      console.log('❌ Erreur JOIN (service_role):', joinError.message);
    } else {
      console.log('✅ JOIN fonctionne avec service_role');
      console.log(`   mission.ticket:`, missionWithTicket.ticket ? 'PRÉSENT' : 'NULL');
      
      if (missionWithTicket.ticket) {
        console.log(`   ticket.id: ${missionWithTicket.ticket.id?.substring(0, 8)}`);
        console.log(`   ticket.categorie: ${missionWithTicket.ticket.categorie}`);
        console.log(`   ticket.locataire:`, missionWithTicket.ticket.locataire ? 'PRÉSENT' : 'NULL');
        console.log(`   ticket.logement:`, missionWithTicket.ticket.logement ? 'PRÉSENT' : 'NULL');
      }
    }
    
    console.log('');

    // ========================================
    // ÉTAPE 3: Login technicien et tester
    // ========================================
    console.log('═══ ÉTAPE 3: TEST AVEC COMPTE TECHNICIEN (RLS actif) ═══\n');
    
    // Login avec compte technicien
    const { data: authData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
      email: 'demo.technicien@test.app',
      password: 'Demo1234!'
    });
    
    if (loginError) {
      console.log('❌ Erreur login technicien:', loginError.message);
      return;
    }
    
    console.log(`✅ Login technicien: ${authData.user.email}`);
    console.log(`   auth.uid(): ${authData.user.id.substring(0, 8)}`);
    console.log('');

    // Test 1: Accès direct tickets
    console.log('--- Test 1: Accès direct table tickets ---');
    
    const { data: ticketDirect, error: ticketError } = await supabaseAnon
      .from('tickets')
      .select('id, categorie, sous_categorie, description')
      .eq('id', mission.ticket_id)
      .single();
    
    if (ticketError) {
      console.log('❌ ERREUR RLS sur tickets:');
      console.log(`   Code: ${ticketError.code}`);
      console.log(`   Message: ${ticketError.message}`);
      console.log('   → Le technicien NE PEUT PAS lire la table tickets');
    } else if (!ticketDirect) {
      console.log('⚠️ Requête OK mais ticket NULL (RLS bloque la ligne)');
    } else {
      console.log('✅ Accès direct tickets OK');
      console.log(`   Ticket: ${ticketDirect.categorie}`);
    }
    
    console.log('');

    // Test 2: Mission avec JOIN ticket (comme le front)
    console.log('--- Test 2: Mission avec JOIN ticket (comme dashboard.html) ---');
    
    const { data: missionAsUser, error: missionError } = await supabaseAnon
      .from('missions')
      .select(`
        id,
        ticket_id,
        statut,
        ticket:tickets(
          id,
          categorie,
          sous_categorie,
          description,
          locataire:locataires(nom, prenom, telephone),
          logement:logements(adresse, npa, ville)
        )
      `)
      .eq('id', mission.id)
      .single();
    
    if (missionError) {
      console.log('❌ Erreur requête mission:');
      console.log(`   Code: ${missionError.code}`);
      console.log(`   Message: ${missionError.message}`);
    } else {
      console.log('✅ Requête mission OK');
      console.log(`   mission.ticket_id: ${missionAsUser.ticket_id?.substring(0, 8)}`);
      console.log(`   mission.ticket: ${missionAsUser.ticket ? 'PRÉSENT ✅' : 'NULL ❌'}`);
      
      if (!missionAsUser.ticket && missionAsUser.ticket_id) {
        console.log('');
        console.log('🚨 PROBLÈME IDENTIFIÉ:');
        console.log('   ticket_id existe MAIS ticket (join) est NULL');
        console.log('   → RLS bloque le JOIN vers tickets');
      }
    }
    
    console.log('');

    // Test 3: Accès locataires
    console.log('--- Test 3: Accès table locataires ---');
    
    if (ticket.locataire_id) {
      const { data: locataire, error: locataireError } = await supabaseAnon
        .from('locataires')
        .select('id, nom, prenom, telephone')
        .eq('id', ticket.locataire_id)
        .single();
      
      if (locataireError) {
        console.log('❌ ERREUR RLS sur locataires:');
        console.log(`   Message: ${locataireError.message}`);
      } else if (!locataire) {
        console.log('⚠️ RLS bloque la ligne locataire');
      } else {
        console.log('✅ Accès locataires OK');
      }
    }
    
    console.log('');

    // Test 4: Accès logements
    console.log('--- Test 4: Accès table logements ---');
    
    if (ticket.logement_id) {
      const { data: logement, error: logementError } = await supabaseAnon
        .from('logements')
        .select('id, adresse, npa, ville')
        .eq('id', ticket.logement_id)
        .single();
      
      if (logementError) {
        console.log('❌ ERREUR RLS sur logements:');
        console.log(`   Message: ${logementError.message}`);
      } else if (!logement) {
        console.log('⚠️ RLS bloque la ligne logement');
      } else {
        console.log('✅ Accès logements OK');
      }
    }
    
    console.log('');

    // ========================================
    // ÉTAPE 4: Vérifier RLS policies
    // ========================================
    console.log('═══ ÉTAPE 4: VÉRIFICATION RLS POLICIES ═══\n');
    
    // Lister policies sur tickets
    const { data: ticketPolicies } = await supabaseAdmin.rpc('exec_sql', {
      query: `
        SELECT policyname, cmd, roles, qual
        FROM pg_policies
        WHERE tablename = 'tickets'
        ORDER BY policyname;
      `
    }).catch(() => ({ data: null }));
    
    if (ticketPolicies && ticketPolicies.length > 0) {
      console.log('Policies sur table tickets:');
      ticketPolicies.forEach(p => {
        console.log(`  - ${p.policyname} (${p.cmd}) [${p.roles}]`);
      });
    } else {
      console.log('⚠️ Impossible de lire pg_policies (faire manuellement)');
      console.log('   Requête SQL à exécuter dans SQL Editor:');
      console.log('   SELECT * FROM pg_policies WHERE tablename = \'tickets\';');
    }
    
    console.log('');

    // ========================================
    // RÉSUMÉ DIAGNOSTIC
    // ========================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Données vérifiées:');
    console.log(`  ✅ Mission existe (id: ${mission.id.substring(0, 8)})`);
    console.log(`  ✅ ticket_id existe (${mission.ticket_id.substring(0, 8)})`);
    console.log(`  ✅ Ticket existe en DB (${ticket.categorie})`);
    console.log('');
    
    console.log('Conclusion:');
    console.log('  Si ticket est NULL côté technicien:');
    console.log('  → RLS sur table tickets/locataires/logements bloque l\'accès');
    console.log('  → Le JOIN échoue silencieusement (ticket = null)');
    console.log('');
    console.log('Solutions:');
    console.log('  1. Ajouter policies SELECT sur tickets/locataires/logements pour techniciens');
    console.log('  2. Utiliser vue missions_details si elle existe');
    console.log('  3. Patch front: vérifier ticket !== null avant utilisation');

    // Cleanup
    await supabaseAnon.auth.signOut();

  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

diagnosticTicketNull();
