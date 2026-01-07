/**
 * DEBUG VUE TECHNICIEN - ÉTAPE 0 & 1
 * Identifier la mission exacte et vérifier la DB
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMissionData() {
  console.log('[DEBUG][ÉTAPE 0-1] IDENTIFICATION MISSION + VÉRIF DB\n');
  
  try {
    // 1. Trouver une mission technicien
    console.log('=== ÉTAPE 1.1: Trouver mission technicien ===');
    const { data: missions, error: errMissions } = await supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (errMissions) {
      console.error('❌ Erreur récupération missions:', errMissions.message);
      return;
    }
    
    if (!missions || missions.length === 0) {
      console.log('⚠️ Aucune mission dans la base');
      return;
    }
    
    console.log(`✅ ${missions.length} mission(s) trouvée(s)\n`);
    
    // Prendre la première mission
    const mission = missions[0];
    const missionId = mission.id;
    const ticketId = mission.ticket_id;
    
    console.log('========== MISSION DETAILS ==========');
    console.log('mission.id:', missionId);
    console.log('mission.ticket_id:', ticketId);
    console.log('mission.technicien_id:', mission.technicien_id);
    console.log('mission.statut:', mission.statut);
    console.log('mission.date_intervention_prevue:', mission.date_intervention_prevue);
    console.log('mission.disponibilite_id:', mission.disponibilite_id);
    console.log('');
    
    if (!ticketId) {
      console.error('❌ PROBLÈME: mission.ticket_id est NULL');
      console.log('➡️ CAUSE A: L\'assignation mission→ticket est cassée');
      return;
    }
    
    console.log('✅ mission.ticket_id est présent:', ticketId.substring(0, 8), '\n');
    
    // 2. Vérifier le ticket via JOIN
    console.log('=== ÉTAPE 1.2: Vérifier ticket via JOIN SQL ===');
    const { data: ticketJoin, error: errTicketJoin } = await supabase
      .from('missions')
      .select(`
        id,
        ticket_id,
        tickets (
          id,
          categorie,
          sous_categorie,
          description,
          locataire_id,
          logement_id
        )
      `)
      .eq('id', missionId)
      .single();
    
    if (errTicketJoin) {
      console.error('❌ Erreur JOIN missions→tickets:', errTicketJoin.message);
      console.log('➡️ CAUSE B ou C: Problème de relation ou RLS');
      return;
    }
    
    console.log('JOIN missions→tickets:', ticketJoin);
    console.log('');
    
    if (!ticketJoin.tickets) {
      console.error('❌ PROBLÈME: JOIN retourne NULL pour tickets');
      console.log('➡️ CAUSE C probable: RLS bloque la lecture de tickets');
      console.log('');
      
      // Vérifier si le ticket existe directement
      console.log('=== VÉRIFICATION: Ticket existe-t-il en DB ? ===');
      const { data: ticketDirect, error: errTicketDirect } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
      
      if (errTicketDirect) {
        console.error('❌ Ticket inexistant ou inaccessible:', errTicketDirect.message);
      } else {
        console.log('✅ Ticket EXISTE en DB (via service_role)');
        console.log('Ticket categorie:', ticketDirect.categorie);
        console.log('Ticket sous_categorie:', ticketDirect.sous_categorie);
        console.log('Ticket locataire_id:', ticketDirect.locataire_id);
        console.log('Ticket logement_id:', ticketDirect.logement_id);
        console.log('');
        console.log('⚠️ CAUSE CONFIRMÉE: RLS bloque la lecture nested de tickets');
      }
      
      return;
    }
    
    console.log('✅ JOIN missions→tickets fonctionne\n');
    
    // 3. Vérifier locataire et logement
    console.log('=== ÉTAPE 1.3: Vérifier locataire + logement ===');
    const ticket = ticketJoin.tickets;
    
    if (ticket.locataire_id) {
      const { data: locataire, error: errLoc } = await supabase
        .from('locataires')
        .select('id, nom, prenom, telephone, email')
        .eq('id', ticket.locataire_id)
        .single();
      
      if (errLoc) {
        console.error('❌ Erreur récupération locataire:', errLoc.message);
      } else {
        console.log('✅ Locataire:', locataire.nom, locataire.prenom, locataire.telephone);
      }
    } else {
      console.log('⚠️ ticket.locataire_id est NULL');
    }
    
    if (ticket.logement_id) {
      const { data: logement, error: errLog } = await supabase
        .from('logements')
        .select(`
          id, adresse, npa, ville, numero, etage,
          immeuble:immeubles(nom, adresse, digicode, interphone)
        `)
        .eq('id', ticket.logement_id)
        .single();
      
      if (errLog) {
        console.error('❌ Erreur récupération logement:', errLog.message);
      } else {
        console.log('✅ Logement:', logement.adresse, logement.npa, logement.ville);
        if (logement.immeuble) {
          console.log('✅ Immeuble:', logement.immeuble.nom, 'Code:', logement.immeuble.digicode);
        }
      }
    } else {
      console.log('⚠️ ticket.logement_id est NULL');
    }
    
    console.log('');
    
    // 4. Test avec la requête EXACTE du front
    console.log('=== ÉTAPE 2: TEST AVEC REQUÊTE FRONT EXACTE ===');
    const { data: frontTest, error: errFront } = await supabase
      .from('missions')
      .select(`
        *,
        ticket:tickets(
          id,
          categorie,
          sous_categorie,
          description,
          piece,
          photos,
          locataire:locataires(
            nom,
            prenom,
            telephone,
            email
          ),
          logement:logements(
            adresse,
            npa,
            ville,
            numero,
            etage,
            pays,
            immeuble:immeubles(
              nom,
              adresse,
              npa,
              ville,
              digicode,
              interphone,
              ascenseur
            )
          )
        )
      `)
      .eq('id', missionId)
      .single();
    
    if (errFront) {
      console.error('❌ Erreur avec requête front:', errFront.message);
      console.log('Détails:', errFront);
      console.log('');
      console.log('➡️ CAUSE B: Problème de relation/mapping dans .select()');
      return;
    }
    
    console.log('✅ Requête front fonctionne');
    console.log('');
    console.log('========== RÉSULTAT REQUÊTE FRONT ==========');
    console.log('mission.ticket:', frontTest.ticket ? 'PRÉSENT' : '❌ NULL');
    
    if (frontTest.ticket) {
      console.log('  ticket.categorie:', frontTest.ticket.categorie);
      console.log('  ticket.sous_categorie:', frontTest.ticket.sous_categorie);
      console.log('  ticket.locataire:', frontTest.ticket.locataire ? 'PRÉSENT' : '❌ NULL');
      
      if (frontTest.ticket.locataire) {
        console.log('    locataire.nom:', frontTest.ticket.locataire.nom);
        console.log('    locataire.prenom:', frontTest.ticket.locataire.prenom);
        console.log('    locataire.telephone:', frontTest.ticket.locataire.telephone);
      }
      
      console.log('  ticket.logement:', frontTest.ticket.logement ? 'PRÉSENT' : '❌ NULL');
      
      if (frontTest.ticket.logement) {
        console.log('    logement.adresse:', frontTest.ticket.logement.adresse);
        console.log('    logement.npa:', frontTest.ticket.logement.npa);
        console.log('    logement.ville:', frontTest.ticket.logement.ville);
        console.log('    logement.immeuble:', frontTest.ticket.logement.immeuble ? 'PRÉSENT' : '❌ NULL');
        
        if (frontTest.ticket.logement.immeuble) {
          console.log('      immeuble.nom:', frontTest.ticket.logement.immeuble.nom);
          console.log('      immeuble.digicode:', frontTest.ticket.logement.immeuble.digicode);
        }
      }
    }
    
    console.log('');
    console.log('========== DIAGNOSTIC FINAL ==========');
    
    if (frontTest.ticket && frontTest.ticket.locataire && frontTest.ticket.logement) {
      console.log('✅ TOUTES LES DONNÉES SONT RÉCUPÉRABLES');
      console.log('➡️ Le problème est probablement côté front (mauvaise gestion des données null ou rendering)');
    } else if (frontTest.ticket && (!frontTest.ticket.locataire || !frontTest.ticket.logement)) {
      console.log('⚠️ TICKET OK mais LOCATAIRE ou LOGEMENT NULL');
      console.log('➡️ CAUSE C: RLS bloque locataires ou logements');
    } else if (!frontTest.ticket) {
      console.log('❌ TICKET NULL dans requête front');
      console.log('➡️ CAUSE C: RLS bloque tickets');
    }
    
  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

debugMissionData();
