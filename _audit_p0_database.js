#!/usr/bin/env node
/**
 * AUDIT P0 - STRUCTURE DATABASE RÉELLE
 * Vérifie : tables, colonnes, RLS policies, fonctions RPC
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:[@Asterix1987]@db.bwzyajsrmfhrxdmfpyqy.supabase.co:5432/postgres';

async function auditDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connecté à Supabase DB\n');

    // ==========================================
    // 1. LISTER TOUTES LES TABLES PUBLIC
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TABLES DU SCHÉMA PUBLIC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    tablesResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.table_name} (${row.column_count} colonnes)`);
    });
    console.log('');

    // ==========================================
    // 2. DÉTAIL TABLE PROFILES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 TABLE PROFILES (DÉTAIL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const profilesColumns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
      ORDER BY ordinal_position;
    `);
    
    if (profilesColumns.rows.length > 0) {
      profilesColumns.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '🔒 NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
    } else {
      console.log('⚠️ Table profiles n\'existe pas');
    }
    console.log('');

    // Compter les profils par rôle
    try {
      const profilesCount = await client.query(`
        SELECT 
          role,
          COUNT(*) as count
        FROM profiles
        GROUP BY role
        ORDER BY count DESC;
      `);
      
      console.log('📊 Répartition des profils par rôle:');
      profilesCount.rows.forEach(row => {
        console.log(`  • ${row.role || '(null)'}: ${row.count}`);
      });
      console.log('');
    } catch (err) {
      console.log('⚠️ Erreur récupération profils:', err.message, '\n');
    }

    // ==========================================
    // 3. DÉTAIL TABLE TICKETS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 TABLE TICKETS (DÉTAIL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const ticketsColumns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tickets'
      ORDER BY ordinal_position;
    `);
    
    if (ticketsColumns.rows.length > 0) {
      ticketsColumns.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️ Table tickets n\'existe pas');
    }
    console.log('');

    // ==========================================
    // 4. DÉTAIL TABLE ENTREPRISES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏢 TABLE ENTREPRISES (DÉTAIL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const entreprisesColumns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'entreprises'
      ORDER BY ordinal_position;
    `);
    
    if (entreprisesColumns.rows.length > 0) {
      entreprisesColumns.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️ Table entreprises n\'existe pas');
    }
    console.log('');

    // ==========================================
    // 5. DÉTAIL TABLE TECHNICIENS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 TABLE TECHNICIENS (DÉTAIL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const techniciensColumns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'techniciens'
      ORDER BY ordinal_position;
    `);
    
    if (techniciensColumns.rows.length > 0) {
      techniciensColumns.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️ Table techniciens n\'existe pas');
    }
    console.log('');

    // ==========================================
    // 6. DÉTAIL TABLE MISSIONS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 TABLE MISSIONS (DÉTAIL)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const missionsColumns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'missions'
      ORDER BY ordinal_position;
    `);
    
    if (missionsColumns.rows.length > 0) {
      missionsColumns.rows.forEach(col => {
        console.log(`  • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️ Table missions n\'existe pas');
    }
    console.log('');

    // ==========================================
    // 7. RLS POLICIES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 RLS POLICIES (PAR TABLE)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const rlsPolicies = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    
    if (rlsPolicies.rows.length > 0) {
      let currentTable = '';
      rlsPolicies.rows.forEach(policy => {
        if (policy.tablename !== currentTable) {
          currentTable = policy.tablename;
          console.log(`\n📋 ${currentTable.toUpperCase()}`);
        }
        console.log(`  • ${policy.policyname}`);
        console.log(`    - Commande: ${policy.cmd}`);
        console.log(`    - Rôles: ${policy.roles.join(', ')}`);
        if (policy.qual) {
          console.log(`    - Condition: ${policy.qual.substring(0, 100)}${policy.qual.length > 100 ? '...' : ''}`);
        }
      });
    } else {
      console.log('⚠️ Aucune policy RLS trouvée');
    }
    console.log('');

    // ==========================================
    // 8. FONCTIONS RPC
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚙️ FONCTIONS RPC DISPONIBLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const rpcFunctions = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY p.proname;
    `);
    
    if (rpcFunctions.rows.length > 0) {
      rpcFunctions.rows.forEach((func, idx) => {
        console.log(`${idx + 1}. ${func.function_name}(${func.arguments || 'void'})`);
      });
    } else {
      console.log('⚠️ Aucune fonction RPC trouvée');
    }
    console.log('');

    // ==========================================
    // 9. VÉRIFICATION AUTH.USERS ↔ PROFILES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 COHÉRENCE AUTH.USERS ↔ PROFILES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      // Users sans profile
      const usersWithoutProfile = await client.query(`
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL;
      `);
      
      if (usersWithoutProfile.rows.length > 0) {
        console.log('⚠️ Users sans profile:');
        usersWithoutProfile.rows.forEach(user => {
          console.log(`  • ${user.email} (${user.id})`);
        });
      } else {
        console.log('✅ Tous les users ont un profile');
      }
      console.log('');

      // Profiles sans user
      const profilesWithoutUser = await client.query(`
        SELECT p.id, p.email
        FROM public.profiles p
        LEFT JOIN auth.users au ON p.id = au.id
        WHERE au.id IS NULL;
      `);
      
      if (profilesWithoutUser.rows.length > 0) {
        console.log('⚠️ Profiles orphelins (sans user):');
        profilesWithoutUser.rows.forEach(profile => {
          console.log(`  • ${profile.email || '(no email)'} (${profile.id})`);
        });
      } else {
        console.log('✅ Tous les profiles ont un user auth');
      }
      console.log('');

      // Profiles avec role null
      const profilesNullRole = await client.query(`
        SELECT id, email
        FROM public.profiles
        WHERE role IS NULL;
      `);
      
      if (profilesNullRole.rows.length > 0) {
        console.log('⚠️ Profiles avec role NULL:');
        profilesNullRole.rows.forEach(profile => {
          console.log(`  • ${profile.email || '(no email)'} (${profile.id})`);
        });
      } else {
        console.log('✅ Tous les profiles ont un rôle défini');
      }
      console.log('');

      // Doublons email dans profiles
      const duplicateEmails = await client.query(`
        SELECT email, COUNT(*) as count
        FROM public.profiles
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1;
      `);
      
      if (duplicateEmails.rows.length > 0) {
        console.log('⚠️ Emails dupliqués dans profiles:');
        duplicateEmails.rows.forEach(dup => {
          console.log(`  • ${dup.email}: ${dup.count} occurrences`);
        });
      } else {
        console.log('✅ Pas de doublons email dans profiles');
      }
      console.log('');

    } catch (err) {
      console.log('⚠️ Erreur vérification cohérence:', err.message, '\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AUDIT DATABASE TERMINÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Erreur connexion DB:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditDatabase();
