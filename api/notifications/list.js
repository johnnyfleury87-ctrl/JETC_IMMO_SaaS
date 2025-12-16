/**
 * API : GET /api/notifications/list
 * 
 * Liste les notifications de l'utilisateur connecté
 * 
 * Sécurité :
 *   - Authentification requise
 *   - RLS filtre automatiquement par user_id
 * 
 * Query params :
 *   - read : filtrer par statut (true/false)
 *   - type : filtrer par type de notification
 *   - limit : nombre de résultats (défaut 50)
 *   - offset : pagination (défaut 0)
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": [ notifications ],
 *     "count": total,
 *     "unread_count": nombre non lues
 *   }
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const url = require('url');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'GET') {
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

  // Parser les query params
  const parsedUrl = url.parse(req.url, true);
  const { read, type, limit = 50, offset = 0 } = parsedUrl.query;

  // Construire la requête
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' });

  // Filtrer par statut de lecture si spécifié
  if (read === 'true') {
    query = query.eq('read', true);
  } else if (read === 'false') {
    query = query.eq('read', false);
  }

  // Filtrer par type si spécifié
  const validTypes = [
    'new_message',
    'mission_status_change',
    'ticket_status_change',
    'mission_assigned',
    'facture_status_change',
    'new_ticket'
  ];
  if (type && validTypes.includes(type)) {
    query = query.eq('type', type);
  }

  // Pagination
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  // Tri par date de création décroissante (plus récentes en premier)
  query = query.order('created_at', { ascending: false });

  const { data: notifications, error, count } = await query;

  if (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: error.message 
    }));
    return;
  }

  // Compter les notifications non lues
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: notifications || [],
    count: count || 0,
    unread_count: unreadCount || 0,
    limit: limitNum,
    offset: offsetNum
  }));
};
