/**
 * API : Diffuser un ticket aux entreprises (Régie)
 * 
 * POST /api/tickets/diffuser
 * 
 * Body :
 * {
 *   "ticket_id": "uuid"
 * }
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une régie
 * - Transition : nouveau → en_attente
 * - Utilise update_ticket_statut() centralisée
 */

const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false,
      error: 'Non authentifié' 
    }));
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
    res.end(JSON.stringify({ 
      success: false,
      error: 'Erreur lors de la récupération du profil' 
    }));
    return;
  }

  if (profile.role !== 'regie' && profile.role !== 'admin_jtec') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false,
      error: 'Seules les régies peuvent diffuser des tickets' 
    }));
    return;
  }

  // 3. Lire le body
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  try {
    const { ticket_id } = JSON.parse(body);

    if (!ticket_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false,
        error: 'ticket_id est requis' 
      }));
      return;
    }

    // 4. Appeler la fonction centralisée de transition
    const { data: result, error: updateError } = await supabase
      .rpc('update_ticket_statut', {
        p_ticket_id: ticket_id,
        p_nouveau_statut: 'en_attente',
        p_role: profile.role
      });

    if (updateError) {
      console.error('[TICKETS/DIFFUSER] Erreur:', updateError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false,
        error: 'Erreur lors de la diffusion du ticket',
        details: updateError.message
      }));
      return;
    }

    // 5. Vérifier le résultat
    if (!result || !result.success) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result || { 
        success: false, 
        error: 'Transition refusée' 
      }));
      return;
    }

    // 6. Succès
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Ticket diffusé aux entreprises',
      ...result
    }));

  } catch (error) {
    console.error('[TICKETS/DIFFUSER] Erreur parsing:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false,
      error: 'Corps de requête invalide' 
    }));
  }
};
