/**
 * VÉRIFIER: tickets.technicien_id doit-il être rempli ?
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifierTicketsTechnicienId() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION tickets.technicien_id');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Vérifier colonnes table tickets
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'tickets');
    
    console.log('Colonnes table tickets:');
    const hasTechnicienId = columns?.some(c => c.column_name === 'technicien_id');
    console.log(`  technicien_id: ${hasTechnicienId ? 'EXISTE ✅' : 'N\'EXISTE PAS'}`);
    console.log('');

    // Vérifier tickets avec/sans technicien_id
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, technicien_id, entreprise_id, statut');
    
    const avecTechnicienId = tickets?.filter(t => t.technicien_id !== null) || [];
    const sansTechnicienId = tickets?.filter(t => t.technicien_id === null) || [];
    
    console.log(`Total tickets: ${tickets?.length || 0}`);
    console.log(`  Avec technicien_id: ${avecTechnicienId.length}`);
    console.log(`  Sans technicien_id: ${sansTechnicienId.length}`);
    console.log('');

    // Vérifier missions
    const { data: missions } = await supabase
      .from('missions')
      .select('id, ticket_id, technicien_id, statut');
    
    console.log(`Total missions: ${missions?.length || 0}`);
    console.log('');

    // Cross-check: missions vs tickets
    if (missions && missions.length > 0) {
      console.log('Cross-check missions ↔ tickets:');
      
      for (const mission of missions) {
        if (!mission.ticket_id) continue;
        
        const ticket = tickets?.find(t => t.id === mission.ticket_id);
        
        console.log(`Mission ${mission.id.substring(0, 8)}`);
        console.log(`  mission.technicien_id: ${mission.technicien_id?.substring(0, 8) || 'NULL'}`);
        console.log(`  ticket.technicien_id:  ${ticket?.technicien_id?.substring(0, 8) || 'NULL'}`);
        
        if (mission.technicien_id && ticket) {
          if (ticket.technicien_id === null) {
            console.log(`  ⚠️ Mission assignée MAIS ticket.technicien_id = NULL`);
          } else if (ticket.technicien_id !== mission.technicien_id) {
            console.log(`  ⚠️ INCOHÉRENCE: IDs différents`);
          } else {
            console.log(`  ✅ IDs cohérents`);
          }
        }
        
        console.log('');
      }
    }

    // Chercher où technicien_id est mis à jour
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📄 RECHERCHE CODE MISE À JOUR tickets.technicien_id');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('À chercher dans le code:');
    console.log('  grep -r "tickets.*update.*technicien_id" --include="*.sql" --include="*.js"');
    console.log('  grep -r "SET.*technicien_id" --include="*.sql"');
    console.log('');

    // Conclusion
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 CONCLUSION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('État actuel:');
    console.log(`  tickets.technicien_id existe: ${hasTechnicienId ? 'OUI' : 'NON'}`);
    console.log(`  Valeurs NULL: ${sansTechnicienId.length}/${tickets?.length || 0}`);
    console.log('');
    
    if (hasTechnicienId && sansTechnicienId.length > 0) {
      console.log('Hypothèses:');
      console.log('  1. tickets.technicien_id est OPTIONNEL (peut rester NULL)');
      console.log('     → L\'assignation est portée uniquement par missions.technicien_id');
      console.log('     → Choix de design: éviter duplication de données');
      console.log('');
      console.log('  2. tickets.technicien_id DEVRAIT être rempli');
      console.log('     → Permet de filtrer tickets par technicien directement');
      console.log('     → RLS plus simple: WHERE tickets.technicien_id = auth.uid()');
      console.log('     → Nécessite trigger ou RPC pour synchroniser');
      console.log('');
      console.log('Recommandation:');
      console.log('  → GARDER tickets.technicien_id = NULL');
      console.log('  → Ajouter policy RLS basée sur missions.technicien_id');
      console.log('  → Plus simple, moins de risque d\'incohérence');
    }

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

verifierTicketsTechnicienId();
