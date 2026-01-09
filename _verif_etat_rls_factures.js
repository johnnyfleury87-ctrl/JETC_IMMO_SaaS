#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTMxMjE1OCwiZXhwIjoyMDUwODg4MTU4fQ.BI5UQoKm0sGoKwYvRZ5fLxEe-BmMqiP8SaRt__hf7lA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifierEtatRLS() {
  console.log('\n🔍 VÉRIFICATION ÉTAT RLS FACTURES\n');
  
  const factureId = '6de22ccb-15f5-4922-8e07-2fd7910891b0';
  const entrepriseId = '898b4b8b-e7aa-4bd4-9390-b489519c7f19';
  
  // 1. Vérifier la facture existe
  const { data: facture } = await supabase
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .single();
  
  console.log('✅ Facture existe:', {
    id: facture.id,
    entreprise_id: facture.entreprise_id,
    statut: facture.statut
  });
  
  // 2. Vérifier les policies actuelles
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'factures');
  
  console.log('\n📋 POLICIES ACTIVES SUR TABLE FACTURES:');
  policies.forEach(p => {
    console.log(`  - ${p.policyname} (${p.cmd})`);
  });
  
  // 3. Vérifier profiles.entreprise_id
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, entreprise_id')
    .eq('role', 'entreprise')
    .limit(5);
  
  console.log('\n👥 PROFILES ENTREPRISES (échantillon):');
  profiles.forEach(p => {
    console.log(`  - ${p.id}: entreprise_id = ${p.entreprise_id}`);
  });
  
  const { data: profileEntreprise } = await supabase
    .from('profiles')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .maybeSingle();
  
  console.log('\n🎯 PROFILE POUR ENTREPRISE ' + entrepriseId + ':');
  console.log(profileEntreprise ? '  ✅ Existe' : '  ❌ AUCUN (profiles.entreprise_id NULL ou incorrect)');
  
  if (!profileEntreprise) {
    console.log('\n⚠️ PROBLÈME IDENTIFIÉ: profiles.entreprise_id NOT SET');
    console.log('   → M56 PARTIE 1 (synchronisation) NON APPLIQUÉE');
  }
  
  // 4. Tester policy actuelle avec un profile fictif
  const { data: testProfiles } = await supabase.rpc('test_rls_factures_debug', {
    p_facture_id: factureId
  }).catch(() => ({ data: null }));
  
  console.log('\n🔬 DIAGNOSTIC FINAL:');
  console.log('  - Facture existe en DB: ✅');
  console.log('  - Policies définies: ✅ (' + policies.length + ')');
  console.log('  - profiles.entreprise_id synchronisé: ' + (profileEntreprise ? '✅' : '❌ MANQUANT'));
  console.log('\n➡️ SOLUTION: Exécuter M56 dans Supabase SQL Editor (PARTIE 1 critique)\n');
}

verifierEtatRLS().catch(console.error);
