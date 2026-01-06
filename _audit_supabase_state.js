/**
 * SCRIPT AUDIT SUPABASE - Vérification état réel DB
 * Mode : Lecture seule
 * Objectif : Vérifier existence tables/vues/RPC avant implémentation P0/P1
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERREUR: Variables SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 AUDIT SUPABASE - Vérification état DB\n');
console.log(`📡 Connexion : ${supabaseUrl}\n`);

const report = {
  timestamp: new Date().toISOString(),
  supabaseUrl: supabaseUrl,
  checks: {
    tables: {},
    views: {},
    rpc: {},
    columns: {}
  },
  anomalies: [],
  status: 'OK'
};

// ============================================================
// 1. VÉRIFIER TABLES CRITIQUES
// ============================================================

const TABLES_TO_CHECK = [
  'tickets',
  'missions',
  'factures',
  'tickets_disponibilites',
  'mission_signalements',
  'mission_historique_statuts',
  'profiles',
  'regies',
  'entreprises',
  'techniciens',
  'locataires',
  'logements',
  'immeubles',
  'regies_entreprises'
];

async function checkTables() {
  console.log('📋 Vérification TABLES...\n');
  
  for (const tableName of TABLES_TO_CHECK) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Table "${tableName}" : ERREUR - ${error.message}`);
        report.checks.tables[tableName] = { exists: false, error: error.message };
        report.anomalies.push(`Table "${tableName}" inaccessible ou absente : ${error.message}`);
        report.status = 'ANOMALIE';
      } else {
        console.log(`✅ Table "${tableName}" : OK (${count} lignes)`);
        report.checks.tables[tableName] = { exists: true, count: count };
      }
    } catch (err) {
      console.log(`❌ Table "${tableName}" : EXCEPTION - ${err.message}`);
      report.checks.tables[tableName] = { exists: false, error: err.message };
      report.anomalies.push(`Table "${tableName}" exception : ${err.message}`);
      report.status = 'ANOMALIE';
    }
  }
}

// ============================================================
// 2. VÉRIFIER VUES CRITIQUES
// ============================================================

const VIEWS_TO_CHECK = [
  'factures_commissions_jtec',
  'factures_stats',
  'missions_details',
  'tickets_visibles_entreprise',
  'admin_stats_tickets_statuts',
  'admin_stats_tickets_categories',
  'admin_stats_tickets_priorites'
];

async function checkViews() {
  console.log('\n📊 Vérification VUES...\n');
  
  for (const viewName of VIEWS_TO_CHECK) {
    try {
      const { data, error, count } = await supabase
        .from(viewName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Vue "${viewName}" : ERREUR - ${error.message}`);
        report.checks.views[viewName] = { exists: false, error: error.message };
        report.anomalies.push(`Vue "${viewName}" inaccessible ou absente : ${error.message}`);
        report.status = 'ANOMALIE';
      } else {
        console.log(`✅ Vue "${viewName}" : OK (${count} lignes)`);
        report.checks.views[viewName] = { exists: true, count: count };
      }
    } catch (err) {
      console.log(`❌ Vue "${viewName}" : EXCEPTION - ${err.message}`);
      report.checks.views[viewName] = { exists: false, error: err.message };
      report.anomalies.push(`Vue "${viewName}" exception : ${err.message}`);
      report.status = 'ANOMALIE';
    }
  }
}

// ============================================================
// 3. VÉRIFIER RPC CRITIQUES
// ============================================================

const RPC_TO_CHECK = [
  { name: 'generate_facture_from_mission', testParams: null },
  { name: 'accept_ticket_and_create_mission', testParams: null },
  { name: 'assign_technicien_to_mission', testParams: null },
  { name: 'create_ticket_locataire', testParams: null },
  { name: 'diffuser_ticket', testParams: null },
  { name: 'get_user_regie_id', testParams: null },
  { name: 'signaler_absence_locataire', testParams: null },
  { name: 'ajouter_photos_mission', testParams: null }
];

async function checkRPC() {
  console.log('\n⚙️ Vérification RPC...\n');
  
  // Pour vérifier existence RPC, on peut interroger information_schema
  // Mais Supabase ne permet pas toujours cela via API client
  // Alternative : tenter appel RPC avec params null (attendu erreur mais fonction existe)
  
  for (const rpc of RPC_TO_CHECK) {
    try {
      // Tentative d'appel sans paramètres (attendu : erreur mais fonction existe)
      const { data, error } = await supabase.rpc(rpc.name, rpc.testParams || {});
      
      if (error) {
        // Erreur attendue si params invalides, mais fonction existe
        if (error.message.includes('could not find function') || 
            error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`❌ RPC "${rpc.name}" : ABSENTE`);
          report.checks.rpc[rpc.name] = { exists: false, error: 'Fonction introuvable' };
          report.anomalies.push(`RPC "${rpc.name}" absente de la base`);
          report.status = 'ANOMALIE';
        } else {
          // Autre erreur (params manquants, etc.) = fonction existe
          console.log(`✅ RPC "${rpc.name}" : OK (erreur params attendue)`);
          report.checks.rpc[rpc.name] = { exists: true, note: 'Erreur params attendue' };
        }
      } else {
        console.log(`✅ RPC "${rpc.name}" : OK`);
        report.checks.rpc[rpc.name] = { exists: true };
      }
    } catch (err) {
      console.log(`❌ RPC "${rpc.name}" : EXCEPTION - ${err.message}`);
      report.checks.rpc[rpc.name] = { exists: false, error: err.message };
      report.anomalies.push(`RPC "${rpc.name}" exception : ${err.message}`);
      report.status = 'ANOMALIE';
    }
  }
}

// ============================================================
// 4. VÉRIFIER COLONNES CRITIQUES
// ============================================================

const COLUMNS_TO_CHECK = {
  'tickets': [
    'id', 'titre', 'description', 'categorie', 'sous_categorie', 'piece',
    'priorite', 'statut', 'mode_diffusion', 'plafond_intervention_chf',
    'devise', 'locataire_id', 'logement_id', 'regie_id', 'entreprise_id',
    'technicien_id', 'locked_at', 'diffuse_at', 'valide_at'
  ],
  'missions': [
    'id', 'ticket_id', 'entreprise_id', 'technicien_id', 'statut',
    'date_intervention_prevue', 'date_intervention_realisee',
    'locataire_absent', 'absence_signalement_at', 'absence_raison',
    'photos_urls', 'montant', 'devis_url', 'facture_url'
  ],
  'factures': [
    'id', 'mission_id', 'entreprise_id', 'regie_id', 'numero',
    'montant_ht', 'montant_tva', 'montant_ttc', 'taux_tva',
    'montant_commission', 'taux_commission', 'statut',
    'date_emission', 'date_echeance'
  ]
};

async function checkColumns() {
  console.log('\n📐 Vérification COLONNES critiques...\n');
  
  for (const [tableName, expectedColumns] of Object.entries(COLUMNS_TO_CHECK)) {
    try {
      // Tentative lecture 1 ligne pour obtenir colonnes
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table "${tableName}" : impossible vérifier colonnes - ${error.message}`);
        continue;
      }
      
      const actualColumns = data && data.length > 0 ? Object.keys(data[0]) : [];
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`⚠️ Table "${tableName}" : colonnes manquantes = ${missingColumns.join(', ')}`);
        report.checks.columns[tableName] = { missing: missingColumns };
        report.anomalies.push(`Table "${tableName}" colonnes manquantes : ${missingColumns.join(', ')}`);
        report.status = 'ANOMALIE';
      } else {
        console.log(`✅ Table "${tableName}" : toutes colonnes critiques présentes`);
        report.checks.columns[tableName] = { status: 'OK' };
      }
    } catch (err) {
      console.log(`❌ Table "${tableName}" : EXCEPTION - ${err.message}`);
    }
  }
}

// ============================================================
// 5. EXÉCUTION ET GÉNÉRATION RAPPORT
// ============================================================

async function runAudit() {
  console.log('=' .repeat(60));
  console.log('🔍 DÉBUT AUDIT SUPABASE');
  console.log('=' .repeat(60) + '\n');
  
  await checkTables();
  await checkViews();
  await checkRPC();
  await checkColumns();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RÉSUMÉ AUDIT');
  console.log('=' .repeat(60) + '\n');
  
  console.log(`Status global : ${report.status}`);
  console.log(`Tables vérifiées : ${Object.keys(report.checks.tables).length}`);
  console.log(`Vues vérifiées : ${Object.keys(report.checks.views).length}`);
  console.log(`RPC vérifiées : ${Object.keys(report.checks.rpc).length}`);
  console.log(`Anomalies détectées : ${report.anomalies.length}\n`);
  
  if (report.anomalies.length > 0) {
    console.log('⚠️ ANOMALIES DÉTECTÉES :\n');
    report.anomalies.forEach((anomaly, idx) => {
      console.log(`${idx + 1}. ${anomaly}`);
    });
    console.log('');
  }
  
  // Sauvegarder rapport JSON
  const reportPath = './audit/REPORT_SUPABASE_STATE.json';
  fs.mkdirSync('./audit', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Rapport JSON sauvegardé : ${reportPath}\n`);
  
  // Générer rapport Markdown
  await generateMarkdownReport(report);
  
  if (report.status === 'ANOMALIE') {
    console.log('❌ AUDIT TERMINÉ AVEC ANOMALIES - Correction requise avant implémentation P0/P1\n');
    process.exit(1);
  } else {
    console.log('✅ AUDIT TERMINÉ - Base Supabase conforme, implémentation P0/P1 peut commencer\n');
    process.exit(0);
  }
}

async function generateMarkdownReport(report) {
  let md = `# 🔍 RAPPORT AUDIT SUPABASE — État réel DB

**Date** : ${new Date(report.timestamp).toLocaleString('fr-FR')}  
**Supabase URL** : ${report.supabaseUrl}  
**Status global** : ${report.status}

---

## 📋 Tables (${Object.keys(report.checks.tables).length} vérifiées)

| Table | Existe | Lignes | Notes |
|-------|--------|--------|-------|
`;

  for (const [table, check] of Object.entries(report.checks.tables)) {
    const exists = check.exists ? '✅' : '❌';
    const count = check.count !== undefined ? check.count : '-';
    const note = check.error || '-';
    md += `| ${table} | ${exists} | ${count} | ${note} |\n`;
  }

  md += `\n---\n\n## 📊 Vues (${Object.keys(report.checks.views).length} vérifiées)\n\n`;
  md += `| Vue | Existe | Lignes | Notes |\n|-----|--------|--------|-------|\n`;

  for (const [view, check] of Object.entries(report.checks.views)) {
    const exists = check.exists ? '✅' : '❌';
    const count = check.count !== undefined ? check.count : '-';
    const note = check.error || '-';
    md += `| ${view} | ${exists} | ${count} | ${note} |\n`;
  }

  md += `\n---\n\n## ⚙️ RPC (${Object.keys(report.checks.rpc).length} vérifiées)\n\n`;
  md += `| Fonction RPC | Existe | Notes |\n|--------------|--------|-------|\n`;

  for (const [rpc, check] of Object.entries(report.checks.rpc)) {
    const exists = check.exists ? '✅' : '❌';
    const note = check.note || check.error || '-';
    md += `| ${rpc} | ${exists} | ${note} |\n`;
  }

  md += `\n---\n\n## 📐 Colonnes critiques\n\n`;

  for (const [table, check] of Object.entries(report.checks.columns)) {
    if (check.missing && check.missing.length > 0) {
      md += `### ⚠️ Table \`${table}\` : colonnes manquantes\n\n`;
      md += check.missing.map(col => `- \`${col}\``).join('\n') + '\n\n';
    } else if (check.status === 'OK') {
      md += `### ✅ Table \`${table}\` : toutes colonnes présentes\n\n`;
    }
  }

  md += `\n---\n\n## ⚠️ Anomalies (${report.anomalies.length})\n\n`;

  if (report.anomalies.length === 0) {
    md += `Aucune anomalie détectée. Base conforme.\n`;
  } else {
    report.anomalies.forEach((anomaly, idx) => {
      md += `${idx + 1}. ${anomaly}\n`;
    });
  }

  md += `\n---\n\n## 🎯 Conclusion\n\n`;

  if (report.status === 'OK') {
    md += `✅ **Base Supabase CONFORME**\n\n`;
    md += `Tous les objets critiques (tables, vues, RPC) sont présents et accessibles.\n`;
    md += `L'implémentation P0/P1 peut commencer.\n`;
  } else {
    md += `❌ **ANOMALIES DÉTECTÉES**\n\n`;
    md += `Des objets manquent ou sont inaccessibles.\n`;
    md += `Correction requise AVANT implémentation P0/P1.\n\n`;
    md += `### Actions recommandées\n\n`;
    md += `1. Vérifier les migrations non appliquées dans \`supabase/migrations\`\n`;
    md += `2. Appliquer les migrations manquantes via Supabase CLI ou Dashboard\n`;
    md += `3. Re-exécuter cet audit\n`;
  }

  const mdPath = './audit/REPORT_SUPABASE_STATE.md';
  fs.writeFileSync(mdPath, md);
  console.log(`📄 Rapport Markdown sauvegardé : ${mdPath}\n`);
}

// Exécuter audit
runAudit().catch(err => {
  console.error('❌ ERREUR CRITIQUE :', err);
  process.exit(1);
});
