/**
 * API : GET /api/messages/mission/:id
 * 
 * Récupère tous les messages d'une mission
 * 
 * Sécurité :
 *   - Authentification requise
 *   - RLS vérifie que l'utilisateur est acteur de la mission
 * 
 * Query params :
 *   - limit : nombre de résultats (défaut 50)
 *   - offset : pagination (défaut 0)
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": [ messages ],
 *     "count": total
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

  // Extraire l'ID de la mission depuis l'URL
  const urlParts = req.url.split('?')[0].split('/');
  const missionId = urlParts[urlParts.length - 1];

  if (!missionId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'ID de mission manquant' 
    }));
    return;
  }

  // Parser les query params
  const parsedUrl = url.parse(req.url, true);
  const { limit = 50, offset = 0 } = parsedUrl.query;

  // Construire la requête
  let query = supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('mission_id', missionId);

  // Pagination
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  // Tri par date de création
  query = query.order('created_at', { ascending: true });

  const { data: messages, error, count } = await query;

  if (error) {
    // Si erreur de RLS, c'est que l'utilisateur n'a pas accès
    if (error.code === 'PGRST116' || error.message.includes('row-level security')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Accès refusé à cette mission' 
      }));
      return;
    }

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: error.message 
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: messages || [],
    count: count || 0,
    limit: limitNum,
    offset: offsetNum
  }));
};
