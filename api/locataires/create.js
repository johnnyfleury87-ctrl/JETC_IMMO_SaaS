/**
 * API - Créer un locataire
 * 
 * Workflow :
 * 1. Vérifier authentification + rôle régie
 * 2. Créer utilisateur Supabase Auth (admin SDK)
 * 3. Créer profile avec role='locataire'
 * 4. Appeler RPC creer_locataire_complet()
 * 
 * Route : POST /api/locataires/create
 */

const { supabaseAdmin, checkUserRole } = require('../_supabase');

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

    // ============================================
    // 2. RÉCUPÉRER DONNÉES FORMULAIRE
    // ============================================

    const {
      nom,
      prenom,
      email,
      mot_de_passe,
      logement_id,
      date_entree,
      telephone,
      date_naissance,
      contact_urgence_nom,
      contact_urgence_telephone
    } = req.body;

    // Validation
    if (!nom || !prenom || !email || !mot_de_passe || !logement_id || !date_entree) {
      return res.status(400).json({ 
        error: 'Champs obligatoires manquants',
        required: ['nom', 'prenom', 'email', 'mot_de_passe', 'logement_id', 'date_entree']
      });
    }

    if (mot_de_passe.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // ============================================
    // 3. CRÉER UTILISATEUR SUPABASE AUTH
    // ============================================

    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: mot_de_passe,
      email_confirm: true, // Confirmer email automatiquement
      user_metadata: {
        nom: nom,
        prenom: prenom
      }
    });

    if (createAuthError) {
      console.error('[CREATE LOCATAIRE] Erreur création auth.users:', createAuthError);
      return res.status(400).json({ 
        error: `Erreur création compte : ${createAuthError.message}` 
      });
    }

    const profileId = authUser.user.id;

    try {
      // ============================================
      // 4. CRÉER PROFILE
      // ============================================

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: profileId,
          email: email,
          role: 'locataire'
        });

      if (profileError) {
        // Rollback : supprimer auth.users
        await supabaseAdmin.auth.admin.deleteUser(profileId);
        throw new Error(`Erreur création profile : ${profileError.message}`);
      }

      // ============================================
      // 5. APPELER RPC creer_locataire_complet()
      // ============================================

      // Se connecter en tant que régie (pour bypass RLS dans RPC)
      const { data: rpcResult, error: rpcError } = await supabaseAdmin
        .rpc('creer_locataire_complet', {
          p_nom: nom,
          p_prenom: prenom,
          p_email: email,
          p_profile_id: profileId,
          p_logement_id: logement_id,
          p_date_entree: date_entree,
          p_telephone: telephone || null,
          p_date_naissance: date_naissance || null,
          p_contact_urgence_nom: contact_urgence_nom || null,
          p_contact_urgence_telephone: contact_urgence_telephone || null
        });

      if (rpcError) {
        // Rollback : supprimer profile + auth.users
        await supabaseAdmin.from('profiles').delete().eq('id', profileId);
        await supabaseAdmin.auth.admin.deleteUser(profileId);
        throw new Error(`Erreur RPC : ${rpcError.message}`);
      }

      // ============================================
      // 6. SUCCÈS
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
        message: `Locataire ${nom} ${prenom} créé avec succès`
      });

    } catch (rpcErrorCatch) {
      // Rollback si RPC échoue
      console.error('[CREATE LOCATAIRE] Rollback après erreur RPC:', rpcErrorCatch);
      
      // Supprimer auth.users (cascade supprimera profile)
      await supabaseAdmin.auth.admin.deleteUser(profileId);

      return res.status(500).json({ 
        error: rpcErrorCatch.message || 'Erreur lors de la création du locataire' 
      });
    }

  } catch (error) {
    console.error('[CREATE LOCATAIRE] Erreur globale:', error);
    return res.status(500).json({ 
      error: 'Erreur serveur interne',
      details: error.message 
    });
  }
};
