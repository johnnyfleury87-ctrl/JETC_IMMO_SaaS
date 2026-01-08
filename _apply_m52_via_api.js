#!/usr/bin/env node

/**
 * =====================================================
 * APPLICATION MIGRATION M52 VIA API SUPABASE
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

async function applyM52ViaAPI() {
  console.log('🔧 APPLICATION M52 via API Supabase\n');
  
  try {
    // Lire le SQL
    const migrationSQL = fs.readFileSync(
      './supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql',
      'utf8'
    );
    
    console.log('📋 Migration chargée');
    console.log('⚙️  Exécution...\n');
    
    // Exécuter via l'API REST Supabase (Management API)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erreur API:', error);
      
      // Essayer une approche plus directe
      console.log('\n🔄 Tentative avec exécution SQL directe...\n');
      
      // Extraire juste la fonction
      const functionSQL = `
DROP FUNCTION IF EXISTS assign_technicien_to_mission(UUID, UUID);

CREATE FUNCTION assign_technicien_to_mission(
  p_mission_id UUID,
  p_technicien_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entreprise_id UUID;
  v_mission_entreprise_id UUID;
  v_technicien_entreprise_id UUID;
  v_mission_statut TEXT;
  v_ticket_id UUID;
BEGIN
  RAISE NOTICE '🔧 assign_technicien_to_mission: mission=%, technicien=%', p_mission_id, p_technicien_id;
  
  SELECT id INTO v_entreprise_id
  FROM entreprises
  WHERE profile_id = auth.uid();
  
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous devez être connecté en tant qu''entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Entreprise connectée: %', v_entreprise_id;
  
  SELECT entreprise_id, statut, ticket_id 
  INTO v_mission_entreprise_id, v_mission_statut, v_ticket_id
  FROM missions
  WHERE id = p_mission_id;
  
  IF v_mission_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Mission introuvable'
    );
  END IF;
  
  IF v_mission_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas modifier une mission qui ne vous appartient pas'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Mission appartient à l''entreprise (statut: %)', v_mission_statut;
  
  SELECT entreprise_id INTO v_technicien_entreprise_id
  FROM techniciens
  WHERE id = p_technicien_id;
  
  IF v_technicien_entreprise_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Technicien introuvable'
    );
  END IF;
  
  IF v_technicien_entreprise_id != v_entreprise_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas assigner un technicien d''une autre entreprise'
    );
  END IF;
  
  RAISE NOTICE '  ✅ Technicien appartient à l''entreprise';
  
  IF v_mission_statut NOT IN ('en_attente') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''assigner un technicien à une mission déjà démarrée ou terminée'
    );
  END IF;
  
  UPDATE missions
  SET 
    technicien_id = p_technicien_id,
    updated_at = NOW()
  WHERE id = p_mission_id;
  
  RAISE NOTICE '  ✅ Technicien assigné (statut reste en_attente)';
  
  INSERT INTO historique_statuts (mission_id, ancien_statut, nouveau_statut, auteur, details)
  VALUES (
    p_mission_id,
    v_mission_statut,
    'en_attente',
    v_entreprise_id::text,
    'Technicien assigné'
  )
  ON CONFLICT DO NOTHING;
  
  INSERT INTO notifications (
    type,
    title,
    message,
    related_mission_id,
    related_ticket_id,
    user_id,
    created_at
  )
  VALUES (
    'mission_assigned',
    'Technicien assigné',
    'Un technicien a été assigné à votre intervention',
    p_mission_id,
    v_ticket_id,
    (SELECT profile_id FROM techniciens WHERE id = p_technicien_id),
    NOW()
  )
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'mission_id', p_mission_id,
    'technicien_id', p_technicien_id,
    'message', 'Technicien assigné avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erreur assign_technicien_to_mission: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_technicien_to_mission TO authenticated;
`;
      
      // Écrire dans un fichier pour exécution manuelle
      fs.writeFileSync('./supabase/migrations/_APPLY_M52_MANUAL.sql', functionSQL);
      console.log('✅ SQL sauvegardé dans: supabase/migrations/_APPLY_M52_MANUAL.sql');
      console.log('\n📋 INSTRUCTIONS MANUELLES:');
      console.log('1. Aller sur https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql');
      console.log('2. Copier le contenu de _APPLY_M52_MANUAL.sql');
      console.log('3. Coller dans l\'éditeur SQL');
      console.log('4. Cliquer sur "RUN"');
      console.log('\nOu utiliser la CLI Supabase:');
      console.log('  supabase db push --db-url "$DATABASE_URL"');
      
    } else {
      console.log('✅ Migration appliquée via API!');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    // Créer fichier de secours
    const functionSQL = fs.readFileSync(
      './supabase/migrations/20260108000000_m52_fix_assign_technicien_notifications.sql',
      'utf8'
    );
    fs.writeFileSync('./supabase/migrations/_APPLY_M52_MANUAL.sql', functionSQL);
    console.log('\n✅ SQL sauvegardé pour application manuelle');
    console.log('Fichier: supabase/migrations/_APPLY_M52_MANUAL.sql\n');
  }
}

applyM52ViaAPI()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
