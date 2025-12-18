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
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Non authentifié' }));
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

      // 4. Appeler la fonction centralisée de transition
      const { data: result, error: startError } = await supabase
        .rpc('update_mission_statut', {
          p_mission_id: mission_id,
          p_nouveau_statut: 'en_cours',
          p_role: profile.role
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
