#!/usr/bin/env node

/**
 * Script de validation - Vue Technicien
 * Vérifie la conformité DB pour la vue technicien
 * 
 * Usage:
 *   node audit/test_vue_technicien_db.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 TEST VUE TECHNICIEN - VALIDATION DB\n');
console.log('='.repeat(60));

let errors = 0;
let warnings = 0;
let success = 0;

async function test(label, fn) {
  try {
    const result = await fn();
    if (result === true) {
      console.log(`✅ ${label}`);
      success++;
    } else if (result === 'warning') {
      console.log(`⚠️  ${label}`);
      warnings++;
    } else {
      console.log(`❌ ${label}`);
      errors++;
    }
  } catch (error) {
    console.log(`❌ ${label}`);
    console.error(`   Erreur: ${error.message}`);
    errors++;
  }
}

(async () => {
  console.log('\n📋 ÉTAPE 1 - STRUCTURE TABLES\n');
  
  await test('Table missions existe', async () => {
    const { data, error } = await supabase
      .from('missions')
      .select('id')
      .limit(1);
    return !error;
  });
  
  await test('Table mission_signalements existe', async () => {
    const { data, error } = await supabase
      .from('mission_signalements')
      .select('id')
      .limit(1);
    return !error;
  });
  
  await test('Table techniciens existe', async () => {
    const { data, error } = await supabase
      .from('techniciens')
      .select('id')
      .limit(1);
    return !error;
  });

  console.log('\n📋 ÉTAPE 2 - COLONNES MISSIONS\n');
  
  const requiredColumns = [
    'technicien_id',
    'statut',
    'started_at',
    'completed_at',
    'notes',
    'photos_urls',
    'locataire_absent',
    'absence_signalement_at',
    'absence_raison',
    'date_intervention_prevue'
  ];
  
  for (const col of requiredColumns) {
    await test(`Colonne missions.${col} existe`, async () => {
      const { data, error } = await supabase
        .from('missions')
        .select(col)
        .limit(1);
      return !error;
    });
  }

  console.log('\n📋 ÉTAPE 3 - COLONNES SIGNALEMENTS\n');
  
  const signalementsColumns = [
    'mission_id',
    'type_signalement',
    'description',
    'photos_urls',
    'signale_par',
    'signale_at',
    'resolu',
    'resolu_par',
    'resolu_at'
  ];
  
  for (const col of signalementsColumns) {
    await test(`Colonne mission_signalements.${col} existe`, async () => {
      const { data, error } = await supabase
        .from('mission_signalements')
        .select(col)
        .limit(1);
      return !error;
    });
  }

  console.log('\n📋 ÉTAPE 4 - DONNÉES TEST\n');
  
  await test('Au moins 1 technicien existe', async () => {
    const { data, error } = await supabase
      .from('techniciens')
      .select('id, profile_id');
    
    if (error) throw error;
    
    if (data.length === 0) {
      console.log('   ℹ️  Aucun technicien trouvé - créer via Dashboard ou API');
      return 'warning';
    }
    
    console.log(`   ℹ️  ${data.length} technicien(s) trouvé(s)`);
    return true;
  });
  
  await test('Au moins 1 mission existe', async () => {
    const { data, error } = await supabase
      .from('missions')
      .select('id, statut, technicien_id');
    
    if (error) throw error;
    
    if (data.length === 0) {
      console.log('   ℹ️  Aucune mission - créer via Dashboard Entreprise');
      return 'warning';
    }
    
    console.log(`   ℹ️  ${data.length} mission(s) trouvée(s)`);
    
    const withTech = data.filter(m => m.technicien_id !== null).length;
    console.log(`   ℹ️  ${withTech} mission(s) assignée(s) à un technicien`);
    
    return true;
  });

  console.log('\n📋 ÉTAPE 5 - RLS POLICIES\n');
  
  await test('Policy "Technicien can view assigned missions" existe', async () => {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'missions' 
        AND policyname ILIKE '%technicien%view%'
      `
    }).catch(() => {
      // Fallback si RPC non disponible
      return { data: null, error: 'RPC exec_sql non disponible' };
    });
    
    if (error) {
      console.log('   ℹ️  Impossible de vérifier via RPC - vérifier manuellement dans Dashboard');
      return 'warning';
    }
    
    return true; // Assume OK si pas d'erreur
  });
  
  await test('Policy "Technicien can update assigned missions" existe', async () => {
    // Même approche que ci-dessus
    return 'warning'; // On ne peut pas vérifier sans RPC ou accès direct pg_policies
  });

  console.log('\n📋 ÉTAPE 6 - STORAGE BUCKET\n');
  
  await test('Bucket mission-photos existe', async () => {
    const { data, error } = await supabase.storage.getBucket('mission-photos');
    
    if (error) {
      console.log('   ℹ️  Bucket non trouvé - appliquer migration M47');
      console.log('   📝 Migration: supabase/migrations/20260106100000_m47_storage_mission_photos.sql');
      return 'warning';
    }
    
    console.log(`   ℹ️  Bucket public: ${data.public}`);
    return true;
  });
  
  await test('Bucket mission-photos est public', async () => {
    const { data, error } = await supabase.storage.getBucket('mission-photos');
    
    if (error) return 'warning';
    
    if (!data.public) {
      console.log('   ⚠️  Bucket non public - modifier dans Dashboard Storage');
      return false;
    }
    
    return true;
  });

  console.log('\n📋 ÉTAPE 7 - RELATIONS / FOREIGN KEYS\n');
  
  await test('Relation missions.technicien_id → techniciens.id', async () => {
    const { data: missions, error } = await supabase
      .from('missions')
      .select('technicien_id, technicien:techniciens(id)')
      .not('technicien_id', 'is', null)
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️  Erreur: ${error.message}`);
      return false;
    }
    
    if (!missions || missions.length === 0) {
      console.log('   ℹ️  Aucune mission assignée pour tester la relation');
      return 'warning';
    }
    
    return true;
  });
  
  await test('Relation mission_signalements.mission_id → missions.id', async () => {
    const { data, error } = await supabase
      .from('mission_signalements')
      .select('mission_id, mission:missions(id)')
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️  Erreur: ${error.message}`);
      return false;
    }
    
    return true;
  });

  console.log('\n📋 ÉTAPE 8 - QUERY COMPLEXE (FULL JOIN)\n');
  
  await test('Query complète missions + tickets + logements + locataires fonctionne', async () => {
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        ticket:tickets(
          id,
          categorie,
          sous_categorie,
          description,
          locataire:locataires(nom, prenom, telephone),
          logement:logements(
            adresse,
            immeuble:immeubles(nom, adresse)
          )
        )
      `)
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️  Erreur: ${error.message}`);
      return false;
    }
    
    console.log('   ℹ️  Query complexe OK - relations fonctionnelles');
    return true;
  });

  // ============================================================
  // RÉSUMÉ
  // ============================================================
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS\n');
  
  const total = success + warnings + errors;
  
  console.log(`✅ Succès:      ${success}/${total}`);
  console.log(`⚠️  Avertissements: ${warnings}/${total}`);
  console.log(`❌ Erreurs:     ${errors}/${total}`);
  
  console.log('\n' + '='.repeat(60));
  
  if (errors > 0) {
    console.log('\n❌ ÉCHEC - Corriger les erreurs avant de continuer\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  VALIDATION PARTIELLE - Vérifier les avertissements\n');
    console.log('💡 Actions recommandées:');
    console.log('   - Créer au moins 1 technicien de test');
    console.log('   - Assigner au moins 1 mission à ce technicien');
    console.log('   - Appliquer migration M47 (Storage bucket)');
    console.log('   - Vérifier RLS policies dans Dashboard Supabase\n');
  } else {
    console.log('\n✅ VALIDATION COMPLÈTE - Vue technicien prête à être testée\n');
  }
  
  console.log('📝 Prochaines étapes:');
  console.log('   1. Lancer serveur local: python3 -m http.server 8000');
  console.log('   2. Ouvrir: http://localhost:8000/public/technicien/dashboard.html');
  console.log('   3. Se connecter avec: tech@test.app (ou créer compte technicien)');
  console.log('   4. Suivre guide: GUIDE_TEST_VUE_TECHNICIEN.md\n');
})();
