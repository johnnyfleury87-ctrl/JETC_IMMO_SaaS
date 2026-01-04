#!/usr/bin/env node
/**
 * AUDIT FINAL SUPABASE — MODE LECTURE SEULE
 * Script d'introspection complète de la base de données
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

// Essai avec supabase-js d'abord (plus fiable pour Supabase)
const { createClient } = require('@supabase/supabase-js');

// Récupération des credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquant dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Client pg en fallback (si nécessaire)
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

const results = {
  connection: {},
  migration_logs: [],
  tables: [],
  columns: [],
  rls_status: [],
  policies: [],
  functions: [],
  triggers: [],
  constraints: []
};

async function executeQuery(name, query) {
  try {
    console.log(`\n🔍 Exécution: ${name}...`);
    
    // Tentative via supabase-js RPC d'abord
    if (name.includes('migration_logs')) {
      const { data, error } = await supabase
        .from('migration_logs')
        .select('*')
        .order('executed_at');
      
      if (!error && data) {
        console.log(`✅ ${data.length} résultats (via Supabase JS)`);
        return data;
      }
    }
    
    // Fallback sur pg client
    const result = await client.query(query);
    console.log(`✅ ${result.rowCount || result.rows.length} résultats`);
    return result.rows;
  } catch (error) {
    console.error(`❌ Erreur ${name}:`, error.message);
    return [];
  }
}

async function runAudit() {
  let usingSupabaseJS = false;
  
  try {
    console.log('🔌 Test connexion Supabase...');
    
    // Test avec supabase-js d'abord
    try {
      const { data, error } = await supabase.from('migration_logs').select('count');
      if (!error) {
        console.log('✅ Connecté via Supabase JS');
        usingSupabaseJS = true;
      } else {
        throw new Error(error.message);
      }
    } catch (e) {
      console.log('⚠️ Supabase JS non disponible, tentative pg client...');
      await client.connect();
      console.log('✅ Connecté via pg client');
    }

    // 1. Info connexion
    results.connection.version = await executeQuery('Version PostgreSQL', 
      'SELECT version();'
    );
    
    results.connection.current_user = await executeQuery('Utilisateur actuel',
      'SELECT current_user, current_database(), current_schema();'
    );

    results.connection.schemas = await executeQuery('Schémas disponibles',
      "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;"
    );

    results.connection.roles = await executeQuery('Rôles actifs',
      "SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname;"
    );

    // 2. Migration logs (CRITIQUE)
    results.migration_logs = await executeQuery('Historique migrations',
      "SELECT * FROM public.migration_logs ORDER BY executed_at;"
    );

    // 3. Tables
    results.tables = await executeQuery('Tables publiques',
      `SELECT 
        schemaname, tablename, 
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        (SELECT reltuples::bigint FROM pg_class WHERE oid = (schemaname||'.'||tablename)::regclass) as estimated_rows
       FROM pg_tables 
       WHERE schemaname = 'public' 
       ORDER BY tablename;`
    );

    // 4. RLS Status (CRUCIAL)
    results.rls_status = await executeQuery('Statut RLS',
      `SELECT 
        schemaname, tablename,
        CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
       FROM pg_tables t
       JOIN pg_class c ON c.relname = t.tablename
       WHERE schemaname = 'public'
       ORDER BY tablename;`
    );

    // 5. Policies RLS
    results.policies = await executeQuery('Policies RLS',
      `SELECT 
        schemaname, tablename, policyname,
        CASE cmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END as command,
        CASE qual WHEN NULL THEN 'No check' ELSE pg_get_expr(qual, polrelid) END as using_expression,
        CASE with_check WHEN NULL THEN 'No check' ELSE pg_get_expr(with_check, polrelid) END as with_check_expression
       FROM pg_policies
       WHERE schemaname = 'public'
       ORDER BY tablename, policyname;`
    );

    // 6. Colonnes critiques (mode_diffusion, etc.)
    results.columns = await executeQuery('Colonnes critiques',
      `SELECT 
        table_schema, table_name, column_name, 
        data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' 
       AND (
         column_name LIKE '%mode_diffusion%' 
         OR column_name LIKE '%statut%'
         OR column_name LIKE '%diffuse%'
         OR column_name LIKE '%plafond%'
       )
       ORDER BY table_name, column_name;`
    );

    // 7. Fonctions RPC
    results.functions = await executeQuery('Fonctions RPC publiques',
      `SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       ORDER BY p.proname;`
    );

    // 8. Triggers
    results.triggers = await executeQuery('Triggers actifs',
      `SELECT 
        event_object_schema as schema,
        event_object_table as table_name,
        trigger_name,
        event_manipulation as event,
        action_timing as timing,
        action_statement as action
       FROM information_schema.triggers
       WHERE event_object_schema = 'public'
       ORDER BY event_object_table, trigger_name;`
    );

    // 9. Contraintes
    results.constraints = await executeQuery('Contraintes',
      `SELECT 
        tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
        CASE 
          WHEN tc.constraint_type = 'CHECK' THEN pg_get_constraintdef(c.oid)
          ELSE kcu.column_name
        END as details
       FROM information_schema.table_constraints tc
       LEFT JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       LEFT JOIN pg_constraint c ON c.conname = tc.constraint_name
       WHERE tc.table_schema = 'public'
       ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;`
    );

    // 10. Analyse spécifique mode_diffusion
    console.log('\n🎯 Analyse spécifique mode_diffusion...');
    
    results.mode_diffusion_analysis = {
      tickets_table: await executeQuery('Colonne tickets.mode_diffusion',
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' 
         AND table_name = 'tickets'
         AND column_name = 'mode_diffusion';`
      ),
      
      tickets_values: await executeQuery('Valeurs mode_diffusion dans tickets',
        `SELECT mode_diffusion, COUNT(*) as count
         FROM tickets
         WHERE mode_diffusion IS NOT NULL
         GROUP BY mode_diffusion
         ORDER BY count DESC;`
      ),
      
      tickets_constraint: await executeQuery('CHECK constraint mode_diffusion tickets',
        `SELECT conname, pg_get_constraintdef(oid) as definition
         FROM pg_constraint
         WHERE conrelid = 'public.tickets'::regclass
         AND contype = 'c'
         AND conname LIKE '%mode_diffusion%';`
      ),
      
      rpc_accept_ticket: await executeQuery('RPC accept_ticket_and_create_mission',
        `SELECT pg_get_functiondef(oid) as definition
         FROM pg_proc
         WHERE proname = 'accept_ticket_and_create_mission';`
      ),
      
      regies_entreprises_mode: await executeQuery('Colonne regies_entreprises.mode_diffusion',
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' 
         AND table_name = 'regies_entreprises'
         AND column_name = 'mode_diffusion';`
      ),
      
      enterprise_policies: await executeQuery('Policies entreprises sur tickets',
        `SELECT policyname, cmd, pg_get_expr(qual, polrelid) as using_clause
         FROM pg_policies
         WHERE schemaname = 'public'
         AND tablename = 'tickets'
         AND policyname LIKE '%entreprise%';`
      )
    };

    // Sauvegarder résultats bruts
    console.log('\n💾 Sauvegarde résultats bruts...');
    fs.writeFileSync(
      '_audit_db_results.json',
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('✅ Résultats sauvegardés dans _audit_db_results.json');

    console.log('\n✅ AUDIT TERMINÉ');
    console.log(`📊 Tables: ${results.tables.length}`);
    console.log(`📊 Policies: ${results.policies.length}`);
    console.log(`📊 Fonctions: ${results.functions.length}`);
    console.log(`📊 Migrations: ${results.migration_logs.length}`);

  } catch (error) {
    console.error('❌ ERREUR AUDIT:', error);
    throw error;
  } finally {
    if (!usingSupabaseJS) {
      await client.end();
    }
    console.log('🔌 Déconnecté');
  }
}

runAudit().catch(console.error);
