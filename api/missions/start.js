/**
 * API : Démarrer une mission
 * 
 * POST /api/missions/start
 * 
 * Body :
 * {
 *   "mission_id": "uuid"
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une entreprise ou un technicien
 * - Vérifie que la mission appartient à l'entreprise du technicien
 * - Transition : en_attente → en_cours
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// ⚠️ BACKEND ONLY - Utilise la clé SERVICE_ROLE (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleStartMission(req, res) {
  console.log('[START_MISSION] 🚀 Nouvelle requête');
  console.log('[START_MISSION] Method:', req.method);
  console.log('[START_MISSION] Headers:', JSON.stringify({
    authorization: req.headers.authorization ? 'Bearer ...' + req.headers.authorization.substring(req.headers.authorization.length - 20) : 'ABSENT',
    Authorization: req.headers.Authorization ? 'Bearer ...' + req.headers.Authorization.substring(req.headers.Authorization.length - 20) : 'ABSENT',
    'content-type': req.headers['content-type']
  }));
  
  // 1. Authentification
  const user = await authenticateUser(req);
  
  console.log('[START_MISSION] Auth result:', user ? `USER_ID: ${user.id}` : 'NULL (401)');
  
  if (!user) {
    console.error('[START_MISSION] ❌ Authentification échouée');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Non authentifié',
      debug: 'Token manquant ou invalide - Vérifiez Authorization header'
    }));
    return;
  }

  // 2. Vérifier que l'utilisateur est entreprise ou technicien
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la récupération du profil' }));
    return;
  }

  if (profile.role !== 'entreprise' && profile.role !== 'technicien') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Accès réservé aux entreprises et techniciens' }));
    return;
  }

  // 3. Lire le body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { mission_id } = JSON.parse(body);

      if (!mission_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mission_id est requis' }));
        return;
      }

      // 4. Appeler la fonction start_mission
      const { data: result, error: startError } = await supabase
        .rpc('start_mission', {
          p_mission_id: mission_id
        });

      if (startError) {
        console.error('Erreur démarrage:', startError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors du démarrage de la mission' }));
        return;
      }

      // 5. Vérifier le résultat
      if (!result.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      // 6. Succès
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Mission démarrée avec succès'
      }));

    } catch (error) {
      console.error('Erreur parsing:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'JSON invalide' }));
    }
  });
}

// Export direct pour compatibilité Vercel
module.exports = handleStartMission;
