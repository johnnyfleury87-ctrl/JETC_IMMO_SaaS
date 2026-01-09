const { createClient } = require('@supabase/supabase-js');

async function testM63MissionsDevise() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🧪 TEST M63 - Multi-devises missions (CHF + EUR)\n');
  console.log('═══════════════════════════════════════════════════\n');

  let testsPasses = 0;
  let testsTotal = 0;

  // ===================================================================
  // SETUP: Récupérer un ticket de test et une entreprise
  // ===================================================================
  console.log('🔧 Setup: Recherche ticket et entreprise de test...\n');
  
  const { data: tickets, error: errTicket } = await supabase
    .from('tickets')
    .select('id, devise, locked_at')
    .is('locked_at', null)
    .limit(1);

  const { data: entreprises, error: errEnt } = await supabase
    .from('entreprises')
    .select('id')
    .limit(1);

  if (errTicket || !tickets || tickets.length === 0) {
    console.log('⚠️  Aucun ticket disponible pour test');
    console.log('   Créez un ticket via l\'interface régie avant de tester\n');
    process.exit(0);
  }

  if (errEnt || !entreprises || entreprises.length === 0) {
    console.log('⚠️  Aucune entreprise disponible pour test');
    process.exit(0);
  }

  const testTicket = tickets[0];
  const testEntreprise = entreprises[0];

  console.log(`✅ Ticket trouvé: ${testTicket.id}`);
  console.log(`   Devise ticket: ${testTicket.devise || 'NULL'}`);
  console.log(`✅ Entreprise: ${testEntreprise.id}\n`);

  // ===================================================================
  // TEST 1 : Insertion directe mission CHF (Suisse)
  // ===================================================================
  testsTotal++;
  console.log('Test 1 : Insertion mission avec devise = CHF');
  try {
    const { data: missionCHF, error: e1 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: testTicket.id,
        entreprise_id: testEntreprise.id,
        statut: 'en_attente',
        devise: 'CHF'
      }])
      .select();

    if (e1) {
      console.log('  ❌ ÉCHEC:', e1.message);
      if (e1.message.includes('check_mission_devise')) {
        console.log('  🚨 La contrainte bloque encore CHF!\n');
      }
    } else {
      console.log('  ✅ OK - Mission CHF créée (id:', missionCHF[0].id, ')');
      // Cleanup
      await supabase.from('missions').delete().eq('id', missionCHF[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', testTicket.id);
      console.log('  🧹 Nettoyé\n');
      testsPasses++;
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
  }

  // ===================================================================
  // TEST 2 : Insertion directe mission EUR (France)
  // ===================================================================
  testsTotal++;
  console.log('Test 2 : Insertion mission avec devise = EUR');
  try {
    const { data: missionEUR, error: e2 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: testTicket.id,
        entreprise_id: testEntreprise.id,
        statut: 'en_attente',
        devise: 'EUR'
      }])
      .select();

    if (e2) {
      console.log('  ❌ ÉCHEC:', e2.message);
      if (e2.message.includes('check_mission_devise_chf')) {
        console.log('  🚨 La contrainte check_mission_devise_chf bloque EUR!');
        console.log('  ➡️  Migration M63 pas encore appliquée\n');
      } else if (e2.message.includes('check_mission_devise_multi_pays')) {
        console.log('  🚨 Contrainte multi_pays rejette EUR (config incorrecte)\n');
      }
    } else {
      console.log('  ✅ OK - Mission EUR créée (id:', missionEUR[0].id, ')');
      // Cleanup
      await supabase.from('missions').delete().eq('id', missionEUR[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', testTicket.id);
      console.log('  🧹 Nettoyé\n');
      testsPasses++;
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
  }

  // ===================================================================
  // TEST 3 : Trigger héritage devise du ticket
  // ===================================================================
  testsTotal++;
  console.log('Test 3 : Trigger héritage devise du ticket');
  
  // Modifier devise du ticket pour le test
  await supabase.from('tickets').update({ devise: 'EUR' }).eq('id', testTicket.id);
  
  try {
    const { data: missionAuto, error: e3 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: testTicket.id,
        entreprise_id: testEntreprise.id,
        statut: 'en_attente'
        // SANS devise explicite -> trigger doit l'hériter
      }])
      .select('id, devise');

    if (e3) {
      console.log('  ❌ ÉCHEC:', e3.message, '\n');
    } else {
      if (missionAuto[0].devise === 'EUR') {
        console.log('  ✅ OK - Trigger hérite devise EUR du ticket');
        console.log('  ✅ Mission créée avec devise:', missionAuto[0].devise, '\n');
        testsPasses++;
      } else {
        console.log('  ⚠️  Mission créée mais devise incorrecte:', missionAuto[0].devise);
        console.log('  ➡️  Trigger pas encore actif\n');
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', missionAuto[0].id);
      await supabase.from('tickets').update({ locked_at: null, devise: testTicket.devise || 'CHF' }).eq('id', testTicket.id);
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
    await supabase.from('tickets').update({ devise: testTicket.devise || 'CHF' }).eq('id', testTicket.id);
  }

  // ===================================================================
  // RÉSULTAT FINAL
  // ===================================================================
  console.log('═══════════════════════════════════════════════════');
  console.log(`Tests passés : ${testsPasses}/${testsTotal}`);
  console.log('═══════════════════════════════════════════════════');

  if (testsPasses === testsTotal) {
    console.log('✅ TOUS LES TESTS PASSENT - M63 OK');
    console.log('✅ Missions CHF et EUR fonctionnent');
    console.log('✅ Trigger hérite correctement devise du ticket\n');
  } else if (testsPasses === 1 && testsTotal === 3) {
    console.log('🚨 M63 PAS ENCORE APPLIQUÉE');
    console.log('➡️  Seul CHF fonctionne, EUR bloqué');
    console.log('➡️  Appliquer migration M63 via SQL Editor Supabase\n');
  } else {
    console.log('⚠️  RÉSULTATS PARTIELS - Vérifier configuration\n');
  }
}

testM63MissionsDevise();
