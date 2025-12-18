/**
 * API : Planning du technicien
 * 
 * GET /api/techniciens/planning
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est un technicien
 * - Retourne uniquement les missions assignées au technicien connecté
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// ⚠️ BACKEND ONLY - Utilise la clé SERVICE_ROLE (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleGetPlanning(req, res) {
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Non authentifié' }));
    return;
  }

  // 2. Vérifier que l'utilisateur est un technicien
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

  if (profile.role !== 'technicien') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Accès réservé aux techniciens' }));
    return;
  }

  // 3. Récupérer l'ID du technicien
  const { data: technicien, error: technicienError } = await supabase
    .from('techniciens')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (technicienError || !technicien) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Technicien non trouvé' }));
    return;
  }

  // 4. Récupérer le planning du technicien via la vue
  const { data: planning, error: planningError } = await supabase
    .from('planning_technicien')
    .select('*')
    .eq('technicien_id', technicien.id)
    .order('date_intervention_prevue', { ascending: true, nullsFirst: false });

  if (planningError) {
    console.error('Erreur récupération planning:', planningError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la récupération du planning' }));
    return;
  }

  // 5. Succès
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ planning }));
}

// Export direct pour compatibilité Vercel
module.exports = handleGetPlanning;
