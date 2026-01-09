const { createClient } = require('@supabase/supabase-js');

async function testM62MultiDevise() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🧪 TEST M62 - Multi-devises tickets (CHF + EUR)\n');
  console.log('═══════════════════════════════════════════════════\n');

  let testsPasses = 0;
  let testsTotal = 0;

  // ===================================================================
  // TEST 1 : Ticket CHF (Suisse) → doit passer
  // ===================================================================
  testsTotal++;
  console.log('Test 1 : Création ticket CHF (Suisse)');
  try {
    const { data: ticketCHF, error: e1 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_M62_CHF_' + Date.now(),
        statut: 'nouveau',
        devise: 'CHF',
        regie_id: '00000000-0000-0000-0000-000000000000',
        locataire_id: '00000000-0000-0000-0000-000000000000',
        logement_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e1) {
      console.log('  ❌ ÉCHEC:', e1.message);
      if (e1.message.includes('check_devise')) {
        console.log('  🚨 La contrainte bloque encore CHF!\n');
      }
    } else {
      console.log('  ✅ OK - Ticket CHF créé (id:', ticketCHF[0].id, ')');
      await supabase.from('tickets').delete().eq('id', ticketCHF[0].id);
      console.log('  🧹 Nettoyé\n');
      testsPasses++;
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
  }

  // ===================================================================
  // TEST 2 : Ticket EUR (France) → doit passer APRÈS M62
  // ===================================================================
  testsTotal++;
  console.log('Test 2 : Création ticket EUR (France)');
  try {
    const { data: ticketEUR, error: e2 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_M62_EUR_' + Date.now(),
        statut: 'nouveau',
        devise: 'EUR',
        regie_id: '00000000-0000-0000-0000-000000000000',
        locataire_id: '00000000-0000-0000-0000-000000000000',
        logement_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e2) {
      console.log('  ❌ ÉCHEC:', e2.message);
      if (e2.message.includes('check_devise_chf')) {
        console.log('  🚨 La contrainte check_devise_chf bloque encore EUR!');
        console.log('  ➡️  Migration M62 pas encore appliquée\n');
      } else if (e2.message.includes('check_devise_multi_pays')) {
        console.log('  🚨 La contrainte check_devise_multi_pays rejette EUR (config incorrecte)\n');
      }
    } else {
      console.log('  ✅ OK - Ticket EUR créé (id:', ticketEUR[0].id, ')');
      await supabase.from('tickets').delete().eq('id', ticketEUR[0].id);
      console.log('  🧹 Nettoyé\n');
      testsPasses++;
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
  }

  // ===================================================================
  // TEST 3 : Ticket USD (invalide) → doit échouer
  // ===================================================================
  testsTotal++;
  console.log('Test 3 : Création ticket USD (invalide)');
  try {
    const { data: ticketUSD, error: e3 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_M62_USD_' + Date.now(),
        statut: 'nouveau',
        devise: 'USD',
        regie_id: '00000000-0000-0000-0000-000000000000',
        locataire_id: '00000000-0000-0000-0000-000000000000',
        logement_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e3) {
      if (e3.message.includes('check_devise')) {
        console.log('  ✅ OK - USD correctement rejeté par contrainte');
        console.log('  ✅ Seuls CHF et EUR sont autorisés\n');
        testsPasses++;
      } else {
        console.log('  ⚠️  USD rejeté mais pas par contrainte devise:', e3.message, '\n');
      }
    } else {
      console.log('  ❌ ÉCHEC - USD accepté (contrainte trop permissive!)');
      await supabase.from('tickets').delete().eq('id', ticketUSD[0].id);
      console.log('  🧹 Nettoyé\n');
    }
  } catch (err) {
    console.log('  ❌ Erreur système:', err.message, '\n');
  }

  // ===================================================================
  // RÉSULTAT FINAL
  // ===================================================================
  console.log('═══════════════════════════════════════════════════');
  console.log(`Tests passés : ${testsPasses}/${testsTotal}`);
  console.log('═══════════════════════════════════════════════════');

  if (testsPasses === testsTotal) {
    console.log('✅ TOUS LES TESTS PASSENT - M62 OK');
    console.log('✅ Tickets CHF et EUR fonctionnent correctement\n');
  } else if (testsPasses === 1 && testsTotal === 3) {
    console.log('🚨 M62 PAS ENCORE APPLIQUÉE');
    console.log('➡️  Seul CHF fonctionne, EUR bloqué par check_devise_chf');
    console.log('➡️  Appliquer migration M62 via SQL Editor Supabase\n');
  } else {
    console.log('⚠️  RÉSULTATS PARTIELS - Vérifier configuration\n');
  }
}

testM62MultiDevise();
