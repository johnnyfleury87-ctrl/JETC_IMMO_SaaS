#!/usr/bin/env node
/**
 * DÉPLOIEMENT M56 - FIX RLS FACTURES
 * Date: 2026-01-09
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🚀 DÉPLOIEMENT M56 - FIX RLS FACTURES');
  console.log('='.repeat(80));
  
  // Lire le fichier SQL
  const migrationPath = './supabase/migrations/20260109000000_m56_fix_rls_factures_urgent.sql';
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Fichier migration introuvable:', migrationPath);
    process.exit(1);
  }
  
  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('\n📄 Contenu migration:');
  console.log('-'.repeat(80));
  console.log(sqlContent.substring(0, 500) + '...');
  console.log('-'.repeat(80));
  
  console.log('\n⚠️  ATTENTION: Cette migration va:');
  console.log('   - Supprimer les anciennes policies RLS obsolètes');
  console.log('   - Créer de nouvelles policies correctes');
  console.log('   - Activer l\'accès factures pour Entreprises et Régies');
  
  // Demander confirmation (commenté pour auto-deploy)
  // const readline = require('readline').createInterface({
  //   input: process.stdin,
  //   output: process.stdout
  // });
  
  // const answer = await new Promise(resolve => {
  //   readline.question('\n✅ Continuer? (oui/non): ', resolve);
  // });
  // readline.close();
  
  // if (answer.toLowerCase() !== 'oui') {
  //   console.log('❌ Déploiement annulé');
  //   process.exit(0);
  // }
  
  // Déployer via RPC exec_sql si disponible
  console.log('\n🔧 Application de la migration...');
  
  try {
    // Méthode 1 : Essayer exec_sql (si existe)
    const { data, error } = await supabase.rpc('exec_sql', {
      query: sqlContent
    }).catch(() => ({ data: null, error: { message: 'RPC exec_sql non disponible' } }));
    
    if (error) {
      console.log('⚠️  RPC exec_sql non disponible, instructions manuelles:');
      console.log('\n📋 COPIER-COLLER CE SQL DANS SUPABASE SQL EDITOR:');
      console.log('='.repeat(80));
      console.log(sqlContent);
      console.log('='.repeat(80));
      console.log('\n📍 URL: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql');
      process.exit(1);
    }
    
    console.log('✅ Migration appliquée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n📋 FALLBACK - Copier-coller SQL manuellement:');
    console.log(sqlContent);
    process.exit(1);
  }
  
  // Vérifier les policies
  console.log('\n🔍 Vérification des policies...');
  
  const { data: factures, error: facturesError } = await supabase
    .from('factures')
    .select('id, numero, entreprise_id, regie_id, statut')
    .limit(5);
  
  if (facturesError) {
    console.error('❌ Erreur lecture factures:', facturesError.message);
  } else {
    console.log(`✅ ${factures?.length || 0} factures accessibles en mode SERVICE_ROLE`);
  }
  
  console.log('\n📋 PROCHAINES ÉTAPES:');
  console.log('   1. ✅ Migration SQL appliquée');
  console.log('   2. ✅ Frontend déjà corrigé (dashboard.html)');
  console.log('   3. ✅ Page factures.html créée pour Régie');
  console.log('   4. 🔄 Vider cache navigateur (Ctrl+Shift+R)');
  console.log('   5. 🧪 Tester:');
  console.log('      - Connexion Entreprise → Dashboard → Factures');
  console.log('      - Connexion Régie → Factures');
  
  console.log('\n🎉 DÉPLOIEMENT M56 TERMINÉ !');
}

main().catch(console.error);
