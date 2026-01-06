#!/usr/bin/env node
/**
 * =====================================================
 * AUDIT COMPLET SUPABASE - GESTION TECHNICIENS
 * =====================================================
 * 
 * Vérifie l'état RÉEL de la base de données Supabase via API REST :
 * - Tables existantes
 * - Colonnes et types
 * - Relations
 * - Données de test
 * 
 * Connexion via SUPABASE_URL + SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Charger les variables d'environnement depuis .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env.local non trouvé');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  }
  return env;
}

const env = loadEnv();

// Vérifier les variables nécessaires
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local');
  process.exit(1);
}

console.log('🔍 Connexion à Supabase via API REST...');
console.log(`📍 URL: ${env.SUPABASE_URL}\n`);

// Résultats d'audit
const auditResults = {
  timestamp: new Date().toISOString(),
  connection: { status: 'pending', url: env.SUPABASE_URL },
  tables: {},
  data_checks: {},
  summary: { conforme: 0, partiel: 0, manquant: 0, warnings: [] }
};

// Fonction pour faire des requêtes HTTP
function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Fonction principale
async function runAudit() {
  try {
    // Test de connexion
    console.log('🔗 Test de connexion...');
    const testResponse = await makeRequest(`${env.SUPABASE_URL}/rest/v1/`);
    
    if (testResponse.status === 200 || testResponse.status === 404) {
      auditResults.connection.status = '✅ connecté';
      console.log('✅ Connexion Supabase établie\n');
    } else {
      throw new Error(`Échec connexion: HTTP ${testResponse.status}`);
    }

    // 1. Vérifier les tables via requêtes
    await auditTables();

    // 2. Vérifier les relations en inspectant les données
    await auditRelations();

    // 3. Générer le rapport
    generateReport();

  } catch (error) {
    console.error('❌ Erreur lors de l\'audit:', error.message);
    auditResults.connection.status = `❌ erreur: ${error.message}`;
    auditResults.connection.error = error.stack;
    generateReport();
  }
}

// Vérifier les tables
async function auditTables() {
  console.log('📋 === AUDIT DES TABLES ===\n');

  const tablesToCheck = ['entreprises', 'techniciens', 'profiles', 'missions', 'tickets'];

  for (const tableName of tablesToCheck) {
    try {
      // Tenter de faire une requête sur la table avec limit=0 pour vérifier l'existence
      const url = `${env.SUPABASE_URL}/rest/v1/${tableName}?limit=0`;
      const response = await makeRequest(url);

      if (response.status === 200) {
        console.log(`✅ Table "${tableName}" : ACCESSIBLE`);
        
        // Récupérer une ligne d'exemple pour voir la structure
        const sampleUrl = `${env.SUPABASE_URL}/rest/v1/${tableName}?limit=1`;
        const sampleResponse = await makeRequest(sampleUrl);
        
        const columns = sampleResponse.data && sampleResponse.data[0] 
          ? Object.keys(sampleResponse.data[0]) 
          : [];
        
        // Compter les enregistrements
        const countUrl = `${env.SUPABASE_URL}/rest/v1/${tableName}?select=count`;
        const countResponse = await makeRequest(countUrl);
        
        console.log(`   Colonnes détectées (${columns.length}) :`, columns.join(', '));
        console.log(`   Nombre d'enregistrements : estimé via échantillon`);
        console.log('');

        auditResults.tables[tableName] = {
          status: '✅ conforme',
          accessible: true,
          columns: columns,
          sample: sampleResponse.data && sampleResponse.data[0] ? sampleResponse.data[0] : null
        };
        auditResults.summary.conforme++;

      } else if (response.status === 404) {
        console.log(`❌ Table "${tableName}" : NON TROUVÉE (404)`);
        auditResults.tables[tableName] = { status: '❌ manquant', accessible: false };
        auditResults.summary.manquant++;
      } else if (response.status === 401 || response.status === 403) {
        console.log(`⚠️  Table "${tableName}" : ACCÈS REFUSÉ (${response.status})`);
        console.log(`   Message :`, response.data);
        auditResults.tables[tableName] = { 
          status: '⚠️ partiel', 
          accessible: false,
          reason: `HTTP ${response.status}`,
          message: response.data
        };
        auditResults.summary.partiel++;
        auditResults.summary.warnings.push(`RLS potentiellement trop restrictif sur ${tableName}`);
      } else {
        console.log(`⚠️  Table "${tableName}" : STATUT INATTENDU (${response.status})`);
        auditResults.tables[tableName] = { 
          status: '⚠️ partiel', 
          http_status: response.status 
        };
        auditResults.summary.partiel++;
      }

    } catch (error) {
      console.log(`❌ Erreur lors de la vérification de "${tableName}" :`, error.message);
      auditResults.tables[tableName] = { status: '❌ erreur', error: error.message };
      auditResults.summary.manquant++;
    }
  }
}

// Vérifier les relations via les données
async function auditRelations() {
  console.log('\n🔗 === AUDIT DES RELATIONS (via données) ===\n');

  // Vérifier techniciens -> entreprises
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/techniciens?select=id,entreprise_id,profile_id&limit=5`;
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data && response.data.length > 0) {
      const sample = response.data[0];
      const hasEntrepriseId = 'entreprise_id' in sample;
      const hasProfileId = 'profile_id' in sample;
      
      console.log(`✅ Relation techniciens.entreprise_id : ${hasEntrepriseId ? 'EXISTE' : 'MANQUANTE'}`);
      console.log(`✅ Relation techniciens.profile_id : ${hasProfileId ? 'EXISTE' : 'MANQUANTE'}`);
      
      auditResults.data_checks.techniciens_relations = {
        status: hasEntrepriseId && hasProfileId ? '✅ conforme' : '⚠️ partiel',
        has_entreprise_id: hasEntrepriseId,
        has_profile_id: hasProfileId,
        sample: sample
      };
      
      if (hasEntrepriseId && hasProfileId) {
        auditResults.summary.conforme++;
      } else {
        auditResults.summary.partiel++;
      }
    } else if (response.status === 200) {
      console.log(`⚠️  Table techniciens vide - impossible de vérifier les relations`);
      auditResults.data_checks.techniciens_relations = {
        status: '⚠️ partiel',
        reason: 'Aucune donnée pour vérifier'
      };
      auditResults.summary.warnings.push('Table techniciens vide - relations non vérifiables');
    } else {
      console.log(`❌ Impossible d'accéder aux techniciens (${response.status})`);
      auditResults.data_checks.techniciens_relations = {
        status: '❌ manquant',
        http_status: response.status
      };
      auditResults.summary.manquant++;
    }
  } catch (error) {
    console.log(`❌ Erreur lors de la vérification des relations techniciens :`, error.message);
  }

  // Vérifier missions -> techniciens
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/missions?select=id,technicien_id,ticket_id&limit=5`;
    const response = await makeRequest(url);
    
    if (response.status === 200 && response.data && response.data.length > 0) {
      const sample = response.data[0];
      const hasTechnicienId = 'technicien_id' in sample;
      
      console.log(`✅ Relation missions.technicien_id : ${hasTechnicienId ? 'EXISTE' : 'MANQUANTE'}`);
      
      auditResults.data_checks.missions_relations = {
        status: hasTechnicienId ? '✅ conforme' : '⚠️ partiel',
        has_technicien_id: hasTechnicienId,
        sample: sample
      };
      
      if (hasTechnicienId) {
        auditResults.summary.conforme++;
      } else {
        auditResults.summary.partiel++;
      }
    } else if (response.status === 200) {
      console.log(`⚠️  Table missions vide - impossible de vérifier les relations`);
      auditResults.data_checks.missions_relations = {
        status: '⚠️ partiel',
        reason: 'Aucune donnée pour vérifier'
      };
      auditResults.summary.warnings.push('Table missions vide - relations non vérifiables');
    }
  } catch (error) {
    console.log(`❌ Erreur lors de la vérification des relations missions :`, error.message);
  }

  console.log('');
}

// Générer le rapport final
function generateReport() {
  console.log('\n\n');
  console.log('═'.repeat(60));
  console.log('📊 RAPPORT D\'AUDIT FINAL - GESTION TECHNICIENS');
  console.log('═'.repeat(60));
  console.log('');

  console.log(`🔗 Connexion : ${auditResults.connection.status}`);
  console.log(`📍 URL : ${auditResults.connection.url}`);
  console.log('');

  console.log('📈 RÉSUMÉ :');
  console.log(`   ✅ Conforme  : ${auditResults.summary.conforme}`);
  console.log(`   ⚠️  Partiel   : ${auditResults.summary.partiel}`);
  console.log(`   ❌ Manquant  : ${auditResults.summary.manquant}`);
  
  if (auditResults.summary.warnings.length > 0) {
    console.log(`   ⚠️  Warnings  : ${auditResults.summary.warnings.length}`);
    auditResults.summary.warnings.forEach(w => console.log(`      - ${w}`));
  }
  console.log('');

  // Statut global
  let globalStatus;
  if (auditResults.summary.manquant === 0 && auditResults.summary.partiel === 0) {
    globalStatus = '✅ CONFORME - Prêt pour implémentation';
  } else if (auditResults.summary.manquant > 0) {
    globalStatus = '❌ NON CONFORME - Éléments manquants critiques';
  } else {
    globalStatus = '⚠️  PARTIELLEMENT CONFORME - Vérifications nécessaires';
  }

  console.log(`🎯 STATUT GLOBAL : ${globalStatus}`);
  console.log('');

  // Détails par catégorie
  console.log('📋 DÉTAILS PAR CATÉGORIE :');
  console.log('');

  console.log('   Tables accessibles :');
  Object.entries(auditResults.tables).forEach(([name, data]) => {
    console.log(`      ${data.status} ${name}`);
    if (data.columns && data.columns.length > 0) {
      console.log(`         Colonnes : ${data.columns.join(', ')}`);
    }
  });
  console.log('');

  console.log('   Relations détectées :');
  Object.entries(auditResults.data_checks).forEach(([name, data]) => {
    console.log(`      ${data.status} ${name}`);
  });
  console.log('');

  // Sauvegarder le rapport JSON
  const reportPath = path.join(__dirname, '_AUDIT_TECHNICIENS_SUPABASE_RESULT.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  console.log(`💾 Rapport détaillé sauvegardé : ${reportPath}`);
  console.log('');

  // Générer le rapport Markdown
  generateMarkdownReport();

  console.log('═'.repeat(60));
}

// Générer un rapport Markdown
function generateMarkdownReport() {
  const lines = [];
  
  lines.push('# 🔍 AUDIT SUPABASE - GESTION TECHNICIENS');
  lines.push('');
  lines.push(`**Date :** ${new Date(auditResults.timestamp).toLocaleString('fr-FR')}`);
  lines.push(`**Connexion :** ${auditResults.connection.status}`);
  lines.push(`**URL :** ${auditResults.connection.url}`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## 📊 RÉSUMÉ EXÉCUTIF');
  lines.push('');
  lines.push(`| Statut | Nombre |`);
  lines.push(`|--------|--------|`);
  lines.push(`| ✅ Conforme | ${auditResults.summary.conforme} |`);
  lines.push(`| ⚠️ Partiel | ${auditResults.summary.partiel} |`);
  lines.push(`| ❌ Manquant | ${auditResults.summary.manquant} |`);
  lines.push('');

  if (auditResults.summary.warnings.length > 0) {
    lines.push('### ⚠️ Avertissements');
    lines.push('');
    auditResults.summary.warnings.forEach(w => {
      lines.push(`- ${w}`);
    });
    lines.push('');
  }

  // Statut global
  let globalStatus;
  if (auditResults.summary.manquant === 0 && auditResults.summary.partiel === 0) {
    globalStatus = '✅ **CONFORME** - Base de données prête pour implémentation';
  } else if (auditResults.summary.manquant > 0) {
    globalStatus = '❌ **NON CONFORME** - Éléments manquants critiques détectés';
  } else {
    globalStatus = '⚠️ **PARTIELLEMENT CONFORME** - Vérifications complémentaires nécessaires';
  }
  
  lines.push(`### 🎯 Statut global : ${globalStatus}`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  // Tables
  lines.push('## 📋 TABLES');
  lines.push('');
  Object.entries(auditResults.tables).forEach(([name, data]) => {
    lines.push(`### ${data.status} Table \`${name}\``);
    lines.push('');
    
    if (data.accessible) {
      if (data.columns && data.columns.length > 0) {
        lines.push('**Colonnes détectées :**');
        lines.push('');
        data.columns.forEach(col => {
          lines.push(`- \`${col}\``);
        });
        lines.push('');
      }
      
      if (data.sample) {
        lines.push('<details>');
        lines.push('<summary>Exemple de données</summary>');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(data.sample, null, 2));
        lines.push('```');
        lines.push('</details>');
        lines.push('');
      }
    } else {
      lines.push(`**Raison :** ${data.reason || 'Table non accessible'}`);
      lines.push('');
    }
  });
  
  lines.push('---');
  lines.push('');
  
  // Relations
  lines.push('## 🔗 RELATIONS DÉTECTÉES');
  lines.push('');
  Object.entries(auditResults.data_checks).forEach(([name, data]) => {
    lines.push(`### ${data.status} ${name}`);
    lines.push('');
    
    if (data.has_entreprise_id !== undefined) {
      lines.push(`- \`entreprise_id\` : ${data.has_entreprise_id ? '✅ présent' : '❌ manquant'}`);
    }
    if (data.has_profile_id !== undefined) {
      lines.push(`- \`profile_id\` : ${data.has_profile_id ? '✅ présent' : '❌ manquant'}`);
    }
    if (data.has_technicien_id !== undefined) {
      lines.push(`- \`technicien_id\` : ${data.has_technicien_id ? '✅ présent' : '❌ manquant'}`);
    }
    
    if (data.reason) {
      lines.push('');
      lines.push(`**Note :** ${data.reason}`);
    }
    
    lines.push('');
  });
  
  lines.push('---');
  lines.push('');
  
  // Recommandations
  lines.push('## 💡 RECOMMANDATIONS');
  lines.push('');
  
  if (auditResults.summary.manquant > 0) {
    lines.push('### ❌ Actions requises (éléments manquants)');
    lines.push('');
    
    const missingTables = Object.entries(auditResults.tables).filter(([_, data]) => data.status.includes('❌'));
    if (missingTables.length > 0) {
      lines.push('**Tables à créer ou rendre accessibles :**');
      missingTables.forEach(([name]) => {
        lines.push(`- [ ] Vérifier/créer la table \`${name}\``);
      });
      lines.push('');
    }
  }
  
  if (auditResults.summary.partiel > 0) {
    lines.push('### ⚠️ Vérifications recommandées');
    lines.push('');
    
    const partialTables = Object.entries(auditResults.tables).filter(([_, data]) => data.status.includes('⚠️'));
    if (partialTables.length > 0) {
      lines.push('**Tables avec accès partiel :**');
      partialTables.forEach(([name, data]) => {
        lines.push(`- [ ] Vérifier les policies RLS pour \`${name}\` (${data.reason || 'accès refusé'})`);
      });
      lines.push('');
    }
    
    if (auditResults.summary.warnings.length > 0) {
      lines.push('**Points d\'attention :**');
      auditResults.summary.warnings.forEach(w => {
        lines.push(`- [ ] ${w}`);
      });
      lines.push('');
    }
  }
  
  if (auditResults.summary.manquant === 0 && auditResults.summary.partiel === 0) {
    lines.push('✅ **Aucune action requise** - La base de données est prête pour l\'implémentation de la gestion des techniciens.');
    lines.push('');
    lines.push('**Prochaines étapes :**');
    lines.push('1. Implémenter les APIs backend pour la gestion CRUD des techniciens');
    lines.push('2. Créer l\'interface frontend pour les entreprises');
    lines.push('3. Tester les assignations de techniciens aux missions');
    lines.push('4. Valider les règles métier et la sécurité RLS');
  } else {
    lines.push('');
    lines.push('### 📝 Notes importantes');
    lines.push('');
    lines.push('- Cet audit utilise l\'API REST Supabase avec SERVICE_ROLE_KEY');
    lines.push('- Les accès refusés (401/403) peuvent indiquer des RLS trop restrictifs');
    lines.push('- Il est recommandé de vérifier manuellement les policies RLS dans le Dashboard Supabase');
    lines.push('- Les relations sont détectées par inspection des données existantes');
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Rapport généré automatiquement le ${new Date().toLocaleString('fr-FR')}*`);
  
  const reportPath = path.join(__dirname, '_AUDIT_TECHNICIENS_SUPABASE_RESULT.md');
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`📄 Rapport Markdown sauvegardé : ${reportPath}`);
}

// Lancer l'audit
runAudit().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
