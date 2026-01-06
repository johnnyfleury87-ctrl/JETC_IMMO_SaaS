#!/usr/bin/env node
/**
 * Vérification approfondie de la structure de la table techniciens
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
            headers: res.headers,
            rawData: data 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            data: data, 
            headers: res.headers,
            rawData: data 
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

async function checkTechniciensTable() {
  console.log('🔍 === VÉRIFICATION APPROFONDIE TABLE TECHNICIENS ===\n');

  try {
    // 1. Test SELECT simple
    console.log('1️⃣  Test SELECT simple...');
    const selectUrl = `${env.SUPABASE_URL}/rest/v1/techniciens?select=*&limit=10`;
    const selectResult = await makeRequest(selectUrl);
    console.log(`   Statut: ${selectResult.status}`);
    console.log(`   Données:`, selectResult.data);
    console.log('');

    // 2. Test avec projection de toutes les colonnes possibles
    console.log('2️⃣  Test projection de colonnes attendues...');
    const projectionUrl = `${env.SUPABASE_URL}/rest/v1/techniciens?select=id,nom,prenom,email,telephone,specialites,profile_id,entreprise_id,actif,created_at,updated_at&limit=1`;
    const projectionResult = await makeRequest(projectionUrl);
    console.log(`   Statut: ${projectionResult.status}`);
    if (projectionResult.status !== 200) {
      console.log(`   Message d'erreur:`, projectionResult.data);
    } else {
      console.log(`   Données:`, projectionResult.data);
    }
    console.log('');

    // 3. Tester insertion d'un technicien de test
    console.log('3️⃣  Test insertion d\'un technicien (sera annulé)...');
    const insertUrl = `${env.SUPABASE_URL}/rest/v1/techniciens`;
    const testData = {
      nom: 'TEST',
      prenom: 'Test',
      email: 'test@test.com',
      telephone: '000000000',
      profile_id: '14c2c351-e015-46ae-95ff-bbfcd975f8e2', // Un ID de profile existant
      entreprise_id: '6ff210bc-9985-457c-8851-4185123edb07', // Un ID d'entreprise existant
      actif: true
    };
    const insertResult = await makeRequest(insertUrl, 'POST', testData);
    console.log(`   Statut: ${insertResult.status}`);
    console.log(`   Message:`, insertResult.data);
    console.log('');

    // 4. Si l'insertion a réussi, récupérer et supprimer
    if (insertResult.status === 201 && insertResult.data && insertResult.data[0]) {
      const insertedId = insertResult.data[0].id;
      console.log(`   ✅ Insertion réussie, ID: ${insertedId}`);
      console.log(`   📋 Structure détectée:`, Object.keys(insertResult.data[0]));
      
      // Supprimer le test
      console.log('\n4️⃣  Suppression du technicien de test...');
      const deleteUrl = `${env.SUPABASE_URL}/rest/v1/techniciens?id=eq.${insertedId}`;
      const deleteResult = await makeRequest(deleteUrl, 'DELETE');
      console.log(`   Statut: ${deleteResult.status}`);
      console.log(`   ✅ Technicien de test supprimé`);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 CONCLUSION');
    console.log('═══════════════════════════════════════════════════════\n');

    if (selectResult.status === 200 && Array.isArray(selectResult.data)) {
      console.log('✅ La table techniciens existe et est accessible');
      console.log(`   Nombre d'enregistrements actuels: ${selectResult.data.length}`);
      
      if (selectResult.data.length > 0) {
        console.log(`   Colonnes disponibles:`, Object.keys(selectResult.data[0]).join(', '));
      } else {
        console.log('   ⚠️  Table vide - aucune donnée pour déterminer les colonnes');
        
        if (insertResult.status === 201) {
          console.log('   ✅ Insertion testée avec succès, colonnes confirmées');
        } else {
          console.log('   ⚠️  Impossible de tester l\'insertion, colonnes non confirmées');
          console.log(`   Erreur d'insertion:`, insertResult.data);
        }
      }
    } else {
      console.log('❌ La table techniciens n\'est pas accessible ou n\'existe pas');
      console.log(`   Statut HTTP: ${selectResult.status}`);
      console.log(`   Erreur:`, selectResult.data);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkTechniciensTable();
