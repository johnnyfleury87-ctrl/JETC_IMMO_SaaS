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
  try {
    // 1. Authentification
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    // 2. Vérifier que l'utilisateur est une entreprise
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du profil' });
    }

    if (profile.role !== 'entreprise') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux entreprises' });
    }

    // 3. Récupérer l'ID de l'entreprise
    const { data: entreprise, error: entrepriseError } = await supabase
      .from('entreprises')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (entrepriseError || !entreprise) {
      return res.status(403).json({ success: false, error: 'Entreprise non trouvée' });
    }

    // 4. Récupérer les techniciens de l'entreprise
    const { data: techniciens, error: techniciensError } = await supabase
      .from('techniciens')
      .select('*')
      .eq('entreprise_id', entreprise.id)
      .order('nom', { ascending: true });

    if (techniciensError) {
      console.error('Erreur récupération techniciens:', techniciensError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des techniciens' });
    }

    // 5. Succès
    return res.status(200).json({ success: true, techniciens: techniciens || [] });
    
  } catch (error) {
    console.error('[API /techniciens/list] Erreur inattendue:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
}

// Export direct pour compatibilité Vercel
module.exports = handleGetTechniciens;
