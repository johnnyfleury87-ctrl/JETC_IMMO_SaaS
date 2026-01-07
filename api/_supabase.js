/**
 * ======================================================
 * CLIENT SUPABASE BACKEND (ADMIN)
 * ======================================================
 * 
 * 🎯 OBJECTIF :
 * Client Supabase avec privilèges administrateur
 * 
 * 🔥 SÉCURITÉ CRITIQUE :
 * - Utilise la clé SERVICE_ROLE (bypass TOUS les RLS)
 * - Ne JAMAIS exposer ce module au frontend
 * - Ne JAMAIS importer dans src/lib/supabaseClient.js
 * - Utilisé UNIQUEMENT dans les routes /api/* (backend)
 * 
 * 📍 VARIABLES D'ENVIRONNEMENT REQUISES :
 * - SUPABASE_URL : URL du projet Supabase
 * - SUPABASE_SERVICE_ROLE_KEY : Clé admin secrète
 * 
 * ⚠️ RÈGLES STRICTES :
 * - Ce client BYPASS tous les RLS
 * - Vous êtes responsable des vérifications manuelles
 * - Vérifier TOUJOURS le rôle de l'utilisateur avant toute opération
 * - Logger toutes les opérations sensibles
 * 
 * 🚫 INTERDICTIONS :
 * - Ne JAMAIS exposer cette clé dans les logs
 * - Ne JAMAIS commit cette clé dans Git
 * - Ne JAMAIS utiliser ce client côté frontend
 * 
 * 📚 Documentation : https://supabase.com/docs/guides/auth/auth-helpers/auth-ui
 * ======================================================
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ======================================================
// CONFIGURATION - Lecture variables d'environnement
// ======================================================

// 1️⃣ URL du projet Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

// 2️⃣ Clé SERVICE_ROLE (admin, bypass RLS)
// ❌ Cette clé est SECRÈTE et ne doit JAMAIS être exposée
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[SUPABASE BACKEND] Variables d\'environnement manquantes');
  throw new Error('Configuration Supabase Backend incomplète. Vérifier SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
}

// Création du client Supabase avec privilèges service_role
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Récupère le profil d'un utilisateur par son ID
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<{profile: object|null, error: object|null}>}
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[SUPABASE BACKEND] Erreur récupération profil:', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (error) {
    console.error('[SUPABASE BACKEND] Exception:', error);
    return { profile: null, error };
  }
}

/**
 * Vérifie si l'utilisateur a le rôle requis
 * @param {string} userId - UUID de l'utilisateur
 * @param {string|string[]} requiredRoles - Rôle(s) autorisé(s)
 * @returns {Promise<boolean>}
 */
async function checkUserRole(userId, requiredRoles) {
  const { profile, error } = await getUserProfile(userId);
  
  if (error || !profile) return false;
  
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(profile.role);
}

console.log('[SUPABASE BACKEND] Client backend initialisé');

module.exports = {
  supabaseAdmin,
  getUserProfile,
  checkUserRole
};
