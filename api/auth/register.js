/**
 * ROUTE API : REGISTER (Inscription)
 * 
 * Objectif : Créer un nouveau compte utilisateur
 * 
 * Méthode : POST
 * Body : { email, password, language? }
 * 
 * Processus :
 * 1. Validation des données
 * 2. Création utilisateur via Supabase Auth
 * 3. Le trigger crée automatiquement le profil
 * 4. Récupération du profil créé
 * 5. Retour des infos utilisateur
 * 
 * Erreurs gérées :
 * - Email invalide
 * - Mot de passe trop faible
 * - Email déjà utilisé
 * - Erreur Supabase
 */

const { supabaseAdmin } = require('../_supabase');
require('dotenv').config();

module.exports = async (req, res) => {
  console.log('[AUTH/REGISTER] Requête reçue');
  
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
    
    const { email, password, language = 'fr' } = JSON.parse(body);
    
    console.log('[AUTH/REGISTER] Tentative inscription:', email);
    
    // Validation des données
    if (!email || !email.includes('@')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Email invalide'
      }));
    }
    
    if (!password || password.length < 6) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      }));
    }
    
    if (!['fr', 'en', 'de'].includes(language)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Langue non supportée. Utilisez fr, en ou de.'
      }));
    }
    
    // Création de l'utilisateur via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirme l'email en développement
      user_metadata: {
        language: language
      }
    });
    
    if (authError) {
      console.error('[AUTH/REGISTER] Erreur Supabase Auth:', authError);
      
      // Gestion des erreurs spécifiques
      if (authError.message.includes('already registered')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'Cet email est déjà utilisé'
        }));
      }
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la création du compte',
        details: authError.message
      }));
    }
    
    const user = authData.user;
    console.log('[AUTH/REGISTER] Utilisateur créé:', user.id);
    
    // Attendre un peu que le trigger crée le profil
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Récupération du profil créé par le trigger
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('[AUTH/REGISTER] Erreur récupération profil:', profileError);
      // Profil devrait exister grâce au trigger
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Compte créé mais profil non trouvé',
        userId: user.id
      }));
    }
    
    console.log('[AUTH/REGISTER] Inscription réussie:', {
      userId: user.id,
      email: user.email,
      role: profile.role
    });
    
    // Succès
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile.role,
        language: profile.language,
        created_at: user.created_at
      },
      message: 'Inscription réussie. Vous pouvez maintenant vous connecter.'
    }));
    
  } catch (error) {
    console.error('[AUTH/REGISTER] Erreur:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    }));
  }
};
