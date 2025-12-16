/**
 * API : Valider une mission (Régie)
 * 
 * POST /api/missions/validate
 * 
 * Body :
 * {
 *   "mission_id": "uuid"
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une régie
 * - Transition : terminee → validee
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleValidateMission(req, res) {
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Non authentifié' }));
    return;
  }

  // 2. Vérifier que l'utilisateur est une régie
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

  if (profile.role !== 'regie') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Seules les régies peuvent valider des missions' }));
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
      const { data: result, error: validateError } = await supabase
        .rpc('update_mission_statut', {
          p_mission_id: mission_id,
          p_nouveau_statut: 'validee',
          p_role: profile.role
        });

      if (validateError) {
        console.error('Erreur validation:', validateError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors de la validation de la mission' }));
        return;
      }

      // 5. Vérifier le résultat
      if (!result.success) {
        // Cas spécial : warning pour signatures manquantes
        if (result.warning) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: result.error,
            warning: true 
          }));
          return;
        }
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      // 6. Succès
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Mission validée avec succès'
      }));

    } catch (error) {
      console.error('Erreur parsing:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'JSON invalide' }));
    }
  });
}

module.exports = { handleValidateMission };
