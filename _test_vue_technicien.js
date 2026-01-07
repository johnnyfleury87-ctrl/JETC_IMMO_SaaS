/**
 * TEST VUE TECHNICIEN - AFFICHAGE COMPLET
 * Vérifie que toutes les infos sont bien récupérées et affichées
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testVueTechnicien() {
  console.log('[TEST][VUE TECH] DÉBUT TEST AFFICHAGE COMPLET\n');
  
  let success = 0;
  let warnings = 0;
  let errors = 0;

  try {
    // 1. Test requête complète (comme dans le dashboard)
    console.log('=== TEST 1: REQUÊTE MISSIONS COMPLÈTE ===');
    const { data: missions, error } = await supabase
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
      .order('date_intervention_prevue', { ascending: true })
      .limit(5);
    
    if (error) {
      console.error('❌ Erreur requête:', error.message);
      errors++;
    } else {
      console.log(`✅ Requête OK - ${missions.length} missions récupérées`);
      success++;
    }

    if (!missions || missions.length === 0) {
      console.log('⚠️ Aucune mission dans la base');
      console.log('[TEST][VUE TECH] Test terminé (aucune donnée à vérifier)\n');
      return;
    }

    // 2. Vérification de la structure des données
    console.log('\n=== TEST 2: STRUCTURE DONNÉES ===');
    missions.forEach((mission, idx) => {
      console.log(`\n--- Mission ${idx + 1} (${mission.id.substring(0, 8)}) ---`);
      console.log(`Statut: ${mission.statut}`);
      
      const ticket = mission.ticket;
      if (!ticket) {
        console.log('❌ Pas de ticket lié');
        errors++;
        return;
      }
      
      console.log(`✅ Ticket: ${ticket.categorie || 'N/A'} - ${ticket.sous_categorie || 'N/A'}`);
      
      // Vérifier locataire
      if (ticket.locataire) {
        const loc = ticket.locataire;
        console.log(`✅ Locataire: ${loc.nom || 'N/A'} ${loc.prenom || ''}`);
        if (loc.telephone) {
          console.log(`  ✅ Téléphone: ${loc.telephone}`);
        } else {
          console.log(`  ⚠️ Téléphone non renseigné`);
          warnings++;
        }
        if (loc.email) {
          console.log(`  ✅ Email: ${loc.email}`);
        } else {
          console.log(`  ⚠️ Email non renseigné`);
          warnings++;
        }
        success++;
      } else {
        console.log('⚠️ Pas de locataire lié');
        warnings++;
      }
      
      // Vérifier logement
      if (ticket.logement) {
        const log = ticket.logement;
        if (log.adresse) {
          console.log(`✅ Adresse logement: ${log.adresse}`);
          if (log.npa && log.ville) {
            console.log(`  ✅ NPA/Ville: ${log.npa} ${log.ville}`);
          }
          success++;
        } else {
          console.log('⚠️ Adresse logement non renseignée');
          warnings++;
        }
        
        if (log.numero) {
          console.log(`  ✅ Numéro: ${log.numero}`);
        }
        if (log.etage) {
          console.log(`  ✅ Étage: ${log.etage}`);
        }
        
        // Vérifier immeuble et accès
        if (log.immeuble) {
          const imm = log.immeuble;
          if (imm.nom) {
            console.log(`✅ Immeuble: ${imm.nom}`);
          }
          
          if (imm.digicode) {
            console.log(`  ✅ CODE ACCÈS: ${imm.digicode}`);
            success++;
          } else if (imm.interphone) {
            console.log(`  ✅ Interphone disponible`);
            success++;
          } else {
            console.log(`  ⚠️ Pas d'info accès (digicode/interphone)`);
            warnings++;
          }
          
          if (imm.ascenseur) {
            console.log(`  ✅ Ascenseur disponible`);
          }
        } else {
          console.log('⚠️ Pas d\'immeuble lié');
          warnings++;
        }
      } else {
        console.log('⚠️ Pas de logement lié');
        warnings++;
      }
      
      // Vérifier planification
      if (mission.date_intervention_prevue) {
        console.log(`✅ Date intervention: ${mission.date_intervention_prevue}`);
        success++;
      } else {
        console.log(`⚠️ Date intervention non planifiée`);
        warnings++;
      }
      
      if (mission.disponibilite_id) {
        console.log(`  ℹ️ Créneau lié: ${mission.disponibilite_id.substring(0, 8)}`);
      }
    });

    // 3. Récapitulatif
    console.log('\n=== RÉCAPITULATIF TEST ===');
    console.log(`✅ Succès: ${success}`);
    console.log(`⚠️ Avertissements: ${warnings}`);
    console.log(`❌ Erreurs: ${errors}`);
    
    // 4. Vérification critères métier
    console.log('\n=== VÉRIFICATION CRITÈRES MÉTIER ===');
    let criteresOK = true;
    
    missions.forEach((mission) => {
      const ticket = mission.ticket;
      if (!ticket) return;
      
      const locataire = ticket.locataire;
      const logement = ticket.logement;
      const immeuble = logement?.immeuble;
      
      // Critère 1: Pas de N/A - N/A si données présentes
      if (ticket.categorie && ticket.sous_categorie) {
        if (ticket.categorie === 'N/A' || ticket.sous_categorie === 'N/A') {
          console.log('❌ CRITÈRE BLOQUANT: categorie/sous_categorie = N/A alors que données présentes');
          criteresOK = false;
        }
      }
      
      // Critère 2: Adresse visible si existe
      if (!logement?.adresse && !immeuble?.adresse) {
        console.log('⚠️ Aucune adresse disponible (ni logement ni immeuble)');
      }
      
      // Critère 3: Infos locataire visibles
      if (locataire && !locataire.nom) {
        console.log('⚠️ Locataire sans nom');
      }
    });
    
    if (criteresOK) {
      console.log('✅ TOUS LES CRITÈRES MÉTIER RESPECTÉS');
    } else {
      console.log('❌ CERTAINS CRITÈRES MÉTIER NON RESPECTÉS');
    }
    
    console.log('\n[TEST][VUE TECH] Test terminé ✅\n');
    
  } catch (error) {
    console.error('❌ ERREUR GLOBALE:', error);
  }
}

testVueTechnicien();
