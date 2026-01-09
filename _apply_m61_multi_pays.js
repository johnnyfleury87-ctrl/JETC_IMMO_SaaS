#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   🌍 MIGRATION M61 - SUPPORT MULTI-PAYS          ║');
console.log('╚═══════════════════════════════════════════════════╝\n');

async function applyMigration() {
  try {
    // Vérification présence fichier migration
    const migrationPath = './supabase/migrations/20260109000001_m61_npa_multi_pays.sql';
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Fichier migration introuvable:', migrationPath);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Connexion Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables environnement manquantes');
      console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log('📋 Fichier migration:', migrationPath);
    console.log('📏 Taille SQL:', sqlContent.length, 'caractères\n');
    
    console.log('🚀 Application migration M61...\n');
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sqlContent 
    });

    if (error) {
      console.error('❌ Erreur application migration:', error);
      process.exit(1);
    }

    console.log('\n✅ Migration M61 appliquée avec succès!\n');
    
    // Vérification état après migration
    console.log('🔍 Vérification contraintes...\n');
    
    const { data: constraints, error: errConstraints } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%npa%'
        ORDER BY constraint_name;
      `
    });

    if (!errConstraints && constraints) {
      console.log('Contraintes NPA actives:');
      constraints.forEach(c => {
        console.log(`  - ${c.constraint_name}: ${c.check_clause}`);
      });
    }

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║              ✅ MIGRATION TERMINÉE                ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Exception:', error.message);
    process.exit(1);
  }
}

applyMigration();
