/**
 * ROUTE HEALTHCHECK
 * 
 * Objectif : Vérifier que l'API est opérationnelle
 * 
 * Utilisations :
 * - Test de déploiement
 * - Test local
 * - Monitoring
 * 
 * Cette route ne nécessite aucune authentification
 */

require('dotenv').config();

module.exports = async (req, res) => {
  // Log de la requête
  console.log('[HEALTHCHECK] Requête reçue');
  
  // Vérification de la méthode HTTP
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: false,
      error: 'Méthode non autorisée',
      method_allowed: 'GET'
    }));
  }

  try {
    // Récupération du mode actif
    const mode = process.env.MODE || 'demo';
    
    // Vérification des variables critiques
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      MODE: mode
    };

    // Réponse de santé
    const response = {
      ok: true,
      timestamp: new Date().toISOString(),
      mode: mode,
      environment: envCheck,
      version: '1.0.0',
      project: 'JETC_IMMO'
    };

    console.log('[HEALTHCHECK] OK - Mode:', mode);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('[HEALTHCHECK] Erreur:', error);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: false,
      error: 'Erreur interne du serveur',
      message: error.message
    }));
  }
};
