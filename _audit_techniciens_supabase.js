#!/usr/bin/env node
/**
 * =====================================================
 * AUDIT COMPLET SUPABASE - GESTION TECHNICIENS
 * =====================================================
 * 
 * Vérifie l'état RÉEL de la base de données Supabase :
 * - Tables existantes
 * - Colonnes et types
 * - Clés étrangères
 * - Contraintes
 * - Policies RLS
 * - RPC functions
 * 
 * Connexion via Data URL depuis .env.local
 */

const fs = require('fs');
const path = require('path');

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
        // Supprimer les guillemets si présents
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
if (!env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquante dans .env.local');
  process.exit(1);
}

console.log('🔍 Connexion à Supabase via DATABASE_URL...\n');

// Utiliser pg pour la connexion directe
const { Client } = require('pg');

// Parser l'URL pour remplacer le hostname par son IP si nécessaire
const parsedUrl = new URL(env.DATABASE_URL.replace('postgresql://', 'postgres://'));
const hostname = parsedUrl.hostname;

// Configuration de connexion
const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Forcer IPv4
  host: hostname,
  options: '-c client_encoding=UTF8'
});

// Résultats d'audit
const auditResults = {
  timestamp: new Date().toISOString(),
  connection: { status: 'pending' },
  tables: {},
  relations: {},
  rls: {},
  rpc: {},
  summary: { conforme: 0, partiel: 0, manquant: 0 }
};

// Fonction principale
async function runAudit() {
  try {
    await client.connect();
    auditResults.connection.status = '✅ connecté';
    console.log('✅ Connexion Supabase établie\n');

    // 1. Vérifier les tables
    await auditTables();

    // 2. Vérifier les relations (foreign keys)
    await auditRelations();

    // 3. Vérifier les policies RLS
    await auditRLS();

    // 4. Vérifier les RPC functions
    await auditRPC();

    // 5. Générer le rapport
    generateReport();

  } catch (error) {
    console.error('❌ Erreur lors de l\'audit:', error.message);
    auditResults.connection.status = `❌ erreur: ${error.message}`;
    auditResults.connection.error = error.stack;
  } finally {
    await client.end();
  }
}

// Vérifier les tables
async function auditTables() {
  console.log('📋 === AUDIT DES TABLES ===\n');

  const tablesToCheck = ['entreprises', 'techniciens', 'profiles', 'missions', 'tickets'];

  for (const tableName of tablesToCheck) {
    try {
      // Vérifier l'existence de la table
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      const existsResult = await client.query(tableExistsQuery, [tableName]);
      const tableExists = existsResult.rows[0].exists;

      if (!tableExists) {
        console.log(`❌ Table "${tableName}" : MANQUANTE`);
        auditResults.tables[tableName] = { status: '❌ manquant', exists: false };
        auditResults.summary.manquant++;
        continue;
      }

      // Récupérer les colonnes
      const columnsQuery = `
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const columnsResult = await client.query(columnsQuery, [tableName]);
      const columns = columnsResult.rows;

      // Récupérer les contraintes
      const constraintsQuery = `
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1
        ORDER BY tc.constraint_type, tc.constraint_name;
      `;
      const constraintsResult = await client.query(constraintsQuery, [tableName]);
      const constraints = constraintsResult.rows;

      console.log(`✅ Table "${tableName}" : EXISTE`);
      console.log(`   Colonnes (${columns.length}) :`, columns.map(c => `${c.column_name} (${c.data_type})`).join(', '));
      console.log(`   Contraintes (${constraints.length}) :`, constraints.map(c => `${c.constraint_type}`).join(', '));
      console.log('');

      auditResults.tables[tableName] = {
        status: '✅ conforme',
        exists: true,
        columns: columns,
        constraints: constraints
      };
      auditResults.summary.conforme++;

    } catch (error) {
      console.log(`❌ Erreur lors de la vérification de "${tableName}" :`, error.message);
      auditResults.tables[tableName] = { status: '❌ erreur', error: error.message };
      auditResults.summary.manquant++;
    }
  }
}

// Vérifier les relations (foreign keys)
async function auditRelations() {
  console.log('\n🔗 === AUDIT DES RELATIONS (FOREIGN KEYS) ===\n');

  const relationsToCheck = [
    { name: 'techniciens.entreprise_id → entreprises.id', table: 'techniciens', column: 'entreprise_id', ref_table: 'entreprises', ref_column: 'id' },
    { name: 'techniciens.profile_id → profiles.id', table: 'techniciens', column: 'profile_id', ref_table: 'profiles', ref_column: 'id' },
    { name: 'missions.technicien_id → techniciens.id', table: 'missions', column: 'technicien_id', ref_table: 'techniciens', ref_column: 'id' }
  ];

  for (const relation of relationsToCheck) {
    try {
      const fkQuery = `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
          AND kcu.column_name = $2
          AND ccu.table_name = $3
          AND ccu.column_name = $4;
      `;
      
      const result = await client.query(fkQuery, [
        relation.table,
        relation.column,
        relation.ref_table,
        relation.ref_column
      ]);

      if (result.rows.length > 0) {
        console.log(`✅ Relation "${relation.name}" : EXISTE`);
        auditResults.relations[relation.name] = { status: '✅ conforme', details: result.rows[0] };
        auditResults.summary.conforme++;
      } else {
        console.log(`❌ Relation "${relation.name}" : MANQUANTE`);
        auditResults.relations[relation.name] = { status: '❌ manquant' };
        auditResults.summary.manquant++;
      }

    } catch (error) {
      console.log(`❌ Erreur lors de la vérification de "${relation.name}" :`, error.message);
      auditResults.relations[relation.name] = { status: '❌ erreur', error: error.message };
      auditResults.summary.manquant++;
    }
  }
}

// Vérifier les policies RLS
async function auditRLS() {
  console.log('\n🛡️  === AUDIT DES POLICIES RLS ===\n');

  const tablesToCheck = ['entreprises', 'techniciens', 'profiles', 'missions'];

  for (const tableName of tablesToCheck) {
    try {
      // Vérifier si RLS est activé
      const rlsEnabledQuery = `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `;
      const rlsResult = await client.query(rlsEnabledQuery, [tableName]);
      
      if (rlsResult.rows.length === 0) {
        console.log(`⚠️  Table "${tableName}" : table non trouvée`);
        continue;
      }

      const rlsEnabled = rlsResult.rows[0].relrowsecurity;

      // Récupérer les policies
      const policiesQuery = `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1;
      `;
      const policiesResult = await client.query(policiesQuery, [tableName]);
      const policies = policiesResult.rows;

      console.log(`Table "${tableName}" :`);
      console.log(`   RLS activé : ${rlsEnabled ? '✅ OUI' : '❌ NON'}`);
      console.log(`   Nombre de policies : ${policies.length}`);
      
      if (policies.length > 0) {
        policies.forEach(policy => {
          console.log(`   - ${policy.policyname} (${policy.cmd}) pour ${policy.roles.join(', ')}`);
        });
      }
      console.log('');

      auditResults.rls[tableName] = {
        status: rlsEnabled && policies.length > 0 ? '✅ conforme' : (policies.length > 0 ? '⚠️ partiel' : '❌ manquant'),
        rls_enabled: rlsEnabled,
        policies: policies
      };

      if (rlsEnabled && policies.length > 0) {
        auditResults.summary.conforme++;
      } else if (policies.length > 0) {
        auditResults.summary.partiel++;
      } else {
        auditResults.summary.manquant++;
      }

    } catch (error) {
      console.log(`❌ Erreur lors de la vérification RLS pour "${tableName}" :`, error.message);
      auditResults.rls[tableName] = { status: '❌ erreur', error: error.message };
      auditResults.summary.manquant++;
    }
  }
}

// Vérifier les RPC functions
async function auditRPC() {
  console.log('\n⚙️  === AUDIT DES RPC FUNCTIONS ===\n');

  const rpcToCheck = ['assign_technicien_to_mission'];

  for (const rpcName of rpcToCheck) {
    try {
      const rpcQuery = `
        SELECT 
          n.nspname as schema,
          p.proname as function_name,
          pg_get_function_identity_arguments(p.oid) as arguments,
          pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = $1;
      `;
      
      const result = await client.query(rpcQuery, [rpcName]);

      if (result.rows.length > 0) {
        console.log(`✅ RPC "${rpcName}" : EXISTE`);
        console.log(`   Arguments : ${result.rows[0].arguments}`);
        auditResults.rpc[rpcName] = { 
          status: '✅ conforme', 
          details: {
            arguments: result.rows[0].arguments,
            schema: result.rows[0].schema
          }
        };
        auditResults.summary.conforme++;
      } else {
        console.log(`❌ RPC "${rpcName}" : MANQUANTE`);
        auditResults.rpc[rpcName] = { status: '❌ manquant' };
        auditResults.summary.manquant++;
      }

    } catch (error) {
      console.log(`❌ Erreur lors de la vérification de "${rpcName}" :`, error.message);
      auditResults.rpc[rpcName] = { status: '❌ erreur', error: error.message };
      auditResults.summary.manquant++;
    }
  }

  // Lister toutes les RPC disponibles
  try {
    const allRpcQuery = `
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY p.proname;
    `;
    
    const result = await client.query(allRpcQuery);
    console.log(`\n📋 Liste complète des RPC publiques (${result.rows.length}) :`);
    result.rows.forEach(row => {
      console.log(`   - ${row.function_name}(${row.arguments})`);
    });
    
    auditResults.rpc._all_functions = result.rows;

  } catch (error) {
    console.log(`❌ Erreur lors de la récupération de toutes les RPC :`, error.message);
  }
}

// Générer le rapport final
function generateReport() {
  console.log('\n\n');
  console.log('═'.repeat(60));
  console.log('📊 RAPPORT D\'AUDIT FINAL - GESTION TECHNICIENS');
  console.log('═'.repeat(60));
  console.log('');

  console.log(`🔗 Connexion : ${auditResults.connection.status}`);
  console.log('');

  console.log('📈 RÉSUMÉ :');
  console.log(`   ✅ Conforme  : ${auditResults.summary.conforme}`);
  console.log(`   ⚠️  Partiel   : ${auditResults.summary.partiel}`);
  console.log(`   ❌ Manquant  : ${auditResults.summary.manquant}`);
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

  console.log('   Tables :');
  Object.entries(auditResults.tables).forEach(([name, data]) => {
    console.log(`      ${data.status} ${name}`);
  });
  console.log('');

  console.log('   Relations :');
  Object.entries(auditResults.relations).forEach(([name, data]) => {
    console.log(`      ${data.status} ${name}`);
  });
  console.log('');

  console.log('   RLS :');
  Object.entries(auditResults.rls).forEach(([name, data]) => {
    console.log(`      ${data.status} ${name} (${data.policies ? data.policies.length : 0} policies)`);
  });
  console.log('');

  console.log('   RPC :');
  Object.entries(auditResults.rpc).filter(([key]) => !key.startsWith('_')).forEach(([name, data]) => {
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
    if (data.exists) {
      lines.push('');
      lines.push('**Colonnes :**');
      if (data.columns && data.columns.length > 0) {
        data.columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          lines.push(`- \`${col.column_name}\` : ${col.data_type} ${nullable}`);
        });
      }
      lines.push('');
      lines.push('**Contraintes :**');
      if (data.constraints && data.constraints.length > 0) {
        const groupedConstraints = {};
        data.constraints.forEach(c => {
          if (!groupedConstraints[c.constraint_type]) {
            groupedConstraints[c.constraint_type] = [];
          }
          groupedConstraints[c.constraint_type].push(c);
        });
        Object.entries(groupedConstraints).forEach(([type, constraints]) => {
          lines.push(`- ${type} : ${constraints.length}`);
        });
      }
    }
    lines.push('');
  });
  
  lines.push('---');
  lines.push('');
  
  // Relations
  lines.push('## 🔗 RELATIONS (FOREIGN KEYS)');
  lines.push('');
  Object.entries(auditResults.relations).forEach(([name, data]) => {
    lines.push(`- ${data.status} \`${name}\``);
  });
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  // RLS
  lines.push('## 🛡️ ROW LEVEL SECURITY (RLS)');
  lines.push('');
  Object.entries(auditResults.rls).forEach(([name, data]) => {
    lines.push(`### ${data.status} Table \`${name}\``);
    lines.push('');
    lines.push(`- RLS activé : ${data.rls_enabled ? '✅ OUI' : '❌ NON'}`);
    lines.push(`- Nombre de policies : ${data.policies ? data.policies.length : 0}`);
    if (data.policies && data.policies.length > 0) {
      lines.push('');
      lines.push('**Policies :**');
      data.policies.forEach(policy => {
        lines.push(`- \`${policy.policyname}\` (${policy.cmd}) pour ${policy.roles.join(', ')}`);
      });
    }
    lines.push('');
  });
  
  lines.push('---');
  lines.push('');
  
  // RPC
  lines.push('## ⚙️ RPC FUNCTIONS');
  lines.push('');
  Object.entries(auditResults.rpc).filter(([key]) => !key.startsWith('_')).forEach(([name, data]) => {
    lines.push(`- ${data.status} \`${name}\``);
    if (data.details && data.details.arguments) {
      lines.push(`  - Arguments : \`${data.details.arguments}\``);
    }
  });
  lines.push('');
  
  if (auditResults.rpc._all_functions) {
    lines.push('### 📋 Toutes les fonctions publiques disponibles');
    lines.push('');
    auditResults.rpc._all_functions.forEach(func => {
      lines.push(`- \`${func.function_name}(${func.arguments})\``);
    });
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  // Recommandations
  lines.push('## 💡 RECOMMANDATIONS');
  lines.push('');
  
  if (auditResults.summary.manquant > 0) {
    lines.push('### ❌ Actions requises (éléments manquants)');
    lines.push('');
    
    // Tables manquantes
    const missingTables = Object.entries(auditResults.tables).filter(([_, data]) => data.status.includes('❌'));
    if (missingTables.length > 0) {
      lines.push('**Tables à créer :**');
      missingTables.forEach(([name]) => {
        lines.push(`- [ ] Créer la table \`${name}\``);
      });
      lines.push('');
    }
    
    // Relations manquantes
    const missingRelations = Object.entries(auditResults.relations).filter(([_, data]) => data.status.includes('❌'));
    if (missingRelations.length > 0) {
      lines.push('**Relations à créer :**');
      missingRelations.forEach(([name]) => {
        lines.push(`- [ ] Créer la foreign key \`${name}\``);
      });
      lines.push('');
    }
    
    // RLS manquants
    const missingRLS = Object.entries(auditResults.rls).filter(([_, data]) => data.status.includes('❌'));
    if (missingRLS.length > 0) {
      lines.push('**RLS à configurer :**');
      missingRLS.forEach(([name]) => {
        lines.push(`- [ ] Activer RLS et créer policies pour \`${name}\``);
      });
      lines.push('');
    }
    
    // RPC manquantes
    const missingRPC = Object.entries(auditResults.rpc).filter(([key, data]) => !key.startsWith('_') && data.status.includes('❌'));
    if (missingRPC.length > 0) {
      lines.push('**RPC à créer :**');
      missingRPC.forEach(([name]) => {
        lines.push(`- [ ] Créer la fonction \`${name}\``);
      });
      lines.push('');
    }
  }
  
  if (auditResults.summary.partiel > 0) {
    lines.push('### ⚠️ Vérifications recommandées');
    lines.push('');
    const partialElements = Object.entries(auditResults.rls).filter(([_, data]) => data.status.includes('⚠️'));
    partialElements.forEach(([name, data]) => {
      lines.push(`- [ ] Vérifier la configuration RLS de \`${name}\` (RLS: ${data.rls_enabled ? 'activé' : 'désactivé'}, Policies: ${data.policies ? data.policies.length : 0})`);
    });
    lines.push('');
  }
  
  if (auditResults.summary.manquant === 0 && auditResults.summary.partiel === 0) {
    lines.push('✅ **Aucune action requise** - La base de données est prête pour l\'implémentation de la gestion des techniciens.');
    lines.push('');
    lines.push('**Prochaines étapes :**');
    lines.push('1. Implémenter les APIs backend pour la gestion CRUD des techniciens');
    lines.push('2. Créer l\'interface frontend pour les entreprises');
    lines.push('3. Tester les assignations de techniciens aux missions');
    lines.push('4. Valider les règles métier et la sécurité RLS');
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
