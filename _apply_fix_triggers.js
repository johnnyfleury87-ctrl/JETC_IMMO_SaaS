#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyFix() {
  console.log('===== CORRECTIF TRIGGERS MISSION =====\n');
  
  // Fonction 1: notify_mission_status_change_extended
  const func1 = `
create or replace function notify_mission_status_change_extended()
returns trigger
language plpgsql
as $$
declare
  v_actor record;
  v_mission_ref text;
begin
  if OLD.statut is distinct from NEW.statut then
    v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
    
    perform create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    for v_actor in select * from get_mission_actors(NEW.id)
    loop
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    end loop;
  end if;
  
  return NEW;
end;
$$;
  `;
  
  console.log('1️⃣  Correction notify_mission_status_change_extended...');
  const result1 = await supabase.rpc('exec', { sql: func1 });
  
  if (result1.error) {
    console.error('❌ Erreur:', result1.error.message);
  } else {
    console.log('✅ OK\n');
  }
  
  // Fonction 2: notify_technicien_assignment
  const func2 = `
create or replace function notify_technicien_assignment()
returns trigger
language plpgsql
as $$
declare
  v_tech_user_id uuid;
  v_mission_ref text;
  v_tech_nom text;
begin
  if OLD.technicien_id is null and NEW.technicien_id is not null then
    select user_id, nom into v_tech_user_id, v_tech_nom
    from techniciens
    where id = NEW.technicien_id;
    
    if v_tech_user_id is not null then
      v_mission_ref := 'MISSION-' || substring(NEW.id::text, 1, 8);
      
      perform create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      insert into notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      values (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    end if;
  end if;
  
  return NEW;
end;
$$;
  `;
  
  console.log('2️⃣  Correction notify_technicien_assignment...');
  const result2 = await supabase.rpc('exec', { sql: func2 });
  
  if (result2.error) {
    console.error('❌ Erreur:', result2.error.message);
  } else {
    console.log('✅ OK\n');
  }
  
  console.log('===== TEST UPDATE MISSION =====\n');
  
  // Test simple UPDATE
  const { data: missions, error: missionError } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);
  
  if (missionError || !missions || missions.length === 0) {
    console.log('Aucune mission en_attente pour tester');
    return;
  }
  
  const testMissionId = missions[0].id;
  console.log('Mission test:', testMissionId.substring(0, 13) + '...');
  
  const { data: updateData, error: updateError } = await supabase
    .from('missions')
    .update({ started_at: new Date().toISOString() })
    .eq('id', testMissionId)
    .select();
  
  if (updateError) {
    console.error('❌ UPDATE échoué:', updateError);
  } else {
    console.log('✅ UPDATE réussi!\n');
    
    // Rollback
    await supabase
      .from('missions')
      .update({ started_at: null })
      .eq('id', testMissionId);
  }
}

applyFix().catch(console.error);
