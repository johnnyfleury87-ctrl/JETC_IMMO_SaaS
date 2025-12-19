/**
 * ROUTE API : REGISTER (Inscription)
 * 
 * Objectif : Créer un nouveau compte utilisateur
 * 
 * Méthode : POST
 * Body : { email, password, language?, nomAgence, nbCollaborateurs, nbLogements, siret? }
 * 
 * Processus (transaction atomique avec rollback) :
 * 1. Validation des données
 * 2. Création utilisateur via Supabase Auth
 * 3. Création profil dans public.profiles (code métier)
 * 4. Création régie dans public.regies (statut en_attente)
 * 5. Rollback complet en cas d'erreur à n'importe quelle étape
 * 
 * Erreurs gérées :
 * - Email invalide
 * - Mot de passe trop faible
 * - Email déjà utilisé
 * - Champs métier manquants/invalides
 * - Erreur Supabase (avec rollback)
 */

const { supabaseAdmin } = require('../_supabase');
const { sendEmail } = require('../services/emailService');
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
    
    const userId = authData.user.id;
    console.log('[AUTH/REGISTER] Utilisateur auth créé:', userId);
    
    // ============================================
    // ÉTAPE 2 : Créer le profil (code métier)
    // ============================================
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        role: 'regie',
        language: language,
        is_demo: false
      });
    
    if (profileError) {
      console.error('[AUTH/REGISTER] Erreur création profil:', profileError);
      
      // Rollback : supprimer l'utilisateur auth
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la création du profil utilisateur'
      }));
    }
    
    console.log('[AUTH/REGISTER] Profil créé avec succès (role: regie)');
    
    // ============================================
    // ÉTAPE 3 : Créer la régie
    // ============================================
    const { error: regieError } = await supabaseAdmin
      .from('regies')
      .insert({
        profile_id: userId,
        nom: nomAgence.trim(),
        email: email,
        nb_collaborateurs: parseInt(nbCollaborateurs),
        nb_logements_geres: parseInt(nbLogements),
        siret: siret || null,
        statut_validation: 'en_attente'
      });
    
    if (regieError) {
      console.error('[AUTH/REGISTER] Erreur création régie:', regieError);
      
      // Rollback : supprimer profil + utilisateur auth
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Erreur lors de la création de l\'agence'
      }));
    }
    
    console.log('[AUTH/REGISTER] Régie créée avec succès (statut: en_attente)');
    
    // ============================================
    // ÉTAPE 4 : Envoyer l'email de confirmation
    // ============================================
    console.log('[AUTH/REGISTER] Envoi email de confirmation...');
    
    const emailResult = await sendEmail(
      email,
      'adhesion_demande',
      {
        email: email,
        nomAgence: nomAgence.trim(),
        nbCollaborateurs: parseInt(nbCollaborateurs),
        nbLogements: parseInt(nbLogements),
        siret: siret || null
      },
      language
    );
    
    if (!emailResult.success) {
      console.warn('[AUTH/REGISTER] ⚠️ Erreur envoi email (non bloquant):', emailResult.error);
      // On ne bloque pas l'inscription si l'email échoue
    } else {
      console.log('[AUTH/REGISTER] ✅ Email de confirmation envoyé');
    }
    
    // ============================================
    // ÉTAPE 5 : Succès complet
    // ============================================
    
    console.log('[AUTH/REGISTER] ✅ Inscription complète:', {
      userId: userId,
      email: email,
      role: 'regie',
      statut: 'en_attente'
    });
    
    // Succès
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      user: {
        id: userId,
        email: email,
        role: 'regie',
        language: language,
        created_at: authData.user.created_at
      },
      message: 'Inscription réussie. Votre agence est en attente de validation par l\'équipe JETC_IMMO. Vous recevrez un email dès validation.'
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
