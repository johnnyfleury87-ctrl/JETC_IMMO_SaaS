/**
 * API VERCEL FUNCTION - Créer entreprise avec compte Auth complet
 * 
 * Endpoint: /api/regie/create-entreprise-account
 * Méthode: POST
 * Auth: Bearer token (régie)
 * 
 * Workflow:
 * 1. Vérifier que l'utilisateur est une régie
 * 2. Créer user Auth Supabase (via admin API)
 * 3. Créer profile (role='entreprise')
 * 4. Appeler RPC create_entreprise_with_profile
 * 5. Retourner entreprise_id + credentials temporaires
 */

const { getAdminClient, getUserClient, verifyToken, getUserProfile } = require('../lib/supabaseServer');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[CREATE-ENTREPRISE] Step 0: Request received');

  try {
    // Obtenir les clients Supabase (valide env vars)
    console.log('[CREATE-ENTREPRISE] Step 1: Initializing Supabase clients');
    const supabaseAdmin = getAdminClient();
    console.log('[CREATE-ENTREPRISE] Step 1.1: Admin client OK');

    // =======================================================
    // 2. AUTHENTIFICATION & VALIDATION
    // =======================================================
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Vérifier le token
    console.log('[CREATE-ENTREPRISE] Step 2: Verifying token');
    const { user, error: userError } = await verifyToken(token);
    if (userError || !user) {
      console.error('[CREATE-ENTREPRISE] Step 2 FAILED: Auth error:', userError);
      return res.status(401).json({ error: 'Token invalide' });
    }

    console.log('[CREATE-ENTREPRISE] Step 2 OK: User authenticated:', user.id);

    // Récupérer et vérifier le profil
    console.log('[CREATE-ENTREPRISE] Step 3: Fetching user profile');
    const { profile, error: profileError } = await getUserProfile(user.id);
    if (profileError || !profile) {
      console.error('[CREATE-ENTREPRISE] Step 3 FAILED: Profile error:', profileError);
      return res.status(403).json({ error: 'Profil non trouvé' });
    }

    if (profile.role !== 'regie') {
      console.error('[CREATE-ENTREPRISE] Step 3 FAILED: Wrong role:', profile.role);
      return res.status(403).json({ error: 'Accès réservé aux régies' });
    }

    console.log('[CREATE-ENTREPRISE] Step 3 OK: Regie validated:', profile.regie_id);

    const supabaseUserContext = getUserClient(token);
    console.log('[CREATE-ENTREPRISE] Step 3.1: User context client OK');

    // =======================================================
    // 2. EXTRACTION DONNÉES ENTREPRISE
    // =======================================================
    
    const {
      nom,
      email,
      telephone = null,
      adresse = null,
      code_postal = null,
      ville = null,
      siret = null,
      description = null,
      mode_diffusion = 'restreint'
    } = req.body;

    console.log('[CREATE-ENTREPRISE] Step 4: Extracting body params', { nom, email, mode_diffusion });

    // Validation
    if (!nom || !email) {
      return res.status(400).json({ error: 'Nom et email obligatoires' });
    }

    if (mode_diffusion && !['general', 'restreint'].includes(mode_diffusion)) {
      console.error('[CREATE-ENTREPRISE] Step 4 FAILED: Invalid mode_diffusion:', mode_diffusion);
      return res.status(400).json({ 
        error: 'mode_diffusion doit être general ou restreint',
        received: mode_diffusion,
        allowed: ['general', 'restreint']
      });
    }

    console.log('[CREATE-ENTREPRISE] Step 4 OK: Validation passed');

    // =======================================================
    // 5. CRÉER USER AUTH SUPABASE (ADMIN API)
    // =======================================================
    
    console.log('[CREATE-ENTREPRISE] Step 5: Creating Auth user for:', email);

    // Générer mot de passe temporaire sécurisé
    const tempPassword = generateTempPassword();

    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: false, // Email non confirmé (activation requise)
      user_metadata: {
        role: 'entreprise',
        created_by: 'regie',
        regie_id: profile.regie_id
      }
    });

    if (createUserError) {
      console.error('[CREATE-ENTREPRISE] Step 5 FAILED:', createUserError);
      return res.status(500).json({ 
        error: 'Erreur création compte Auth', 
        details: createUserError.message 
      });
    }

    const newUserId = newUser.user.id;
    console.log('[CREATE-ENTREPRISE] Step 5 OK: Auth user created:', newUserId);

    // =======================================================
    // 6. CRÉER PROFILE (via RLS - policy M29 autorise)
    // =======================================================
    
    console.log('[CREATE-ENTREPRISE] Step 6: Inserting profile for user:', newUserId);
    
    const { data: newProfile, error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        email: email,
        role: 'entreprise',
        regie_id: profile.regie_id // Référence à la régie créatrice
      })
      .select()
      .single();

    if (profileInsertError) {
      console.error('[CREATE-ENTREPRISE] Step 6 FAILED:', profileInsertError);
      
      // ROLLBACK: Supprimer user Auth créé
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      
      return res.status(500).json({ 
        error: 'Erreur création profile', 
        details: profileInsertError.message 
      });
    }

    console.log('[CREATE-ENTREPRISE] Step 6 OK: Profile created');

    // =======================================================
    // 7. CRÉER ENTREPRISE + LIEN (via RPC M30)
    // =======================================================
    
    console.log('[CREATE-ENTREPRISE] Step 7: Calling RPC create_entreprise_with_profile', {
      profile_id: newUserId,
      mode_diffusion
    });
    
    const { data: entrepriseId, error: rpcError } = await supabaseUserContext.rpc('create_entreprise_with_profile', {
      p_profile_id: newUserId,
      p_nom: nom,
      p_email: email,
      p_telephone: telephone,
      p_adresse: adresse,
      p_code_postal: code_postal,
      p_ville: ville,
      p_siret: siret,
      p_description: description,
      p_mode_diffusion: mode_diffusion
    });

    if (rpcError) {
      console.error('[CREATE-ENTREPRISE] Step 7 FAILED: RPC error:', rpcError);
      
      // ROLLBACK: Supprimer profile + user Auth
      console.log('[CREATE-ENTREPRISE] Rolling back: deleting profile and auth user');
      await supabaseAdmin.from('profiles').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      
      return res.status(500).json({ 
        error: 'Erreur création entreprise', 
        details: rpcError.message,
        hint: rpcError.hint,
        code: rpcError.code
      });
    }

    console.log('[CREATE-ENTREPRISE] Step 7 OK: Entreprise created:', entrepriseId);

    // =======================================================
    // 8. RETOUR SUCCÈS
    // =======================================================
    
    console.log('[CREATE-ENTREPRISE] Step 8: Success response');
    
    return res.status(201).json({
      success: true,
      entreprise_id: entrepriseId,
      profile_id: newUserId,
      credentials: {
        email: email,
        temp_password: tempPassword,
        reset_required: true
      },
      message: 'Entreprise créée avec succès'
    });

  } catch (error) {
    console.error('[CREATE-ENTREPRISE-ACCOUNT] Erreur:', error);
    return res.status(500).json({ 
      error: 'Erreur serveur', 
      details: error.message 
    });
  }
}

/**
 * Génère un mot de passe temporaire sécurisé
 * Format: 12 caractères alphanumériques + symboles
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
