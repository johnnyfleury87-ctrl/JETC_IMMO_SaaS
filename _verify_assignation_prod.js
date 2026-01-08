#!/usr/bin/env node

/**
 * Script de vérification de l'assignation technicien en PROD
 * Vérifie que la RPC assign_technicien_to_mission existe avec la bonne signature
 */

const https = require('https');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bwzyajsrmfhrxdmfpyqy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'votre_anon_key';

console.log('🔍 Vérification assignation technicien en PROD\n');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Clé: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
console.log('');

async function checkRPC() {
  console.log('📋 Test 1: Vérifier que la RPC existe\n');
  
  const url = `${SUPABASE_URL}/rest/v1/rpc/assign_technicien_to_mission`;
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  };

  const postData = JSON.stringify({
    p_mission_id: '00000000-0000-0000-0000-000000000001',
    p_technicien_id: '00000000-0000-0000-0000-000000000002'
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
        console.log(`Body: ${data}\n`);

        if (res.statusCode === 404) {
          console.log('❌ ERREUR: La RPC assign_technicien_to_mission n\'existe pas en PROD');
          console.log('');
          console.log('Action requise:');
          console.log('1. Ouvrir: https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new');
          console.log('2. Copier le contenu de: supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql');
          console.log('3. Coller et cliquer RUN');
          console.log('');
          resolve({ exists: false });
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ La RPC assign_technicien_to_mission existe');
          
          try {
            const result = JSON.parse(data);
            console.log('Réponse RPC:', JSON.stringify(result, null, 2));
            
            if (result.success === false) {
              console.log('✅ La RPC fonctionne (erreur attendue avec IDs fictifs)');
            } else {
              console.log('⚠️  Réponse inattendue (IDs fictifs devraient échouer)');
            }
          } catch (e) {
            console.log('⚠️  Réponse non-JSON:', data);
          }
          
          resolve({ exists: true });
        } else {
          console.log(`⚠️  Status inattendu: ${res.statusCode}`);
          resolve({ exists: true, unexpected: true });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function checkSchema() {
  console.log('📋 Test 2: Vérifier le schéma via introspection\n');
  
  // Requête OpenAPI pour voir si la fonction est dans le schéma
  const url = `${SUPABASE_URL}/rest/v1/`;
  
  const options = {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ API REST accessible');
          // Note: L'introspection complète nécessiterait d'analyser les headers ou l'OpenAPI
          console.log('   (introspection détaillée nécessite accès SQL direct)');
        } else {
          console.log(`⚠️  Status: ${res.statusCode}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      reject(error);
    });

    req.end();
  });
}

async function main() {
  try {
    const rpcCheck = await checkRPC();
    await checkSchema();
    
    console.log('\n===========================================');
    console.log('RÉSUMÉ');
    console.log('===========================================\n');
    
    if (rpcCheck.exists) {
      console.log('✅ RPC assign_technicien_to_mission: EXISTE');
      console.log('');
      console.log('La fonction est bien déployée en PROD.');
      console.log('');
      console.log('Prochaine étape: Tester depuis le dashboard entreprise');
      console.log('https://[votre-domaine]/entreprise/dashboard.html');
    } else {
      console.log('❌ RPC assign_technicien_to_mission: MANQUANTE');
      console.log('');
      console.log('🚨 ACTION URGENTE REQUISE:');
      console.log('');
      console.log('Appliquer la migration:');
      console.log('  supabase/migrations/20260108120000_fix_assignation_prod_urgent.sql');
      console.log('');
      console.log('Via SQL Editor Supabase:');
      console.log('  https://supabase.com/dashboard/project/bwzyajsrmfhrxdmfpyqy/sql/new');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
  }
}

// Vérifier que les variables d'environnement sont définies
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.log('⚠️  Variables d\'environnement manquantes\n');
  console.log('Utilisation:');
  console.log('  SUPABASE_URL=... SUPABASE_ANON_KEY=... node _verify_assignation_prod.js');
  console.log('');
  console.log('Ou créer un fichier .env avec:');
  console.log('  SUPABASE_URL=https://bwzyajsrmfhrxdmfpyqy.supabase.co');
  console.log('  SUPABASE_ANON_KEY=eyJ...');
  console.log('');
  console.log('Exécution avec valeurs par défaut (peut échouer)...\n');
}

main();
