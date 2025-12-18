/**
 * API : Gestion des techniciens d'une entreprise
 * 
 * GET /api/techniciens
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une entreprise
 * - Retourne la liste des techniciens de l'entreprise
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// ⚠️ BACKEND ONLY - Utilise la clé SERVICE_ROLE (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleGetTechniciens(req, res) {
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
    res.end(JSON.stringify({ error: 'Accès réservé aux entreprises' }));
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

  // 4. Récupérer les techniciens de l'entreprise
  const { data: techniciens, error: techniciensError } = await supabase
    .from('techniciens')
    .select('*')
    .eq('entreprise_id', entreprise.id)
    .order('nom', { ascending: true });

  if (techniciensError) {
    console.error('Erreur récupération techniciens:', techniciensError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la récupération des techniciens' }));
    return;
  }

  // 5. Succès
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ techniciens }));
}

// Export direct pour compatibilité Vercel
module.exports = handleGetTechniciens;
