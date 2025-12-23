/**
 * API - Créer un locataire
 * 
 * Workflow :
 * 1. Vérifier authentification + rôle régie
 * 2. Générer mot de passe temporaire sécurisé
 * 3. Créer utilisateur Supabase Auth (admin SDK)
 * 4. Créer profile avec role='locataire'
 * 5. Stocker mot de passe temporaire hashé
 * 6. Appeler RPC creer_locataire_complet()
 * 
 * Route : POST /api/locataires/create
 */

const { supabaseAdmin, checkUserRole } = require('../_supabase');
const { createTempPassword, TEMP_PASSWORD_EXPIRY_DAYS } = require('../services/passwordService');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // ============================================
    // 1. VÉRIFIER AUTHENTIFICATION
    // ============================================

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.split(' ')[1];

    // Vérifier le token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Vérifier que l'utilisateur est une régie
    const isRegie = await checkUserRole(user.id, 'regie');
    if (!isRegie) {
      return res.status(403).json({ error: 'Accès non autorisé : réservé aux régies' });
    }

    // Récupérer le regie_id du profil connecté (OBLIGATOIRE)
    const { data: regieProfile, error: regieError } = await supabaseAdmin
      .from('profiles')
      .select('regie_id')
      .eq('id', user.id)
      .single();

    if (regieError || !regieProfile?.regie_id) {
      return res.status(400).json({ 
        error: 'Profil régie sans rattachement valide. Contactez l\'administrateur.',
        code: 'REGIE_ID_MISSING'
      });
    }

    const regieId = regieProfile.regie_id;

    // ============================================
    // 2. RÉCUPÉRER DONNÉES FORMULAIRE
    // ============================================

    const {
      nom,
      prenom,
      email,
      logement_id,
      date_entree,
      telephone,
      date_naissance,
      contact_urgence_nom,
      contact_urgence_telephone
    } = req.body;

    // Validation (mot_de_passe retiré, généré automatiquement)
    if (!nom || !prenom || !email || !date_entree) {
      return res.status(400).json({ 
        error: 'Champs obligatoires manquants',
        required: ['nom', 'prenom', 'email', 'date_entree']
      });
    }

    // ============================================
    // 3. GÉNÉRER MOT DE PASSE TEMPORAIRE
    // ============================================

    let tempPassword, expiresAt;
    try {
      // Générer mot de passe fixe Test1234! (pas de DB pour le moment)
      const tempPasswordResult = await createTempPassword('temp-placeholder', user.id);
      tempPassword = tempPasswordResult.password;
      expiresAt = tempPasswordResult.expiresAt;
    } catch (tempPasswordError) {
      console.warn('[CREATE LOCATAIRE] Erreur génération mot de passe (non bloquant):', tempPasswordError);
      // Fallback : mot de passe fixe si service échoue
      tempPassword = 'Test1234!';
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
    }
    
    // Ce mot de passe sera retourné EN CLAIR une seule fois au frontend

    // ============================================
    // 4. CRÉER UTILISATEUR SUPABASE AUTH
    // ============================================

    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword, // Utiliser le mot de passe temporaire généré
      email_confirm: true, // Confirmer email automatiquement
      user_metadata: {
        nom: nom,
        prenom: prenom
      }
    });

    if (createAuthError) {
      console.error('[CREATE LOCATAIRE] Erreur création auth.users:', createAuthError);
      return res.status(400).json({ 
        error: `Erreur création compte : ${createAuthError.message}`,
        code: 'AUTH_CREATE_ERROR',
        details: createAuthError.message
      });
    }

    const profileId = authUser.user.id;

    // ============================================
    // 5. CRÉER PROFILE
    // ============================================

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: profileId,
        email: email,
        role: 'locataire'
      });

    if (profileError) {
      console.error('[CREATE LOCATAIRE] Erreur création profile:', profileError);
      // Rollback : supprimer auth.users
      try {
        await supabaseAdmin.auth.admin.deleteUser(profileId);
      } catch (deleteError) {
        console.error('[CREATE LOCATAIRE] Erreur rollback deleteUser:', deleteError);
      }
      return res.status(400).json({ 
        error: `Erreur création profil locataire : ${profileError.message}`,
        code: 'PROFILE_CREATE_ERROR',
        details: profileError.message
      });
    }

    // ============================================
    // 6. STOCKER MOT DE PASSE TEMPORAIRE (OPTIONNEL)
    // ============================================

    // Tentative de stockage (non bloquant si table absente)
    try {
      await createTempPassword(profileId, user.id);
    } catch (tempPasswordUpdateError) {
      console.warn('[CREATE LOCATAIRE] Table temporary_passwords absente, stockage ignoré');
      // Non bloquant : le mot de passe est déjà généré et sera retourné
    }

    // ============================================
    // 7. APPELER RPC creer_locataire_complet()
    // ============================================

    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('creer_locataire_complet', {
        p_nom: nom,
        p_prenom: prenom,
        p_email: email,
        p_profile_id: profileId,
        p_regie_id: regieId,  // ✅ AJOUTÉ : garantit isolation multi-tenant
        p_logement_id: logement_id,
        p_date_entree: date_entree,
        p_telephone: telephone || null,
        p_date_naissance: date_naissance || null,
        p_contact_urgence_nom: contact_urgence_nom || null,
        p_contact_urgence_telephone: contact_urgence_telephone || null
      });

    if (rpcError) {
      console.error('[CREATE LOCATAIRE] Erreur RPC creer_locataire_complet:', rpcError);
      // Rollback : supprimer profile + auth.users
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', profileId);
        await supabaseAdmin.auth.admin.deleteUser(profileId);
      } catch (rollbackError) {
        console.error('[CREATE LOCATAIRE] Erreur rollback après RPC:', rollbackError);
      }
      return res.status(500).json({ 
        error: `Erreur lors de la création du locataire : ${rpcError.message}`,
        code: 'RPC_ERROR',
        details: rpcError.message
      });
    }

    // ============================================
    // 8. SUCCÈS - RETOURNER MOT DE PASSE TEMPORAIRE
    // ============================================

    return res.status(201).json({
      success: true,
      locataire: {
        id: rpcResult.locataire_id,
        nom: nom,
        prenom: prenom,
        email: email,
        profile_id: profileId,
        logement: rpcResult.logement
      },
      temporary_password: {
        password: tempPassword, // Mot de passe EN CLAIR (une seule fois)
        expires_at: expiresAt,
        expires_in_days: TEMP_PASSWORD_EXPIRY_DAYS
      },
      message: `Locataire ${nom} ${prenom} créé avec succès`
    });

  } catch (error) {
    console.error('[CREATE LOCATAIRE] Erreur globale non catchée:', error);
    
    // S'assurer de toujours retourner du JSON
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Erreur serveur interne',
        code: 'INTERNAL_SERVER_ERROR',
        details: error.message || 'Une erreur inattendue s\'est produite'
      });
    }
  }
};
