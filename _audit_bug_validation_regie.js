#!/usr/bin/env node
/**
 * AUDIT BUG VALIDATION RÉGIE - CONTRAINTE CHECK sous_categorie
 * 
 * Diagnostic complet :
 * 1. Définition exacte de la contrainte check_sous_categorie_valide
 * 2. Valeurs existantes en BDD
 * 3. Code frontend qui envoie le payload
 * 4. Identification de la cause
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const results = {
  timestamp: new Date().toISOString(),
  contrainte: {},
  valeurs_existantes: {},
  tickets_locataires: [],
  code_frontend: {},
  diagnostic: [],
  solution: []
};

console.log('🔍 AUDIT BUG VALIDATION RÉGIE - Contrainte CHECK sous_categorie\n');

// 1. RÉCUPÉRER LA DÉFINITION DE LA CONTRAINTE
async function getConstraintDefinition() {
  console.log('📋 1. Récupération définition contrainte check_sous_categorie_valide...\n');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conname = 'check_sous_categorie_valide'
        OR conname LIKE '%sous_categorie%'
      ORDER BY conname;
    `
  });

  if (error) {
    // Essayer méthode alternative
    const query = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'tickets'
        AND (tc.constraint_name LIKE '%sous_categorie%' 
             OR cc.check_clause LIKE '%sous_categorie%');
    `;
    
    console.log('Requête alternative pour contraintes CHECK...');
    const result = await supabase.from('tickets').select('*').limit(0);
    
    // Lire depuis les migrations SQL
    console.log('Recherche dans les fichiers de migration...\n');
  }

  results.contrainte.definition = data || error;
  console.log('Contrainte trouvée:', JSON.stringify(data || error, null, 2));
}

// 2. ANALYSER LES VALEURS EXISTANTES
async function analyzeExistingValues() {
  console.log('\n📊 2. Analyse des valeurs existantes en BDD...\n');
  
  // Types des colonnes
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'tickets'
          AND column_name IN ('categorie', 'sous_categorie', 'piece_concernee')
        ORDER BY ordinal_position;
      `
    });

  results.valeurs_existantes.types_colonnes = columns || colError;
  console.log('Types des colonnes:', JSON.stringify(columns || colError, null, 2));

  // Valeurs distinctes
  const { data: distinctValues, error: distError } = await supabase
    .from('tickets')
    .select('categorie, sous_categorie, piece_concernee, statut, created_by_locataire')
    .limit(1000);

  if (!distError && distinctValues) {
    const categories = new Set();
    const sousCategories = new Set();
    const pieces = new Set();
    const combinations = new Map();

    distinctValues.forEach(t => {
      if (t.categorie) categories.add(t.categorie);
      if (t.sous_categorie) sousCategories.add(t.sous_categorie);
      if (t.piece_concernee) pieces.add(t.piece_concernee);
      
      const key = `${t.categorie}|${t.sous_categorie}`;
      if (!combinations.has(key)) {
        combinations.set(key, []);
      }
      combinations.get(key).push({ statut: t.statut, created_by_locataire: t.created_by_locataire });
    });

    results.valeurs_existantes.categories_uniques = Array.from(categories);
    results.valeurs_existantes.sous_categories_uniques = Array.from(sousCategories);
    results.valeurs_existantes.pieces_uniques = Array.from(pieces);
    results.valeurs_existantes.combinations = Array.from(combinations.entries()).map(([key, values]) => ({
      categorie_sous_categorie: key,
      count: values.length,
      sample: values[0]
    }));

    console.log('\n✅ Catégories uniques:', results.valeurs_existantes.categories_uniques);
    console.log('✅ Sous-catégories uniques:', results.valeurs_existantes.sous_categories_uniques);
    console.log('✅ Pièces uniques:', results.valeurs_existantes.pieces_uniques);
    console.log('\n✅ Combinaisons cat|sous-cat:', results.valeurs_existantes.combinations.length);
  }
}

// 3. EXAMINER LES TICKETS CRÉÉS PAR LOCATAIRES (EN ATTENTE DE VALIDATION)
async function examineTicketsLocataires() {
  console.log('\n🎫 3. Tickets créés par locataires (en attente validation)...\n');
  
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, titre, categorie, sous_categorie, piece_concernee, statut, created_by_locataire')
    .eq('created_by_locataire', true)
    .in('statut', ['en_attente', 'brouillon', 'soumis'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (!error && tickets) {
    results.tickets_locataires = tickets;
    console.log(`✅ ${tickets.length} tickets locataires trouvés:`);
    tickets.forEach(t => {
      console.log(`  - ID ${t.id}: "${t.titre}"`);
      console.log(`    Cat: "${t.categorie}" | Sous-cat: "${t.sous_categorie}" | Pièce: "${t.piece_concernee}"`);
      console.log(`    Statut: ${t.statut}\n`);
    });
  } else {
    console.log('❌ Erreur:', error);
  }
}

// 4. ANALYSER LE CODE FRONTEND (tickets.html - partie régie)
async function analyzeCodeFrontend() {
  console.log('\n💻 4. Analyse du code frontend (validation régie)...\n');
  
  const regieFiles = [
    'public/regie/tickets.html',
    'public/regie/dashboard.html',
    'public/admin/tickets.html'
  ];

  for (const file of regieFiles) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Rechercher la fonction de validation
        const validateMatch = content.match(/function\s+(?:valider|publier|diffuser).*?\{[\s\S]*?\n\s*\}/gi);
        const updateMatch = content.match(/\.update\s*\(\s*\{[\s\S]*?sous_categorie[\s\S]*?\}\s*\)/gi);
        const patchMatch = content.match(/\.from\s*\(\s*['"]tickets['"]\s*\)[\s\S]*?\.update/gi);
        
        if (validateMatch || updateMatch || patchMatch) {
          results.code_frontend[file] = {
            validation_functions: validateMatch || [],
            update_calls: updateMatch || [],
            patch_calls: patchMatch || []
          };
          
          console.log(`✅ Trouvé dans ${file}:`);
          if (validateMatch) console.log(`  - ${validateMatch.length} fonction(s) de validation`);
          if (updateMatch) console.log(`  - ${updateMatch.length} appel(s) update avec sous_categorie`);
          if (patchMatch) console.log(`  - ${patchMatch.length} appel(s) patch tickets`);
        }
      }
    } catch (err) {
      console.log(`⚠️  Erreur lecture ${file}:`, err.message);
    }
  }
}

// 5. RECHERCHER DANS LES MIGRATIONS
async function searchMigrations() {
  console.log('\n📜 5. Recherche dans les migrations SQL...\n');
  
  const migrationFiles = fs.readdirSync('supabase/migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const content = fs.readFileSync(`supabase/migrations/${file}`, 'utf-8');
    
    if (content.includes('check_sous_categorie_valide') || 
        (content.includes('CHECK') && content.includes('sous_categorie'))) {
      
      console.log(`✅ Trouvé dans ${file}:`);
      
      // Extraire la contrainte
      const checkMatch = content.match(/CONSTRAINT\s+\w*sous_categorie\w*\s+CHECK\s*\([^)]+\)/gi);
      if (checkMatch) {
        checkMatch.forEach(c => console.log(`  ${c}\n`));
        if (!results.contrainte.definition_migration) {
          results.contrainte.definition_migration = [];
        }
        results.contrainte.definition_migration.push({
          file,
          constraint: checkMatch
        });
      }
    }
  }
}

// 6. DIAGNOSTIC ET SOLUTION
function generateDiagnostic() {
  console.log('\n🔬 6. DIAGNOSTIC\n');
  
  results.diagnostic.push('ANALYSE DE LA CONTRAINTE CHECK');
  
  // Analyser la définition si trouvée
  if (results.contrainte.definition_migration) {
    const constraints = results.contrainte.definition_migration;
    console.log('📌 Contrainte trouvée dans migrations:');
    constraints.forEach(c => {
      console.log(`   ${c.file}`);
      c.constraint.forEach(def => console.log(`   ${def}`));
    });
    
    results.diagnostic.push('La contrainte existe et définit les valeurs autorisées');
  }

  // Analyser les valeurs
  if (results.valeurs_existantes.sous_categories_uniques) {
    console.log('\n📌 Sous-catégories actuellement en BDD:');
    console.log('   ', results.valeurs_existantes.sous_categories_uniques.join(', '));
    
    results.diagnostic.push(`${results.valeurs_existantes.sous_categories_uniques.length} sous-catégories distinctes en BDD`);
  }

  // Analyser les tickets locataires
  if (results.tickets_locataires.length > 0) {
    console.log('\n📌 Tickets locataires en attente:');
    const problematic = results.tickets_locataires.filter(t => 
      !t.sous_categorie || t.sous_categorie === '' || t.sous_categorie === 'null'
    );
    
    if (problematic.length > 0) {
      console.log(`   ⚠️  ${problematic.length} tickets avec sous_categorie vide/null`);
      results.diagnostic.push('PROBLÈME: Tickets avec sous_categorie vide ou null');
    }
  }

  // Solution proposée
  console.log('\n💡 SOLUTION PROPOSÉE:\n');
  
  const solutions = [
    '1. Vérifier que le frontend régie charge les valeurs existantes avant update',
    '2. Ne PAS écraser categorie/sous_categorie si déjà renseignées par locataire',
    '3. Valider les valeurs contre la contrainte CHECK avant envoi',
    '4. Ajouter des valeurs par défaut si manquantes',
    '5. Option: assouplir la contrainte si trop stricte'
  ];
  
  solutions.forEach(s => {
    console.log(`   ${s}`);
    results.solution.push(s);
  });
}

// MAIN
async function main() {
  try {
    await getConstraintDefinition();
    await analyzeExistingValues();
    await examineTicketsLocataires();
    await analyzeCodeFrontend();
    await searchMigrations();
    generateDiagnostic();

    // Sauvegarder résultats
    fs.writeFileSync(
      '_AUDIT_BUG_VALIDATION_REGIE_RESULTS.json',
      JSON.stringify(results, null, 2)
    );

    console.log('\n✅ Audit terminé! Résultats sauvegardés dans _AUDIT_BUG_VALIDATION_REGIE_RESULTS.json\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
