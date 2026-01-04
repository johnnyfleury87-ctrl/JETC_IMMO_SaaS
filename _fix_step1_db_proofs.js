#!/usr/bin/env node
/**
 * ÉTAPE 1 — VÉRIFICATION DB RÉELLE (PREUVES)
 * Exécute requêtes SQL critiques pour identifier état exact des 2 blockers
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  timestamp: new Date().toISOString(),
  queries: {}
};

async function executeQuery(name, description, table, columns) {
  console.log(`\n🔍 ${name}...`);
  console.log(`   ${description}`);
  
  try {
    const { data, error } = await supabase
      .from(table)
      .select(columns, { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
      results.queries[name] = {
        description,
        error: error.message,
        success: false
      };
      return null;
    }
    
    console.log(`   ✅ Table accessible`);
    results.queries[name] = {
      description,
      success: true,
      accessible: true
    };
    return data;
    
  } catch (e) {
    console.log(`   ❌ Exception: ${e.message}`);
    results.queries[name] = {
      description,
      error: e.message,
      success: false
    };
    return null;
  }
}

async function checkColumnExists(tableName, columnName) {
  console.log(`\n🔍 Vérification colonne ${tableName}.${columnName}...`);
  
  // Test via tentative de SELECT de la colonne
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName, { head: true, count: 'exact' });
    
    if (error) {
      // Si erreur contient "column" + "does not exist", alors colonne absente
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log(`   ❌ COLONNE ABSENTE: ${error.message}`);
        return {
          exists: false,
          error: error.message,
          proof: 'SELECT failed with column does not exist'
        };
      }
      
      // Autre erreur (RLS, permissions, etc.)
      console.log(`   ⚠️ Erreur (pas nécessairement colonne absente): ${error.message}`);
      return {
        exists: 'unknown',
        error: error.message,
        proof: 'SELECT failed with other error'
      };
    }
    
    console.log(`   ✅ COLONNE EXISTE`);
    return {
      exists: true,
      proof: 'SELECT succeeded'
    };
    
  } catch (e) {
    console.log(`   ❌ Exception: ${e.message}`);
    return {
      exists: 'unknown',
      error: e.message,
      proof: 'Exception caught'
    };
  }
}

async function checkEnumValues() {
  console.log(`\n🔍 Vérification enum ticket_status...`);
  
  // On ne peut pas interroger pg_enum directement via Supabase JS
  // On va essayer d'insérer une valeur invalide pour déclencher l'erreur enum
  
  // Alternative: lire le schéma depuis information_schema via RPC debug si disponible
  const { data, error } = await supabase.rpc('jetc_debug_schema');
  
  if (!error && data) {
    console.log(`   ✅ RPC debug disponible`);
    results.queries['enum_via_debug'] = {
      description: 'Enum values via jetc_debug_schema',
      success: true,
      data: data
    };
    return data;
  }
  
  // Fallback: tenter SELECT avec colonne statut pour voir le type
  console.log(`   ⚠️ RPC debug non disponible, tentative lecture tickets.statut...`);
  
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('tickets')
    .select('statut')
    .limit(1);
  
  if (ticketsError) {
    console.log(`   ❌ Erreur lecture tickets: ${ticketsError.message}`);
    
    // Analyser message d'erreur pour enum
    if (ticketsError.message.includes('invalid input value for enum')) {
      const match = ticketsError.message.match(/invalid input value for enum (\w+): "(\w+)"/);
      if (match) {
        console.log(`   🎯 ENUM DÉTECTÉ: ${match[1]}, valeur invalide: ${match[2]}`);
        return {
          enum_name: match[1],
          invalid_value: match[2],
          proof: ticketsError.message
        };
      }
    }
    
    return {
      error: ticketsError.message
    };
  }
  
  console.log(`   ✅ Tickets.statut accessible`);
  return {
    accessible: true,
    sample: ticketsData
  };
}

async function analyzeRPCDefinition() {
  console.log(`\n🔍 Analyse RPC accept_ticket_and_create_mission...`);
  
  // Impossible de lire pg_proc directement via Supabase JS
  // On va tester le comportement de la RPC
  
  console.log(`   ⚠️ Impossible d'extraire définition RPC via Supabase JS SDK`);
  console.log(`   ℹ️ Utiliser CSV 9_Fonctions_RPC ou Supabase Studio SQL Editor`);
  
  return {
    method: 'manual',
    source: 'CSV 9_Fonctions_RPC (définitions complètes).csv',
    note: 'Extraction définition nécessite accès pg_proc'
  };
}

async function runStep1() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ÉTAPE 1 — VÉRIFICATION DB RÉELLE (PREUVES)');
  console.log('═══════════════════════════════════════════════');
  
  try {
    // Test 1: Table missions accessible
    await executeQuery(
      'missions_accessible',
      'Vérifier accès table missions',
      'missions',
      'id'
    );
    
    // Test 2: Colonne disponibilite_id existe?
    results.disponibilite_id_check = await checkColumnExists('missions', 'disponibilite_id');
    
    // Test 3: Toutes colonnes missions
    const { data: missionsCols, error: missionsError } = await supabase
      .from('missions')
      .select('*', { head: true });
    
    if (missionsError) {
      console.log(`\n❌ Impossible de lire colonnes missions: ${missionsError.message}`);
      results.missions_columns = { error: missionsError.message };
    } else {
      console.log(`\n✅ Colonnes missions accessibles`);
      // Note: avec head:true, on ne peut pas lire les colonnes exactes
      // Il faudrait faire un vrai SELECT avec 1 ligne si la base n'est pas vide
      results.missions_columns = { accessible: true };
    }
    
    // Test 4: Enum ticket_status
    results.enum_check = await checkEnumValues();
    
    // Test 5: RPC definition
    results.rpc_analysis = await analyzeRPCDefinition();
    
    // Analyse CSV pour colonnes exactes missions
    console.log(`\n📊 Analyse CSV colonnes missions...`);
    const csv4 = fs.readFileSync(
      'supabase/Audit_supabase/4_Colonnes détaillées (types, null, défaut, identité).csv',
      'utf8'
    );
    
    const missionLines = csv4.split('\n')
      .filter(line => line.startsWith('public,missions,'))
      .map(line => {
        const parts = line.split(',');
        return {
          position: parts[2],
          column_name: parts[3],
          data_type: parts[4],
          is_nullable: parts[6],
          column_default: parts[7]
        };
      });
    
    console.log(`   ✅ ${missionLines.length} colonnes missions dans CSV`);
    results.missions_columns_from_csv = missionLines;
    
    // Vérifier si disponibilite_id dans CSV
    const disponibiliteCol = missionLines.find(c => c.column_name === 'disponibilite_id');
    if (disponibiliteCol) {
      console.log(`   ✅ disponibilite_id PRÉSENTE dans CSV: ${JSON.stringify(disponibiliteCol)}`);
    } else {
      console.log(`   ❌ disponibilite_id ABSENTE du CSV`);
    }
    
    // Analyse CSV enum
    console.log(`\n📊 Analyse CSV enum ticket_status...`);
    const csv4Full = fs.readFileSync(
      'supabase/Audit_supabase/4_Colonnes détaillées (types, null, défaut, identité).csv',
      'utf8'
    );
    
    const ticketsStatusLine = csv4Full.split('\n')
      .find(line => line.includes('public,tickets,') && line.includes(',statut,'));
    
    if (ticketsStatusLine) {
      console.log(`   ✅ Colonne tickets.statut trouvée: ${ticketsStatusLine}`);
      results.tickets_statut_column = ticketsStatusLine.split(',');
    }
    
    // Analyse CSV RPC
    console.log(`\n📊 Extraction RPC accept_ticket depuis CSV...`);
    const csv9 = fs.readFileSync(
      'supabase/Audit_supabase/9_Fonctions_RPC (définitions complètes).csv',
      'utf8'
    );
    
    const rpcLines = csv9.split('\n')
      .filter(line => line.includes('accept_ticket_and_create_mission'));
    
    if (rpcLines.length > 0) {
      console.log(`   ✅ RPC trouvée dans CSV (${rpcLines.length} lignes)`);
      
      // Extraire la définition complète (difficile car multi-lignes CSV)
      // On va sauvegarder les premières lignes
      results.rpc_from_csv = {
        found: true,
        sample: rpcLines.slice(0, 5)
      };
      
      // Rechercher les termes clés
      const rpcFullText = rpcLines.join('\n');
      const hasPublic = rpcFullText.includes("'public'");
      const hasAssigne = rpcFullText.includes("'assigné'") || rpcFullText.includes("'assigne'");
      const hasGeneral = rpcFullText.includes("'general'");
      const hasRestreint = rpcFullText.includes("'restreint'");
      
      console.log(`   📝 Terminologie détectée dans RPC:`);
      console.log(`      - 'public': ${hasPublic ? '✅' : '❌'}`);
      console.log(`      - 'assigné': ${hasAssigne ? '✅' : '❌'}`);
      console.log(`      - 'general': ${hasGeneral ? '✅' : '❌'}`);
      console.log(`      - 'restreint': ${hasRestreint ? '✅' : '❌'}`);
      
      results.rpc_terminology = {
        obsolete: { public: hasPublic, assigne: hasAssigne },
        current: { general: hasGeneral, restreint: hasRestreint }
      };
      
      if (hasPublic || hasAssigne) {
        console.log(`   🔴 RPC VERSION OBSOLÈTE DÉTECTÉE (terminologie public/assigné)`);
      } else if (hasGeneral || hasRestreint) {
        console.log(`   ✅ RPC VERSION CORRECTE (terminologie general/restreint)`);
      }
    }
    
    // Sauvegarder résultats
    fs.writeFileSync(
      '_fix_output/01_db_proofs.json',
      JSON.stringify(results, null, 2),
      'utf8'
    );
    
    console.log('\n✅ ÉTAPE 1 TERMINÉE');
    console.log('📄 Résultats: _fix_output/01_db_proofs.json');
    
    return results;
    
  } catch (error) {
    console.error('\n❌ ERREUR ÉTAPE 1:', error);
    throw error;
  }
}

runStep1().catch(err => {
  console.error('Échec:', err);
  process.exit(1);
});
