#!/usr/bin/env node

/**
 * =====================================================
 * APPLICATION MIGRATION M52
 * =====================================================
 * Fix: assign_technicien_to_mission - Erreur user_id
 * Correction des noms de colonnes dans INSERT notifications
 * =====================================================
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function applyM52() {
  console.log('🔧 APPLICATION M52: Fix assign_technicien_to_mission\n');
  console.log('='.repeat(60));
  
  try {
    // Lire le fichier de migration
    const migrationSQL = fs.readFileSync(
      './supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql',
      'utf8'
    );
    
    console.log('\n📋 Migration chargée (longueur: %d caractères)', migrationSQL.length);
    
    // Méthode alternative avec pg direct
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');
    
    // Exécuter la migration
    console.log('⚙️  Exécution de la migration...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration M52 appliquée avec succès!\n');
    
    // Vérifier que la fonction existe
    const checkResult = await client.query(`
      SELECT 
        p.proname,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'assign_technicien_to_mission';
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Fonction assign_technicien_to_mission existe');
      
      // Vérifier que la définition contient les bons noms
      const def = checkResult.rows[0].definition;
      const hasTitle = def.includes('title');
      const hasRelatedMissionId = def.includes('related_mission_id');
      const hasRelatedTicketId = def.includes('related_ticket_id');
      
      console.log('\n📝 Vérifications:');
      console.log('  - Utilise "title" : %s', hasTitle ? '✅' : '❌');
      console.log('  - Utilise "related_mission_id" : %s', hasRelatedMissionId ? '✅' : '❌');
      console.log('  - Utilise "related_ticket_id" : %s', hasRelatedTicketId ? '✅' : '❌');
      
      if (hasTitle && hasRelatedMissionId && hasRelatedTicketId) {
        console.log('\n🎉 CORRECTION VALIDÉE!\n');
      } else {
        console.log('\n⚠️  Attention: Vérifier manuellement la fonction\n');
      }
    } else {
      console.log('❌ Fonction non trouvée après migration\n');
    }
    
    await client.end();
    
    console.log('='.repeat(60));
    console.log('✅ M52 APPLIQUÉE - assign_technicien_to_mission corrigée');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyM52()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
