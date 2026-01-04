#!/usr/bin/env node
/**
 * ÉTAPE 3 - PRÉPARATION M41 (RPC mode_diffusion)
 * 
 * Objectif: Vérifier version actuelle RPC et préparer M41
 * 1. Extraire définition RPC accept_ticket_and_create_mission
 * 2. Identifier terminologie (M05: public/assigné vs M41: general/restreint)
 * 3. Préparer SQL M41 pour application manuelle
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  timestamp: new Date().toISOString(),
  etape: '3 - Préparation M41',
  checks: {}
};

/**
 * Lire contenu migration M05 (version obsolète)
 */
function readMigrationM05() {
  const m05Path = 'supabase/migrations/20251226170400_m05_fix_rpc_accept_ticket.sql';
  
  if (!fs.existsSync(m05Path)) {
    return { exists: false, content: null };
  }
  
  const content = fs.readFileSync(m05Path, 'utf8');
  
  // Extraire la partie RPC (lignes 49-71 environ)
  const rpcMatch = content.match(/CREATE OR REPLACE FUNCTION accept_ticket_and_create_mission[\s\S]*?END;/);
  
  return {
    exists: true,
    content: content,
    rpcDefinition: rpcMatch ? rpcMatch[0] : null,
    hasPublic: content.includes("'public'"),
    hasAssigne: content.includes("'assigné'") || content.includes("'assigne'"),
    hasGeneral: content.includes("'general'"),
    hasRestreint: content.includes("'restreint'")
  };
}

/**
 * Lire contenu migration M41 (version correcte)
 */
function readMigrationM41() {
  const m41Path = 'supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql';
  
  if (!fs.existsSync(m41Path)) {
    return { exists: false, content: null };
  }
  
  const content = fs.readFileSync(m41Path, 'utf8');
  
  return {
    exists: true,
    content: content,
    hasGeneral: content.includes("'general'"),
    hasRestreint: content.includes("'restreint'"),
    hasPublic: content.includes("'public'"),
    hasAssigne: content.includes("'assigné'") || content.includes("'assigne'")
  };
}

/**
 * Tenter extraction RPC via pg_get_functiondef (si accessible)
 */
async function tryExtractRPCFromDB() {
  console.log('🔍 Tentative extraction RPC depuis DB (pg_proc)...');
  
  // Test 1: Via information_schema.routines
  try {
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('*')
      .eq('routine_name', 'accept_ticket_and_create_mission')
      .eq('routine_schema', 'public');
    
    if (!error && data) {
      console.log('   ✅ information_schema.routines accessible');
      return { method: 'information_schema', success: true, data };
    }
  } catch (err) {
    // Not accessible
  }
  
  console.log('   ⚠️ Pas d\'accès direct pg_proc via SDK\n');
  return { method: null, success: false, data: null };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('ÉTAPE 3 - PRÉPARATION M41 (FIX RPC)');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log('🎯 OBJECTIF: Remplacer RPC version M05 par M41');
  console.log('   Blocker #2: Mode diffusion invalide "general"\n');
  
  // ═══════════════════════════════════════════════════
  // CHECK 1: Lire migration M05 (version actuelle présumée)
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 1: Analyse migration M05 (obsolète)      │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  const m05 = readMigrationM05();
  results.checks.m05_analysis = m05;
  
  if (m05.exists) {
    console.log('✅ Migration M05 trouvée');
    console.log(`   Terminologie détectée:`);
    console.log(`   - 'public':    ${m05.hasPublic ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - 'assigné':   ${m05.hasAssigne ? '✅ OUI' : '❌ NON'}`);
    console.log(`   - 'general':   ${m05.hasGeneral ? '❌ NON' : '✅ ABSENT (attendu)'}`);
    console.log(`   - 'restreint': ${m05.hasRestreint ? '❌ NON' : '✅ ABSENT (attendu)'}`);
    
    if (m05.hasPublic && m05.hasAssigne && !m05.hasGeneral) {
      console.log('\n   🔴 CONFIRMATION: M05 utilise ANCIENNE terminologie');
      console.log('      → Cause du blocker "Mode diffusion invalide: general"\n');
    }
  } else {
    console.log('⚠️ Migration M05 introuvable (fichier déplacé?)\n');
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 2: Lire migration M41 (version correcte)
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 2: Analyse migration M41 (correcte)      │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  const m41 = readMigrationM41();
  results.checks.m41_analysis = m41;
  
  if (m41.exists) {
    console.log('✅ Migration M41 trouvée');
    console.log(`   Terminologie détectée:`);
    console.log(`   - 'general':   ${m41.hasGeneral ? '✅ OUI (attendu)' : '❌ NON'}`);
    console.log(`   - 'restreint': ${m41.hasRestreint ? '✅ OUI (attendu)' : '❌ NON'}`);
    console.log(`   - 'public':    ${m41.hasPublic ? '⚠️ OUI (devrait être absent)' : '✅ NON'}`);
    console.log(`   - 'assigné':   ${m41.hasAssigne ? '⚠️ OUI (devrait être absent)' : '✅ NON'}`);
    
    if (m41.hasGeneral && m41.hasRestreint && !m41.hasPublic) {
      console.log('\n   ✅ VALIDATION: M41 utilise NOUVELLE terminologie');
      console.log('      → Fix blocker #2 après application\n');
    }
  } else {
    console.log('❌ Migration M41 introuvable!\n');
    console.log('   Chemin attendu: supabase/migrations/20260104001700_m41_harmonize_rpc_acceptation.sql\n');
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 3: Tentative extraction RPC DB
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 3: Version RPC en production             │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  const dbRpc = await tryExtractRPCFromDB();
  results.checks.db_rpc = dbRpc;
  
  if (!dbRpc.success) {
    console.log('⚠️ Extraction RPC DB impossible via SDK (normal)');
    console.log('   → Validation manuelle requise via SQL (pg_get_functiondef)\n');
  }
  
  // ═══════════════════════════════════════════════════
  // CHECK 4: Copier M41 pour application
  // ═══════════════════════════════════════════════════
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ CHECK 4: Préparation M41 pour application      │');
  console.log('└─────────────────────────────────────────────────┘\n');
  
  if (m41.exists) {
    const outputSql = '_fix_output/03_m41_to_apply.sql';
    fs.writeFileSync(outputSql, m41.content);
    console.log(`✅ Migration M41 copiée: ${outputSql}`);
    
    const lines = m41.content.split('\n').length;
    const size = (m41.content.length / 1024).toFixed(1);
    console.log(`   📄 ${lines} lignes, ${size} KB\n`);
    
    results.checks.m41_prepared = {
      path: outputSql,
      lines: lines,
      size_kb: parseFloat(size)
    };
  } else {
    console.log('❌ Impossible de préparer M41 (fichier introuvable)\n');
    results.checks.m41_prepared = { success: false };
  }
  
  // ═══════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('RÉSUMÉ PRÉPARATION M41');
  console.log('═══════════════════════════════════════════════════\n');
  
  const m05Obsolete = m05.exists && m05.hasPublic && m05.hasAssigne;
  const m41Ready = m41.exists && m41.hasGeneral && m41.hasRestreint;
  
  console.log(`✓ M05 (obsolète) identifiée:    ${m05Obsolete ? '✅ OUI' : '⚠️ INCERTAIN'}`);
  console.log(`✓ M41 (correcte) prête:         ${m41Ready ? '✅ OUI' : '❌ NON'}`);
  console.log(`✓ SQL copié pour application:   ${m41.exists ? '✅ OUI' : '❌ NON'}`);
  
  results.summary = {
    m05_obsolete_confirmed: m05Obsolete,
    m41_ready: m41Ready,
    m41_prepared: m41.exists,
    validation: m41Ready ? 'READY_TO_APPLY' : 'ERROR'
  };
  
  if (m41Ready) {
    console.log(`\n🎯 STATUT: ✅ PRÊT POUR APPLICATION`);
    console.log(`   → Fichier: _fix_output/03_m41_to_apply.sql`);
    console.log(`   → Action: Exécuter dans Supabase Studio SQL Editor\n`);
  } else {
    console.log(`\n🎯 STATUT: ❌ ERREUR`);
    console.log(`   → Migration M41 introuvable ou invalide\n`);
  }
  
  // Sauvegarder résultats
  const outputPath = '_fix_output/03_pre_apply_m41_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Résultats: ${outputPath}\n`);
  
  process.exit(m41Ready ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
