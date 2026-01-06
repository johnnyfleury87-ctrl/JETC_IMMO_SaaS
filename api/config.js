/**
 * ======================================================
 * GET /api/config
 * ======================================================
 * Retourne les variables d'environnement publiques 
 * pour injection dans le frontend (public/js/supabaseClient.js)
 * ======================================================
 */

module.exports = async (req, res) => {
  // Méthode autorisée
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Récupérer les variables d'environnement
  const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };

  // Vérification de la présence des variables
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error('[API /config] Variables d\'environnement manquantes');
    console.error('[API /config] SUPABASE_URL présent:', !!config.supabaseUrl);
    console.error('[API /config] SUPABASE_ANON_KEY présent:', !!config.supabaseAnonKey);
    
    return res.status(500).json({ 
      error: 'Configuration Supabase manquante côté serveur',
      details: {
        hasUrl: !!config.supabaseUrl,
        hasKey: !!config.supabaseAnonKey
      }
    });
  }

  // Logger en mode développement uniquement
  if (process.env.NODE_ENV === 'development') {
    console.log('[API /config] SUPABASE_URL:', config.supabaseUrl);
    console.log('[API /config] SUPABASE_ANON_KEY:', config.supabaseAnonKey.substring(0, 20) + '...');
  }

  // Retourner la configuration
  res.status(200).json(config);
};
