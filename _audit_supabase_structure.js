/**
 * AUDIT STRUCTURE SUPABASE - Version corrigée
 * Vérifie la structure réelle via information_schema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const results = {
  timestamp: new Date().toISOString(),
  status: 'OK',
  anomalies: [],
  checks: {}
};

/**
 * Vérifier les colonnes via requête SQL directe
 */
async function checkTableStructure(tableName, expectedColumns) {
  console.log(`\n🔍 Vérification structure: ${tableName}`);
  
  try {
    // Requête SQL pour obtenir les colonnes
    const { data, error } = await supabase.rpc('get_table_structure', {
      p_table_name: tableName
    });
    
    if (error) {
      // Fallback : requête directe si RPC n'existe pas
      console.log(`   ⚠️ RPC non disponible, utilisation fallback...`);
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (fallbackError) {
        results.anomalies.push({
          type: 'ERREUR_LECTURE',
          table: tableName,
          message: fallbackError.message
        });
        return { exists: false, columns: [] };
      }
      
      // Si table vide, on ne peut pas déduire les colonnes
      if (!fallbackData || fallbackData.length === 0) {
        console.log(`   ⚠️ Table vide, impossible de vérifier colonnes via select`);
        results.anomalies.push({
          type: 'WARNING',
          table: tableName,
          message: 'Table vide - impossible de vérifier structure via SELECT'
        });
        return { exists: true, columns: [], empty: true };
      }
      
      const actualColumns = Object.keys(fallbackData[0]);
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missing.length > 0) {
        console.log(`   ❌ Colonnes manquantes: ${missing.join(', ')}`);
        results.anomalies.push({
          type: 'COLONNES_MANQUANTES',
          table: tableName,
          missing
        });
      } else {
        console.log(`   ✅ Toutes les colonnes attendues présentes`);
      }
      
      return { exists: true, columns: actualColumns, missing };
    }
    
    // Si RPC existe
    const actualColumns = data.map(col => col.column_name);
    const missing = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missing.length > 0) {
      console.log(`   ❌ Colonnes manquantes: ${missing.join(', ')}`);
      results.anomalies.push({
        type: 'COLONNES_MANQUANTES',
        table: tableName,
        missing
      });
    } else {
      console.log(`   ✅ Toutes les colonnes attendues présentes`);
    }
    
    return { exists: true, columns: actualColumns, missing };
    
  } catch (err) {
    console.log(`   ❌ ERREUR: ${err.message}`);
    results.anomalies.push({
      type: 'ERREUR_TECHNIQUE',
      table: tableName,
      error: err.message
    });
    return { exists: false, columns: [] };
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  AUDIT STRUCTURE SUPABASE');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Date: ${new Date().toISOString()}\n`);
  
  // Tables critiques à vérifier
  const checks = [
    {
      table: 'tickets',
      columns: ['id', 'titre', 'description', 'statut', 'priorite', 'categorie', 
                'sous_categorie', 'piece', 'mode_diffusion', 'plafond_ht', 'valide_at']
    },
    {
      table: 'missions',
      columns: ['id', 'ticket_id', 'entreprise_id', 'statut', 'montant', 
                'date_intervention', 'technicien_id']
    },
    {
      table: 'factures',
      columns: ['id', 'mission_id', 'entreprise_id', 'regie_id', 'numero', 
                'montant_ht', 'montant_tva', 'montant_ttc', 'taux_tva', 
                'montant_commission', 'taux_commission', 'statut', 
                'date_emission', 'date_echeance']
    }
  ];
  
  for (const check of checks) {
    const result = await checkTableStructure(check.table, check.columns);
    results.checks[check.table] = result;
  }
  
  // Statut global
  if (results.anomalies.length > 0) {
    const criticalAnomalies = results.anomalies.filter(a => 
      a.type === 'COLONNES_MANQUANTES' || a.type === 'ERREUR_LECTURE'
    );
    
    if (criticalAnomalies.length > 0) {
      results.status = 'ANOMALIE';
      console.log('\n❌ AUDIT TERMINÉ AVEC ANOMALIES CRITIQUES');
      console.log(`   ${criticalAnomalies.length} anomalie(s) bloquante(s) détectée(s)`);
    } else {
      results.status = 'WARNING';
      console.log('\n⚠️ AUDIT TERMINÉ AVEC WARNINGS');
      console.log(`   ${results.anomalies.length} avertissement(s)`);
    }
  } else {
    console.log('\n✅ AUDIT TERMINÉ AVEC SUCCÈS');
    console.log('   Aucune anomalie détectée');
  }
  
  // Sauvegarde
  if (!fs.existsSync('./audit')) {
    fs.mkdirSync('./audit', { recursive: true });
  }
  
  fs.writeFileSync(
    './audit/STRUCTURE_SUPABASE.json',
    JSON.stringify(results, null, 2)
  );
  
  // Rapport Markdown
  let md = `# AUDIT STRUCTURE SUPABASE\n\n`;
  md += `**Date:** ${results.timestamp}\n`;
  md += `**Statut:** ${results.status}\n\n`;
  
  if (results.anomalies.length > 0) {
    md += `## ⚠️ Anomalies détectées (${results.anomalies.length})\n\n`;
    for (const anomaly of results.anomalies) {
      md += `### ${anomaly.type} - ${anomaly.table || 'Général'}\n`;
      md += `${JSON.stringify(anomaly, null, 2)}\n\n`;
    }
  }
  
  md += `## Résumé des vérifications\n\n`;
  for (const [table, result] of Object.entries(results.checks)) {
    md += `### Table: ${table}\n`;
    md += `- **Existe:** ${result.exists ? 'Oui' : 'Non'}\n`;
    if (result.empty) {
      md += `- **État:** Table vide (structure non vérifiable via SELECT)\n`;
    } else {
      md += `- **Colonnes détectées:** ${result.columns.length}\n`;
      if (result.missing && result.missing.length > 0) {
        md += `- **❌ Colonnes manquantes:** ${result.missing.join(', ')}\n`;
      }
    }
    md += `\n`;
  }
  
  fs.writeFileSync('./audit/STRUCTURE_SUPABASE.md', md);
  
  console.log('\n📄 Rapports générés:');
  console.log('   - audit/STRUCTURE_SUPABASE.json');
  console.log('   - audit/STRUCTURE_SUPABASE.md');
  
  // Exit code selon résultat
  process.exit(results.status === 'ANOMALIE' ? 1 : 0);
}

run().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(2);
});
