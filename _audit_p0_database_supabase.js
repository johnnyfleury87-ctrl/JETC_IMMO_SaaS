#!/usr/bin/env node
/**
 * AUDIT P0 - STRUCTURE DATABASE via Supabase JS
 * Vérifie : tables, colonnes, RLS policies, données
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzODY1NSwiZXhwIjoyMDgxNjE0NjU1fQ.2Jgom881Qkro3OE8ylY5qsRAzT7Xoc7wYL2fAomRuxI';

async function auditDatabase() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('✅ Client Supabase créé avec service_role\n');

  try {
    // ==========================================
    // 1. LISTER TABLES VIA INFORMATION_SCHEMA
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TABLES DU SCHÉMA PUBLIC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables_list');
    
    if (tablesError) {
      console.log('⚠️ RPC get_tables_list non disponible, tentative query directe...\n');
      
      // Fallback: tenter de lister via les tables connues
      const knownTables = [
        'profiles', 'tickets', 'entreprises', 'techniciens', 'missions',
        'regies', 'locataires', 'logements', 'factures', 'interventions'
      ];
      
      console.log('Tables connues à vérifier:');
      for (const tableName of knownTables) {
        const { data, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
        if (!error) {
          console.log(`✅ ${tableName} existe`);
        }
      }
      console.log('');
    } else {
      tables.forEach((table, idx) => {
        console.log(`${idx + 1}. ${table.table_name}`);
      });
      console.log('');
    }

    // ==========================================
    // 2. PROFILES - STRUCTURE ET DONNÉES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 TABLE PROFILES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.log('❌ Erreur récupération profiles:', profilesError.message);
    } else {
      console.log(`📊 ${profiles.length} profils récupérés (sample)`);
      if (profiles.length > 0) {
        console.log('\nColonnes détectées:', Object.keys(profiles[0]).join(', '));
        console.log('\nÉchantillon:');
        profiles.forEach((p, idx) => {
          console.log(`  ${idx + 1}. ${p.email || p.id} - Rôle: ${p.role || '(null)'}`);
        });
      }
      console.log('');

      // Compter profils par rôle
      const { data: roleStats, error: roleError } = await supabase
        .rpc('count_profiles_by_role');
      
      if (roleError) {
        console.log('⚠️ RPC count_profiles_by_role non disponible\n');
        
        // Fallback: récupérer tous et compter localement
        const { data: allProfiles } = await supabase.from('profiles').select('role');
        if (allProfiles) {
          const roleCounts = {};
          allProfiles.forEach(p => {
            const role = p.role || '(null)';
            roleCounts[role] = (roleCounts[role] || 0) + 1;
          });
          console.log('📊 Répartition des profils par rôle:');
          Object.entries(roleCounts).forEach(([role, count]) => {
            console.log(`  • ${role}: ${count}`);
          });
          console.log('');
        }
      } else {
        console.log('📊 Répartition des profils par rôle:');
        roleStats.forEach(stat => {
          console.log(`  • ${stat.role}: ${stat.count}`);
        });
        console.log('');
      }
    }

    // ==========================================
    // 3. TICKETS - STRUCTURE ET STATUTS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 TABLE TICKETS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .limit(3);
    
    if (ticketsError) {
      console.log('❌ Erreur récupération tickets:', ticketsError.message);
    } else {
      console.log(`📊 ${tickets.length} tickets récupérés (sample)`);
      if (tickets.length > 0) {
        console.log('\nColonnes détectées:', Object.keys(tickets[0]).join(', '));
      }
      console.log('');

      // Compter tickets par statut
      const { data: allTickets } = await supabase.from('tickets').select('statut, status');
      if (allTickets) {
        const statusCounts = {};
        allTickets.forEach(t => {
          const status = t.statut || t.status || '(null)';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log('📊 Répartition des tickets par statut:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  • ${status}: ${count}`);
        });
        console.log('');
      }
    }

    // ==========================================
    // 4. ENTREPRISES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏢 TABLE ENTREPRISES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('*')
      .limit(3);
    
    if (entreprisesError) {
      console.log('❌ Erreur récupération entreprises:', entreprisesError.message);
    } else {
      console.log(`📊 ${entreprises.length} entreprises récupérées`);
      if (entreprises.length > 0) {
        console.log('\nColonnes:', Object.keys(entreprises[0]).join(', '));
        entreprises.forEach((e, idx) => {
          console.log(`  ${idx + 1}. ${e.nom || e.name || e.id}`);
        });
      }
    }
    console.log('');

    // ==========================================
    // 5. TECHNICIENS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 TABLE TECHNICIENS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: techniciens, error: techniciensError } = await supabase
      .from('techniciens')
      .select('*')
      .limit(5);
    
    if (techniciensError) {
      console.log('❌ Erreur récupération techniciens:', techniciensError.message);
    } else {
      console.log(`📊 ${techniciens.length} techniciens récupérés`);
      if (techniciens.length > 0) {
        console.log('\nColonnes:', Object.keys(techniciens[0]).join(', '));
        techniciens.forEach((t, idx) => {
          console.log(`  ${idx + 1}. ${t.nom || t.name || t.email || t.id} - Entreprise: ${t.entreprise_id || '(null)'}`);
        });
      }
    }
    console.log('');

    // ==========================================
    // 6. MISSIONS
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 TABLE MISSIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select('*')
      .limit(3);
    
    if (missionsError) {
      console.log('❌ Erreur récupération missions:', missionsError.message);
    } else {
      console.log(`📊 ${missions.length} missions récupérées`);
      if (missions.length > 0) {
        console.log('\nColonnes:', Object.keys(missions[0]).join(', '));
      }
    }
    console.log('');

    // ==========================================
    // 7. COHÉRENCE AUTH ↔ PROFILES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 COHÉRENCE AUTH.USERS ↔ PROFILES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Récupérer tous les profiles
    const { data: allProfiles } = await supabase.from('profiles').select('id, email, role');
    
    if (allProfiles) {
      console.log(`📊 Total profiles: ${allProfiles.length}`);
      
      // Vérifier les rôles null
      const nullRoles = allProfiles.filter(p => !p.role);
      if (nullRoles.length > 0) {
        console.log(`⚠️ Profiles avec rôle NULL: ${nullRoles.length}`);
        nullRoles.forEach(p => {
          console.log(`  • ${p.email || p.id}`);
        });
      } else {
        console.log('✅ Tous les profiles ont un rôle défini');
      }
      console.log('');

      // Vérifier emails dupliqués
      const emailCounts = {};
      allProfiles.forEach(p => {
        if (p.email) {
          emailCounts[p.email] = (emailCounts[p.email] || 0) + 1;
        }
      });
      const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log('⚠️ Emails dupliqués:');
        duplicates.forEach(([email, count]) => {
          console.log(`  • ${email}: ${count} occurrences`);
        });
      } else {
        console.log('✅ Pas de doublons email');
      }
      console.log('');
    }

    // ==========================================
    // 8. FONCTIONS RPC DISPONIBLES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚙️ TEST FONCTIONS RPC CONNUES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const rpcTests = [
      'get_my_role',
      'get_user_profile',
      'assign_technicien_to_mission',
      'create_technicien',
      'update_technicien',
      'diffuse_ticket_to_entreprises',
      'accept_ticket_entreprise'
    ];
    
    for (const rpcName of rpcTests) {
      const { data, error } = await supabase.rpc(rpcName, {}).limit(0);
      if (error && !error.message.includes('required')) {
        console.log(`❌ ${rpcName}: non disponible`);
      } else {
        console.log(`✅ ${rpcName}: disponible`);
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ AUDIT DATABASE TERMINÉ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Erreur audit:', error.message);
    process.exit(1);
  }
}

auditDatabase();
