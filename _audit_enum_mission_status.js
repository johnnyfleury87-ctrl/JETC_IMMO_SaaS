#!/usr/bin/env node
/**
 * AUDIT DÉFINITIF: ENUM mission_status
 * 
 * Objectif: Identifier l'incohérence entre l'ENUM PostgreSQL et le code
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const results = {
  timestamp: new Date().toISOString(),
  enum_postgres: {},
  code_usage: {},
  missions_actuelles: [],
  diagnostic: [],
  solution: null
};

console.log('🔍 AUDIT DÉFINITIF: ENUM mission_status\n');

// 1. AUDITER L'ENUM PostgreSQL
async function auditEnumPostgres() {
  console.log('📋 1. Audit ENUM PostgreSQL mission_status\n');
  
  // Méthode 1: Via information_schema
  const { data: enumData, error: enumError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value,
        e.enumsortorder as sort_order
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'mission_status'
      ORDER BY e.enumsortorder;
    `
  }).catch(() => ({ data: null, error: 'RPC exec_sql not available' }));
  
  if (enumError || !enumData) {
    console.log('⚠️  RPC exec_sql non disponible, tentative directe...\n');
    
    // Méthode 2: Via query directe
    const { data, error } = await supabase
      .from('missions')
      .select('statut')
      .limit(0);
    
    if (error) {
      console.error('❌ Impossible de récupérer l\'ENUM:', error);
      results.enum_postgres.error = error.message;
      return;
    }
  }
  
  // Méthode 3: Lire depuis les migrations
  console.log('📄 Lecture depuis les migrations SQL...\n');
  
  try {
    const migrations = fs.readdirSync('supabase/migrations')
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    const enumDefs = [];
    
    for (const file of migrations) {
      const content = fs.readFileSync(`supabase/migrations/${file}`, 'utf-8');
      
      // Chercher CREATE TYPE mission_status
      const createMatch = content.match(/CREATE TYPE.*?mission_status.*?AS ENUM\s*\(([\s\S]*?)\)/i);
      if (createMatch) {
        console.log(`✅ Trouvé dans ${file}:`);
        const values = createMatch[1]
          .split(',')
          .map(v => v.trim().replace(/'/g, '').replace(/"/g, ''))
          .filter(v => v.length > 0);
        
        console.log('   Valeurs:', values);
        enumDefs.push({ file, values });
      }
      
      // Chercher ALTER TYPE mission_status ADD VALUE
      const alterMatches = content.matchAll(/ALTER TYPE.*?mission_status.*?ADD VALUE.*?['"]([^'"]+)['"]/gi);
      for (const match of alterMatches) {
        console.log(`✅ Ajout trouvé dans ${file}: '${match[1]}'`);
        enumDefs.push({ file, added: match[1] });
      }
    }
    
    results.enum_postgres.definitions = enumDefs;
    
    if (enumDefs.length === 0) {
      console.log('⚠️  Aucune définition d\'ENUM trouvée dans les migrations');
    }
    
  } catch (err) {
    console.error('❌ Erreur lecture migrations:', err.message);
  }
}

// 2. AUDITER LE CODE
async function auditCodeUsage() {
  console.log('\n📋 2. Audit usage dans le code\n');
  
  try {
    // Chercher "planifiée" dans tout le projet
    const { stdout: grepPlanifiee } = await execAsync('grep -r "planifiée" --include="*.sql" --include="*.js" --include="*.html" . 2>/dev/null || true');
    
    if (grepPlanifiee) {
      console.log('🔍 Occurrences de "planifiée":');
      console.log(grepPlanifiee);
      results.code_usage.planifiee = grepPlanifiee.split('\n').filter(l => l.trim());
    }
    
    // Chercher "planifiee" (sans accent)
    const { stdout: grepPlanifiee2 } = await execAsync('grep -r "planifiee" --include="*.sql" --include="*.js" --include="*.html" . 2>/dev/null || true');
    
    if (grepPlanifiee2) {
      console.log('\n🔍 Occurrences de "planifiee" (sans accent):');
      console.log(grepPlanifiee2);
      results.code_usage.planifiee_no_accent = grepPlanifiee2.split('\n').filter(l => l.trim());
    }
    
    // Chercher tous les statuts de mission utilisés
    const { stdout: grepStatut } = await execAsync('grep -r "statut.*=" --include="*.sql" supabase/migrations/ 2>/dev/null | grep -i mission | head -20 || true');
    
    if (grepStatut) {
      console.log('\n🔍 Assignations de statut dans migrations:');
      console.log(grepStatut);
    }
    
  } catch (err) {
    console.error('❌ Erreur grep:', err.message);
  }
}

// 3. VÉRIFIER LES MISSIONS ACTUELLES
async function checkCurrentMissions() {
  console.log('\n📋 3. Vérification missions existantes\n');
  
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, statut, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }
  
  if (missions && missions.length > 0) {
    console.log(`✅ ${missions.length} missions trouvées:`);
    
    const statutsUniques = new Set();
    missions.forEach(m => {
      console.log(`   - ${m.statut}`);
      statutsUniques.add(m.statut);
    });
    
    console.log(`\n✅ Statuts uniques actuellement en BDD: ${Array.from(statutsUniques).join(', ')}`);
    results.missions_actuelles = missions;
    results.enum_postgres.statuts_en_base = Array.from(statutsUniques);
  } else {
    console.log('⚠️  Aucune mission en base');
  }
}

// 4. DIAGNOSTIC ET SOLUTION
function generateDiagnostic() {
  console.log('\n📋 4. DIAGNOSTIC ET SOLUTION\n');
  
  const planifieeAvecAccent = results.code_usage.planifiee || [];
  const planifieeSansAccent = results.code_usage.planifiee_no_accent || [];
  const statutsEnBase = results.enum_postgres.statuts_en_base || [];
  
  console.log('══════════════════════════════════════════════════════════');
  console.log('DIAGNOSTIC');
  console.log('══════════════════════════════════════════════════════════\n');
  
  // Analyse
  if (planifieeAvecAccent.length > 0) {
    console.log(`❌ PROBLÈME: "${planifieeAvecAccent.length}" occurrences de "planifiée" (avec accent) trouvées`);
    results.diagnostic.push('Code utilise "planifiée" avec accent');
  }
  
  if (planifieeSansAccent.length > 0) {
    console.log(`⚠️  "${planifieeSansAccent.length}" occurrences de "planifiee" (sans accent) trouvées`);
    results.diagnostic.push('Code utilise "planifiee" sans accent');
  }
  
  console.log(`\n✅ Statuts actuellement en BDD: ${statutsEnBase.join(', ')}`);
  
  // Solution recommandée
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('SOLUTION RECOMMANDÉE');
  console.log('══════════════════════════════════════════════════════════\n');
  
  if (planifieeSansAccent.length > 0 || planifieeAvecAccent.length > 0) {
    console.log('🎯 OPTION A (Recommandée): Normaliser sur "planifiee" (sans accent)');
    console.log('   - Ajouter "planifiee" à l\'ENUM mission_status');
    console.log('   - Remplacer toutes occurrences de "planifiée" par "planifiee"');
    console.log('   - Migration SQL: ALTER TYPE mission_status ADD VALUE IF NOT EXISTS "planifiee"');
    console.log('   - Avantage: Cohérent avec conventions PostgreSQL (pas d\'accent)');
    
    results.solution = {
      option: 'A',
      action: 'Ajouter "planifiee" à l\'ENUM et normaliser le code',
      migration_sql: 'ALTER TYPE mission_status ADD VALUE IF NOT EXISTS \'planifiee\';',
      code_changes: planifieeSansAccent.concat(planifieeAvecAccent)
    };
  } else {
    console.log('✅ Aucun problème détecté');
  }
}

// MAIN
async function main() {
  try {
    await auditEnumPostgres();
    await auditCodeUsage();
    await checkCurrentMissions();
    generateDiagnostic();
    
    // Sauvegarder
    fs.writeFileSync(
      '_AUDIT_ENUM_MISSION_STATUS_RESULTS.json',
      JSON.stringify(results, null, 2)
    );
    
    console.log('\n✅ Audit terminé! Résultats dans _AUDIT_ENUM_MISSION_STATUS_RESULTS.json\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
