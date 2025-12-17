const { supabaseAdmin } = require('../_supabase');

/**
 * API de validation/refus des agences par admin JTEC
 * 
 * ⚠️ SÉCURITÉ:
 * - Nécessite authentification
 * - Réservé aux admin_jtec uniquement
 * - Actions: valider / refuser
 * 
 * @route POST /api/admin/valider-agence
 * @body {string} regie_id - ID de la régie
 * @body {string} action - valider | refuser
 * @body {string} [commentaire] - Obligatoire si action=refuser
 */
module.exports = async (req, res) => {
  console.log('[ADMIN/VALIDATION] Requête reçue');
  
  // ============================================
  // 1. Vérification authentification
  // ============================================
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[ADMIN/VALIDATION] Requête non authentifiée');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false,
      error: 'Non authentifié. Token requis.' 
    }));
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Vérifier le token
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    console.warn('[ADMIN/VALIDATION] Token invalide:', authError?.message);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false,
      error: 'Token invalide ou expiré' 
    }));
  }
  
  console.log('[ADMIN/VALIDATION] Utilisateur authentifié:', user.id);
  
  // ============================================
  // 2. Vérification du rôle admin_jtec
  // ============================================
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (profileError || !profile) {
    console.error('[ADMIN/VALIDATION] Profil non trouvé:', profileError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false,
      error: 'Profil non trouvé' 
    }));
  }
  
  if (profile.role !== 'admin_jtec') {
    console.warn('[ADMIN/VALIDATION] Accès refusé - rôle:', profile.role);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false,
      error: 'Accès réservé aux administrateurs JTEC' 
    }));
  }
  
  // ============================================
  // 3. Lecture et validation du body
  // ============================================
  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk.toString();
    }
  } catch (error) {
    console.error('[ADMIN/VALIDATION] Erreur lecture body:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Requête invalide'
    }));
  }
  
  let regie_id, action, commentaire;
  try {
    const parsed = JSON.parse(body);
    regie_id = parsed.regie_id;
    action = parsed.action;
    commentaire = parsed.commentaire;
  } catch (error) {
    console.error('[ADMIN/VALIDATION] Erreur parsing JSON:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Format JSON invalide'
    }));
  }
  
  // Validation des champs
  if (!regie_id || !action) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Champs manquants: regie_id et action requis'
    }));
  }
  
  if (!['valider', 'refuser'].includes(action)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Action invalide. Utilisez: valider ou refuser'
    }));
  }
  
  // ============================================
  // 4. Exécution de l'action
  // ============================================
  let result;
  
  try {
    if (action === 'valider') {
      console.log('[ADMIN/VALIDATION] Validation de la régie:', regie_id);
      
      const { data, error } = await supabaseAdmin.rpc('valider_agence', {
        p_regie_id: regie_id,
        p_admin_id: user.id
      });
      
      if (error) {
        console.error('[ADMIN/VALIDATION] Erreur SQL valider_agence:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false,
          error: 'Erreur lors de la validation: ' + error.message 
        }));
      }
      
      result = data;
      
    } else if (action === 'refuser') {
      console.log('[ADMIN/VALIDATION] Refus de la régie:', regie_id);
      
      // Vérification du commentaire pour refus
      if (!commentaire || commentaire.trim().length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'Un commentaire est obligatoire pour refuser une agence'
        }));
      }
      
      const { data, error } = await supabaseAdmin.rpc('refuser_agence', {
        p_regie_id: regie_id,
        p_admin_id: user.id,
        p_commentaire: commentaire.trim()
      });
      
      if (error) {
        console.error('[ADMIN/VALIDATION] Erreur SQL refuser_agence:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false,
          error: 'Erreur lors du refus: ' + error.message 
        }));
      }
      
      result = data;
    }
    
    // ============================================
    // 5. Vérification du résultat
    // ============================================
    if (!result || !result.success) {
      const errorMsg = result?.error || 'Erreur inconnue';
      console.warn('[ADMIN/VALIDATION] Échec de l\'action:', errorMsg);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: errorMsg
      }));
    }
    
    // ============================================
    // 6. Succès
    // ============================================
    console.log('[ADMIN/VALIDATION] ✅ Action réussie:', action, result.regie_nom);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      action: action,
      regie_id: regie_id,
      regie_nom: result.regie_nom,
      regie_email: result.regie_email,
      message: result.message
    }));
    
  } catch (error) {
    console.error('[ADMIN/VALIDATION] Exception:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur serveur lors de la validation',
      details: error.message
    }));
  }
};
