/**
 * API : POST /api/factures/generate
 * 
 * Génère une facture pour une mission validée
 * 
 * Sécurité :
 *   - Authentification requise
 *   - Rôle entreprise uniquement
 *   - RLS vérifie que la mission appartient à l'entreprise
 * 
 * Body :
 *   {
 *     "mission_id": "uuid",
 *     "montant_ht": 150.00,
 *     "date_echeance": "2025-07-15",  // optionnel (par défaut +30 jours)
 *     "taux_tva": 20.00,               // optionnel (par défaut 20%)
 *     "taux_commission": 10.00         // optionnel (par défaut 10%)
 *   }
 * 
 * Retour :
 *   {
 *     "success": true,
 *     "data": { facture }
 *   }
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'POST') {
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

  // Récupérer le rôle
  const { data: authUser, error: roleError } = await supabase
    .from('auth_users')
    .select('role, entreprise_id')
    .eq('user_id', user.id)
    .single();

  if (roleError || !authUser) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Erreur lors de la récupération du rôle' 
    }));
    return;
  }

  // Vérifier que l'utilisateur est une entreprise
  if (authUser.role !== 'entreprise') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Seules les entreprises peuvent générer des factures' 
    }));
    return;
  }

  // Parser le body
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'JSON invalide' 
    }));
    return;
  }

  const { 
    mission_id, 
    montant_ht,
    date_echeance,
    taux_tva,
    taux_commission
  } = data;

  // Valider les données
  if (!mission_id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'mission_id est requis' 
    }));
    return;
  }

  if (!montant_ht || montant_ht <= 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'montant_ht doit être supérieur à 0' 
    }));
    return;
  }

  // Vérifier que la mission appartient à l'entreprise et est validée
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('id, statut, entreprise_id')
    .eq('id', mission_id)
    .single();

  if (missionError || !mission) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Mission non trouvée' 
    }));
    return;
  }

  if (mission.entreprise_id !== authUser.entreprise_id) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Cette mission n\'appartient pas à votre entreprise' 
    }));
    return;
  }

  if (mission.statut !== 'validee') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'La mission doit être validée pour générer une facture' 
    }));
    return;
  }

  // Appeler la fonction SQL
  const params = {
    p_mission_id: mission_id,
    p_montant_ht: montant_ht
  };

  if (date_echeance) params.p_date_echeance = date_echeance;
  if (taux_tva !== undefined) params.p_taux_tva = taux_tva;
  if (taux_commission !== undefined) params.p_taux_commission = taux_commission;

  const { data: facture, error: generateError } = await supabase
    .rpc('generate_facture_from_mission', params);

  if (generateError) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: generateError.message 
    }));
    return;
  }

  // Retourner la facture créée
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: facture 
  }));
};
