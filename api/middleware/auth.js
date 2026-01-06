/**
 * Middleware d'authentification pour les APIs
 * Extrait et vérifie le token Bearer JWT
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Authentifie l'utilisateur à partir du token Bearer
 * @param {Object} req - Requête HTTP
 * @returns {Promise<Object|null>} - User ou null si non authentifié
 */
async function authenticateUser(req) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Erreur:', error);
    return null;
  }
}

module.exports = { authenticateUser };
