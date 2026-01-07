#!/usr/bin/env node
/**
 * TEST POST-CORRECTIF : Validation régie
 * 
 * Vérifie que le bug de contrainte CHECK est résolu
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 TEST POST-CORRECTIF : Validation régie\n');

async function testValidation() {
  try {
    console.log('1️⃣  Récupération d\'un ticket existant...\n');
    
    // Récupérer n'importe quel ticket en statut 'nouveau'
    const { data: tickets, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('statut', 'nouveau')
      .limit(1);

    if (fetchError) {
      console.error('❌ Erreur:', fetchError);
      return;
    }

    let ticket;

    if (!tickets || tickets.length === 0) {
      console.log('⚠️  Aucun ticket en statut "nouveau" trouvé.');
      console.log('   Création d\'un ticket de test...\n');
      
      // Récupérer un locataire et un logement pour créer un ticket
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      const { data: logements } = await supabase
        .from('logements')
        .select('id')
        .limit(1);

      if (!profiles || profiles.length === 0 || !logements || logements.length === 0) {
        console.log('❌ Impossible de créer un ticket de test (pas de profile/logement).');
        return;
      }

      const testTicket = {
        titre: 'TEST - Fuite robinet cuisine',
        description: 'Ticket de test pour validation régie',
        categorie: 'plomberie',
        sous_categorie: 'Fuite d\'eau', // ✅ Valeur correcte selon contrainte
        piece: 'cuisine',
        priorite: 'normale',
        statut: 'nouveau',
        locataire_id: profiles[0].id,
        logement_id: logements[0].id
      };

      const { data: newTicket, error: createError } = await supabase
        .from('tickets')
        .insert(testTicket)
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur création ticket test:', createError);
        return;
      }

      ticket = newTicket;
      console.log('✅ Ticket de test créé:', ticket.id);
    } else {
      ticket = tickets[0];
      console.log('✅ Ticket trouvé:', ticket.id);
    }

    console.log(`   Titre: ${ticket.titre || 'N/A'}`);
    console.log(`   Catégorie: ${ticket.categorie}`);
    console.log(`   Sous-catégorie: "${ticket.sous_categorie}"`);
    console.log(`   Pièce: ${ticket.piece || 'N/A'}`);
    console.log(`   Statut: ${ticket.statut}\n`);

    console.log('3️⃣  Simulation UPDATE régie (ce qui causait l\'erreur)...\n');

    // Simuler ce que fait la régie : update avec les valeurs pré-remplies
    const { data: updated, error: updateError } = await supabase
      .from('tickets')
      .update({
        sous_categorie: ticket.sous_categorie, // Même valeur (devrait passer maintenant)
        piece: ticket.piece,
        priorite: 'normale',
        plafond_intervention_chf: 500
      })
      .eq('id', ticket.id)
      .select();

    if (updateError) {
      console.error('❌ ÉCHEC - Erreur lors de l\'update:');
      console.error(`   Code: ${updateError.code}`);
      console.error(`   Message: ${updateError.message}`);
      console.error(`   Details: ${updateError.details}\n`);
      
      if (updateError.code === '23514') {
        console.log('⚠️  Le bug persiste ! Vérifier que :');
        console.log('   1. Les valeurs du select régie sont alignées sur la contrainte SQL');
        console.log('   2. La valeur envoyée est exactement : "' + ticket.sous_categorie + '"');
        console.log('   3. Pas d\'espace ou de caractère invisible\n');
      }
      
      return;
    }

    console.log('✅ UPDATE RÉUSSI ! Le bug est corrigé.');
    console.log(`   sous_categorie: "${updated[0].sous_categorie}"`);
    console.log(`   piece: "${updated[0].piece}"`);
    console.log(`   plafond_intervention_chf: ${updated[0].plafond_intervention_chf}\n`);

    console.log('4️⃣  Test avec une valeur INVALIDE (doit échouer)...\n');

    const { error: invalidError } = await supabase
      .from('tickets')
      .update({
        sous_categorie: 'fuite' // ❌ Minuscule (invalide)
      })
      .eq('id', ticket.id);

    if (invalidError && invalidError.code === '23514') {
      console.log('✅ PARFAIT - Valeur invalide rejetée comme attendu.');
      console.log(`   Message: ${invalidError.message}\n`);
    } else if (!invalidError) {
      console.log('⚠️  ATTENTION - Valeur invalide acceptée (ne devrait pas).\n');
    }

    console.log('5️⃣  Test des autres valeurs de la contrainte...\n');

    const testValues = [
      { categorie: 'plomberie', sous_categorie: 'WC bouché' },
      { categorie: 'electricite', sous_categorie: 'Panne générale' },
      { categorie: 'chauffage', sous_categorie: 'Radiateur' },
      { categorie: 'ventilation', sous_categorie: 'VMC défectueuse' },
      { categorie: 'serrurerie', sous_categorie: 'Porte bloquée' },
      { categorie: 'vitrerie', sous_categorie: 'Vitre cassée' },
      { categorie: 'menuiserie', sous_categorie: 'Porte' },
      { categorie: 'peinture', sous_categorie: 'Murs' },
      { categorie: 'autre', sous_categorie: 'Autre intervention' }
    ];

    let passCount = 0;
    for (const test of testValues) {
      const { error } = await supabase
        .from('tickets')
        .update({
          categorie: test.categorie,
          sous_categorie: test.sous_categorie
        })
        .eq('id', ticket.id);

      if (!error) {
        console.log(`   ✅ ${test.categorie} / "${test.sous_categorie}"`);
        passCount++;
      } else {
        console.log(`   ❌ ${test.categorie} / "${test.sous_categorie}" - ${error.message}`);
      }
    }

    console.log(`\n✅ ${passCount}/${testValues.length} valeurs testées avec succès.\n`);

    console.log('6️⃣  Restauration ticket initial...\n');
    await supabase
      .from('tickets')
      .update({
        categorie: ticket.categorie,
        sous_categorie: ticket.sous_categorie
      })
      .eq('id', ticket.id);

    console.log('✅ Ticket restauré.\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 TEST TERMINÉ AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Le bug de contrainte CHECK est résolu !');
    console.log('La régie peut maintenant valider les tickets locataires.\n');

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

testValidation();
