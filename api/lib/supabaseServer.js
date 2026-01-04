/**
 * ======================================================
 * SUPABASE SERVER HELPER - Client Admin Backend
 * ======================================================
 * 
 * 🎯 OBJECTIF :
 * Fournir un client Supabase unifié pour toutes les routes API backend
 * 
 * 🔐 SÉCURITÉ :
 * - Utilise SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
 * - UNIQUEMENT pour routes /api/* (backend)
 * - JAMAIS exposer au frontend
 * 
 * 📍 VARIABLES REQUISES :
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * 💡 USAGE :
 * 
 * // Pour opérations admin (bypass RLS)
 * const { getAdminClient } = require('../lib/supabaseServer');
 * const supabase = getAdminClient();
 * 
 * // Pour opérations avec contexte utilisateur (RLS appliqué)
 * const { getUserClient } = require('../lib/supabaseServer');
 * const supabase = getUserClient(token);
 * 
 * ======================================================
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validation au chargement du module
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[SUPABASE SERVER] Variables d\'environnement manquantes', {
    hasUrl: !!SUPABASE_URL,
    hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY
  });
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
}

/**
 * Client admin Supabase (singleton)
 * Bypass TOUS les RLS - utiliser avec précaution
 */
let _adminClient;

function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[SUPABASE SERVER] Admin client initialized');
  }
  return _adminClient;
}

/**
 * Client avec contexte utilisateur (RLS appliqué)
 * @param {string} token - JWT token de l'utilisateur
 * @returns {object} Client Supabase avec contexte utilisateur
 */
function getUserClient(token) {
  if (!token) {
    throw new Error('Token requis pour getUserClient');
  }
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Vérifie le token et retourne l'utilisateur
 * @param {string} token - JWT token
 * @returns {Promise<{user: object|null, error: object|null}>}
 */
async function verifyToken(token) {
  try {
    const client = getUserClient(token);
    const { data: { user }, error } = await client.auth.getUser();
    
    if (error) {
      console.error('[SUPABASE SERVER] Token verification failed:', error);
      return { user: null, error };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('[SUPABASE SERVER] Token verification exception:', error);
    return { user: null, error };
  }
}

/**
 * Récupère le profil d'un utilisateur
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<{profile: object|null, error: object|null}>}
 */
async function getUserProfile(userId) {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[SUPABASE SERVER] Profile fetch failed:', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (error) {
    console.error('[SUPABASE SERVER] Profile fetch exception:', error);
    return { profile: null, error };
  }
}

module.exports = {
  getAdminClient,
  getUserClient,
  verifyToken,
  getUserProfile
};
