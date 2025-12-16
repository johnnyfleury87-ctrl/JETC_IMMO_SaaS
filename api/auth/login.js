/**
 * ROUTE API : LOGIN (Connexion)
 * 
 * Objectif : Authentifier un utilisateur existant
 * 
 * Méthode : POST
 * Body : { email, password }
 * 
 * Processus :
 * 1. Validation des données
 * 2. Authentification via Supabase Auth
 * 3. Récupération du profil utilisateur
 * 4. Retour des infos + session
 * 
 * Erreurs gérées :
 * - Email/mot de passe manquant
 * - Identifiants incorrects
 * - Profil non trouvé
 * - Erreur Supabase
 */

const { supabaseAdmin } = require('../_supabase');
require('dotenv').config();

module.exports = async (req, res) => {
  console.log('[AUTH/LOGIN] Requête reçue');
  
  // Vérification méthode
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Méthode non autorisée. Utilisez POST.'
    }));
  }

  try {
    // Lecture du body
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }
    
    const { email, password } = JSON.parse(body);
    
    console.log('[AUTH/LOGIN] Tentative connexion:', email);
    
    // Validation des données
    if (!email || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Email et mot de passe requis'
      }));
    }
    
    // Récupérer l'utilisateur depuis auth.users
    const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('[AUTH/LOGIN] Erreur liste utilisateurs:', getUserError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la connexion'
      }));
    }
    
    // Trouver l'utilisateur par email
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.log('[AUTH/LOGIN] Utilisateur non trouvé:', email);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Email ou mot de passe incorrect'
      }));
    }
    
    // Vérifier le mot de passe en créant une session
    const { createClient } = require('@supabase/supabase-js');
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (signInError) {
      console.error('[AUTH/LOGIN] Erreur authentification:', signInError.message);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Email ou mot de passe incorrect'
      }));
    }
    
    const authenticatedUser = signInData.user;
    const session = signInData.session;
    
    console.log('[AUTH/LOGIN] Authentification réussie:', authenticatedUser.id);
    
    // Récupération du profil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authenticatedUser.id)
      .single();
    
    if (profileError || !profile) {
      console.error('[AUTH/LOGIN] Profil non trouvé:', profileError);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Profil utilisateur non trouvé',
        userId: authenticatedUser.id
      }));
    }
    
    console.log('[AUTH/LOGIN] Connexion réussie:', {
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      role: profile.role
    });
    
    // Succès
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        role: profile.role,
        language: profile.language,
        regie_id: profile.regie_id,
        entreprise_id: profile.entreprise_id,
        logement_id: profile.logement_id
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
      },
      message: 'Connexion réussie'
    }));
    
  } catch (error) {
    console.error('[AUTH/LOGIN] Erreur:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    }));
  }
};
