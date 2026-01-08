// TEST COMPLET M55 : Facturation Suisse + Lignes
// ================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enlhanNybWZocnhkbWZweXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzg2NTUsImV4cCI6MjA4MTYxNDY1NX0.sLB8N8PJ_vW2mS-0a_N6If6lcuOoF36YHNcolAL5KXs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('\n=== TEST M55: FACTURATION SUISSE + LIGNES ===\n');
  
  try {
    // 1. Vérifier structure facture_lignes
    console.log('1️⃣  Vérification table facture_lignes...');
    const { data: lignes, error: errorLignes } = await supabase
      .from('facture_lignes')
      .select('*')
      .limit(1);
    
    if (errorLignes) {
      console.log('❌ Table facture_lignes:', errorLignes.message);
      return;
    }
    console.log('✅ Table facture_lignes existe');
    
    // 2. Vérifier les factures brouillon
    console.log('\n2️⃣  Recherche facture brouillon...');
    const { data: factures, error: errorFact } = await supabase
      .from('factures')
      .select('*')
      .eq('statut', 'brouillon')
      .limit(1);
    
    if (errorFact) {
      console.log('❌ Erreur:', errorFact.message);
      return;
    }
    
    if (!factures || factures.length === 0) {
      console.log('⚠️  Pas de facture brouillon trouvée');
      return;
    }
    
    const facture = factures[0];
    console.log('✅ Facture brouillon:', {
      id: facture.id,
      numero: facture.numero_facture,
      montant_ht: facture.montant_ht,
      taux_tva: facture.taux_tva,
      taux_commission: facture.taux_commission,
      montant_tva: facture.montant_tva,
      montant_ttc: facture.montant_ttc,
      montant_commission: facture.montant_commission
    });
    
    // 3. Test: Ajouter ligne matériel
    console.log('\n3️⃣  Test ajouter ligne matériel...');
    const { data: ligne1, error: error1 } = await supabase.rpc('ajouter_ligne_facture', {
      p_facture_id: facture.id,
      p_type: 'materiel',
      p_description: 'Tuyau PVC Ø 50mm',
      p_quantite: 10,
      p_unite: 'pcs',
      p_prix_unitaire_ht: 25.50
    });
    
    if (error1) {
      console.log('❌ Erreur ligne1:', error1.message);
    } else {
      console.log('✅ Ligne matériel ajoutée:', ligne1);
    }
    
    // 4. Test: Ajouter ligne main d'oeuvre
    console.log('\n4️⃣  Test ajouter ligne main d\'oeuvre...');
    const { data: ligne2, error: error2 } = await supabase.rpc('ajouter_ligne_facture', {
      p_facture_id: facture.id,
      p_type: 'main_oeuvre',
      p_description: 'Installation plomberie',
      p_quantite: 4.5,
      p_unite: 'h',
      p_prix_unitaire_ht: 80.00
    });
    
    if (error2) {
      console.log('❌ Erreur ligne2:', error2.message);
    } else {
      console.log('✅ Ligne main d\'oeuvre ajoutée:', ligne2);
    }
    
    // 5. Test: Ajouter ligne déplacement
    console.log('\n5️⃣  Test ajouter ligne déplacement...');
    const { data: ligne3, error: error3 } = await supabase.rpc('ajouter_ligne_facture', {
      p_facture_id: facture.id,
      p_type: 'deplacement',
      p_description: 'Déplacement Genève-Lausanne',
      p_quantite: 62,
      p_unite: 'km',
      p_prix_unitaire_ht: 0.70
    });
    
    if (error3) {
      console.log('❌ Erreur ligne3:', error3.message);
    } else {
      console.log('✅ Ligne déplacement ajoutée:', ligne3);
    }
    
    // 6. Test: Ajouter remise
    console.log('\n6️⃣  Test ajouter remise...');
    const { data: ligne4, error: error4 } = await supabase.rpc('ajouter_ligne_facture', {
      p_facture_id: facture.id,
      p_type: 'remise',
      p_description: 'Remise client fidèle',
      p_quantite: 1,
      p_unite: 'forfait',
      p_prix_unitaire_ht: -50.00
    });
    
    if (error4) {
      console.log('❌ Erreur ligne4:', error4.message);
    } else {
      console.log('✅ Ligne remise ajoutée:', ligne4);
    }
    
    // 7. Vérifier recalcul automatique
    console.log('\n7️⃣  Vérification recalcul automatique...');
    const { data: factureUpdated, error: errorUpdate } = await supabase
      .from('factures')
      .select('*')
      .eq('id', facture.id)
      .single();
    
    if (errorUpdate) {
      console.log('❌ Erreur:', errorUpdate.message);
    } else {
      const montantAttendu = (10 * 25.50) + (4.5 * 80.00) + (62 * 0.70) + (-50.00);
      console.log('✅ Facture recalculée:', {
        montant_ht: factureUpdated.montant_ht,
        montant_attendu: montantAttendu,
        taux_tva: factureUpdated.taux_tva,
        montant_tva: factureUpdated.montant_tva,
        montant_commission: factureUpdated.montant_commission,
        montant_ttc: factureUpdated.montant_ttc,
        calcul_ok: Math.abs(factureUpdated.montant_ht - montantAttendu) < 0.01
      });
      
      // Vérifier TVA Suisse
      const tvaAttendue = montantAttendu * (8.1 / 100);
      const commissionAttendue = montantAttendu * (2.0 / 100);
      console.log('\n📊 Calculs Suisse:', {
        base_ht: factureUpdated.montant_ht,
        tva_8_1_pourcent: factureUpdated.montant_tva,
        tva_attendue: tvaAttendue.toFixed(2),
        tva_ok: Math.abs(factureUpdated.montant_tva - tvaAttendue) < 0.01,
        commission_2_pourcent: factureUpdated.montant_commission,
        commission_attendue: commissionAttendue.toFixed(2),
        commission_ok: Math.abs(factureUpdated.montant_commission - commissionAttendue) < 0.01
      });
    }
    
    // 8. Lister toutes les lignes
    console.log('\n8️⃣  Liste des lignes de facture...');
    const { data: allLignes, error: errorAll } = await supabase
      .from('facture_lignes')
      .select('*')
      .eq('facture_id', facture.id)
      .order('ordre', { ascending: true });
    
    if (errorAll) {
      console.log('❌ Erreur:', errorAll.message);
    } else {
      console.log('✅ Lignes de facture:', allLignes.length);
      allLignes.forEach((ligne, index) => {
        console.log(`   ${index + 1}. ${ligne.description}`);
        console.log(`      ${ligne.quantite} ${ligne.unite} × ${ligne.prix_unitaire_ht} CHF = ${ligne.total_ht} CHF HT`);
      });
    }
    
    // 9. Test: modifier une ligne
    if (allLignes && allLignes.length > 0) {
      console.log('\n9️⃣  Test modifier ligne...');
      const { data: modif, error: errorModif } = await supabase.rpc('modifier_ligne_facture', {
        p_ligne_id: allLignes[0].id,
        p_quantite: 12
      });
      
      if (errorModif) {
        console.log('❌ Erreur:', errorModif.message);
      } else {
        console.log('✅ Ligne modifiée:', modif);
      }
    }
    
    // 10. Test: RPC editer_facture (sans colonnes générées)
    console.log('\n🔟 Test RPC editer_facture corrigée...');
    const { data: edit, error: errorEdit } = await supabase.rpc('editer_facture', {
      p_facture_id: facture.id,
      p_montant_ht: 500.00, // On force un montant (normalement calculé auto depuis lignes)
      p_notes: 'Facture modifiée via RPC corrigée',
      p_iban: 'CH93 0076 2011 6238 5295 7'
    });
    
    if (errorEdit) {
      console.log('❌ Erreur editer_facture:', errorEdit.message, errorEdit);
    } else {
      console.log('✅ editer_facture OK:', edit);
    }
    
    console.log('\n✅ TESTS M55 TERMINÉS\n');
    
  } catch (err) {
    console.error('❌ Erreur globale:', err);
  }
}

test();
