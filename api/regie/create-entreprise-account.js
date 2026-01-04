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

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ADMIN KEY (server-side only)

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

  try {
    // =======================================================
    // 1. AUTHENTIFICATION & VALIDATION
    // =======================================================
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Créer client Supabase avec token utilisateur
    const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    });

    // Vérifier utilisateur
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Vérifier que l'utilisateur est une régie
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role, regie_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Profil non trouvé' });
    }

    if (profile.role !== 'regie') {
      return res.status(403).json({ error: 'Accès réservé aux régies' });
    }

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
      mode_diffusion = 'actif'
    } = req.body;

    // Validation
    if (!nom || !email) {
      return res.status(400).json({ error: 'Nom et email obligatoires' });
    }

    if (mode_diffusion && !['actif', 'silencieux'].includes(mode_diffusion)) {
      return res.status(400).json({ error: 'mode_diffusion doit être actif ou silencieux' });
    }

    // =======================================================
    // 3. CRÉER USER AUTH SUPABASE (ADMIN API)
    // =======================================================
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error('[CREATE-USER] Erreur:', createUserError);
      return res.status(500).json({ 
        error: 'Erreur création compte Auth', 
        details: createUserError.message 
      });
    }

    const newUserId = newUser.user.id;

    // =======================================================
    // 4. CRÉER PROFILE (via RLS - policy M29 autorise)
    // =======================================================
    
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
      console.error('[CREATE-PROFILE] Erreur:', profileInsertError);
      
      // ROLLBACK: Supprimer user Auth créé
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      
      return res.status(500).json({ 
        error: 'Erreur création profile', 
        details: profileInsertError.message 
      });
    }

    // =======================================================
    // 5. CRÉER ENTREPRISE + LIEN (via RPC M29)
    // =======================================================
    
    const { data: entrepriseId, error: rpcError } = await supabaseUser.rpc('create_entreprise_with_profile', {
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
      console.error('[CREATE-ENTREPRISE] Erreur RPC:', rpcError);
      
      // ROLLBACK: Supprimer profile + user Auth
      await supabaseAdmin.from('profiles').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      
      return res.status(500).json({ 
        error: 'Erreur création entreprise', 
        details: rpcError.message 
      });
    }

    // =======================================================
    // 6. RETOUR SUCCÈS
    // =======================================================
    
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
