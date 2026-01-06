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
  try {
    // 1. Authentification
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    // 2. Vérifier que l'utilisateur est un technicien
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du profil' });
    }

    if (profile.role !== 'technicien') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux techniciens' });
    }

    // 3. Récupérer l'ID du technicien
    const { data: technicien, error: technicienError } = await supabase
      .from('techniciens')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (technicienError || !technicien) {
      return res.status(404).json({ success: false, error: 'Technicien non trouvé' });
    }

    // 4. Récupérer le planning du technicien via la vue
    const { data: planning, error: planningError } = await supabase
      .from('planning_technicien')
      .select('*')
      .eq('technicien_id', technicien.id)
      .order('date_intervention_prevue', { ascending: true, nullsFirst: false });

    if (planningError) {
      console.error('Erreur récupération planning:', planningError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du planning' });
    }

    // 5. Succès
    return res.status(200).json({ success: true, planning: planning || [] });
    
  } catch (error) {
    console.error('[API /techniciens/planning] Erreur inattendue:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
}

// Export direct pour compatibilité Vercel
module.exports = handleGetPlanning;
