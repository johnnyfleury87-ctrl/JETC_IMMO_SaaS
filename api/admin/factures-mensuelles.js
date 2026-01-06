/**
 * API Admin - Factures Mensuelles JETC
 * 
 * Route: /api/admin/factures-mensuelles
 * Méthode: GET
 * Accès: admin_jtec uniquement
 * 
 * Query params:
 *   - annee (optionnel): filtrer par année (ex: 2025)
 *   - mois (optionnel): filtrer par mois (ex: 12)
 * 
 * Retourne:
 *   - lignes: tableau des agrégations par régie/mois
 *   - totaux: totaux globaux (nombre missions, HT, commissions)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Vérifier authentification et rôle admin_jtec
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Vérifier que l'utilisateur est admin_jtec
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin_jtec') {
      return res.status(403).json({ error: 'Accès refusé : admin_jtec uniquement' });
    }

    // 2. Récupérer les paramètres de filtrage
    const { annee, mois } = req.query;

    let query = supabaseAdmin
      .from('admin_factures_mensuelles_regies')
      .select('*');

    // Appliquer filtres
    if (annee) {
      query = query.eq('annee', parseInt(annee));
    }
    if (mois) {
      query = query.eq('mois', parseInt(mois));
    }

    // Tri par période DESC (plus récent en premier)
    query = query.order('periode', { ascending: false });

    const { data: lignes, error: queryError } = await query;

    if (queryError) {
      console.error('Erreur requête vue:', queryError);
      return res.status(500).json({ error: 'Erreur lors de la récupération des données' });
    }

    // 3. Calculer les totaux globaux
    const totaux = lignes.reduce((acc, ligne) => {
      acc.nombre_missions += ligne.nombre_missions || 0;
      acc.total_ht += parseFloat(ligne.total_ht || 0);
      acc.total_commission_jetc += parseFloat(ligne.total_commission_jetc || 0);
      return acc;
    }, {
      nombre_missions: 0,
      total_ht: 0,
      total_commission_jetc: 0
    });

    // Arrondir les totaux
    totaux.total_ht = Math.round(totaux.total_ht * 100) / 100;
    totaux.total_commission_jetc = Math.round(totaux.total_commission_jetc * 100) / 100;

    // 4. Retourner les données
    return res.status(200).json({
      lignes,
      totaux,
      filtres: {
        annee: annee ? parseInt(annee) : null,
        mois: mois ? parseInt(mois) : null
      },
      metadata: {
        count: lignes.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur API factures-mensuelles:', error);
    return res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};
