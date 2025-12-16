/**
 * API : GET /api/factures/list
 * 
 * Liste les factures selon le rôle de l'utilisateur
 * 
 * Sécurité :
 *   - Authentification requise
 *   - Entreprise : voit ses factures
 *   - Régie : voit les factures des missions sur ses biens
 *   - Admin JTEC : voit toutes les factures
 *   - RLS filtre automatiquement
 * 
 * Query params :
 *   - statut : filtrer par statut (brouillon, envoyee, payee, annulee)
 *   - limit : nombre de résultats (défaut 50)
 *   - offset : pagination (défaut 0)
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": [ factures ],
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

  // Parser les query params
  const parsedUrl = url.parse(req.url, true);
  const { statut, limit = 50, offset = 0 } = parsedUrl.query;

  // Construire la requête
  let query = supabase
    .from('factures')
    .select(`
      *,
      missions!inner(
        reference,
        date_intervention_prevue,
        statut
      ),
      entreprises!inner(
        nom,
        siret
      ),
      regies!inner(
        nom
      )
    `, { count: 'exact' });

  // Filtrer par statut si spécifié
  if (statut && ['brouillon', 'envoyee', 'payee', 'annulee'].includes(statut)) {
    query = query.eq('statut', statut);
  }

  // Pagination
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  // Tri par date d'émission décroissante
  query = query.order('date_emission', { ascending: false });

  const { data: factures, error, count } = await query;

  if (error) {
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
    data: factures,
    count: count || 0,
    limit: limitNum,
    offset: offsetNum
  }));
};
