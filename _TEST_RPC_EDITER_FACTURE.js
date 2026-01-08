/**
 * VÉRIFICATION RPC EDITER_FACTURE
 * S'assurer que la RPC accepte les bons paramètres
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRPCEditerFacture() {
  console.log('\n=== TEST RPC editer_facture ===\n');
  
  // Prendre une facture en brouillon
  const { data: factures, error: fetchError } = await supabase
    .from('factures')
    .select('*')
    .eq('statut', 'brouillon')
    .limit(1);
  
  if (fetchError || !factures || factures.length === 0) {
    console.error('❌ Aucune facture brouillon trouvée');
    return;
  }
  
  const facture = factures[0];
  console.log('Facture test:', facture.numero);
  console.log('ID:', facture.id);
  console.log('Montant HT actuel:', facture.montant_ht);
  console.log('IBAN actuel:', facture.iban);
  console.log('Notes actuelles:', facture.notes);
  
  // Test 1: Appel avec les bons params
  console.log('\n--- Test 1: Appel RPC ---');
  const { data: result1, error: error1 } = await supabase.rpc('editer_facture', {
    p_facture_id: facture.id,
    p_montant_ht: facture.montant_ht || 100,
    p_notes: 'Test édition via script',
    p_iban: facture.iban || 'CH93 0076 2011 6238 5295 7'
  });
  
  if (error1) {
    console.error('❌ Erreur RPC:', error1.message);
    console.error('Code:', error1.code);
    console.error('Details:', error1.details);
    console.error('Hint:', error1.hint);
  } else {
    console.log('✅ RPC appelée avec succès');
    console.log('Résultat:', result1);
  }
  
  // Vérifier la mise à jour
  console.log('\n--- Vérification mise à jour ---');
  const { data: updated, error: checkError } = await supabase
    .from('factures')
    .select('*')
    .eq('id', facture.id)
    .single();
  
  if (checkError) {
    console.error('❌ Erreur vérification:', checkError.message);
  } else {
    console.log('Notes après édition:', updated.notes);
    console.log('Updated_at:', updated.updated_at);
    
    if (updated.notes === 'Test édition via script') {
      console.log('✅ Mise à jour confirmée !');
    } else {
      console.log('⚠️ Notes non mises à jour');
    }
  }
}

async function testRPCEnvoyerFacture() {
  console.log('\n\n=== TEST RPC envoyer_facture ===\n');
  
  // Prendre une facture en brouillon
  const { data: factures, error: fetchError } = await supabase
    .from('factures')
    .select('*')
    .eq('statut', 'brouillon')
    .limit(1);
  
  if (fetchError || !factures || factures.length === 0) {
    console.error('❌ Aucune facture brouillon trouvée');
    return;
  }
  
  const facture = factures[0];
  console.log('Facture test:', facture.numero);
  console.log('ID:', facture.id);
  console.log('Statut actuel:', facture.statut);
  
  console.log('\n⚠️  TEST DÉSACTIVÉ pour ne pas changer le statut réel');
  console.log('Pour tester en vrai, décommentez le code ci-dessous');
  
  /*
  const { data: result, error } = await supabase.rpc('envoyer_facture', {
    p_facture_id: facture.id
  });
  
  if (error) {
    console.error('❌ Erreur RPC:', error.message);
  } else {
    console.log('✅ RPC appelée avec succès');
    console.log('Résultat:', result);
  }
  */
}

async function main() {
  await testRPCEditerFacture();
  await testRPCEnvoyerFacture();
}

main().catch(console.error);
