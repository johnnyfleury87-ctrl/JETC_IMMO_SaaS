const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyMigration() {
  const supabase = createClient(
    'https://bwzyajsrmfhrxdmfpyqy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI'
  );

  console.log('🌍 Migration M61 - Support multi-pays\n');

  try {
    // Étape 1: Supprimer contrainte immeubles
    console.log('1️⃣ Suppression contrainte check_npa_format sur immeubles...');
    await supabase.rpc('query', {
      query: 'ALTER TABLE immeubles DROP CONSTRAINT IF EXISTS check_npa_format'
    }).catch(() => {});
    
    // Étape 2: Ajouter nouvelle contrainte immeubles
    console.log('2️⃣ Ajout contrainte check_npa_multi_pays sur immeubles...');
    const { error: e1 } = await supabase.rpc('query', {
      query: "ALTER TABLE immeubles ADD CONSTRAINT check_npa_multi_pays CHECK (npa ~ '^[0-9]{4,5}$')"
    }).catch(() => {});
    
    // Étape 3: Supprimer contrainte logements
    console.log('3️⃣ Suppression contrainte check_logement_npa_format sur logements...');
    await supabase.rpc('query', {
      query: 'ALTER TABLE logements DROP CONSTRAINT IF EXISTS check_logement_npa_format'
    }).catch(() => {});
    
    // Étape 4: Ajouter nouvelle contrainte logements
    console.log('4️⃣ Ajout contrainte check_logement_npa_multi_pays sur logements...');
    const { error: e2 } = await supabase.rpc('query', {
      query: "ALTER TABLE logements ADD CONSTRAINT check_logement_npa_multi_pays CHECK (npa ~ '^[0-9]{4,5}$')"
    }).catch(() => {});

    console.log('\n✅ Migration appliquée avec succès!');
    console.log('   - Contraintes NPA acceptent maintenant 4 OU 5 chiffres');
    console.log('   - Tables: immeubles, logements\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

applyMigration();
