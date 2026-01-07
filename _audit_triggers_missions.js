/**
 * ═════════════════════════════════════════════════════════════
 * AUDIT TRIGGERS - TABLE MISSIONS
 * ═════════════════════════════════════════════════════════════
 * Identifier trigger bugué qui référence NEW.reference
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 AUDIT TRIGGERS - TABLE MISSIONS\n');

async function main() {
  // Liste tous les triggers sur table missions
  const query = `
    SELECT 
      t.tgname as trigger_name,
      p.proname as function_name,
      pg_get_triggerdef(t.oid) as trigger_definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'missions'
      AND NOT t.tgisinternal
    ORDER BY t.tgname;
  `;

  // Exécuter en SQL direct via service_role (bypass tout)
  const { data, error } = await supabase
    .from('missions')
    .select('id')
    .limit(0);  // Juste pour tester connexion

  if (error) {
    console.log('❌ Erreur connexion:', error.message);
    return;
  }

  console.log('✅ Connexion Supabase OK\n');
  console.log('📋 Pour lister les triggers, exécuter ce SQL dans Dashboard:\n');
  console.log(query);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 RECHERCHE: Trigger qui utilise NEW.reference\n');
  console.log('Emplacement potentiel:');
  console.log('  - supabase/schema/16_messagerie.sql (ligne 321, 379)');
  console.log('  - Trigger sur missions qui appelle une fonction messagerie\n');

  // Test: Lire fonction handle_ticket_notification
  console.log('🧪 Test: Identifier fonction trigger bugguée...\n');
  
  const queryFunc = `
    SELECT 
      p.proname as function_name,
      pg_get_functiondef(p.oid) as function_body
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname LIKE '%notif%'
      OR p.proname LIKE '%mission%'
    ORDER BY p.proname;
  `;

  console.log('SQL pour voir fonctions trigger:\n');
  console.log(queryFunc);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚠️  PROBLÈME IDENTIFIÉ:\n');
  console.log('Erreur: record "new" has no field "reference"');
  console.log('→ Un trigger sur missions essaie d\'accéder NEW.reference');
  console.log('→ Mais la table missions n\'a PAS de colonne "reference"');
  console.log('');
  console.log('💡 SOLUTION:');
  console.log('1. Identifier le trigger fautif (probablement lié à messagerie)');
  console.log('2. Corriger la fonction trigger pour ne pas utiliser NEW.reference');
  console.log('3. OU désactiver temporairement le trigger');
  console.log('');
  console.log('🔧 COMMANDE TEMPORAIRE (désactiver trigger):');
  console.log('   ALTER TABLE missions DISABLE TRIGGER <nom_trigger>;');
  console.log('');

  // Essayer de détecter via erreur
  console.log('🧪 Tentative UPDATE mission pour forcer erreur...\n');
  
  const { data: missions, error: errMissions } = await supabase
    .from('missions')
    .select('id, statut')
    .eq('statut', 'en_attente')
    .limit(1);

  if (!missions || missions.length === 0) {
    console.log('⚠️  Aucune mission test');
    return;
  }

  const testId = missions[0].id;
  console.log('Mission test:', testId);
  console.log('Tentative UPDATE notes (trigger update_at)...\n');

  const { data: updateData, error: updateError } = await supabase
    .from('missions')
    .update({ notes: 'Test audit trigger ' + new Date().toISOString() })
    .eq('id', testId)
    .select();

  if (updateError) {
    console.log('❌ ERREUR UPDATE:', updateError.message);
    console.log('');
    if (updateError.message.includes('reference')) {
      console.log('✅ CONFIRMÉ: Trigger missions utilise NEW.reference (colonne inexistante)');
    }
  } else {
    console.log('✅ UPDATE réussi (pas de trigger bugué sur UPDATE simple)');
    console.log('');
    console.log('⚠️  Le bug apparaît uniquement sur UPDATE du statut');
    console.log('   → Le trigger est probablement conditionnel (WHEN statut change)');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
