const { createClient } = require('@supabase/supabase-js');

async function inspectTicketsSchema() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🔍 Inspection schéma table tickets\n');

  try {
    // Test 1: Ticket avec devise EUR (France)
    console.log('Test 1: Création ticket avec devise = EUR (France)');
    const { data: test1, error: e1 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_FRANCE_EUR',
        statut: 'nouveau',
        devise: 'EUR',
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e1) {
      console.log('❌ ÉCHEC:', e1.message);
      if (e1.message.includes('check_devise_chf') || e1.message.includes('CHF')) {
        console.log('🎯 CONTRAINTE check_devise_chf BLOQUE EUR\n');
      }
    } else {
      console.log('✅ OK - Ticket EUR créé\n');
      await supabase.from('tickets').delete().eq('id', test1[0].id);
    }

    // Test 2: Ticket avec devise CHF (Suisse)
    console.log('Test 2: Création ticket avec devise = CHF (Suisse)');
    const { data: test2, error: e2 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_SUISSE_CHF',
        statut: 'nouveau',
        devise: 'CHF',
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e2) {
      console.log('❌ ÉCHEC:', e2.message, '\n');
    } else {
      console.log('✅ OK - Ticket CHF créé\n');
      await supabase.from('tickets').delete().eq('id', test2[0].id);
    }

    // Test 3: Ticket SANS devise (défaut)
    console.log('Test 3: Création ticket SANS devise');
    const { data: test3, error: e3 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_SANS_DEVISE',
        statut: 'nouveau',
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e3) {
      console.log('❌ ÉCHEC:', e3.message, '\n');
    } else {
      console.log('✅ OK - Ticket créé avec devise par défaut:', test3[0].devise, '\n');
      await supabase.from('tickets').delete().eq('id', test3[0].id);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

inspectTicketsSchema();
