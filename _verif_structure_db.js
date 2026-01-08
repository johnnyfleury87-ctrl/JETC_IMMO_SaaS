const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifierStructureDB() {
  console.log('🔍 VÉRIFICATION STRUCTURE BASE DONNÉES');
  console.log('='.repeat(60));
  
  try {
    // 1. Lister toutes les tables accessibles
    console.log('\n📋 1. TABLES ACCESSIBLES');
    console.log('-'.repeat(60));
    
    const tables = ['profiles', 'regies', 'entreprises', 'techniciens', 'locataires', 
                    'immeubles', 'logements', 'tickets', 'missions'];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count} enregistrements`);
      }
    }

    // 2. Vérifier fonction RPC
    console.log('\n📋 2. FONCTION RPC assign_technicien_to_mission');
    console.log('-'.repeat(60));
    
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('assign_technicien_to_mission', {
        p_mission_id: '00000000-0000-0000-0000-000000000000',  // UUID fictif
        p_technicien_id: '00000000-0000-0000-0000-000000000000'
      });

    if (rpcError) {
      if (rpcError.message.includes('does not exist')) {
        console.error('❌ Fonction assign_technicien_to_mission INEXISTANTE');
        console.error('💡 M51 n\'a PAS été appliquée');
        console.error('\n📝 SOLUTION: Appliquer M51 via Dashboard SQL Editor');
        console.error('   Fichier: supabase/migrations/20260107000100_m51_create_assign_technicien_rpc.sql\n');
      } else if (rpcError.message.includes('user_id')) {
        console.error('❌ Fonction existe mais erreur "user_id"');
        console.error('💡 Policies RLS utilisent "user_id"');
        console.error('\n📝 SOLUTION: Appliquer M46 via Dashboard SQL Editor');
        console.error('   Fichier: supabase/migrations/20260106000300_m46_fix_user_id_policies.sql\n');
      } else if (rpcError.message.includes('Mission non trouvée') || rpcError.message.includes('introuvable')) {
        console.log('✅ Fonction existe et fonctionne (erreur attendue: mission fictive)');
        console.log('   Message:', rpcError.message);
      } else {
        console.error('⚠️ Erreur inattendue:', rpcError.message);
      }
    } else {
      console.log('✅ Fonction existe et s\'exécute');
    }

    // 3. Test SELECT avec erreur potentielle user_id
    console.log('\n📋 3. TEST POLICIES RLS');
    console.log('-'.repeat(60));
    
    console.log('\n🧪 Test SELECT missions...');
    const { data: m, error: mErr } = await supabase
      .from('missions')
      .select('id, statut')
      .limit(1);
    
    if (mErr && mErr.message.includes('user_id')) {
      console.error('❌ Policy SELECT missions utilise "user_id"');
      console.error('🔥 PROBLÈME IDENTIFIÉ: M46 n\'a PAS été appliquée correctement');
    } else if (mErr) {
      console.log('⚠️ Autre erreur:', mErr.message);
    } else {
      console.log('✅ SELECT missions OK');
    }
    
    console.log('\n🧪 Test SELECT techniciens...');
    const { data: t, error: tErr } = await supabase
      .from('techniciens')
      .select('id, nom')
      .limit(1);
    
    if (tErr && tErr.message.includes('user_id')) {
      console.error('❌ Policy SELECT techniciens utilise "user_id"');
      console.error('🔥 PROBLÈME IDENTIFIÉ: M46 n\'a PAS été appliquée correctement');
    } else if (tErr) {
      console.log('⚠️ Autre erreur:', tErr.message);
    } else {
      console.log('✅ SELECT techniciens OK');
    }

    // 4. Résumé et diagnostic
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC FINAL');
    console.log('='.repeat(60));
    
    const hasMissions = !mErr && m;
    const hasTechniciens = !tErr && t;
    const hasUserIdError = (mErr && mErr.message.includes('user_id')) || (tErr && tErr.message.includes('user_id'));
    
    if (hasUserIdError) {
      console.log('\n🔥 ERREUR BLOQUANTE IDENTIFIÉE: column "user_id" does not exist\n');
      console.log('CAUSE:');
      console.log('  Les policies RLS utilisent encore "user_id" au lieu de auth.uid()');
      console.log('  M46 n\'a pas été appliquée OU policies ont été recréées après\n');
      console.log('SOLUTION IMMÉDIATE:');
      console.log('  1. Ouvrir Supabase Dashboard: https://supabase.com/dashboard');
      console.log('  2. Aller dans: SQL Editor');
      console.log('  3. Copier-coller TOUT le contenu de:');
      console.log('     supabase/migrations/20260106000300_m46_fix_user_id_policies.sql');
      console.log('  4. Exécuter (bouton Run)');
      console.log('  5. Vérifier messages: doit afficher "✅ M46: Migration réussie"\n');
      console.log('ALTERNATIVE (script unique):');
      console.log('  Créer un script _fix_policies_user_id.sql avec UNIQUEMENT les DROP/CREATE');
      console.log('  des policies problématiques\n');
    } else if (!hasMissions || !hasTechniciens) {
      console.log('\n⚠️ BASE DE DONNÉES VIDE\n');
      console.log('Aucune mission ou technicien en base pour tester');
      console.log('Le workflow ne peut pas être testé sans données\n');
    } else {
      console.log('\n✅ STRUCTURE DB CORRECTE\n');
      console.log('Policies RLS semblent OK');
      console.log('Données présentes pour test\n');
    }

  } catch (error) {
    console.error('\n💥 ERREUR FATALE:', error.message);
  }
}

verifierStructureDB().catch(console.error);
