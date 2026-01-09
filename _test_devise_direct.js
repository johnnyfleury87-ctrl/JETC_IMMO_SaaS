const { createClient } = require('@supabase/supabase-js');

async function testDeviseConstraint() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🔍 Test contrainte check_devise_chf sur tickets\n');

  // Vérifier la contrainte via SQL
  const { data: constraints, error: err } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'tickets'::regclass
        AND conname = 'check_devise_chf';
    `
  });

  if (err && err.message.includes('function exec_sql')) {
    console.log('⚠️ RPC exec_sql non disponible, utilisation SQL directe...\n');
    
    // Test insertion directe avec bypass RLS
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        titre: 'TEST_EUR',
        statut: 'nouveau',
        devise: 'EUR',
        regie_id: '00000000-0000-0000-0000-000000000000',
        locataire_id: '00000000-0000-0000-0000-000000000000',
        logement_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select();

    if (error) {
      console.log('❌ Insertion EUR bloquée:', error.message);
      if (error.message.includes('check_devise_chf') || error.message.includes('CHF')) {
        console.log('🎯 CONFIRMÉ: La contrainte check_devise_chf bloque devise = EUR\n');
        console.log('📋 Contrainte actuelle: CHECK (devise = \'CHF\')');
        console.log('✅ Solution: Remplacer par CHECK (devise IN (\'CHF\', \'EUR\'))');
      }
    } else {
      console.log('✅ EUR accepté (contrainte déjà corrigée)');
    }
  } else {
    console.log('📋 Contraintes trouvées:', constraints);
  }
}

testDeviseConstraint();
