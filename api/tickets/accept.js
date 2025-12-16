/**
 * API : Acceptation de ticket par une entreprise
 * 
 * POST /api/tickets/accept
 * 
 * Body :
 * {
 *   "ticket_id": "uuid"
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une entreprise
 * - Vérifie que l'entreprise est autorisée pour la régie du ticket
 * - Crée une mission et verrouille le ticket
 * - Une seule mission par ticket (contrainte unique)
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleAcceptTicket(req, res) {
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
    res.end(JSON.stringify({ error: 'Seules les entreprises peuvent accepter des tickets' }));
    return;
  }

  // 3. Récupérer l'ID de l'entreprise
  const { data: entreprise, error: entrepriseError } = await supabase
    .from('entreprises')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (entrepriseError || !entreprise) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Entreprise non trouvée' }));
    return;
  }

  // 4. Lire le body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { ticket_id } = JSON.parse(body);

      if (!ticket_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'ticket_id est requis' }));
        return;
      }

      // 5. Appeler la fonction SQL pour accepter le ticket
      const { data: result, error: acceptError } = await supabase
        .rpc('accept_ticket_and_create_mission', {
          p_ticket_id: ticket_id,
          p_entreprise_id: entreprise.id
        });

      if (acceptError) {
        console.error('Erreur acceptation:', acceptError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors de l\'acceptation du ticket' }));
        return;
      }

      // 6. Vérifier le résultat
      if (!result.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      // 7. Succès
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        mission_id: result.mission_id,
        message: 'Mission créée avec succès'
      }));

    } catch (error) {
      console.error('Erreur parsing:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'JSON invalide' }));
    }
  });
}

module.exports = { handleAcceptTicket };
