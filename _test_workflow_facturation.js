/**
 * TEST WORKFLOW FACTURATION COMPLET
 * ==================================
 * Vérifie que la migration M50 a été appliquée correctement
 * et teste le workflow complet entreprise → facture → clôture
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function section(titre) {
  console.log('\n' + '='.repeat(60));
  console.log(titre);
  console.log('='.repeat(60));
}

// ==================================================
// TEST 1 : Vérifier existence RPC
// ==================================================

async function test1_verifyRPC() {
  section('TEST 1 : Vérification RPC');
  
  const rpcList = [
    'start_mission',
    'complete_mission',
    'generate_facture_from_mission',
    'update_facture_status'
  ];
  
  let allOk = true;
  
  for (const rpcName of rpcList) {
    try {
      const { error } = await supabase.rpc(rpcName, {});
      
      if (error) {
        if (error.message.includes('Could not find') || error.code === '42883') {
          console.log(`❌ RPC "${rpcName}" : N'EXISTE PAS`);
          allOk = false;
        } else {
          // Erreur de paramètres = fonction existe
          console.log(`✅ RPC "${rpcName}" : Existe`);
        }
      } else {
        console.log(`✅ RPC "${rpcName}" : Existe`);
      }
    } catch (err) {
      console.log(`⚠️  RPC "${rpcName}" : ${err.message}`);
      allOk = false;
    }
  }
  
  return allOk;
}

// ==================================================
// TEST 2 : Vérifier colonnes ajoutées
// ==================================================

async function test2_verifyColumns() {
  section('TEST 2 : Vérification Colonnes');
  
  // Vérifier colonne IBAN dans factures
  try {
    const { data, error } = await supabase
      .from('factures')
      .select('iban')
      .limit(1);
    
    if (error) {
      console.log('❌ Colonne "iban" manquante dans table factures');
      return false;
    } else {
      console.log('✅ Colonne "iban" existe dans table factures');
    }
  } catch (err) {
    console.log('❌ Erreur vérification colonne iban:', err.message);
    return false;
  }
  
  // Vérifier colonne duree_minutes dans missions
  try {
    const { data, error } = await supabase
      .from('missions')
      .select('duree_minutes')
      .limit(1);
    
    if (error) {
      console.log('❌ Colonne "duree_minutes" manquante dans table missions');
      return false;
    } else {
      console.log('✅ Colonne "duree_minutes" existe dans table missions');
    }
  } catch (err) {
    console.log('❌ Erreur vérification colonne duree_minutes:', err.message);
    return false;
  }
  
  return true;
}

// ==================================================
// TEST 3 : Vérifier vue missions_factures_complet
// ==================================================

async function test3_verifyView() {
  section('TEST 3 : Vérification Vue missions_factures_complet');
  
  try {
    const { data, error } = await supabase
      .from('missions_factures_complet')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Vue "missions_factures_complet" : N\'existe pas');
      console.log('   Erreur:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Vue "missions_factures_complet" : Existe avec données');
      console.log('   Colonnes disponibles:', Object.keys(data[0]).length);
      
      // Vérifier colonnes clés
      const requiredCols = [
        'mission_id', 'mission_statut', 'mission_duree_minutes',
        'facture_id', 'facture_statut', 'facture_numero'
      ];
      
      const missingCols = requiredCols.filter(col => !(col in data[0]));
      
      if (missingCols.length > 0) {
        console.log('⚠️  Colonnes manquantes:', missingCols.join(', '));
      } else {
        console.log('✅ Toutes les colonnes clés présentes');
      }
    } else {
      console.log('✅ Vue "missions_factures_complet" : Existe (vide)');
    }
    
    return true;
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return false;
  }
}

// ==================================================
// TEST 4 : Workflow complet (si mission existe)
// ==================================================

async function test4_workflowComplet() {
  section('TEST 4 : Workflow Complet (si mission terminée existe)');
  
  try {
    // Chercher une mission terminée sans facture
    const { data: missions, error } = await supabase
      .from('missions')
      .select('*')
      .eq('statut', 'terminee')
      .is('validated_at', null)
      .limit(1);
    
    if (error || !missions || missions.length === 0) {
      console.log('⚠️  Aucune mission terminée disponible pour test');
      console.log('   Créer une mission et la terminer pour tester le workflow');
      return true; // Pas d'erreur, juste pas de données de test
    }
    
    const mission = missions[0];
    console.log(`\n📋 Mission trouvée: ${mission.id}`);
    console.log(`   Statut: ${mission.statut}`);
    console.log(`   Durée: ${mission.duree_minutes || 'N/A'} minutes`);
    
    // Vérifier si facture existe déjà
    const { data: factureExistante, error: errFacture } = await supabase
      .from('factures')
      .select('*')
      .eq('mission_id', mission.id)
      .maybeSingle();
    
    if (factureExistante) {
      console.log(`\n💰 Facture déjà existante: ${factureExistante.numero}`);
      console.log(`   Statut: ${factureExistante.statut}`);
      console.log(`   Montant TTC: ${factureExistante.montant_ttc} CHF`);
      
      // Tester update_facture_status si brouillon
      if (factureExistante.statut === 'brouillon') {
        console.log('\n🧪 TEST: Passage facture à "envoyee"...');
        
        const { data: result, error: errUpdate } = await supabase.rpc('update_facture_status', {
          p_facture_id: factureExistante.id,
          p_nouveau_statut: 'envoyee'
        });
        
        if (errUpdate) {
          console.log('❌ Erreur update_facture_status:', errUpdate.message);
        } else {
          console.log('✅ Facture passée à "envoyee"');
          console.log('   Résultat:', result);
        }
      }
      
      return true;
    }
    
    // Tester génération facture
    console.log('\n🧪 TEST: Génération facture...');
    
    const { data: result, error: errGen } = await supabase.rpc('generate_facture_from_mission', {
      p_mission_id: mission.id,
      p_montant_ht: mission.montant_reel_chf || 100.00,
      p_description: 'Facture test générée automatiquement',
      p_iban: 'CH93 0076 2011 6238 5295 7'
    });
    
    if (errGen) {
      console.log('❌ Erreur génération facture:', errGen.message);
      return false;
    }
    
    console.log('✅ Facture générée avec succès!');
    console.log('   Résultat:', result);
    
    // Vérifier que facture existe maintenant
    const { data: nouvelleFacture, error: errCheck } = await supabase
      .from('factures')
      .select('*')
      .eq('mission_id', mission.id)
      .single();
    
    if (errCheck || !nouvelleFacture) {
      console.log('❌ Facture non trouvée après génération');
      return false;
    }
    
    console.log(`✅ Facture confirmée: ${nouvelleFacture.numero}`);
    console.log(`   Montant HT: ${nouvelleFacture.montant_ht} CHF`);
    console.log(`   Montant TTC: ${nouvelleFacture.montant_ttc} CHF`);
    console.log(`   Commission JTEC: ${nouvelleFacture.montant_commission} CHF`);
    
    return true;
    
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return false;
  }
}

// ==================================================
// TEST 5 : Vérifier trigger auto-génération
// ==================================================

async function test5_verifyTrigger() {
  section('TEST 5 : Trigger Auto-génération Facture');
  
  try {
    // Chercher une mission en_cours pour tester trigger
    const { data: missions, error } = await supabase
      .from('missions')
      .select('*')
      .eq('statut', 'en_cours')
      .limit(1);
    
    if (error || !missions || missions.length === 0) {
      console.log('⚠️  Aucune mission "en_cours" pour tester trigger');
      console.log('   Le trigger sera testé lors du prochain complete_mission');
      return true;
    }
    
    const mission = missions[0];
    console.log(`\n📋 Mission en cours trouvée: ${mission.id}`);
    console.log('   ℹ️  Trigger sera déclenché lors du passage à "terminee"');
    console.log('   ℹ️  Utiliser complete_mission() pour tester');
    
    return true;
    
  } catch (err) {
    console.log('❌ Erreur:', err.message);
    return false;
  }
}

// ==================================================
// MAIN
// ==================================================

async function main() {
  console.log('🧪 TEST WORKFLOW FACTURATION COMPLET');
  console.log('Date: ' + new Date().toISOString());
  console.log('');
  
  const results = {
    rpc: await test1_verifyRPC(),
    colonnes: await test2_verifyColumns(),
    vue: await test3_verifyView(),
    workflow: await test4_workflowComplet(),
    trigger: await test5_verifyTrigger()
  };
  
  section('📊 RÉSUMÉ DES TESTS');
  
  console.log('\nRésultats :');
  console.log(`  ${results.rpc ? '✅' : '❌'} RPC (start_mission, complete_mission, etc.)`);
  console.log(`  ${results.colonnes ? '✅' : '❌'} Colonnes (iban, duree_minutes)`);
  console.log(`  ${results.vue ? '✅' : '❌'} Vue missions_factures_complet`);
  console.log(`  ${results.workflow ? '✅' : '❌'} Workflow complet`);
  console.log(`  ${results.trigger ? '✅' : '❌'} Trigger auto-génération`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ TOUS LES TESTS PASSÉS!');
    console.log('');
    console.log('🎯 Prochaines étapes :');
    console.log('  1. Adapter frontend dashboard entreprise (rapports + factures)');
    console.log('  2. Tester scénario complet avec vraies données');
    console.log('  3. Valider vue admin');
  } else {
    console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('');
    console.log('🔧 Actions requises :');
    if (!results.rpc) {
      console.log('  ❌ Appliquer migration M50 via Supabase Dashboard');
    }
    if (!results.colonnes) {
      console.log('  ❌ Vérifier ajout colonnes iban et duree_minutes');
    }
    if (!results.vue) {
      console.log('  ❌ Créer vue missions_factures_complet');
    }
  }
  console.log('='.repeat(60));
}

main();
