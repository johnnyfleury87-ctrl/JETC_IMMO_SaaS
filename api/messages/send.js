/**
 * API : POST /api/messages/send
 * 
 * Envoie un message sur une mission
 * 
 * Sécurité :
 *   - Authentification requise
 *   - Vérifie que l'utilisateur est acteur de la mission
 *   - RLS applique les restrictions d'accès
 * 
 * Body :
 *   {
 *     "mission_id": "uuid",
 *     "content": "Bonjour, j'ai terminé l'intervention..."
 *   }
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": { message }
 *   }
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'POST') {
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

  // Parser le body
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'JSON invalide' 
    }));
    return;
  }

  const { mission_id, content } = data;

  // Valider les données
  if (!mission_id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'mission_id est requis' 
    }));
    return;
  }

  if (!content || content.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Le contenu du message ne peut pas être vide' 
    }));
    return;
  }

  if (content.length > 5000) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Le message ne peut pas dépasser 5000 caractères' 
    }));
    return;
  }

  // Appeler la fonction SQL send_message
  const { data: message, error: sendError } = await supabase
    .rpc('send_message', {
      p_mission_id: mission_id,
      p_sender_user_id: user.id,
      p_content: content
    });

  if (sendError) {
    const statusCode = sendError.message.includes('Accès refusé') ? 403 : 400;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: sendError.message 
    }));
    return;
  }

  // Retourner le message créé
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: message 
  }));
};
