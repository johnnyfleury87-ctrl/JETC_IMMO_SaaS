/**
 * API : PUT /api/factures/:id/status
 * 
 * Met à jour le statut d'une facture
 * 
 * Sécurité :
 *   - Authentification requise
 *   - Entreprise : peut marquer comme 'envoyee'
 *   - Régie : peut marquer comme 'payee'
 *   - Admin JTEC : tous changements
 *   - RLS vérifie l'accès à la facture
 * 
 * Body :
 *   {
 *     "statut": "envoyee" | "payee" | "annulee"
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
  if (req.method !== 'PUT') {
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
    .select('role, entreprise_id, regie_id')
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

  // Extraire l'ID de la facture depuis l'URL
  const urlParts = req.url.split('/');
  const factureId = urlParts[urlParts.length - 2]; // /api/factures/:id/status

  if (!factureId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'ID de facture manquant' 
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

  const { statut } = data;

  // Valider le statut
  if (!statut || !['brouillon', 'envoyee', 'payee', 'annulee'].includes(statut)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Statut invalide. Valeurs autorisées : brouillon, envoyee, payee, annulee' 
    }));
    return;
  }

  // Récupérer la facture pour vérifier les permissions
  const { data: facture, error: fetchError } = await supabase
    .from('factures')
    .select('id, statut, entreprise_id, regie_id')
    .eq('id', factureId)
    .single();

  if (fetchError || !facture) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Facture non trouvée ou accès refusé' 
    }));
    return;
  }

  // Vérifier les permissions selon le rôle
  if (authUser.role === 'entreprise') {
    // Entreprise : peut seulement marquer comme 'envoyee'
    if (facture.entreprise_id !== authUser.entreprise_id) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Cette facture ne vous appartient pas' 
      }));
      return;
    }

    if (statut !== 'envoyee' && statut !== 'brouillon') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Les entreprises peuvent seulement marquer les factures comme brouillon ou envoyée' 
      }));
      return;
    }
  } else if (authUser.role === 'regie') {
    // Régie : peut marquer comme 'payee'
    if (facture.regie_id !== authUser.regie_id) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Cette facture ne concerne pas votre régie' 
      }));
      return;
    }

    if (statut !== 'payee') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Les régies peuvent seulement marquer les factures comme payées' 
      }));
      return;
    }
  } else if (authUser.role !== 'admin_jtec') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Rôle non autorisé' 
    }));
    return;
  }

  // Appeler la fonction SQL pour mettre à jour le statut
  const { data: updatedFacture, error: updateError } = await supabase
    .rpc('update_facture_status', {
      p_facture_id: factureId,
      p_nouveau_statut: statut
    });

  if (updateError) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: updateError.message 
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    data: updatedFacture 
  }));
};
