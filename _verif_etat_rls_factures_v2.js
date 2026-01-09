#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifierEtatRLS() {
  console.log('\n🔍 DIAGNOSTIC COMPLET RLS FACTURES\n');
  
  const factureId = '6de22ccb-15f5-4922-8e07-2fd7910891b0';
  const entrepriseId = '898b4b8b-e7aa-4bd4-9390-b489519c7f19';
  
  // 1. Vérifier la facture existe (avec service_role)
  const { data: facture, error: errFacture } = await supabase
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .maybeSingle();
  
  if (!facture) {
    console.log('❌ FACTURE INTROUVABLE EN DB:', errFacture);
    return;
  }
  
  console.log('✅ Facture existe en DB:', {
    id: facture.id,
    entreprise_id: facture.entreprise_id,
    statut: facture.statut,
    numero: facture.numero
  });
  
  // 2. Vérifier les policies actuelles
  const { data: policies, error: errPolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd, qual, with_check')
    .eq('tablename', 'factures')
    .order('policyname');
  
  if (errPolicies || !policies) {
    console.log('\n⚠️ Impossible de lire pg_policies (table système)');
    console.log('   Vérification manuelle requise dans Supabase Dashboard');
  } else {
    console.log('\n📋 POLICIES RLS ACTIVES (' + policies.length + '):');
    policies.forEach(p => {
      console.log(`  - "${p.policyname}" (${p.cmd})`);
    });
    
    // 3. Chercher policy spécifique pour entreprise SELECT
    const policyEntrepriseSelect = policies.find(p => 
      p.cmd === 'SELECT' && p.policyname.toLowerCase().includes('entreprise')
    );
    
    if (policyEntrepriseSelect) {
      console.log('\n🔍 POLICY SELECT ENTREPRISE:');
      console.log(`  Nom: ${policyEntrepriseSelect.policyname}`);
      if (policyEntrepriseSelect.qual) {
        console.log(`  USING: ${policyEntrepriseSelect.qual.substring(0, 200)}...`);
      }
    }
  }
  
  // 4. Vérifier profiles.entreprise_id
  const { data: profilesEntreprises } = await supabase
    .from('profiles')
    .select('id, email, role, entreprise_id')
    .eq('role', 'entreprise')
    .not('entreprise_id', 'is', null)
    .limit(3);
  
  console.log('\n👥 PROFILES ENTREPRISES AVEC entreprise_id SET:');
  if (profilesEntreprises && profilesEntreprises.length > 0) {
    profilesEntreprises.forEach(p => {
      console.log(`  ✅ ${p.email}: entreprise_id = ${p.entreprise_id.substring(0, 8)}...`);
    });
  } else {
    console.log('  ❌ AUCUN profile entreprise avec entreprise_id SET');
  }
  
  // 5. Vérifier SI profile existe pour cette entreprise
  const { data: profilePourEntreprise } = await supabase
    .from('profiles')
    .select('id, email, role, entreprise_id')
    .eq('entreprise_id', entrepriseId)
    .maybeSingle();
  
  console.log('\n🎯 PROFILE POUR ENTREPRISE ' + entrepriseId.substring(0, 8) + '...:');
  if (profilePourEntreprise) {
    console.log('  ✅ Trouvé:', profilePourEntreprise.email);
  } else {
    console.log('  ❌ AUCUN PROFILE avec entreprise_id = ' + entrepriseId);
    console.log('  ⚠️ Les policies RLS ne peuvent PAS fonctionner!');
  }
  
  // 6. Compter profiles avec entreprise_id NULL
  const { count: nullCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'entreprise')
    .is('entreprise_id', null);
  
  console.log('\n⚠️ PROFILES ENTREPRISE AVEC entreprise_id NULL: ' + (nullCount || 0));
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 DIAGNOSTIC FINAL:');
  console.log('═══════════════════════════════════════');
  console.log('  Facture en DB: ✅');
  console.log('  Policies définies: ' + (policies && policies.length > 0 ? '✅ (' + policies.length + ')' : '⚠️ Non accessible'));
  console.log('  Profile avec entreprise_id: ' + (profilePourEntreprise ? '✅' : '❌ MANQUANT'));
  console.log('  Profiles à synchroniser: ' + (nullCount || 0));
  
  if (!profilePourEntreprise || nullCount > 0) {
    console.log('\n🚨 CAUSE DU BUG:');
    console.log('   profiles.entreprise_id NOT SET → RLS filtre TOUT');
    console.log('\n✅ SOLUTION:');
    console.log('   Exécuter M56 PARTIE 1 dans Supabase SQL Editor');
    console.log('   → UPDATE profiles SET entreprise_id = profiles.id WHERE role = \'entreprise\'');
  }
  
  console.log('\n');
}

verifierEtatRLS().catch(console.error);
