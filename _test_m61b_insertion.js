const { createClient } = require('@supabase/supabase-js');

async function testMigration() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🧪 Test insertion logements après migration M61b\n');

  try {
    // Test 1 : Logement suisse (4 chiffres)
    console.log('Test 1️⃣ : Logement Suisse (NPA 4 chiffres)');
    const { data: swiss, error: e1 } = await supabase
      .from('logements')
      .insert([{
        numero: 'TEST_CH',
        npa: '1000',
        ville: 'Lausanne',
        pays: 'Suisse',
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e1) {
      console.log('❌ ÉCHEC:', e1.message, '\n');
    } else {
      console.log('✅ OK - Logement suisse créé\n');
      // Nettoyage
      await supabase.from('logements').delete().eq('id', swiss[0].id);
    }

    // Test 2 : Logement français (5 chiffres)
    console.log('Test 2️⃣ : Logement France (Code postal 5 chiffres)');
    const { data: french, error: e2 } = await supabase
      .from('logements')
      .insert([{
        numero: 'TEST_FR',
        npa: '75001',
        ville: 'Paris',
        pays: 'France',
        regie_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (e2) {
      console.log('❌ ÉCHEC:', e2.message);
      console.log('   → La migration M61b doit être appliquée en DB\n');
    } else {
      console.log('✅ OK - Logement français créé\n');
      // Nettoyage
      await supabase.from('logements').delete().eq('id', french[0].id);
    }

    console.log('═══════════════════════════════════════════════════');
    if (!e1 && !e2) {
      console.log('🎉 TOUS LES TESTS PASSENT');
      console.log('   Migration M61b appliquée avec succès!\n');
    } else {
      console.log('⚠️  MIGRATION M61b REQUISE');
      console.log('   Suivre: _apply_m61b_logements_patch.md\n');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testMigration();
