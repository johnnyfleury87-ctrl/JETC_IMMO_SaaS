/**
 * AUDIT CHAMPS ACCÈS ET CRÉNEAUX
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditAccesCreneaux() {
  console.log('[TECH][AUDIT] Recherche champs accès et créneaux\n');

  try {
    // 1. Chercher champs d'accès dans immeubles
    console.log('=== CHAMPS ACCÈS DANS IMMEUBLES ===');
    const { data: immeubles } = await supabase
      .from('immeubles')
      .select('*')
      .limit(1);
    
    if (immeubles && immeubles.length > 0) {
      const immeuble = immeubles[0];
      const champsAcces = ['code_entree', 'code_acces', 'digicode', 'interphone', 'instructions_acces', 'acces_infos'];
      console.log('Champs disponibles:', Object.keys(immeuble).join(', '));
      console.log('\nChamps d\'accès trouvés:');
      champsAcces.forEach(champ => {
        if (champ in immeuble) {
          console.log(`  ✅ ${champ}: ${immeuble[champ] || '(vide)'}`);
        }
      });
    }

    // 2. Chercher champs d'accès dans logements
    console.log('\n=== CHAMPS ACCÈS DANS LOGEMENTS ===');
    const { data: logements } = await supabase
      .from('logements')
      .select('*')
      .limit(1);
    
    if (logements && logements.length > 0) {
      const logement = logements[0];
      const champsAcces = ['code_entree', 'code_acces', 'instructions_acces', 'porte', 'appartement', 'batiment'];
      console.log('Champs logement pertinents:');
      champsAcces.forEach(champ => {
        if (champ in logement) {
          console.log(`  ✅ ${champ}: ${logement[champ] || '(vide)'}`);
        }
      });
      console.log(`  ✅ etage: ${logement.etage || '(vide)'}`);
      console.log(`  ✅ numero: ${logement.numero || '(vide)'}`);
    }

    // 3. Chercher champs créneaux dans tickets
    console.log('\n=== CHAMPS CRÉNEAUX DANS TICKETS ===');
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .limit(1);
    
    if (tickets && tickets.length > 0) {
      const ticket = tickets[0];
      const champsCreneaux = ['creneau_choisi', 'date_intervention', 'disponibilite_id', 'creneaux'];
      console.log('Champs créneaux potentiels:');
      champsCreneaux.forEach(champ => {
        if (champ in ticket) {
          console.log(`  ✅ ${champ}: ${ticket[champ] || '(vide)'}`);
        }
      });
    }

    // 4. Chercher champs créneaux dans missions
    console.log('\n=== CHAMPS CRÉNEAUX DANS MISSIONS ===');
    const { data: missions } = await supabase
      .from('missions')
      .select('*')
      .limit(1);
    
    if (missions && missions.length > 0) {
      const mission = missions[0];
      console.log(`  ✅ date_intervention_prevue: ${mission.date_intervention_prevue || '(vide)'}`);
      console.log(`  ✅ disponibilite_id: ${mission.disponibilite_id || '(vide)'}`);
    }

    // 5. Vérifier si table disponibilites existe
    console.log('\n=== TABLE DISPONIBILITES ===');
    const { data: dispos, error: errDispos } = await supabase
      .from('disponibilites')
      .select('*')
      .limit(1);
    
    if (errDispos) {
      console.log('❌ Table disponibilites non trouvée:', errDispos.message);
    } else {
      console.log('✅ Table disponibilites trouvée');
      if (dispos && dispos.length > 0) {
        console.log('Colonnes disponibilites:', Object.keys(dispos[0]).join(', '));
      }
    }

    console.log('\n[TECH][AUDIT] Audit accès/créneaux terminé ✅\n');

  } catch (error) {
    console.error('❌ ERREUR:', error);
  }
}

auditAccesCreneaux();
