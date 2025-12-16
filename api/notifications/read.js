/**
 * API : PUT /api/notifications/:id/read
 * 
 * Marque une notification comme lue
 * 
 * Sécurité :
 *   - Authentification requise
 *   - Vérifie que la notification appartient à l'utilisateur
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": { notification }
 *   }
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'PUT') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Méthode non autorisée' 
    }));
    return;
  }

  // Extraire le token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Token manquant' 
    }));
    return;
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Non authentifié' 
    }));
    return;
  }

  // Extraire l'ID de la notification depuis l'URL
  const urlParts = req.url.split('/');
  const notificationId = urlParts[urlParts.length - 2]; // /api/notifications/:id/read

  if (!notificationId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'ID de notification manquant' 
    }));
    return;
  }

  // Appeler la fonction SQL mark_notification_as_read
  const { data: notification, error: markError } = await supabase
    .rpc('mark_notification_as_read', {
      p_notification_id: notificationId,
      p_user_id: user.id
    });

  if (markError) {
    const statusCode = markError.message.includes('non trouvée') ? 404 : 400;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: markError.message 
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: notification 
  }));
};
