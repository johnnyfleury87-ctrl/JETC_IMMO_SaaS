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
    
    const { email, password, language = 'fr', nomAgence, nbCollaborateurs, nbLogements, siret } = JSON.parse(body);
    
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
    
    // NOUVEAU : Validation des champs métier
    if (!nomAgence || nomAgence.trim().length < 3) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le nom de l\'agence doit contenir au moins 3 caractères'
      }));
    }
    
    if (!nbCollaborateurs || parseInt(nbCollaborateurs) < 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le nombre de collaborateurs doit être au moins 1'
      }));
    }
    
    if (!nbLogements || parseInt(nbLogements) < 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le nombre de logements gérés doit être au moins 1'
      }));
    }
    
    if (siret && (siret.length !== 14 || !/^\d{14}$/.test(siret))) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Le numéro SIRET doit contenir exactement 14 chiffres'
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
    
    // NOUVEAU : Si le rôle est régie, créer l'entrée dans la table regies
    if (profile.role === 'regie') {
      console.log('[AUTH/REGISTER] Création de la régie pour le profil:', user.id);
      
      const { error: regieError } = await supabaseAdmin
        .from('regies')
        .insert({
          profile_id: user.id,
          nom: nomAgence.trim(),
          email: email,
          nb_collaborateurs: parseInt(nbCollaborateurs),
          nb_logements_geres: parseInt(nbLogements),
          siret: siret || null,
          statut_validation: 'en_attente' // Par défaut en attente de validation
        });
      
      if (regieError) {
        console.error('[AUTH/REGISTER] Erreur création régie:', regieError);
        
        // Rollback : supprimer l'utilisateur créé
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'Erreur lors de la création de l\'agence',
          details: regieError.message
        }));
      }
      
      console.log('[AUTH/REGISTER] Régie créée avec succès (statut: en_attente)');
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
      message: profile.role === 'regie' 
        ? 'Inscription réussie. Votre agence est en attente de validation par l\'équipe JETC_IMMO. Vous recevrez un email dès validation.'
        : 'Inscription réussie. Vous pouvez maintenant vous connecter.'
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
