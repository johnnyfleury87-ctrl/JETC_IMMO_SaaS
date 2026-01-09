const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFactureUpdate() {
  console.log('🧪 TEST UPDATE FACTURE BROUILLON\n');
  
  const factureId = '6de22ccb-15f5-4922-8e07-2fd7910891b0';
  const entrepriseProfileId = '97fb8c75-8ab2-4c7f-ba23-d8c86cbae5e6'; // Profile Perreti
  
  // 1. Vérifier SELECT avec admin
  console.log('1️⃣ SELECT avec admin (bypass RLS):\n');
  const { data: factureAdmin } = await supabaseAdmin
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .maybeSingle();
  
  if (factureAdmin) {
    console.log(`✅ Facture existe: ${factureAdmin.numero}`);
    console.log(`   Statut: ${factureAdmin.statut}`);
    console.log(`   Entreprise ID: ${factureAdmin.entreprise_id}`);
    console.log(`   Régie ID: ${factureAdmin.regie_id}`);
  } else {
    console.log('❌ Facture introuvable');
    return;
  }
  
  // 2. Vérifier profile entreprise
  console.log('\n2️⃣ PROFILE ENTREPRISE:\n');
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', entrepriseProfileId)
    .maybeSingle();
  
  if (profile) {
    console.log(`✅ Profile: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   entreprise_id: ${profile.entreprise_id}`);
    console.log(`   Match? ${profile.entreprise_id === factureAdmin.entreprise_id ? '✅ OUI' : '❌ NON'}`);
  }
  
  // 3. Créer client comme entreprise
  console.log('\n3️⃣ TEST AVEC RLS (simuler auth entreprise):\n');
  
  // Simuler session entreprise (on ne peut pas vraiment le faire en Node)
  // Mais on peut tester la policy manuellement
  
  console.log('Policy SELECT attendue:');
  console.log('EXISTS (');
  console.log('  SELECT 1 FROM profiles');
  console.log('  WHERE profiles.id = auth.uid()');
  console.log(`    AND profiles.role = 'entreprise'`);
  console.log('    AND profiles.entreprise_id = factures.entreprise_id');
  console.log(')');
  console.log('');
  console.log('Test manuel SQL:');
  console.log(`SELECT EXISTS (`);
  console.log(`  SELECT 1 FROM profiles`);
  console.log(`  WHERE profiles.id = '${entrepriseProfileId}'`);
  console.log(`    AND profiles.role = 'entreprise'`);
  console.log(`    AND profiles.entreprise_id = '${factureAdmin.entreprise_id}'`);
  console.log(`);`);
  
  const testExists = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = '${entrepriseProfileId}'
          AND profiles.role = 'entreprise'
          AND profiles.entreprise_id = '${factureAdmin.entreprise_id}'
      ) as can_access;
    `
  }).catch(() => null);
  
  if (testExists && testExists.data) {
    console.log(`\n✅ Policy SELECT: ${testExists.data[0]?.can_access ? 'AUTORISÉ' : 'REFUSÉ'}`);
  }
  
  // 4. Test policy UPDATE
  console.log('\n4️⃣ TEST POLICY UPDATE:\n');
  console.log('Policy UPDATE attendue:');
  console.log(`statut = 'brouillon' AND EXISTS (...)`);
  console.log('');
  
  const testUpdate = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT 
        '${factureAdmin.statut}' = 'brouillon' as statut_ok,
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = '${entrepriseProfileId}'
            AND profiles.role = 'entreprise'
            AND profiles.entreprise_id = '${factureAdmin.entreprise_id}'
        ) as ownership_ok;
    `
  }).catch(() => null);
  
  if (testUpdate && testUpdate.data) {
    const result = testUpdate.data[0];
    console.log(`Statut = brouillon? ${result.statut_ok ? '✅ OUI' : '❌ NON'}`);
    console.log(`Ownership OK? ${result.ownership_ok ? '✅ OUI' : '❌ NON'}`);
    console.log(`\nPolicy UPDATE: ${result.statut_ok && result.ownership_ok ? '✅ AUTORISÉ' : '❌ REFUSÉ'}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 RÉSULTAT:\n');
  
  if (profile && profile.entreprise_id === factureAdmin.entreprise_id) {
    console.log('✅ Ownership correct (profiles.entreprise_id match)');
  } else {
    console.log('❌ Ownership incorrect');
  }
  
  if (factureAdmin.statut === 'brouillon') {
    console.log('✅ Statut = brouillon (éditable)');
  } else {
    console.log(`❌ Statut = ${factureAdmin.statut} (non éditable)`);
  }
  
  console.log('\n⚠️ POUR TESTER RÉELLEMENT RLS:');
  console.log('   1. Se connecter comme entreprise dans le frontend');
  console.log('   2. Ouvrir Console Network + Console JS');
  console.log('   3. Cliquer "Éditer facture"');
  console.log('   4. Observer la requête exacte et la réponse');
  
  console.log('='.repeat(60));
}

testFactureUpdate().catch(console.error);
