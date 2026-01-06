#!/usr/bin/env node
/**
 * Vérification rapide des rôles dans la base de données
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

function makeRequest(url, method = 'GET') {
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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkRoles() {
  console.log('🔍 VÉRIFICATION DES RÔLES DANS LA BASE\n');

  try {
    // Récupérer tous les profiles avec leurs rôles
    const url = `${env.SUPABASE_URL}/rest/v1/profiles?select=role,email&limit=100`;
    const response = await makeRequest(url);

    if (response.status === 200 && response.data) {
      const roles = [...new Set(response.data.map(p => p.role))].sort();
      
      console.log('✅ Rôles détectés dans la base de données :\n');
      roles.forEach(role => {
        const count = response.data.filter(p => p.role === role).length;
        console.log(`   - "${role}" (${count} utilisateurs)`);
      });

      console.log('\n📋 CONCLUSION :\n');
      console.log('Le script RLS doit utiliser ces valeurs EXACTES.');
      console.log('Si vous voyez "entreprise" au lieu de "admin_entreprise",');
      console.log('c\'est la vraie valeur à utiliser dans les policies RLS.\n');

      // Sauvegarder
      fs.writeFileSync(
        path.join(__dirname, '_ROLES_DETECTES.txt'),
        `Rôles détectés le ${new Date().toLocaleString('fr-FR')}:\n\n` +
        roles.map(r => `- ${r}`).join('\n')
      );

      console.log('💾 Résultats sauvegardés dans _ROLES_DETECTES.txt\n');

    } else {
      console.error('❌ Erreur:', response.status, response.data);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkRoles();
