const { createClient } = require('@supabase/supabase-js');

async function testM64TriggerSecurise() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🧪 TEST M64 - Trigger sécurisé missions.devise\n');
  console.log('═══════════════════════════════════════════════════\n');

  let testsPasses = 0;
  let testsTotal = 0;

  // ===================================================================
  // SETUP: Récupérer ticket et entreprise de test
  // ===================================================================
  console.log('🔧 Setup: Recherche ticket et entreprise...\n');
  
  const { data: tickets, error: errTicket } = await supabase
    .from('tickets')
    .select('id, devise, locked_at')
    .is('locked_at', null)
    .limit(2);

  const { data: entreprises, error: errEnt } = await supabase
    .from('entreprises')
    .select('id')
    .limit(1);

  if (errTicket || !tickets || tickets.length < 2) {
    console.log('⚠️  Pas assez de tickets disponibles (besoin de 2)');
    console.log('   Créez des tickets via interface régie avant test\n');
    process.exit(0);
  }

  if (errEnt || !entreprises || entreprises.length === 0) {
    console.log('⚠️  Aucune entreprise disponible\n');
    process.exit(0);
  }

  const ticketCHF = tickets[0];
  const ticketEUR = tickets[1];
  const testEntreprise = entreprises[0];

  console.log(`✅ Ticket 1: ${ticketCHF.id} (devise: ${ticketCHF.devise || 'NULL'})`);
  console.log(`✅ Ticket 2: ${ticketEUR.id} (devise: ${ticketEUR.devise || 'NULL'})`);
  console.log(`✅ Entreprise: ${testEntreprise.id}\n`);

  // Mettre à jour devises tickets pour test
  await supabase.from('tickets').update({ devise: 'CHF' }).eq('id', ticketCHF.id);
  await supabase.from('tickets').update({ devise: 'EUR' }).eq('id', ticketEUR.id);

  // ===================================================================
  // TEST 1 : Mission SANS devise fournie → hérite du ticket CHF
  // ===================================================================
  testsTotal++;
  console.log('Test 1 : Mission sans devise + ticket CHF → doit hériter CHF');
  try {
    const { data: mission1, error: e1 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: ticketCHF.id,
        entreprise_id: testEntreprise.id,
        statut: 'en_attente'
        // PAS de devise fournie → trigger doit hériter CHF
      }])
      .select('id, devise');

    if (e1) {
      console.log('  ❌ ÉCHEC:', e1.message, '\n');
    } else {
      if (mission1[0].devise === 'CHF') {
        console.log('  ✅ OK - Trigger hérite CHF du ticket');
        console.log(`     Mission devise: ${mission1[0].devise}\n`);
        testsPasses++;
      } else {
        console.log(`  ❌ Devise incorrecte: ${mission1[0].devise} (attendu: CHF)\n`);
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', mission1[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', ticketCHF.id);
    }
  } catch (err) {
    console.log('  ❌ Erreur:', err.message, '\n');
  }

  // ===================================================================
  // TEST 2 : Mission SANS devise fournie → hérite du ticket EUR
  // ===================================================================
  testsTotal++;
  console.log('Test 2 : Mission sans devise + ticket EUR → doit hériter EUR');
  try {
    const { data: mission2, error: e2 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: ticketEUR.id,
        entreprise_id: testEntreprise.id,
        statut: 'en_attente'
        // PAS de devise fournie → trigger doit hériter EUR
      }])
      .select('id, devise');

    if (e2) {
      console.log('  ❌ ÉCHEC:', e2.message, '\n');
    } else {
      if (mission2[0].devise === 'EUR') {
        console.log('  ✅ OK - Trigger hérite EUR du ticket');
        console.log(`     Mission devise: ${mission2[0].devise}\n`);
        testsPasses++;
      } else {
        console.log(`  ❌ Devise incorrecte: ${mission2[0].devise} (attendu: EUR)\n`);
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', mission2[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', ticketEUR.id);
    }
  } catch (err) {
    console.log('  ❌ Erreur:', err.message, '\n');
  }

  // ===================================================================
  // TEST 3 : Mission AVEC devise EUR fournie + ticket CHF
  //          → doit RESPECTER devise fournie (EUR)
  // ===================================================================
  testsTotal++;
  console.log('Test 3 : Mission avec devise EUR fournie + ticket CHF');
  console.log('        → doit RESPECTER EUR (ne PAS écraser avec CHF du ticket)');
  try {
    const { data: mission3, error: e3 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: ticketCHF.id,  // Ticket CHF
        entreprise_id: testEntreprise.id,
        statut: 'en_attente',
        devise: 'EUR'  // ✅ Devise EXPLICITEMENT fournie
      }])
      .select('id, devise');

    if (e3) {
      console.log('  ❌ ÉCHEC:', e3.message, '\n');
    } else {
      if (mission3[0].devise === 'EUR') {
        console.log('  ✅ OK - Trigger respecte devise EUR fournie');
        console.log('     (n\'écrase PAS avec CHF du ticket)');
        console.log(`     Mission devise: ${mission3[0].devise}\n`);
        testsPasses++;
      } else {
        console.log(`  ❌ ÉCRASEMENT! Devise: ${mission3[0].devise} (attendu: EUR)`);
        console.log('  🚨 Le trigger écrase la devise fournie!\n');
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', mission3[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', ticketCHF.id);
    }
  } catch (err) {
    console.log('  ❌ Erreur:', err.message, '\n');
  }

  // ===================================================================
  // TEST 4 : Mission AVEC devise CHF fournie + ticket EUR
  //          → doit RESPECTER devise fournie (CHF)
  // ===================================================================
  testsTotal++;
  console.log('Test 4 : Mission avec devise CHF fournie + ticket EUR');
  console.log('        → doit RESPECTER CHF (ne PAS écraser avec EUR du ticket)');
  try {
    const { data: mission4, error: e4 } = await supabase
      .from('missions')
      .insert([{
        ticket_id: ticketEUR.id,  // Ticket EUR
        entreprise_id: testEntreprise.id,
        statut: 'en_attente',
        devise: 'CHF'  // ✅ Devise EXPLICITEMENT fournie
      }])
      .select('id, devise');

    if (e4) {
      console.log('  ❌ ÉCHEC:', e4.message, '\n');
    } else {
      if (mission4[0].devise === 'CHF') {
        console.log('  ✅ OK - Trigger respecte devise CHF fournie');
        console.log('     (n\'écrase PAS avec EUR du ticket)');
        console.log(`     Mission devise: ${mission4[0].devise}\n`);
        testsPasses++;
      } else {
        console.log(`  ❌ ÉCRASEMENT! Devise: ${mission4[0].devise} (attendu: CHF)`);
        console.log('  🚨 Le trigger écrase la devise fournie!\n');
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', mission4[0].id);
      await supabase.from('tickets').update({ locked_at: null }).eq('id', ticketEUR.id);
    }
  } catch (err) {
    console.log('  ❌ Erreur:', err.message, '\n');
  }

  // ===================================================================
  // TEST 5 : Mission sans ticket → DEFAULT CHF
  // ===================================================================
  testsTotal++;
  console.log('Test 5 : Mission sans ticket → doit utiliser DEFAULT CHF');
  try {
    const { data: mission5, error: e5 } = await supabase
      .from('missions')
      .insert([{
        entreprise_id: testEntreprise.id,
        statut: 'en_attente'
        // Pas de ticket_id, pas de devise → DEFAULT CHF
      }])
      .select('id, devise');

    if (e5) {
      console.log('  ❌ ÉCHEC:', e5.message, '\n');
    } else {
      if (mission5[0].devise === 'CHF') {
        console.log('  ✅ OK - DEFAULT CHF appliqué');
        console.log(`     Mission devise: ${mission5[0].devise}\n`);
        testsPasses++;
      } else {
        console.log(`  ⚠️  Devise: ${mission5[0].devise} (attendu: CHF)\n`);
      }
      // Cleanup
      await supabase.from('missions').delete().eq('id', mission5[0].id);
    }
  } catch (err) {
    console.log('  ❌ Erreur:', err.message, '\n');
  }

  // ===================================================================
  // RÉSULTAT FINAL
  // ===================================================================
  console.log('═══════════════════════════════════════════════════');
  console.log(`Tests passés : ${testsPasses}/${testsTotal}`);
  console.log('═══════════════════════════════════════════════════');

  if (testsPasses === testsTotal) {
    console.log('✅ TOUS LES TESTS PASSENT - M64 OK');
    console.log('✅ Trigger respecte devise fournie');
    console.log('✅ Trigger hérite devise ticket si NULL');
    console.log('✅ DEFAULT CHF fonctionne\n');
  } else if (testsPasses >= 2 && testsPasses < testsTotal) {
    if (testsPasses < 3) {
      console.log('🚨 M64 PAS ENCORE APPLIQUÉE');
      console.log('➡️  Tests 3/4 échouent: trigger écrase devise fournie');
      console.log('➡️  Appliquer migration M64 via SQL Editor Supabase\n');
    } else {
      console.log('⚠️  RÉSULTATS PARTIELS');
      console.log(`➡️  ${testsTotal - testsPasses} test(s) échoué(s) - vérifier config\n`);
    }
  } else {
    console.log('⚠️  RÉSULTATS INSUFFISANTS');
    console.log('➡️  Vérifier M63 appliquée avant M64\n');
  }
}

testM64TriggerSecurise();
