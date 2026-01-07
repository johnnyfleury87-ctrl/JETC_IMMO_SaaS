/**
 * ═════════════════════════════════════════════════════════════
 * DÉPLOIEMENT MIGRATION M48 - FIX BUG DÉMARRER MISSION
 * ═════════════════════════════════════════════════════════════
 * 
 * Applique les correctifs via requêtes SQL individuelles
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🚀 DÉPLOIEMENT M48 - FIX TRIGGERS MISSIONS');
console.log('═══════════════════════════════════════════════════════════════\n');

async function main() {
  
  console.log('📋 CORRECTIF 1: notify_mission_status_change_extended\n');
  
  const func1 = `
CREATE OR REPLACE FUNCTION notify_mission_status_change_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor RECORD;
  v_mission_ref TEXT;
  v_ticket_ref TEXT;
BEGIN
  IF OLD.statut IS DISTINCT FROM NEW.statut THEN
    
    SELECT t.reference INTO v_ticket_ref
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
    
    v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
    
    PERFORM create_system_message(
      NEW.id,
      'Statut changé : ' || OLD.statut || ' → ' || NEW.statut
    );
    
    FOR v_actor IN SELECT * FROM get_mission_actors(NEW.id)
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_actor.user_id,
        'mission_status_change',
        'Changement de statut - ' || v_mission_ref,
        'La mission est maintenant : ' || NEW.statut,
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
  `;

  // Sauvegarder pour exécution manuelle
  fs.writeFileSync('_deploy_m48_func1.sql', func1);
  console.log('✅ Fonction 1 sauvegardée: _deploy_m48_func1.sql');
  
  console.log('\n📋 CORRECTIF 2: notify_technicien_assignment\n');
  
  const func2 = `
CREATE OR REPLACE FUNCTION notify_technicien_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tech_user_id UUID;
  v_mission_ref TEXT;
  v_tech_nom TEXT;
  v_ticket_ref TEXT;
BEGIN
  IF OLD.technicien_id IS NULL AND NEW.technicien_id IS NOT NULL THEN
    
    SELECT profile_id, nom INTO v_tech_user_id, v_tech_nom
    FROM techniciens
    WHERE id = NEW.technicien_id;
    
    IF v_tech_user_id IS NOT NULL THEN
      
      SELECT t.reference INTO v_ticket_ref
      FROM tickets t
      WHERE t.id = NEW.ticket_id;
      
      v_mission_ref := COALESCE(v_ticket_ref, 'Mission ' || LEFT(NEW.id::text, 8));
      
      PERFORM create_system_message(
        NEW.id,
        'Technicien assigné : ' || v_tech_nom
      );
      
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_mission_id
      )
      VALUES (
        v_tech_user_id,
        'mission_assigned',
        'Nouvelle mission assignée',
        'Vous avez été assigné à la mission ' || v_mission_ref,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
  `;

  fs.writeFileSync('_deploy_m48_func2.sql', func2);
  console.log('✅ Fonction 2 sauvegardée: _deploy_m48_func2.sql');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('✅ Fichiers API corrigés:');
  console.log('   - api/missions/start.js → Appelle start_mission()');
  console.log('   - api/missions/complete.js → Appelle complete_mission()');
  console.log('');
  
  console.log('📦 Fichiers SQL générés pour déploiement manuel:');
  console.log('   - _deploy_m48_func1.sql');
  console.log('   - _deploy_m48_func2.sql');
  console.log('   - supabase/migrations/20260107000000_m48_fix_demarrer_mission.sql');
  console.log('');
  
  console.log('🔧 DÉPLOIEMENT MANUEL:');
  console.log('   1. Ouvrir Supabase Dashboard → SQL Editor');
  console.log('   2. Copier/coller contenu de _deploy_m48_func1.sql');
  console.log('   3. Exécuter');
  console.log('   4. Copier/coller contenu de _deploy_m48_func2.sql');
  console.log('   5. Exécuter');
  console.log('');
  
  console.log('🧪 TEST APRÈS DÉPLOIEMENT:');
  console.log('   node _test_fix_demarrer_mission.js');
  console.log('');
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Créer script de test
  const testScript = `
/**
 * TEST: Vérifier que start_mission fonctionne
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\\n🧪 TEST: Fonction start_mission après fix\\n');

(async () => {
  // Trouver mission test
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, statut, technicien_id, ticket_id')
    .eq('statut', 'en_attente')
    .limit(1);

  if (error || !missions || missions.length === 0) {
    console.log('❌ Aucune mission test disponible');
    return;
  }

  const mission = missions[0];
  console.log('📌 Mission test:', mission.id);
  console.log('   Statut:', mission.statut);
  console.log('   Technicien:', mission.technicien_id);
  console.log('');

  console.log('🚀 Appel start_mission...');
  
  const { data: result, error: startError } = await supabase.rpc('start_mission', {
    p_mission_id: mission.id
  });

  if (startError) {
    console.log('❌ Erreur:', startError.message);
    console.log('');
    console.log('⚠️  Si erreur contient "reference":');
    console.log('   → Migration M48 pas encore déployée');
    console.log('   → Exécuter les 2 fichiers SQL manuellement');
    return;
  }

  console.log('✅ Résultat:', result);
  console.log('');

  if (result.success) {
    console.log('✅✅✅ FIX RÉUSSI! start_mission fonctionne!');
    console.log('');
    
    // Rollback
    console.log('🔄 Rollback mission...');
    await supabase
      .from('missions')
      .update({ statut: 'en_attente', started_at: null })
      .eq('id', mission.id);
    
    console.log('✅ Rollback OK');
  } else {
    console.log('⚠️  Échec:', result.error);
  }

  console.log('');
})();
  `;

  fs.writeFileSync('_test_fix_demarrer_mission.js', testScript);
  console.log('✅ Script de test créé: _test_fix_demarrer_mission.js\n');
}

main().catch(console.error);
