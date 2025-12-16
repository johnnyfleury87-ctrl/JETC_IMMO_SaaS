/**
 * API Admin - Statistiques globales
 * 
 * Retourne les statistiques de la plateforme (admin_jtec uniquement).
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est admin_jtec
 * - Retourne uniquement des données agrégées (pas de données nominatives)
 * 
 * Usage:
 *   GET /api/admin/stats
 */

const { getSupabaseClient } = require('../../lib/supabase-client');
const { authenticateUser } = require('../../lib/auth');

module.exports = async (req, res) => {
  // Méthode GET uniquement
  if (req.method !== 'GET') {
    return res.writeHead(405, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Méthode non autorisée' }));
  }

  try {
    // 1. Authentifier l'utilisateur
    const user = await authenticateUser(req);
    if (!user) {
      return res.writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Non authentifié' }));
    }

    // 2. Vérifier que c'est un admin_jtec
    const supabase = getSupabaseClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin_jtec') {
      return res.writeHead(403, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Accès réservé aux administrateurs JTEC' }));
    }

    // 3. Récupérer les stats depuis la vue consolidée
    const { data: dashboard, error: dashboardError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .single();

    if (dashboardError) {
      console.error('Erreur dashboard:', dashboardError);
      return res.writeHead(500, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Erreur lors de la récupération des stats' }));
    }

    // 4. Récupérer les stats par catégorie
    const { data: categories, error: categoriesError } = await supabase
      .from('admin_stats_tickets_categories')
      .select('*');

    if (categoriesError) {
      console.error('Erreur catégories:', categoriesError);
    }

    // 5. Récupérer les stats par priorité
    const { data: priorites, error: prioritesError } = await supabase
      .from('admin_stats_tickets_priorites')
      .select('*');

    if (prioritesError) {
      console.error('Erreur priorités:', prioritesError);
    }

    // 6. Récupérer l'évolution sur 30 jours
    const { data: evolution, error: evolutionError } = await supabase
      .from('admin_stats_evolution')
      .select('*')
      .order('jour', { ascending: false })
      .limit(30);

    if (evolutionError) {
      console.error('Erreur évolution:', evolutionError);
    }

    // 7. Retourner les stats
    return res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({
        dashboard: dashboard || {},
        categories: categories || [],
        priorites: priorites || [],
        evolution: evolution || []
      }));

  } catch (error) {
    console.error('Erreur stats admin:', error);
    return res.writeHead(500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: 'Erreur serveur' }));
  }
};
