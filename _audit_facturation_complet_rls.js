#!/usr/bin/env node
/**
 * AUDIT COMPLET FACTURATION - RLS + VUES + FRONTEND
 * Date: 2026-01-09
 * Objectif: Identifier pourquoi la Régie ne peut pas traiter les factures
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🔍 AUDIT COMPLET FACTURATION');
  console.log('='.repeat(80));
  
  const results = {
    tables: {},
    vues: {},
    policies: {},
    donnees: {},
    problemes: []
  };

  // ========================================
  // 1. STRUCTURE TABLE FACTURES (via SQL brut)
  // ========================================
  console.log('\n📊 1. STRUCTURE TABLE FACTURES');
  console.log('-'.repeat(80));
  
  const { data: colonnes, error: errColonnes } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        is_generated
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'factures'
      ORDER BY ordinal_position;
    `
  });
  
  if (colonnes && !errColonnes) {
    console.log('✅ Colonnes table factures:', colonnes.length);
    results.tables.factures = colonnes;
    
    // Vérifier colonnes critiques
    const colRequired = ['id', 'numero', 'mission_id', 'entreprise_id', 'regie_id', 
                         'montant_ht', 'montant_tva', 'montant_ttc', 'statut'];
    const colPresentes = colonnes.map(c => c.column_name);
    
    colRequired.forEach(col => {
      if (!colPresentes.includes(col)) {
        results.problemes.push(`❌ Colonne manquante: factures.${col}`);
      }
    });
    
    // Vérifier colonnes générées
    const generees = colonnes.filter(c => c.is_generated === 'ALWAYS');
    console.log('   Colonnes GENERATED:', generees.map(c => c.column_name).join(', '));
  } else {
    console.error('❌ Erreur lecture colonnes:', errColonnes);
    results.problemes.push('Impossible de lire structure table factures');
  }

  // ========================================
  // 2. DONNÉES FACTURES
  // ========================================
  console.log('\n📦 2. DONNÉES FACTURES');
  console.log('-'.repeat(80));
  
  const { data: factures, error: errFactures } = await supabase
    .from('factures')
    .select('id, numero, mission_id, entreprise_id, regie_id, statut, montant_ht, montant_ttc')
    .limit(10);
  
  if (factures) {
    console.log(`✅ ${factures.length} factures dans la base`);
    results.donnees.factures = factures;
    
    factures.forEach((f, i) => {
      console.log(`   ${i+1}. ${f.numero} - Statut: ${f.statut} - HT: ${f.montant_ht} - TTC: ${f.montant_ttc}`);
      console.log(`      Entreprise: ${f.entreprise_id?.substring(0, 8)}...`);
      console.log(`      Régie: ${f.regie_id?.substring(0, 8)}...`);
      
      // Vérifier cohérence
      if (!f.entreprise_id) results.problemes.push(`❌ Facture ${f.numero}: entreprise_id NULL`);
      if (!f.regie_id) results.problemes.push(`❌ Facture ${f.numero}: regie_id NULL`);
      if (!f.mission_id) results.problemes.push(`❌ Facture ${f.numero}: mission_id NULL`);
    });
  } else {
    console.error('❌ Erreur lecture factures:', errFactures);
    results.problemes.push('Impossible de lire les factures');
  }

  // ========================================
  // 3. VUES EXISTANTES
  // ========================================
  console.log('\n👁️  3. VUES LIÉES AUX FACTURES');
  console.log('-'.repeat(80));
  
  try {
    const { data: vues, error: errVues } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name ILIKE '%facture%'
        ORDER BY table_name;
      `
    });
    
    if (vues && vues.length > 0) {
      console.log(`✅ ${vues.length} vues trouvées:`);
      vues.forEach(v => {
        console.log(`   - ${v.table_name}`);
        results.vues[v.table_name] = v.view_definition;
      });
    } else {
      console.log('ℹ️  Aucune vue spécifique aux factures');
    }
  } catch (e) {
    console.log('⚠️  Impossible de lire les vues (RPC exec_sql manquante?)');
  }

  // ========================================
  // 4. POLICIES RLS SUR FACTURES
  // ========================================
  console.log('\n🔒 4. POLICIES RLS SUR TABLE FACTURES');
  console.log('-'.repeat(80));
  
  let policies = null;
  try {
    const result = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname, tablename, policyname, 
          permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'factures'
        ORDER BY policyname;
      `
    });
    policies = result.data;
  } catch (e) {
    console.log('⚠️  exec_sql non disponible, essai méthode alternative...');
  }
  
  if (policies && policies.length > 0) {
    console.log(`✅ ${policies.length} policies trouvées:`);
    results.policies.factures = policies;
    
    policies.forEach(p => {
      console.log(`   📌 ${p.policyname}`);
      console.log(`      Commande: ${p.cmd} | Rôles: ${p.roles}`);
      console.log(`      USING: ${p.qual?.substring(0, 100)}...`);
      
      // Analyse pour la Régie
      if (p.policyname.toLowerCase().includes('regie')) {
        console.log(`      ⚠️  Policy RÉGIE détectée`);
        if (!p.qual?.includes('regie_id')) {
          results.problemes.push(`❌ Policy ${p.policyname}: ne filtre pas par regie_id`);
        }
      }
      
      // Analyse pour l'Entreprise
      if (p.policyname.toLowerCase().includes('entreprise')) {
        console.log(`      ⚠️  Policy ENTREPRISE détectée`);
        if (!p.qual?.includes('entreprise_id')) {
          results.problemes.push(`❌ Policy ${p.policyname}: ne filtre pas par entreprise_id`);
        }
      }
    });
    
    // Vérifier policies essentielles
    const policyNames = policies.map(p => p.policyname.toLowerCase());
    
    if (!policyNames.some(n => n.includes('regie'))) {
      results.problemes.push('❌ CRITIQUE: Aucune policy pour la Régie');
    }
    
    if (!policyNames.some(n => n.includes('entreprise'))) {
      results.problemes.push('❌ CRITIQUE: Aucune policy pour l\'Entreprise');
    }
  } else {
    console.error('❌ Impossible de lire les policies');
    results.problemes.push('Impossible de vérifier les policies RLS');
  }

  // ========================================
  // 5. POLICIES SUR FACTURE_LIGNES
  // ========================================
  console.log('\n🔒 5. POLICIES RLS SUR TABLE FACTURE_LIGNES');
  console.log('-'.repeat(80));
  
  let policiesLignes = null;
  try {
    const result = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname, tablename, policyname, 
          permissive, roles, cmd, qual
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'facture_lignes'
        ORDER BY policyname;
      `
    });
    policiesLignes = result.data;
  } catch (e) {
    console.log('⚠️  Impossible de lire les policies facture_lignes');
  }
  
  if (policiesLignes && policiesLignes.length > 0) {
    console.log(`✅ ${policiesLignes.length} policies trouvées sur facture_lignes`);
    results.policies.facture_lignes = policiesLignes;
    
    policiesLignes.forEach(p => {
      console.log(`   📌 ${p.policyname} (${p.cmd})`);
    });
  } else {
    console.log('ℹ️  Aucune policy sur facture_lignes ou table inexistante');
  }

  // ========================================
  // 6. TEST ACCÈS RÉGIE
  // ========================================
  console.log('\n🧪 6. TEST ACCÈS AVEC UN COMPTE RÉGIE');
  console.log('-'.repeat(80));
  
  // Récupérer une régie de test
  const { data: regies } = await supabase
    .from('regies')
    .select('id, email')
    .limit(1);
  
  if (regies && regies.length > 0) {
    const regie = regies[0];
    console.log(`✅ Régie test: ${regie.email} (${regie.id.substring(0, 8)}...)`);
    
    // Compter les factures liées à cette régie
    const { data: facturesRegie, error: errFacturesRegie } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('regie_id', regie.id);
    
    if (facturesRegie) {
      console.log(`   ✅ ${facturesRegie.length} factures liées à cette régie`);
      
      if (facturesRegie.length === 0) {
        results.problemes.push(`⚠️  Aucune facture liée à la régie ${regie.email}`);
      } else {
        facturesRegie.forEach(f => {
          console.log(`      - ${f.numero} (${f.statut})`);
        });
      }
    } else {
      console.error('   ❌ Erreur lecture factures régie:', errFacturesRegie);
      results.problemes.push('Impossible de lire factures côté régie (RLS?)');
    }
  } else {
    console.log('ℹ️  Aucune régie trouvée');
  }

  // ========================================
  // 7. TEST ACCÈS ENTREPRISE
  // ========================================
  console.log('\n🧪 7. TEST ACCÈS AVEC UN COMPTE ENTREPRISE');
  console.log('-'.repeat(80));
  
  const { data: entreprises } = await supabase
    .from('entreprises')
    .select('id, email, nom')
    .limit(1);
  
  if (entreprises && entreprises.length > 0) {
    const entreprise = entreprises[0];
    console.log(`✅ Entreprise test: ${entreprise.nom} (${entreprise.email})`);
    
    const { data: facturesEntreprise } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('entreprise_id', entreprise.id);
    
    if (facturesEntreprise) {
      console.log(`   ✅ ${facturesEntreprise.length} factures liées à cette entreprise`);
      
      facturesEntreprise.forEach(f => {
        console.log(`      - ${f.numero} (${f.statut})`);
      });
    } else {
      console.log('   ⚠️  Aucune facture pour cette entreprise');
    }
  }

  // ========================================
  // 8. VÉRIFIER FONCTIONS RPC
  // ========================================
  console.log('\n⚙️  8. FONCTIONS RPC FACTURES');
  console.log('-'.repeat(80));
  
  let fonctions = null;
  try {
    const result = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          routine_name, 
          routine_type,
          data_type AS return_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name ILIKE '%facture%'
        ORDER BY routine_name;
      `
    });
    fonctions = result.data;
  } catch (e) {
    console.log('⚠️  Impossible de lire les fonctions RPC');
  }
  
  if (fonctions) {
    console.log(`✅ ${fonctions.length} fonctions RPC trouvées:`);
    results.fonctions = fonctions;
    
    fonctions.forEach(f => {
      console.log(`   📦 ${f.routine_name} (${f.routine_type}) → ${f.return_type}`);
    });
    
    // Vérifier fonctions essentielles
    const fnNames = fonctions.map(f => f.routine_name);
    const fnEssentielles = ['editer_facture', 'ajouter_ligne_facture', 'modifier_ligne_facture', 'supprimer_ligne_facture'];
    
    fnEssentielles.forEach(fn => {
      if (!fnNames.includes(fn)) {
        results.problemes.push(`⚠️  Fonction RPC manquante: ${fn}`);
      }
    });
  }

  // ========================================
  // SYNTHÈSE
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('📋 SYNTHÈSE DE L\'AUDIT');
  console.log('='.repeat(80));
  
  if (results.problemes.length === 0) {
    console.log('✅ Aucun problème détecté au niveau backend');
    console.log('➡️  Le problème est probablement dans le frontend (connexion des vues)');
  } else {
    console.log(`❌ ${results.problemes.length} PROBLÈME(S) DÉTECTÉ(S):\n`);
    results.problemes.forEach((p, i) => {
      console.log(`${i+1}. ${p}`);
    });
  }
  
  // Sauvegarder résultats
  const fs = require('fs');
  fs.writeFileSync(
    '_AUDIT_FACTURATION_RLS_RESULTS.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n💾 Résultats sauvegardés: _AUDIT_FACTURATION_RLS_RESULTS.json');
}

main().catch(console.error);
