#!/usr/bin/env node
/**
 * Vérification complète des RLS et RPC pour la gestion des techniciens
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Charger les variables d'environnement
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
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
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ 
            status: res.statusCode, 
            data: parsed, 
            headers: res.headers 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: data, 
            headers: res.headers 
          });
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

async function checkRLSAndRPC() {
  console.log('🛡️  === VÉRIFICATION RLS ET RPC ===\n');

  const results = {
    rls_tests: {},
    rpc_functions: {},
    recommendations: []
  };

  try {
    // 1. Tester RLS sur techniciens avec ANON KEY
    console.log('1️⃣  Test RLS sur techniciens (avec clé ANON)...\n');
    
    const anonUrl = `${env.SUPABASE_URL}/rest/v1/techniciens?select=*&limit=5`;
    const anonOptions = {
      hostname: new URL(env.SUPABASE_URL).hostname,
      path: '/rest/v1/techniciens?select=*&limit=5',
      method: 'GET',
      headers: {
        'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const anonReq = await new Promise((resolve, reject) => {
      const req = https.request(anonOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`   Test SELECT avec ANON KEY: HTTP ${anonReq.status}`);
    if (anonReq.status === 401 || anonReq.status === 403) {
      console.log('   ✅ RLS activé - accès refusé sans authentification');
      results.rls_tests.techniciens_anon = { status: '✅ protégé', http_status: anonReq.status };
    } else if (anonReq.status === 200) {
      console.log('   ⚠️  RLS peut-être trop permissif - accès autorisé');
      results.rls_tests.techniciens_anon = { status: '⚠️ permissif', http_status: anonReq.status };
      results.recommendations.push('Vérifier les policies RLS de la table techniciens');
    }
    console.log('');

    // 2. Lister les fonctions RPC disponibles
    console.log('2️⃣  Vérification des fonctions RPC...\n');
    
    // Tester assign_technicien_to_mission
    console.log('   Test RPC: assign_technicien_to_mission');
    const rpcUrl = `${env.SUPABASE_URL}/rest/v1/rpc/assign_technicien_to_mission`;
    const rpcTestResult = await makeRequest(rpcUrl, 'POST', {
      p_mission_id: '00000000-0000-0000-0000-000000000000',
      p_technicien_id: '00000000-0000-0000-0000-000000000000'
    });
    
    if (rpcTestResult.status === 404) {
      console.log('   ❌ Fonction assign_technicien_to_mission : NON TROUVÉE');
      results.rpc_functions.assign_technicien_to_mission = { status: '❌ manquant' };
      results.recommendations.push('Créer la fonction RPC assign_technicien_to_mission');
    } else if (rpcTestResult.status === 400 || rpcTestResult.status === 500) {
      console.log('   ✅ Fonction assign_technicien_to_mission : EXISTE (erreur attendue avec IDs fictifs)');
      console.log(`      Message: ${JSON.stringify(rpcTestResult.data)}`);
      results.rpc_functions.assign_technicien_to_mission = { status: '✅ existe', error_expected: true };
    } else if (rpcTestResult.status === 200) {
      console.log('   ✅ Fonction assign_technicien_to_mission : EXISTE');
      results.rpc_functions.assign_technicien_to_mission = { status: '✅ existe' };
    }
    console.log('');

    // 3. Vérifier la structure des tables critiques
    console.log('3️⃣  Vérification des colonnes critiques...\n');

    // Table techniciens
    const techStructure = await makeRequest(`${env.SUPABASE_URL}/rest/v1/techniciens?select=id,profile_id,entreprise_id,nom,prenom,email,telephone,specialites,actif&limit=0`);
    if (techStructure.status === 200) {
      console.log('   ✅ Table techniciens : structure conforme');
      console.log('      Colonnes confirmées: id, profile_id, entreprise_id, nom, prenom, email, telephone, specialites, actif');
      results.structure_checks = results.structure_checks || {};
      results.structure_checks.techniciens = { status: '✅ conforme' };
    } else {
      console.log(`   ⚠️  Problème d'accès à la table techniciens (${techStructure.status})`);
    }

    // Table missions
    const missionStructure = await makeRequest(`${env.SUPABASE_URL}/rest/v1/missions?select=id,ticket_id,entreprise_id,technicien_id,statut&limit=0`);
    if (missionStructure.status === 200) {
      console.log('   ✅ Table missions : colonnes critiques confirmées');
      console.log('      Colonnes: id, ticket_id, entreprise_id, technicien_id, statut');
      results.structure_checks = results.structure_checks || {};
      results.structure_checks.missions = { status: '✅ conforme' };
    }

    // Table entreprises
    const entrepriseStructure = await makeRequest(`${env.SUPABASE_URL}/rest/v1/entreprises?select=id,nom,profile_id&limit=0`);
    if (entrepriseStructure.status === 200) {
      console.log('   ✅ Table entreprises : structure conforme');
      results.structure_checks = results.structure_checks || {};
      results.structure_checks.entreprises = { status: '✅ conforme' };
    }

    console.log('');

    // 4. Rapport final
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RAPPORT RLS ET RPC');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🛡️  RLS (Row Level Security)');
    Object.entries(results.rls_tests).forEach(([key, value]) => {
      console.log(`   ${value.status} ${key}`);
    });
    console.log('');

    console.log('⚙️  Fonctions RPC');
    Object.entries(results.rpc_functions).forEach(([key, value]) => {
      console.log(`   ${value.status} ${key}`);
    });
    console.log('');

    console.log('📋 Structure des tables');
    if (results.structure_checks) {
      Object.entries(results.structure_checks).forEach(([key, value]) => {
        console.log(`   ${value.status} ${key}`);
      });
    }
    console.log('');

    if (results.recommendations.length > 0) {
      console.log('💡 RECOMMANDATIONS');
      results.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log('');
    } else {
      console.log('✅ Aucune recommandation - Configuration conforme');
      console.log('');
    }

    // Sauvegarder le rapport
    const reportPath = path.join(__dirname, '_AUDIT_RLS_RPC_RESULT.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`💾 Rapport sauvegardé: ${reportPath}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkRLSAndRPC();
