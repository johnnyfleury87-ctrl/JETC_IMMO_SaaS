/**
 * API : Lister les missions en retard
 * 
 * GET /api/missions/retards
 * 
 * Sécurité :
 * - Vérifie que l'utilisateur est une régie ou une entreprise
 * - Filtre selon le rôle (via RLS)
 */

const http = require('http');
const { authenticateUser } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// ⚠️ BACKEND ONLY - Utilise la clé SERVICE_ROLE (bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleGetRetards(req, res) {
  // 1. Authentification
  const user = await authenticateUser(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Non authentifié' }));
    return;
  }

  // 2. Vérifier que l'utilisateur est régie ou entreprise
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

  if (profile.role !== 'regie' && profile.role !== 'entreprise') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Accès réservé aux régies et entreprises' }));
    return;
  }

  // 3. Récupérer les missions en retard
  const { data: retards, error: retardsError } = await supabase
    .from('missions_en_retard')
    .select('*')
    .order('heures_retard', { ascending: false });

  if (retardsError) {
    console.error('Erreur récupération retards:', retardsError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la récupération des retards' }));
    return;
  }

  // 4. Succès
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ retards }));
}

// Export direct pour compatibilité Vercel
module.exports = handleGetRetards;
