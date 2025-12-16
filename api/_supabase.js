/**
 * CLIENT SUPABASE BACKEND
 * 
 * ⚠️ RÈGLES STRICTES :
 * - Utilise UNIQUEMENT la clé SERVICE_ROLE
 * - Ne JAMAIS exposer ce client au frontend
 * - Utilisé uniquement dans les routes /api/*
 * - Contourne les RLS (responsabilité = vérifications manuelles)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Vérification des variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
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
