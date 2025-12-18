const { supabaseAdmin } = require('../_supabase');
require('dotenv').config();

/**
 * API de création du premier admin JTEC
 * 
 * ⚠️ SÉCURITÉ:
 * - Nécessite une clé d'installation (INSTALL_ADMIN_KEY)
 * - Ne peut être utilisée qu'une seule fois
 * - Vérifie qu'aucun admin_jtec n'existe déjà
 * 
 * @route POST /api/install/create-admin
 * @body {string} installKey - Clé d'installation
 * @body {string} email - Email de l'admin
 * @body {string} password - Mot de passe de l'admin
 */
module.exports = async (req, res) => {
  console.log('[INSTALL_ADMIN] API called - Method:', req.method);
  console.log('[INSTALL_ADMIN] Environment check:', {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasInstallKey: !!process.env.INSTALL_ADMIN_KEY
  });

  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    console.warn('[INSTALL_ADMIN] Méthode non autorisée:', req.method);
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Méthode non autorisée. Utilisez POST.'
    }));
  }

  // ============================================
  // 1. Vérification de la clé d'installation
  // ============================================
  const INSTALL_KEY = process.env.INSTALL_ADMIN_KEY;
  
  if (!INSTALL_KEY || INSTALL_KEY.length < 32) {
    console.error('[INSTALL_ADMIN] Configuration serveur invalide - INSTALL_ADMIN_KEY manquante ou trop courte');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Configuration serveur invalide. INSTALL_ADMIN_KEY manquante ou incorrecte.',
      details: 'Vérifiez que INSTALL_ADMIN_KEY est configurée dans les variables d\'environnement Vercel'
    }));
  }
  
  // ============================================
  // 2. Lecture et validation du body
  // ============================================
  let body = '';
  try {
    for await (const chunk of req) {
      body += chunk.toString();
    }
  } catch (error) {
    console.error('[INSTALL] Erreur lecture body:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Requête invalide'
    }));
  }
  
  let installKey, email, password;
  try {
    const parsed = JSON.parse(body);
    installKey = parsed.installKey;
    email = parsed.email;
    password = parsed.password;
  } catch (error) {
    console.error('[INSTALL] Erreur parsing JSON:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Format JSON invalide'
    }));
  }
  
  // Validation des champs
  if (!installKey || !email || !password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Champs manquants (installKey, email, password)'
    }));
  }
  
  if (password.length < 12) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Le mot de passe doit contenir au moins 12 caractères'
    }));
  }
  
  // ============================================
  // 3. Vérification de la clé d'installation
  // ============================================
  if (installKey !== INSTALL_KEY) {
    console.warn('[INSTALL] Tentative avec clé invalide');
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Clé d\'installation invalide'
    }));
  }
  
  // ============================================
  // 4. Vérifier qu'aucun admin n'existe déjà
  // ============================================
  try {
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin_jtec')
      .limit(1);
    
    if (checkError) {
      console.error('[INSTALL] Erreur vérification admin existant:', checkError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la vérification des admins existants'
      }));
    }
    
    if (existingAdmin && existingAdmin.length > 0) {
      console.warn('[INSTALL] Tentative de création alors qu\'un admin existe déjà:', existingAdmin[0].email);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Un admin JTEC existe déjà. Installation déjà effectuée. Si vous avez perdu vos accès, contactez le support technique.'
      }));
    }
  } catch (error) {
    console.error('[INSTALL] Exception lors vérification admin:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur serveur lors de la vérification'
    }));
  }
  
  // ============================================
  // 5. Créer le compte admin dans auth.users
  // ============================================
  let userId;
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email confirmé automatiquement
      user_metadata: { 
        language: 'fr',
        created_via: 'install_script',
        installation_date: new Date().toISOString()
      }
    });
    
    if (authError) {
      console.error('[INSTALL] Erreur création auth.users:', authError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la création du compte: ' + authError.message
      }));
    }
    
    userId = authData.user.id;
    console.log('[INSTALL] Compte auth créé:', userId);
  } catch (error) {
    console.error('[INSTALL] Exception création auth:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur serveur lors de la création du compte'
    }));
  }
  
  // ============================================
  // 6. Créer le profil admin_jtec (code métier)
  // ============================================
  try {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        role: 'admin_jtec',
        language: 'fr',
        is_demo: false
      });
    
    if (profileError) {
      console.error('[INSTALL] Erreur création profil admin:', profileError);
      
      // Rollback : supprimer le compte auth créé
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la création du profil administrateur. Compte supprimé. Réessayez.'
      }));
    }
    
    console.log('[INSTALL] ✅ Profil admin_jtec créé avec succès');
  } catch (error) {
    console.error('[INSTALL] Exception création profil:', error);
    
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(userId);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur serveur lors de la création du profil administrateur'
    }));
  }
  
  // ============================================
  // 7. Vérification finale
  // ============================================
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();
    
    if (!profile || profile.role !== 'admin_jtec') {
      console.error('[INSTALL] Vérification finale échouée:', profile);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le compte a été créé mais la vérification a échoué'
      }));
    }
    
    console.log('[INSTALL] ✅ Vérification finale réussie');
  } catch (error) {
    console.error('[INSTALL] Erreur vérification finale:', error);
  }
  
  // ============================================
  // 8. Succès
  // ============================================
  console.log('[INSTALL] ========================================');
  console.log('[INSTALL] ✅ ADMIN JTEC CRÉÉ AVEC SUCCÈS');
  console.log('[INSTALL] Email:', email);
  console.log('[INSTALL] ID:', userId);
  console.log('[INSTALL] ⚠️ IMPORTANT: Supprimez la variable INSTALL_ADMIN_KEY');
  console.log('[INSTALL] ========================================');
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message: 'Admin JTEC créé avec succès',
    admin_id: userId,
    admin_email: email,
    warning: 'IMPORTANT: Supprimez maintenant la variable INSTALL_ADMIN_KEY de votre .env pour sécuriser votre installation'
  }));
};
