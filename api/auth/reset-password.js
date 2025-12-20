/**
 * API - Réinitialisation mot de passe (SANS EMAIL)
 * 
 * Workflow :
 * 1. Vérifier que l'email existe et correspond à un locataire
 * 2. Générer nouveau mot de passe temporaire
 * 3. Mettre à jour auth.users avec nouveau mot de passe
 * 4. Invalider ancien mot de passe temporaire (remplacé)
 * 5. Retourner le nouveau mot de passe EN CLAIR (une seule fois)
 * 
 * ⚠️ IMPORTANT :
 * - Fonctionne SANS envoi d'email (autonome)
 * - Préparé pour intégration email future
 * - Le mot de passe est affiché à l'écran (responsabilité utilisateur de le noter)
 * 
 * Route : POST /api/auth/reset-password
 */

const { supabaseAdmin } = require('../_supabase');
const { createTempPassword, TEMP_PASSWORD_EXPIRY_DAYS } = require('../services/passwordService');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // ============================================
    // 1. RÉCUPÉRER EMAIL
    // ============================================

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email obligatoire' });
    }

    // ============================================
    // 2. VÉRIFIER QUE L'EMAIL EXISTE
    // ============================================

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      // Sécurité : Ne pas révéler si l'email existe ou non
      return res.status(200).json({
        success: true,
        message: 'Si cet email existe, un nouveau mot de passe a été généré.'
      });
    }

    // Vérifier que c'est un locataire
    if (profile.role !== 'locataire') {
      return res.status(200).json({
        success: true,
        message: 'Si cet email existe, un nouveau mot de passe a été généré.'
      });
    }

    // ============================================
    // 3. GÉNÉRER NOUVEAU MOT DE PASSE TEMPORAIRE
    // ============================================

    const { password: newTempPassword, expiresAt } = await createTempPassword(
      profile.id, 
      profile.id // Créé par le locataire lui-même (self-service)
    );

    // ============================================
    // 4. METTRE À JOUR AUTH.USERS
    // ============================================

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      {
        password: newTempPassword
      }
    );

    if (updateAuthError) {
      console.error('[RESET PASSWORD] Erreur mise à jour auth.users:', updateAuthError);
      return res.status(500).json({ 
        error: 'Erreur lors de la réinitialisation du mot de passe' 
      });
    }

    // ============================================
    // 5. SUCCÈS - RETOURNER MOT DE PASSE
    // ============================================

    return res.status(200).json({
      success: true,
      email: email,
      temporary_password: {
        password: newTempPassword, // Mot de passe EN CLAIR (une seule fois)
        expires_at: expiresAt,
        expires_in_days: TEMP_PASSWORD_EXPIRY_DAYS
      },
      message: `Nouveau mot de passe temporaire généré pour ${email}`,
      instructions: 'Notez ce mot de passe. Il expirera dans ' + TEMP_PASSWORD_EXPIRY_DAYS + ' jours. Pensez à le changer après connexion.'
    });

  } catch (error) {
    console.error('[RESET PASSWORD] Erreur globale:', error);
    return res.status(500).json({ 
      error: 'Erreur serveur interne',
      details: error.message 
    });
  }
};
