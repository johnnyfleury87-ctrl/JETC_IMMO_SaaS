const { createClient } = require('@supabase/supabase-js');

async function checkConstraints() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🔍 Vérification contraintes CHECK sur tables immeubles/logements\n');

  try {
    // Requête pour lister toutes les contraintes CHECK
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          tc.table_name,
          tc.constraint_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc 
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name IN ('immeubles', 'logements')
          AND tc.constraint_type = 'CHECK'
        ORDER BY tc.table_name, tc.constraint_name;
      `
    });

    if (error) {
      console.log('⚠️ Fonction exec_sql non disponible, tentative alternative...\n');
      
      // Alternative : interroger directement les tables
      const { data: immeubles, error: e1 } = await supabase
        .from('immeubles')
        .select('npa')
        .limit(1);
      
      const { data: logements, error: e2 } = await supabase
        .from('logements')
        .select('npa')
        .limit(1);

      console.log('📊 Test insertion logement avec NPA 5 chiffres...');
      const { data: testInsert, error: testError } = await supabase
        .from('logements')
        .insert([{
          numero: 'TEST_FR',
          npa: '75001',
          ville: 'Paris',
          pays: 'France',
          regie_id: '00000000-0000-0000-0000-000000000000'
        }])
        .select();

      if (testError) {
        console.log('\n❌ ERREUR détectée:');
        console.log('   Message:', testError.message);
        console.log('   Code:', testError.code);
        console.log('   Details:', testError.details);
        
        if (testError.message.includes('check_logements_npa_format') || 
            testError.message.includes('check_logement_npa_format') ||
            testError.message.includes('npa')) {
          console.log('\n🎯 CONTRAINTE NPA DÉTECTÉE sur table logements');
          console.log('   → Nécessite patch DB pour accepter 4-5 chiffres\n');
        }
      } else {
        console.log('✅ Test OK - contrainte semble déjà flexible\n');
      }
      
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Contraintes CHECK trouvées:\n');
      data.forEach(row => {
        console.log(`Table: ${row.table_name}`);
        console.log(`  Contrainte: ${row.constraint_name}`);
        console.log(`  Clause: ${row.check_clause}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  Aucune contrainte CHECK trouvée sur ces tables\n');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkConstraints();
