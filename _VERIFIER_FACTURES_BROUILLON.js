/**
 * VÉRIFIER L'ÉTAT ACTUEL DES FACTURES
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 ÉTAT DES FACTURES BROUILLON\n');
  
  const { data: factures, error } = await supabase
    .from('factures')
    .select('*')
    .eq('statut', 'brouillon')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  console.log(`Nombre de factures brouillon: ${factures.length}\n`);
  
  factures.forEach((f, idx) => {
    console.log(`${idx + 1}. ${f.numero}`);
    console.log(`   ID: ${f.id}`);
    console.log(`   Mission: ${f.mission_id}`);
    console.log(`   Entreprise: ${f.entreprise_id}`);
    console.log(`   Montant HT: ${f.montant_ht || 'NULL ❌'}`);
    console.log(`   Montant TTC: ${f.montant_ttc || 'NULL ❌'}`);
    console.log(`   IBAN: ${f.iban || 'NULL ❌'}`);
    console.log(`   Notes: ${f.notes || 'NULL'}`);
    console.log('');
    
    // Diagnostique
    const problemes = [];
    if (!f.montant_ht || f.montant_ht === 0) problemes.push('Montant HT manquant');
    if (!f.montant_ttc || f.montant_ttc === 0) problemes.push('Montant TTC manquant');
    if (!f.iban) problemes.push('IBAN manquant');
    
    if (problemes.length > 0) {
      console.log('   ⚠️  PROBLÈMES:');
      problemes.forEach(p => console.log(`      - ${p}`));
      console.log('   ➡️  SOLUTION: Cliquer sur "Éditer" et remplir ces champs');
      console.log('');
    }
  });
  
  console.log('\n💡 ASTUCE:');
  console.log('Si vous ne voyez pas le bouton "Éditer", rafraîchissez la page (Ctrl+Shift+R)');
  console.log('Le bouton "Envoyer" n\'apparaîtra qu\'une fois la facture complète (montant + IBAN)');
}

main().catch(console.error);
