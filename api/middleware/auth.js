/**
 * Middleware d'authentification pour les APIs
 * Extrait et vérifie le token Bearer JWT
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Authentifie l'utilisateur à partir du token Bearer
 * @param {Object} req - Requête HTTP
 * @returns {Promise<Object|null>} - User ou null si non authentifié
 */
async function authenticateUser(req) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    console.log('[AUTH_MIDDLEWARE] Header check:', {
      hasLowercase: !!req.headers.authorization,
      hasUppercase: !!req.headers.Authorization,
      startsWithBearer: authHeader ? authHeader.startsWith('Bearer ') : false
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AUTH_MIDDLEWARE] ❌ No Bearer token found');
      return null;
    }
    
    const token = authHeader.substring(7);
    console.log('[AUTH_MIDDLEWARE] Token extracted, length:', token.length);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('[AUTH_MIDDLEWARE] ❌ getUser error:', error.message);
      return null;
    }
    
    if (!user) {
      console.log('[AUTH_MIDDLEWARE] ❌ No user returned');
      return null;
    }
    
    console.log('[AUTH_MIDDLEWARE] ✅ User authenticated:', user.id);
    return user;
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Exception:', error);
    return null;
  }
}

module.exports = { authenticateUser };
