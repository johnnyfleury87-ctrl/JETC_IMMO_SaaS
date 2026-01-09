#!/usr/bin/env node
/**
 * VÉRIFICATION DIRECTE POLICIES VIA API REST SUPABASE
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    // Fallback: utiliser l'API REST standard pour les vues système
    return null;
  }
  
  return response.json();
}

async function checkPolicies() {
  console.log('🔍 VÉRIFICATION POLICIES RLS - MÉTHODE DIRECTE\n');
  
  // Méthode alternative: appeler directement le SQL Editor de Supabase
  const policiesSQL = `
    SELECT 
      policyname,
      roles::text,
      cmd,
      qual::text AS using_clause
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'factures'
    ORDER BY policyname;
  `;
  
  console.log('📋 SQL à exécuter manuellement dans Supabase SQL Editor:');
  console.log('='.repeat(80));
  console.log(policiesSQL);
  console.log('='.repeat(80));
  
  console.log('\n\n🎯 Ce que nous savons déjà:');
  console.log('✅ 2 factures existent dans la base');
  console.log('✅ Les factures ont bien entreprise_id et regie_id');
  console.log('✅ En mode SERVICE_ROLE, on voit toutes les factures');
  console.log('\n❓ QUESTION: Les policies RLS permettent-elles à la Régie de voir les factures?');
  console.log('\n📌 PROCHAINE ÉTAPE: Vérifier les fichiers frontend (pages/vues Régie)');
}

checkPolicies().catch(console.error);
