#!/usr/bin/env node

/**
 * =====================================================
 * VÉRIFICATION: M48 appliquée en PROD ?
 * =====================================================
 * M48 contient déjà le fix de notify_technicien_assignment
 * Si M48 n'est pas en PROD, appliquer M53
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkM48Applied() {
  console.log('🔍 VÉRIFICATION: M48 appliquée en PROD?\n');
  console.log('='.repeat(60));
  
  try {
    // Vérifier le commentaire de la fonction
    const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          obj_description(p.oid, 'pg_proc') AS comment,
          pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'notify_technicien_assignment';
      `
    }).catch(() => ({ data: null, error: 'RPC non dispo' }));
    
    if (funcError) {
      console.log('⚠️  Impossible de vérifier via API');
      console.log('\n📋 VÉRIFIER MANUELLEMENT SUR PROD:\n');
      console.log('SELECT pg_get_functiondef(\'public.notify_technicien_assignment\'::regprocedure);\n');
      console.log('Chercher dans la définition:');
      console.log('  ✅ SI contient "profile_id" → M48 appliquée (OK)');
      console.log('  ❌ SI contient "user_id" → M48 NON appliquée (appliquer M53)\n');
      return;
    }
    
    if (!funcData || funcData.length === 0) {
      console.log('❌ Fonction notify_technicien_assignment introuvable en PROD\n');
      console.log('Action: Appliquer M53 immédiatement\n');
      return;
    }
    
    const comment = funcData[0].comment || '';
    const definition = funcData[0].definition || '';
    
    console.log('✅ Fonction trouvée en PROD\n');
    
    // Vérifier si M48 est appliquée
    const hasM48Comment = comment.includes('FIX M48') || comment.includes('M48');
    const hasProfileId = definition.includes('profile_id');
    const hasUserId = definition.toLowerCase().includes('user_id');
    const hasTicketReference = definition.includes('tickets') && definition.includes('reference');
    const hasMissionReference = definition.includes('NEW.reference');
    
    console.log('📝 Analyse de la fonction:\n');
    console.log(`   Commentaire contient M48: ${hasM48Comment ? '✅' : '❌'}`);
    console.log(`   Utilise profile_id: ${hasProfileId ? '✅' : '❌'}`);
    console.log(`   Utilise user_id: ${hasUserId ? '❌ (BUG)' : '✅'}`);
    console.log(`   Récupère tickets.reference: ${hasTicketReference ? '✅' : '❌'}`);
    console.log(`   Utilise NEW.reference: ${hasMissionReference ? '❌ (BUG)' : '✅'}`);
    
    if (hasProfileId && !hasUserId && hasTicketReference && !hasMissionReference) {
      console.log('\n🎉 M48 DÉJÀ APPLIQUÉE EN PROD!');
      console.log('   La fonction est correcte');
      console.log('   Pas besoin d\'appliquer M53\n');
      console.log('⚠️  MAIS l\'erreur persiste → autre source possible:');
      console.log('   - Vérifier RPC assign_technicien_to_mission (M52)');
      console.log('   - Vérifier autres triggers sur missions');
    } else {
      console.log('\n❌ M48 NON APPLIQUÉE EN PROD');
      console.log('   La fonction contient encore des bugs\n');
      console.log('🚀 ACTION IMMÉDIATE:');
      console.log('   Appliquer: supabase/migrations/_APPLY_M53_PROD_URGENT.sql');
      console.log('   Via: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql\n');
      
      if (hasUserId) {
        console.log('   🐛 BUG 1: Utilise user_id au lieu de profile_id');
      }
      if (hasMissionReference) {
        console.log('   🐛 BUG 2: Utilise NEW.reference au lieu de tickets.reference');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkM48Applied()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
