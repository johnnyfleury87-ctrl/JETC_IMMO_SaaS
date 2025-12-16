/**
 * ROUTE API : ME (Profil actuel)
 * 
 * Objectif : Récupérer le profil de l'utilisateur connecté
 * 
 * Méthode : GET
 * Headers : Authorization: Bearer <access_token>
 * 
 * Processus :
 * 1. Vérification du token
 * 2. Extraction de l'user_id
 * 3. Récupération du profil
 * 4. Retour des infos
 * 
 * Erreurs gérées :
 * - Token manquant
 * - Token invalide
 * - Profil non trouvé
 */

const { supabaseAdmin } = require('../_supabase');
require('dotenv').config();

module.exports = async (req, res) => {
  console.log('[AUTH/ME] Requête reçue');
  
  // Vérification méthode
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Méthode non autorisée. Utilisez GET.'
    }));
  }

  try {
    // Récupération du token depuis le header Authorization
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Token d\'authentification manquant'
      }));
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Vérification du token et récupération de l'utilisateur
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[AUTH/ME] Token invalide:', userError?.message);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Token invalide ou expiré'
      }));
    }
    
    console.log('[AUTH/ME] Token validé pour:', user.id);
    
    // Récupération du profil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('[AUTH/ME] Profil non trouvé:', profileError);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Profil utilisateur non trouvé'
      }));
    }
    
    console.log('[AUTH/ME] Profil récupéré:', {
      userId: user.id,
      role: profile.role
    });
    
    // Succès
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile.role,
        language: profile.language,
        regie_id: profile.regie_id,
        entreprise_id: profile.entreprise_id,
        logement_id: profile.logement_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    }));
    
  } catch (error) {
    console.error('[AUTH/ME] Erreur:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    }));
  }
};
