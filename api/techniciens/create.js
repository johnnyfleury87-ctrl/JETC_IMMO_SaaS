/**
 * ======================================================
 * POST /api/techniciens/create
 * ======================================================
 * Crée un nouveau technicien lié à une entreprise
 * SÉCURISÉ : Uniquement entreprise propriétaire
 * ======================================================
 */

const { supabaseAdmin } = require('../_supabase');

module.exports = async (req, res) => {
  // 1️⃣ Vérifier méthode HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2️⃣ Vérifier authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('[API /techniciens/create] Erreur auth:', authError);
      return res.status(401).json({ error: 'Token invalide' });
    }

    // 3️⃣ Vérifier rôle entreprise
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, entreprise_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[API /techniciens/create] Profile introuvable:', profileError);
      return res.status(403).json({ error: 'Profile introuvable' });
    }

    if (profile.role !== 'entreprise') {
      console.warn('[API /techniciens/create] Tentative non-entreprise:', profile.role);
      return res.status(403).json({ error: 'Action réservée aux entreprises' });
    }

    // 🔍 Récupérer entreprise_id : essayer d'abord depuis profile.entreprise_id
    let entrepriseId = profile.entreprise_id;
    
    // Si entreprise_id n'est pas dans le profile, chercher via entreprises.profile_id
    if (!entrepriseId) {
      console.log('[API /techniciens/create] entreprise_id NULL dans profile, recherche via entreprises.profile_id...');
      
      const { data: entreprise, error: entError } = await supabaseAdmin
        .from('entreprises')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      
      if (entError || !entreprise) {
        console.error('[API /techniciens/create] ❌ Aucune entreprise liée:', {
          user_id: user.id,
          profile_email: user.email,
          profile_role: profile.role,
          profile_entreprise_id: profile.entreprise_id,
          error: entError?.message
        });
        
        return res.status(403).json({ 
          error: 'Aucune entreprise liée à votre compte',
          debug: process.env.NODE_ENV === 'development' ? {
            user_id: user.id,
            profile_role: profile.role,
            suggestion: 'Exécuter le script SQL de correction pour lier une entreprise'
          } : undefined
        });
      }
      
      entrepriseId = entreprise.id;
      console.log('[API /techniciens/create] ✅ entreprise_id trouvé via table entreprises:', entrepriseId);
    } else {
      console.log('[API /techniciens/create] ✅ entreprise_id depuis profile:', entrepriseId);
    }

    // 4️⃣ Récupérer données du body
    const { nom, prenom, email, telephone, specialites } = req.body;

    // Validation
    if (!nom || !prenom || !email) {
      return res.status(400).json({ 
        error: 'Champs obligatoires manquants',
        required: ['nom', 'prenom', 'email']
      });
    }

    // 5️⃣ Créer user Auth
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true, // Auto-confirmer l'email
      user_metadata: {
        nom,
        prenom,
        role: 'technicien'
      }
    });

    if (createAuthError) {
      console.error('[API /techniciens/create] Erreur création auth:', createAuthError);
      return res.status(500).json({ 
        error: 'Erreur création utilisateur Auth',
        details: createAuthError.message 
      });
    }

    console.log('[API /techniciens/create] User auth créé:', authUser.user.id);

    // 6️⃣ Créer profile avec role=technicien
    const { error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email: email,
        role: 'technicien'
      });

    if (createProfileError) {
      console.error('[API /techniciens/create] Erreur création profile:', createProfileError);
      
      // Rollback : supprimer user auth
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return res.status(500).json({ 
        error: 'Erreur création profile',
        details: createProfileError.message 
      });
    }

    console.log('[API /techniciens/create] Profile créé:', authUser.user.id);

    // 7️⃣ Créer technicien lié à l'entreprise
    const { data: technicien, error: createTechError } = await supabaseAdmin
      .from('techniciens')
      .insert({
        profile_id: authUser.user.id,
        entreprise_id: entrepriseId, // Utiliser la variable récupérée
        nom,
        prenom,
        email,
        telephone,
        specialites: specialites || [],
        actif: true
      })
      .select()
      .single();

    if (createTechError) {
      console.error('[API /techniciens/create] Erreur création technicien:', createTechError);
      
      // Rollback : supprimer profile + user auth
      await supabaseAdmin.from('profiles').delete().eq('id', authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return res.status(500).json({ 
        error: 'Erreur création technicien',
        details: createTechError.message 
      });
    }

    console.log('[API /techniciens/create] Technicien créé:', technicien.id);

    // 8️⃣ Retourner succès
    res.status(201).json({
      success: true,
      technicien: {
        id: technicien.id,
        nom,
        prenom,
        email,
        telephone,
        specialites: technicien.specialites,
        entreprise_id: technicien.entreprise_id,
        created_at: technicien.created_at
      }
    });

  } catch (error) {
    console.error('[API /techniciens/create] Erreur inattendue:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};
