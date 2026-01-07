/**
 * DEBUG VUE TECHNICIEN - TEST CLIENT-SIDE
 * Simule ce que le navigateur devrait recevoir
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Utilise la même clé que le front (ANON, pas SERVICE_ROLE)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // ⚠️ Client-side key
);

async function testClientSide() {
  console.log('[DEBUG][CLIENT] TEST AVEC CLÉ ANON (comme le navigateur)\n');
  
  try {
    // Test SANS authentification (pour voir RLS)
    console.log('=== TEST 1: Sans auth (doit échouer avec RLS) ===');
    const { data: noAuth, error: errNoAuth } = await supabase
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
      .limit(1);
    
    if (errNoAuth) {
      console.log('✅ RLS bloque bien (normal):', errNoAuth.message);
    } else {
      console.log('⚠️ RLS ne bloque PAS (problème de sécurité!)');
      console.log('Données récupérées:', noAuth);
    }
    
    console.log('');
    
    // Test AVEC authentification technicien
    console.log('=== TEST 2: Simulation auth technicien ===');
    console.log('Email: demo.technicien@jetc-immo.local');
    console.log('');
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'demo.technicien@jetc-immo.local',
      password: 'Demo1234!'
    });
    
    if (authError) {
      console.error('❌ Erreur login:', authError.message);
      console.log('⚠️ Vérifie que le compte technicien existe');
      return;
    }
    
    console.log('✅ Login OK, user.id:', authData.user.id);
    console.log('');
    
    // Maintenant test la requête authentifiée
    console.log('=== TEST 3: Requête missions avec auth ===');
    const { data: missions, error: errMissions } = await supabase
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
      .order('date_intervention_prevue', { ascending: true });
    
    if (errMissions) {
      console.error('❌ Erreur requête missions:', errMissions.message);
      console.log('Détails:', errMissions);
      console.log('');
      console.log('➡️ CAUSE C CONFIRMÉE: RLS bloque même authentifié');
      return;
    }
    
    console.log(`✅ ${missions.length} mission(s) récupérée(s)`);
    console.log('');
    
    if (missions.length === 0) {
      console.log('⚠️ Aucune mission pour ce technicien');
      console.log('Vérifier que missions.technicien_id correspond au profile_id du user');
      return;
    }
    
    const mission = missions[0];
    
    console.log('========== MISSION DATA (CLIENT-SIDE) ==========');
    console.log('mission.id:', mission.id);
    console.log('mission.ticket_id:', mission.ticket_id);
    console.log('mission.ticket:', mission.ticket ? 'PRÉSENT ✅' : '❌ NULL');
    console.log('');
    
    if (mission.ticket) {
      console.log('ticket.categorie:', mission.ticket.categorie);
      console.log('ticket.sous_categorie:', mission.ticket.sous_categorie);
      console.log('ticket.description:', mission.ticket.description);
      console.log('ticket.locataire:', mission.ticket.locataire ? 'PRÉSENT ✅' : '❌ NULL');
      console.log('ticket.logement:', mission.ticket.logement ? 'PRÉSENT ✅' : '❌ NULL');
      console.log('');
      
      if (mission.ticket.locataire) {
        console.log('✅ LOCATAIRE:');
        console.log('  nom:', mission.ticket.locataire.nom);
        console.log('  prenom:', mission.ticket.locataire.prenom);
        console.log('  telephone:', mission.ticket.locataire.telephone);
        console.log('  email:', mission.ticket.locataire.email);
      } else {
        console.log('❌ LOCATAIRE NULL - RLS bloque locataires');
      }
      
      console.log('');
      
      if (mission.ticket.logement) {
        console.log('✅ LOGEMENT:');
        console.log('  adresse:', mission.ticket.logement.adresse);
        console.log('  npa:', mission.ticket.logement.npa);
        console.log('  ville:', mission.ticket.logement.ville);
        console.log('  numero:', mission.ticket.logement.numero);
        console.log('  etage:', mission.ticket.logement.etage);
        console.log('  immeuble:', mission.ticket.logement.immeuble ? 'PRÉSENT ✅' : '❌ NULL');
        
        if (mission.ticket.logement.immeuble) {
          console.log('');
          console.log('✅ IMMEUBLE:');
          console.log('  nom:', mission.ticket.logement.immeuble.nom);
          console.log('  digicode:', mission.ticket.logement.immeuble.digicode);
          console.log('  interphone:', mission.ticket.logement.immeuble.interphone);
        } else {
          console.log('❌ IMMEUBLE NULL - RLS bloque immeubles');
        }
      } else {
        console.log('❌ LOGEMENT NULL - RLS bloque logements');
      }
    } else {
      console.log('❌ TICKET NULL - RLS bloque tickets');
    }
    
    console.log('');
    console.log('========== DIAGNOSTIC ==========');
    
    if (mission.ticket && mission.ticket.locataire && mission.ticket.logement && mission.ticket.logement.immeuble) {
      console.log('✅✅✅ TOUTES LES DONNÉES RÉCUPÉRÉES CÔTÉ CLIENT');
      console.log('');
      console.log('➡️ Le front devrait afficher correctement les données');
      console.log('➡️ Vérifier les logs navigateur (F12) pour voir ce qui se passe au rendering');
    } else {
      console.log('❌ CERTAINES DONNÉES MANQUENT');
      console.log('');
      console.log('CAUSE: RLS bloque la lecture nested des tables');
      console.log('');
      console.log('SOLUTION: Ajouter policies SELECT sur:');
      if (!mission.ticket) console.log('  - tickets (via missions.ticket_id)');
      if (mission.ticket && !mission.ticket.locataire) console.log('  - locataires (via tickets.locataire_id)');
      if (mission.ticket && !mission.ticket.logement) console.log('  - logements (via tickets.logement_id)');
      if (mission.ticket && mission.ticket.logement && !mission.ticket.logement.immeuble) console.log('  - immeubles (via logements.immeuble_id)');
    }
    
    // Logout
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

testClientSide();
