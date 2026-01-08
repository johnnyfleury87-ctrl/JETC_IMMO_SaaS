#!/usr/bin/env node

/**
 * =====================================================
 * RÉCUPÉRATION DÉFINITION notify_technicien_assignment
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getFunctionDef() {
  console.log('🔍 RÉCUPÉRATION notify_technicien_assignment depuis PROD\n');
  
  try {
    // Méthode 1: Via SQL direct
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `SELECT pg_get_functiondef('public.notify_technicien_assignment'::regprocedure);`
    }).catch(() => ({ data: null, error: 'RPC non dispo' }));
    
    if (error) {
      console.log('⚠️  RPC exec_sql non disponible');
      console.log('📋 Utiliser cette commande SQL manuellement:\n');
      console.log('SELECT pg_get_functiondef(\'public.notify_technicien_assignment\'::regprocedure);\n');
      
      // Chercher dans les migrations locales
      console.log('🔄 Recherche dans les migrations locales...\n');
      const fs = require('fs');
      const { execSync } = require('child_process');
      
      try {
        const result = execSync(
          'grep -r "notify_technicien_assignment" supabase/migrations/*.sql',
          { encoding: 'utf8' }
        );
        console.log('📁 Trouvé dans les migrations:\n');
        console.log(result);
      } catch (e) {
        console.log('❌ Pas trouvé dans les migrations');
      }
      
      return;
    }
    
    if (data && data[0]) {
      const definition = data[0].pg_get_functiondef;
      console.log('✅ DÉFINITION RÉCUPÉRÉE:\n');
      console.log('='.repeat(80));
      console.log(definition);
      console.log('='.repeat(80));
      
      // Chercher les user_id
      if (definition.includes('user_id')) {
        console.log('\n🚨 RÉFÉRENCES À user_id TROUVÉES:\n');
        const lines = definition.split('\n');
        lines.forEach((line, i) => {
          if (line.toLowerCase().includes('user_id')) {
            console.log(`Ligne ${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

getFunctionDef()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
