#!/usr/bin/env node

/**
 * =====================================================
 * AUDIT BUG: column "user_id" does not exist
 * =====================================================
 * Objectif: Identifier EXACTEMENT où user_id est référencé
 * dans les policies RLS, fonctions, ou triggers de la table missions
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function auditUserIdBug() {
  console.log('🔍 AUDIT: Recherche des références à user_id dans missions\n');
  console.log('='.repeat(60));
  
  try {
    // 1️⃣ Vérifier structure de la table missions
    console.log('\n📋 1. STRUCTURE DE LA TABLE MISSIONS');
    console.log('-'.repeat(60));
    
    const { data: columns, error: colError } = await supabase.rpc('get_table_columns', {
      p_table_name: 'missions'
    }).catch(() => ({ data: null, error: null }));
    
    // Méthode alternative si RPC n'existe pas
    const { data: missionsSchema, error: schemaError } = await supabase
      .from('missions')
      .select('*')
      .limit(0);
    
    console.log('Colonnes disponibles (via query):');
    if (schemaError) {
      console.log('❌ Erreur:', schemaError.message);
    } else {
      console.log('✅ Query réussie (structure existe)');
    }
    
    // 2️⃣ Récupérer TOUTES les policies RLS sur missions
    console.log('\n📜 2. POLICIES RLS SUR TABLE MISSIONS');
    console.log('-'.repeat(60));
    
    const { data: policies, error: polError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual AS using_clause,
          with_check AS check_clause
        FROM pg_policies
        WHERE tablename = 'missions'
        ORDER BY policyname;
      `
    }).catch(async () => {
      // Méthode alternative directe
      const pg = require('pg');
      const client = new pg.Client(process.env.DATABASE_URL);
      await client.connect();
      const result = await client.query(`
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual AS using_clause,
          with_check AS check_clause
        FROM pg_policies
        WHERE tablename = 'missions'
        ORDER BY policyname;
      `);
      await client.end();
      return { data: result.rows, error: null };
    });
    
    if (polError) {
      console.log('❌ Erreur récupération policies:', polError.message);
    } else if (policies && policies.length > 0) {
      console.log(`✅ ${policies.length} policies trouvées:\n`);
      
      for (const pol of policies) {
        console.log(`\n📌 Policy: ${pol.policyname}`);
        console.log(`   Command: ${pol.cmd}`);
        console.log(`   Roles: ${pol.roles}`);
        
        // Chercher user_id dans USING clause
        if (pol.using_clause && pol.using_clause.includes('user_id')) {
          console.log('   ⚠️  USING clause contient "user_id":');
          console.log(`   ${pol.using_clause}`);
        }
        
        // Chercher user_id dans WITH CHECK clause
        if (pol.check_clause && pol.check_clause.includes('user_id')) {
          console.log('   ⚠️  CHECK clause contient "user_id":');
          console.log(`   ${pol.check_clause}`);
        }
      }
    } else {
      console.log('⚠️  Aucune policy trouvée');
    }
    
    // 3️⃣ Récupérer TOUTES les fonctions liées à missions
    console.log('\n\n🔧 3. FONCTIONS/RPC LIÉES À MISSIONS');
    console.log('-'.repeat(60));
    
    const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          p.proname AS function_name,
          pg_get_functiondef(p.oid) AS function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND (
            p.proname ILIKE '%mission%'
            OR p.proname ILIKE '%technicien%'
            OR p.proname ILIKE '%assign%'
          )
        ORDER BY p.proname;
      `
    }).catch(async () => {
      const pg = require('pg');
      const client = new pg.Client(process.env.DATABASE_URL);
      await client.connect();
      const result = await client.query(`
        SELECT 
          p.proname AS function_name,
          pg_get_functiondef(p.oid) AS function_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND (
            p.proname ILIKE '%mission%'
            OR p.proname ILIKE '%technicien%'
            OR p.proname ILIKE '%assign%'
          )
        ORDER BY p.proname;
      `);
      await client.end();
      return { data: result.rows, error: null };
    });
    
    if (funcError) {
      console.log('❌ Erreur récupération fonctions:', funcError.message);
    } else if (functions && functions.length > 0) {
      console.log(`✅ ${functions.length} fonctions trouvées:\n`);
      
      for (const func of functions) {
        console.log(`\n🔧 Fonction: ${func.function_name}`);
        
        // Chercher user_id dans la définition
        if (func.function_definition && func.function_definition.includes('user_id')) {
          console.log('   ⚠️  CONTIENT "user_id"!');
          console.log('   Définition complète:');
          console.log(func.function_definition);
          console.log('\n' + '='.repeat(60));
        } else {
          console.log('   ✅ Pas de référence à user_id');
        }
      }
    } else {
      console.log('⚠️  Aucune fonction trouvée');
    }
    
    // 4️⃣ Récupérer TOUS les triggers sur missions
    console.log('\n\n⚡ 4. TRIGGERS SUR TABLE MISSIONS');
    console.log('-'.repeat(60));
    
    const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          t.tgname AS trigger_name,
          pg_get_triggerdef(t.oid) AS trigger_definition
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'missions'
          AND NOT t.tgisinternal
        ORDER BY t.tgname;
      `
    }).catch(async () => {
      const pg = require('pg');
      const client = new pg.Client(process.env.DATABASE_URL);
      await client.connect();
      const result = await client.query(`
        SELECT 
          t.tgname AS trigger_name,
          pg_get_triggerdef(t.oid) AS trigger_definition
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'missions'
          AND NOT t.tgisinternal
        ORDER BY t.tgname;
      `);
      await client.end();
      return { data: result.rows, error: null };
    });
    
    if (trigError) {
      console.log('❌ Erreur récupération triggers:', trigError.message);
    } else if (triggers && triggers.length > 0) {
      console.log(`✅ ${triggers.length} triggers trouvés:\n`);
      
      for (const trig of triggers) {
        console.log(`\n⚡ Trigger: ${trig.trigger_name}`);
        console.log(`   Définition: ${trig.trigger_definition}`);
        
        if (trig.trigger_definition && trig.trigger_definition.includes('user_id')) {
          console.log('   ⚠️  CONTIENT "user_id"!');
        }
      }
    } else {
      console.log('⚠️  Aucun trigger trouvé');
    }
    
    // 5️⃣ Test direct d'assignation pour reproduire l'erreur
    console.log('\n\n🧪 5. TEST ASSIGNATION POUR REPRODUIRE L\'ERREUR');
    console.log('-'.repeat(60));
    console.log('Tentative d\'appel de assign_technicien_to_mission...\n');
    
    // Récupérer une mission et un technicien de test
    const { data: testMissions } = await supabase
      .from('missions')
      .select('id, entreprise_id, technicien_id')
      .limit(1)
      .single()
      .catch(() => ({ data: null }));
    
    const { data: testTechniciens } = await supabase
      .from('techniciens')
      .select('id, entreprise_id')
      .limit(1)
      .single()
      .catch(() => ({ data: null }));
    
    if (testMissions && testTechniciens) {
      console.log(`Mission test: ${testMissions.id}`);
      console.log(`Technicien test: ${testTechniciens.id}`);
      
      // Essayer l'assignation
      const { data: assignResult, error: assignError } = await supabase
        .rpc('assign_technicien_to_mission', {
          p_mission_id: testMissions.id,
          p_technicien_id: testTechniciens.id
        });
      
      if (assignError) {
        console.log('\n❌ ERREUR REPRODUITE:');
        console.log(`   Message: ${assignError.message}`);
        console.log(`   Code: ${assignError.code}`);
        console.log(`   Details: ${JSON.stringify(assignError.details, null, 2)}`);
        console.log(`   Hint: ${assignError.hint}`);
      } else {
        console.log('\n✅ Assignation réussie:', assignResult);
      }
    } else {
      console.log('⚠️  Impossible de trouver des données de test');
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('🎯 FIN DE L\'AUDIT');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERREUR GLOBALE:', error.message);
    console.error(error);
  }
}

// Version alternative avec pg direct si Supabase RPC ne marche pas
async function auditWithPgDirect() {
  console.log('\n🔄 Audit direct avec pg...\n');
  
  const { Client } = require('pg');
  
  // Forcer IPv4 pour éviter les problèmes de connexion
  const dbUrl = process.env.DATABASE_URL.replace(
    '@db.bwzyajsrmfhrxdmfpyqy.supabase.co',
    '@aws-0-eu-central-1.pooler.supabase.com'
  );
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    options: '-c search_path=public',
  });
  
  try {
    await client.connect();
    console.log('✅ Connexion PostgreSQL établie\n');
    
    // 1. Structure table
    console.log('📋 1. COLONNES DE LA TABLE MISSIONS');
    console.log('-'.repeat(60));
    const colResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'missions'
      ORDER BY ordinal_position;
    `);
    console.log(colResult.rows);
    
    const hasUserId = colResult.rows.some(row => row.column_name === 'user_id');
    console.log(`\n❓ Colonne "user_id" existe? ${hasUserId ? '✅ OUI' : '❌ NON'}\n`);
    
    // 2. Policies
    console.log('\n📜 2. POLICIES RLS SUR MISSIONS');
    console.log('-'.repeat(60));
    const polResult = await client.query(`
      SELECT 
        policyname,
        cmd,
        qual AS using_clause,
        with_check AS check_clause
      FROM pg_policies
      WHERE tablename = 'missions'
      ORDER BY policyname;
    `);
    
    console.log(`${polResult.rows.length} policies trouvées\n`);
    for (const pol of polResult.rows) {
      console.log(`\n📌 ${pol.policyname} (${pol.cmd})`);
      
      if (pol.using_clause) {
        const hasUserId = pol.using_clause.toLowerCase().includes('user_id');
        console.log(`   USING: ${pol.using_clause}`);
        if (hasUserId) {
          console.log('   🚨 CONTIENT "user_id" !!!');
        }
      }
      
      if (pol.check_clause) {
        const hasUserId = pol.check_clause.toLowerCase().includes('user_id');
        console.log(`   CHECK: ${pol.check_clause}`);
        if (hasUserId) {
          console.log('   🚨 CONTIENT "user_id" !!!');
        }
      }
    }
    
    // 3. Fonctions
    console.log('\n\n🔧 3. FONCTIONS LIÉES À MISSIONS');
    console.log('-'.repeat(60));
    const funcResult = await client.query(`
      SELECT 
        p.proname AS function_name,
        pg_get_functiondef(p.oid) AS function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND (
          p.proname ILIKE '%mission%'
          OR p.proname ILIKE '%assign%'
        )
      ORDER BY p.proname;
    `);
    
    console.log(`${funcResult.rows.length} fonctions trouvées\n`);
    for (const func of funcResult.rows) {
      const hasUserId = func.function_definition && func.function_definition.toLowerCase().includes('user_id');
      console.log(`\n🔧 ${func.function_name}`);
      if (hasUserId) {
        console.log('   🚨 CONTIENT "user_id" !!!');
        console.log('\n' + func.function_definition);
        console.log('\n' + '='.repeat(60));
      } else {
        console.log('   ✅ Pas de user_id');
      }
    }
    
    // 4. Triggers
    console.log('\n\n⚡ 4. TRIGGERS SUR MISSIONS');
    console.log('-'.repeat(60));
    const trigResult = await client.query(`
      SELECT 
        t.tgname AS trigger_name,
        pg_get_triggerdef(t.oid) AS trigger_definition,
        p.proname AS function_name,
        pg_get_functiondef(p.oid) AS function_definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE n.nspname = 'public'
        AND c.relname = 'missions'
        AND NOT t.tgisinternal
      ORDER BY t.tgname;
    `);
    
    console.log(`${trigResult.rows.length} triggers trouvés\n`);
    for (const trig of trigResult.rows) {
      console.log(`\n⚡ ${trig.trigger_name}`);
      console.log(`   Appelle: ${trig.function_name}`);
      
      const trigHasUserId = trig.trigger_definition && trig.trigger_definition.toLowerCase().includes('user_id');
      const funcHasUserId = trig.function_definition && trig.function_definition.toLowerCase().includes('user_id');
      
      if (trigHasUserId) {
        console.log('   🚨 Trigger contient "user_id"');
        console.log(trig.trigger_definition);
      }
      
      if (funcHasUserId) {
        console.log('   🚨 Fonction trigger contient "user_id" !!!');
        console.log('\n' + trig.function_definition);
        console.log('\n' + '='.repeat(60));
      }
    }
    
    await client.end();
    console.log('\n✅ Audit terminé\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    await client.end();
  }
}

// Exécution
auditWithPgDirect()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
