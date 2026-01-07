/**
 * AUDIT RLS - POLICIES MISSIONS CÔTÉ TECHNICIEN
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditRLS() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔒 AUDIT RLS - POLICIES MISSIONS POUR TECHNICIENS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Récupération des policies sur la table missions
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'missions');

    if (error) {
      console.log('⚠️ Impossible de lire pg_policies directement, fallback SQL...\n');
      
      // Requête SQL directe
      const query = `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual as using_clause,
          with_check
        FROM pg_policies
        WHERE tablename = 'missions'
        ORDER BY policyname;
      `;
      
      console.log('Requête à exécuter manuellement dans SQL Editor:\n');
      console.log('```sql');
      console.log(query);
      console.log('```\n');
    } else {
      console.log(`📋 Policies trouvées: ${policies?.length || 0}\n`);
      
      if (policies && policies.length > 0) {
        policies.forEach((policy, idx) => {
          console.log(`${idx + 1}. ${policy.policyname}`);
          console.log(`   Table: ${policy.tablename}`);
          console.log(`   Command: ${policy.cmd}`);
          console.log(`   Roles: ${policy.roles}`);
          console.log(`   USING: ${policy.qual || '(non défini)'}`);
          console.log(`   WITH CHECK: ${policy.with_check || '(non défini)'}`);
          console.log('');
        });
      }
    }

    // Affichage de la policy attendue
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ POLICY ATTENDUE POUR TECHNICIENS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('```sql');
    console.log('-- Policy SELECT: technicien voit ses missions');
    console.log('CREATE POLICY "techniciens_view_own_missions" ON missions');
    console.log('  FOR SELECT');
    console.log('  TO authenticated');
    console.log('  USING (');
    console.log('    EXISTS (');
    console.log('      SELECT 1');
    console.log('      FROM techniciens t');
    console.log('      WHERE t.id = missions.technicien_id');
    console.log('        AND t.profile_id = auth.uid()');
    console.log('    )');
    console.log('  );');
    console.log('');
    console.log('-- OU version alternative (si techniciens.id == techniciens.profile_id):');
    console.log('CREATE POLICY "techniciens_view_own_missions_v2" ON missions');
    console.log('  FOR SELECT');
    console.log('  TO authenticated');
    console.log('  USING (');
    console.log('    technicien_id = auth.uid()');
    console.log('  );');
    console.log('```\n');

    // Test pratique avec un compte technicien
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST PRATIQUE - VISIBILITÉ TECHNICIEN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Récupérer un technicien de test
    const { data: techniciens } = await supabase
      .from('techniciens')
      .select('id, profile_id, email')
      .limit(1)
      .single();
    
    if (techniciens) {
      console.log(`Technicien test: ${techniciens.email}`);
      console.log(`  profile_id: ${techniciens.profile_id}`);
      console.log(`  technicien.id: ${techniciens.id}`);
      console.log('');
      
      // Vérifier les missions assignées à ce technicien (avec service_role)
      const { data: missionsServiceRole } = await supabase
        .from('missions')
        .select('id, statut, technicien_id')
        .eq('technicien_id', techniciens.id);
      
      console.log(`Missions assignées (service_role): ${missionsServiceRole?.length || 0}`);
      
      // Créer un client avec le profil du technicien (simulation)
      console.log('\n⚠️ Pour tester réellement la RLS:');
      console.log('1. Connectez-vous avec: demo.technicien@test.app / Demo1234!');
      console.log('2. Ouvrez la console navigateur');
      console.log('3. Exécutez:');
      console.log('```javascript');
      console.log('const { data, error } = await supabase');
      console.log('  .from("missions")');
      console.log('  .select("id, statut, technicien_id");');
      console.log('console.log("Missions visibles:", data?.length);');
      console.log('console.log("Erreur:", error);');
      console.log('```');
    }

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

auditRLS();
