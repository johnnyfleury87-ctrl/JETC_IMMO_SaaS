/**
 * AUDIT STRUCTURE TABLE FACTURES
 * Identifier les colonnes générées qui causent l'erreur 400
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 AUDIT STRUCTURE TABLE FACTURES\n');
  
  // Test: essayer d'updater une facture pour voir l'erreur exacte
  const { data: factures } = await supabase
    .from('factures')
    .select('id, statut')
    .eq('statut', 'brouillon')
    .limit(1);
  
  if (!factures || factures.length === 0) {
    console.log('⚠️  Pas de facture brouillon pour tester');
    return;
  }
  
  const factureId = factures[0].id;
  console.log(`Test avec facture: ${factureId}\n`);
  
  // Test 1: Update montant_ht uniquement
  console.log('--- Test 1: Update montant_ht uniquement ---');
  const { data: r1, error: e1 } = await supabase
    .from('factures')
    .update({ montant_ht: 100 })
    .eq('id', factureId);
  
  if (e1) {
    console.log('❌ Erreur:', e1.message);
    console.log('Code:', e1.code);
    console.log('Details:', e1.details);
  } else {
    console.log('✅ OK');
  }
  
  // Test 2: Update avec colonnes calculées
  console.log('\n--- Test 2: Update avec montant_tva (colonne calculée) ---');
  const { data: r2, error: e2 } = await supabase
    .from('factures')
    .update({ 
      montant_ht: 100,
      montant_tva: 20,
      montant_ttc: 120
    })
    .eq('id', factureId);
  
  if (e2) {
    console.log('❌ Erreur:', e2.message);
    console.log('Code:', e2.code);
    console.log('Details:', e2.details);
    console.log('\n⚠️  Ces colonnes sont GENERATED et ne peuvent pas être modifiées');
  } else {
    console.log('✅ OK');
  }
  
  // Test 3: Lire la structure réelle
  console.log('\n--- Test 3: Colonnes actuelles ---');
  const { data: sample } = await supabase
    .from('factures')
    .select('*')
    .limit(1);
  
  if (sample && sample.length > 0) {
    console.log('Colonnes disponibles:');
    Object.keys(sample[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof sample[0][col]}`);
    });
  }
}

main().catch(console.error);
