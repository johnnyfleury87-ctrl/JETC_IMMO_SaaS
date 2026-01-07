/**
 * AUDIT SCHÉMA SUPABASE - VUE TECHNICIEN
 * Vérifie les tables, colonnes et relations nécessaires
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditSchema() {
  console.log('[TECH][STEP 0] AUDIT SCHÉMA SUPABASE - DÉBUT\n');

  try {
    // 1. Vérifier table missions
    console.log('=== TABLE MISSIONS ===');
    const { data: missions, error: errMissions } = await supabase
      .from('missions')
      .select('*')
      .limit(1);
    
    if (errMissions) {
      console.error('❌ Erreur missions:', errMissions.message);
    } else {
      console.log('✅ Table missions accessible');
      if (missions && missions.length > 0) {
        console.log('Colonnes missions:', Object.keys(missions[0]).join(', '));
      }
    }

    // 2. Vérifier table tickets
    console.log('\n=== TABLE TICKETS ===');
    const { data: tickets, error: errTickets } = await supabase
      .from('tickets')
      .select('*')
      .limit(1);
    
    if (errTickets) {
      console.error('❌ Erreur tickets:', errTickets.message);
    } else {
      console.log('✅ Table tickets accessible');
      if (tickets && tickets.length > 0) {
        console.log('Colonnes tickets:', Object.keys(tickets[0]).join(', '));
      }
    }

    // 3. Vérifier table locataires
    console.log('\n=== TABLE LOCATAIRES ===');
    const { data: locataires, error: errLocataires } = await supabase
      .from('locataires')
      .select('*')
      .limit(1);
    
    if (errLocataires) {
      console.error('❌ Erreur locataires:', errLocataires.message);
    } else {
      console.log('✅ Table locataires accessible');
      if (locataires && locataires.length > 0) {
        console.log('Colonnes locataires:', Object.keys(locataires[0]).join(', '));
      }
    }

    // 4. Vérifier table logements
    console.log('\n=== TABLE LOGEMENTS ===');
    const { data: logements, error: errLogements } = await supabase
      .from('logements')
      .select('*')
      .limit(1);
    
    if (errLogements) {
      console.error('❌ Erreur logements:', errLogements.message);
    } else {
      console.log('✅ Table logements accessible');
      if (logements && logements.length > 0) {
        console.log('Colonnes logements:', Object.keys(logements[0]).join(', '));
      }
    }

    // 5. Vérifier table immeubles
    console.log('\n=== TABLE IMMEUBLES ===');
    const { data: immeubles, error: errImmeubles } = await supabase
      .from('immeubles')
      .select('*')
      .limit(1);
    
    if (errImmeubles) {
      console.error('❌ Erreur immeubles:', errImmeubles.message);
    } else {
      console.log('✅ Table immeubles accessible');
      if (immeubles && immeubles.length > 0) {
        console.log('Colonnes immeubles:', Object.keys(immeubles[0]).join(', '));
      }
    }

    // 6. Chercher tables créneaux possibles
    console.log('\n=== TABLES CRÉNEAUX (recherche) ===');
    const tablesPossibles = ['ticket_creneaux', 'disponibilites', 'creneaux', 'rendez_vous'];
    
    for (const tableName of tablesPossibles) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        console.log(`✅ Table ${tableName} trouvée`);
        if (data && data.length > 0) {
          console.log(`Colonnes ${tableName}:`, Object.keys(data[0]).join(', '));
        }
      }
    }

    // 7. Test JOIN complet sur une mission
    console.log('\n=== TEST JOIN COMPLET ===');
    const { data: testMission, error: errJoin } = await supabase
      .from('missions')
      .select(`
        *,
        ticket:tickets(*),
        technicien:profiles!missions_technicien_id_fkey(*)
      `)
      .limit(1);
    
    if (errJoin) {
      console.error('❌ Erreur JOIN missions:', errJoin.message);
    } else {
      console.log('✅ JOIN missions -> tickets OK');
      if (testMission && testMission.length > 0) {
        console.log('Relations disponibles:', Object.keys(testMission[0]));
      }
    }

    // 8. Test JOIN ticket -> locataire/logement
    console.log('\n=== TEST JOIN TICKET -> LOCATAIRE/LOGEMENT ===');
    const { data: testTicket, error: errTicketJoin } = await supabase
      .from('tickets')
      .select(`
        *,
        locataire:locataires(*),
        logement:logements(*, immeuble:immeubles(*))
      `)
      .limit(1);
    
    if (errTicketJoin) {
      console.error('❌ Erreur JOIN tickets:', errTicketJoin.message);
    } else {
      console.log('✅ JOIN tickets -> locataires + logements OK');
      if (testTicket && testTicket.length > 0) {
        console.log('Relations disponibles:', Object.keys(testTicket[0]));
        if (testTicket[0].locataire) {
          console.log('Infos locataire disponibles:', Object.keys(testTicket[0].locataire));
        }
        if (testTicket[0].logement) {
          console.log('Infos logement disponibles:', Object.keys(testTicket[0].logement));
        }
      }
    }

    console.log('\n[TECH][STEP 0] Schéma vérifié (tables/colonnes confirmées) ✅ OK\n');

  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

auditSchema();
