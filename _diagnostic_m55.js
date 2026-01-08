// DIAGNOSTIC M55 - Vérifier état de la base
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('\n🔍 DIAGNOSTIC M55\n');
  
  try {
    // 1. Test connexion
    console.log('1️⃣  Test connexion Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('factures')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Erreur connexion:', testError.message);
      console.log('   Code:', testError.code);
      console.log('   Details:', testError.details);
      return;
    }
    console.log('✅ Connexion OK');
    
    // 2. Vérifier table facture_lignes
    console.log('\n2️⃣  Vérifier table facture_lignes...');
    const { data: lignesData, error: lignesError } = await supabase
      .from('facture_lignes')
      .select('id')
      .limit(1);
    
    if (lignesError) {
      console.log('❌ Table facture_lignes:', lignesError.message);
      console.log('   → Besoin de faire le ROLLBACK puis réappliquer M55');
    } else {
      console.log('✅ Table facture_lignes existe');
    }
    
    // 3. Vérifier colonnes factures
    console.log('\n3️⃣  Vérifier colonnes factures...');
    const { data: factureData, error: factureError } = await supabase
      .from('factures')
      .select('id, montant_ht, montant_tva, montant_ttc, montant_commission')
      .limit(1);
    
    if (factureError) {
      console.log('❌ Colonnes factures:', factureError.message);
      console.log('   → Colonnes ont été supprimées par DROP CASCADE !');
      console.log('   → URGENT: Faire le ROLLBACK pour recréer les colonnes');
    } else {
      console.log('✅ Colonnes factures OK');
      if (factureData && factureData.length > 0) {
        console.log('   Exemple:', factureData[0]);
      }
    }
    
    // 4. Vérifier RPC functions
    console.log('\n4️⃣  Vérifier RPC ajouter_ligne_facture...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('ajouter_ligne_facture', {
      p_facture_id: '00000000-0000-0000-0000-000000000000', // Fake ID pour tester
      p_type: 'test',
      p_description: 'test',
      p_quantite: 1,
      p_unite: 'h',
      p_prix_unitaire_ht: 0
    });
    
    if (rpcError && rpcError.message.includes('does not exist')) {
      console.log('❌ RPC ajouter_ligne_facture n\'existe pas');
      console.log('   → Migration M55 pas encore appliquée');
    } else if (rpcError && rpcError.message.includes('Facture non trouvée')) {
      console.log('✅ RPC ajouter_ligne_facture existe (erreur normale car fake ID)');
    } else {
      console.log('⚠️  RPC état inconnu:', rpcError ? rpcError.message : 'OK');
    }
    
    console.log('\n📋 RÉSUMÉ:');
    console.log('─────────────────────────────────────');
    if (lignesError && factureError) {
      console.log('🔴 ÉTAT: Base cassée par DROP CASCADE');
      console.log('📝 ACTION: Exécuter _rollback_m55_casse.sql dans Dashboard Supabase');
    } else if (lignesError && !factureError) {
      console.log('🟡 ÉTAT: Colonnes OK mais table lignes manquante');
      console.log('📝 ACTION: Appliquer migration M55 corrigée');
    } else if (!lignesError && !factureError) {
      console.log('🟢 ÉTAT: Migration M55 appliquée avec succès !');
      console.log('📝 ACTION: Tester avec node _test_m55_facturation_suisse.js');
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

diagnostic();
