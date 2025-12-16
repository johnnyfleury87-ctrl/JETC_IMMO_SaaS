/**
 * Route API : Liste des tickets pour une entreprise
 * GET /api/tickets/entreprise
 * 
 * Retourne les tickets visibles par l'entreprise authentifiée
 * selon les autorisations et modes de diffusion
 * 
 * SÉCURITÉ :
 * - Vérification du token JWT
 * - Vérification que l'utilisateur est une entreprise
 * - Entreprise non autorisée ne voit RIEN
 * - Mode général : tous les tickets ouverts des régies autorisées
 * - Mode restreint : seulement les tickets assignés
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // Vérifier la méthode HTTP
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Méthode non autorisée' }));
    return;
  }

  try {
    // Récupérer le token
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token manquant' }));
      return;
    }

    const token = authHeader.substring(7);

    // Vérifier le token et récupérer l'utilisateur
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Token invalide' }));
      return;
    }

    // Récupérer le profil utilisateur
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Profil non trouvé' }));
      return;
    }

    // Vérifier que c'est bien une entreprise
    if (profile.role !== 'entreprise') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Accès réservé aux entreprises' 
      }));
      return;
    }

    // Récupérer les données de l'entreprise
    const { data: entreprise, error: entrepriseError } = await supabaseAdmin
      .from('entreprises')
      .select('id, nom')
      .eq('profile_id', profile.id)
      .single();

    if (entrepriseError || !entreprise) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Fiche entreprise non trouvée' 
      }));
      return;
    }

    // Récupérer les tickets visibles par cette entreprise
    // Utilisation de la vue tickets_visibles_entreprise
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets_visibles_entreprise')
      .select('*')
      .eq('entreprise_id', entreprise.id)
      .order('date_creation', { ascending: false });

    if (ticketsError) {
      console.error('Erreur récupération tickets:', ticketsError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Erreur lors de la récupération des tickets',
        error: ticketsError.message
      }));
      return;
    }

    // Si aucune autorisation, retourner un tableau vide (pas d'erreur)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      tickets: tickets || [],
      count: tickets ? tickets.length : 0,
      entreprise: {
        id: entreprise.id,
        nom: entreprise.nom
      }
    }));

  } catch (error) {
    console.error('Erreur serveur:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      message: 'Erreur serveur',
      error: error.message
    }));
  }
};
