/**
 * ======================================================
 * SCRIPT : APPLICATION MIGRATION M43
 * ======================================================
 * Applique les 3 fichiers de migration M43 dans l'ordre
 * 1. mission_signalements
 * 2. mission_champs_complementaires
 * 3. mission_historique_statuts
 * ======================================================
 */

const fs = require('fs');
const path = require('path');

// Note: Pas besoin de connexion Supabase pour lire les fichiers
// const { createClient } = require('@supabase/supabase-js');

// Liste des migrations dans l'ordre
const migrations = [
  '20260106000001_m43_mission_signalements.sql',
  '20260106000002_m43_mission_champs_complementaires.sql',
  '20260106000003_m43_mission_historique_statuts.sql'
];

async function applyMigration(filename) {
  console.log(`\n📄 Application : ${filename}`);
  
  try {
    // Lire le fichier SQL
    const filepath = path.join(__dirname, 'supabase', 'migrations', filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    
    console.log(`   Longueur SQL : ${sql.length} caractères`);
    
    // Exécuter via supabase.rpc (ou via pg client si trop complexe)
    // Note: Supabase JS client ne supporte pas l'exécution SQL directe
    // Il faut utiliser psql ou le SQL Editor
    
    console.log(`   ⚠️  Impossible d'exécuter SQL directement via @supabase/supabase-js`);
    console.log(`   ✅ Fichier lu avec succès`);
    console.log(`   📋 Contenu disponible pour copier/coller dans SQL Editor`);
    
    return { success: true, sql };
    
  } catch (error) {
    console.error(`   ❌ Erreur lecture fichier :`, error.message);
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 DÉBUT APPLICATION MIGRATION M43\n');
  console.log(` Dossier migrations : supabase/migrations/\n`);
  
  const results = [];
  
  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ migration, ...result });
  }
  
  console.log('\n\n📊 RÉSUMÉ');
  console.log('='.repeat(50));
  
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.migration}`);
  });
  
  console.log('\n⚠️  IMPORTANT');
  console.log('Les migrations doivent être appliquées via :');
  console.log('1. Supabase CLI : supabase db push');
  console.log('2. SQL Editor : https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql');
  console.log('\nChaque fichier SQL doit être copié/collé et exécuté dans l\'ordre.');
  
  // Sauvegarder SQL consolidé
  const consolidatedSQL = results
    .filter(r => r.success)
    .map(r => `-- ===== ${r.migration} =====\n\n${r.sql}`)
    .join('\n\n');
    
  const outputPath = path.join(__dirname, '_apply_m43_consolidated.sql');
  fs.writeFileSync(outputPath, consolidatedSQL, 'utf8');
  
  console.log(`\n✅ SQL consolidé sauvegardé : ${outputPath}`);
  console.log('   Ce fichier peut être copié/collé directement dans le SQL Editor.');
}

main().catch(error => {
  console.error('❌ Erreur script :', error);
  process.exit(1);
});
