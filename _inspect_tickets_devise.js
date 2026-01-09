const { createClient } = require('@supabase/supabase-js');

async function inspectTicketsDevise() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🔍 Inspection contrainte devise_chf sur table tickets\n');

  try {
    // Test insertion ticket avec devise_chf = false (France)
    console.log('Test 1: Création ticket avec devise_chf = false (France)');
    const { data: test1, error: e1 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_FRANCE',
        statut: 'nouveau',
        devise_chf: false,
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e1) {
      console.log('❌ ÉCHEC:', e1.message);
      if (e1.message.includes('check_devise_chf') || e1.message.includes('devise')) {
        console.log('🎯 CONTRAINTE DEVISE DÉTECTÉE\n');
      }
    } else {
      console.log('✅ OK - Ticket avec devise_chf=false créé\n');
      await supabase.from('tickets').delete().eq('id', test1[0].id);
    }

    // Test insertion ticket avec devise_chf = true (Suisse)
    console.log('Test 2: Création ticket avec devise_chf = true (Suisse)');
    const { data: test2, error: e2 } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_SUISSE',
        statut: 'nouveau',
        devise_chf: true,
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e2) {
      console.log('❌ ÉCHEC:', e2.message, '\n');
    } else {
      console.log('✅ OK - Ticket avec devise_chf=true créé\n');
      await supabase.from('tickets').delete().eq('id', test2[0].id);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

inspectTicketsDevise();
