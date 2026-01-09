const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFactureAccess() {
  console.log('🔍 DEBUG ACCÈS FACTURE ÉDITION\n');
  
  // 1. Trouver une facture brouillon d'une entreprise
  const { data: factures } = await supabaseAdmin
    .from('factures')
    .select('id, numero, mission_id, entreprise_id, regie_id, statut, created_at')
    .eq('statut', 'brouillon')
    .limit(3);
  
  if (!factures || factures.length === 0) {
    console.log('❌ Aucune facture brouillon trouvée');
    console.log('   Créer une facture test via interface entreprise d\'abord\n');
    return;
  }
  
  console.log(`✅ ${factures.length} facture(s) brouillon trouvée(s):\n`);
  factures.forEach((f, i) => {
    console.log(`${i+1}. Facture: ${f.numero} (${f.id})`);
    console.log(`   Mission: ${f.mission_id}`);
    console.log(`   Entreprise: ${f.entreprise_id}`);
    console.log(`   Régie: ${f.regie_id}`);
    console.log('');
  });
  
  const testFacture = factures[0];
  
  // 2. Vérifier que entreprise_id est un UUID de profile
  console.log('2️⃣ VÉRIFICATION OWNERSHIP:\n');
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, entreprise_id')
    .eq('id', testFacture.entreprise_id)
    .maybeSingle();
  
  if (profile) {
    console.log(`✅ Profile existe: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   entreprise_id: ${profile.entreprise_id}`);
    console.log('');
    
    if (profile.role !== 'entreprise') {
      console.log('⚠️ ATTENTION: Le profile n\'est pas de type entreprise');
    }
  } else {
    console.log('❌ PROBLÈME: factures.entreprise_id ne correspond à aucun profile');
    console.log(`   Facture entreprise_id: ${testFacture.entreprise_id}`);
    console.log('   → RLS "entreprise_id = auth.uid()" ne matchera JAMAIS\n');
  }
  
  // 3. Vérifier policies RLS
  console.log('3️⃣ POLICIES RLS FACTURES:\n');
  const { data: policies, error: policiesError } = await supabaseAdmin
    .rpc('exec_sql', {
      sql: `
        SELECT policyname, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'factures' 
        AND cmd = 'SELECT'
        ORDER BY policyname;
      `
    })
    .catch(() => null);
  
  if (policies && policies.length > 0) {
    console.log(`✅ ${policies.length} policy/ies SELECT trouvée(s):\n`);
    policies.forEach(p => {
      console.log(`Policy: ${p.policyname}`);
      console.log(`Using: ${p.qual}`);
      console.log('');
    });
  } else {
    console.log('⚠️ Impossible de lire policies (permissions)');
    console.log('   Vérifier manuellement dans Supabase Dashboard\n');
  }
  
  // 4. Test requête entreprise
  console.log('4️⃣ TEST REQUÊTE IDENTIQUE AU FRONTEND:\n');
  console.log(`SELECT * FROM factures WHERE id = '${testFacture.id}' -- .single()`);
  console.log('');
  
  console.log('='.repeat(60));
  console.log('📋 DIAGNOSTIC:\n');
  
  if (!profile) {
    console.log('❌ PROBLÈME IDENTIFIÉ:');
    console.log('   factures.entreprise_id ne pointe PAS vers profiles.id');
    console.log('   → RLS policy "entreprise_id = auth.uid()" ne fonctionne pas');
    console.log('');
    console.log('✅ SOLUTION:');
    console.log('   Policy doit utiliser profiles.entreprise_id:');
    console.log('   EXISTS (');
    console.log('     SELECT 1 FROM profiles');
    console.log('     WHERE profiles.id = auth.uid()');
    console.log('     AND profiles.entreprise_id = factures.entreprise_id');
    console.log('   )');
  } else if (profile.role !== 'entreprise') {
    console.log('⚠️ Incohérence rôle profile');
  } else {
    console.log('✅ Structure semble correcte, vérifier policies');
  }
  
  console.log('='.repeat(60));
}

debugFactureAccess().catch(console.error);
