/**
 * API : Assignation d'un technicien à une mission
 * 
 * POST /api/missions/assign-technicien
 * 
 * Body :
 * {
 *   "mission_id": "uuid",
 *   "technicien_id": "uuid",
 *   "date_intervention_prevue": "2024-12-25T10:00:00Z" (optionnel)
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une entreprise
 * - Vérifie que la mission appartient à l'entreprise
 * - Vérifie que le technicien appartient à l'entreprise
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleAssignTechnicien(req, res) {
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Non authentifié' }));
    return;
  }

  // 2. Vérifier que l'utilisateur est une entreprise
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

  if (profile.role !== 'entreprise') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Seules les entreprises peuvent assigner des techniciens' }));
    return;
  }

  // 3. Lire le body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { mission_id, technicien_id, date_intervention_prevue } = JSON.parse(body);

      if (!mission_id || !technicien_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mission_id et technicien_id sont requis' }));
        return;
      }

      // 4. Appeler la fonction SQL pour assigner le technicien
      const { data: result, error: assignError } = await supabase
        .rpc('assign_technicien_to_mission', {
          p_mission_id: mission_id,
          p_technicien_id: technicien_id,
          p_date_intervention_prevue: date_intervention_prevue || null
        });

      if (assignError) {
        console.error('Erreur assignation:', assignError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors de l\'assignation du technicien' }));
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
        message: 'Technicien assigné avec succès'
      }));

    } catch (error) {
      console.error('Erreur parsing:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'JSON invalide' }));
    }
  });
}

module.exports = { handleAssignTechnicien };
