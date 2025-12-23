/**
 * SERVICE - Génération et gestion des mots de passe temporaires
 * 
 * VERSION SIMPLIFIÉE : Mot de passe fixe Test1234!
 * 
 * Sécurité :
 * - Supabase Auth hashe automatiquement le mot de passe dans auth.users
 * - Table temporary_passwords protégée par RLS
 * - Expiration après 7 jours
 * - Marqué is_used après première connexion
 * 
 * NOTE : Mot de passe fixe pour développement/test uniquement
 */

const { supabaseAdmin } = require('../_supabase');

// Configuration
const TEMP_PASSWORD_EXPIRY_DAYS = 7;
const DEFAULT_TEMP_PASSWORD = 'Test1234!'; // Mot de passe fixe pour tests

/**
 * Génère un mot de passe temporaire (fixe pour le moment)
 * @returns {string} Mot de passe en clair
 */
function generateTempPassword() {
  return DEFAULT_TEMP_PASSWORD;
}

/**
 * Crée ou remplace un mot de passe temporaire pour un locataire
 * STOCKÉ EN CLAIR (Supabase Auth hashe automatiquement dans auth.users)
 * @param {string} profileId - UUID du profile locataire
 * @param {string} createdByUserId - UUID de la régie qui crée
 * @returns {Promise<{password: string, expiresAt: Date}>}
 */
async function createTempPassword(profileId, createdByUserId) {
  // Mot de passe fixe pour le moment
  const tempPassword = generateTempPassword();
  
  // Calculer expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEMP_PASSWORD_EXPIRY_DAYS);
  
  // Tentative d'upsert dans temporary_passwords (NON BLOQUANT si table absente)
  try {
    const { error } = await supabaseAdmin
      .from('temporary_passwords')
      .upsert({
        profile_id: profileId,
        password_clear: tempPassword,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        used_at: null,
        created_by: createdByUserId,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'profile_id'
      });
    
    if (error) {
      console.warn('[passwordService] Table temporary_passwords absente ou erreur:', error.message);
      // NON BLOQUANT : on continue sans stocker
    }
  } catch (tableError) {
    console.warn('[passwordService] Table temporary_passwords non disponible:', tableError.message);
    // NON BLOQUANT : le mot de passe sera quand même retourné
  }
  
  return {
    password: tempPassword,
    expiresAt: expiresAt
  };
}

/**
 * Récupère le mot de passe temporaire d'un locataire
 * @param {string} profileId - UUID du profile
 * @returns {Promise<object|null>}
 */
async function getTempPassword(profileId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('temporary_passwords')
      .select('*')
      .eq('profile_id', profileId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      profileId: data.profile_id,
      passwordClear: data.password_clear,
      expiresAt: new Date(data.expires_at),
      isUsed: data.is_used,
      usedAt: data.used_at ? new Date(data.used_at) : null
    };
  } catch (error) {
    console.warn('[passwordService] getTempPassword error:', error.message);
    return null;
  }
}

/**
 * Marque un mot de passe temporaire comme utilisé
 * @param {string} profileId - UUID du profile locataire
 * @returns {Promise<void>}
 */
async function markTempPasswordAsUsed(profileId) {
  try {
    await supabaseAdmin
      .from('temporary_passwords')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('profile_id', profileId);
  } catch (error) {
    console.warn('[passwordService] markTempPasswordAsUsed error:', error.message);
  }
}

/**
 * Supprime le mot de passe temporaire (après changement permanent)
 * @param {string} profileId - UUID du profile locataire
 * @returns {Promise<void>}
 */
async function deleteTempPassword(profileId) {
  try {
    await supabaseAdmin
      .from('temporary_passwords')
      .delete()
      .eq('profile_id', profileId);
  } catch (error) {
    console.warn('[passwordService] deleteTempPassword error:', error.message);
  }
}

/**
 * Vérifie si un mot de passe temporaire est valide
 * @param {string} profileId - UUID du profile
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
async function validateTempPassword(profileId, password) {
  const tempPwd = await getTempPassword(profileId);
  
  if (!tempPwd) {
    return { valid: false, reason: 'Aucun mot de passe temporaire trouvé' };
  }
  
  // Vérifier expiration
  if (new Date() > tempPwd.expiresAt) {
    return { valid: false, reason: 'Mot de passe temporaire expiré' };
  }
  
  // Vérifier mot de passe (comparaison en clair)
  if (password !== tempPwd.passwordClear) {
    return { valid: false, reason: 'Mot de passe incorrect' };
  }
  
  return { valid: true };
}

module.exports = {
  generateTempPassword,
  createTempPassword,
  getTempPassword,
  markTempPasswordAsUsed,
  deleteTempPassword,
  validateTempPassword,
  TEMP_PASSWORD_EXPIRY_DAYS
};
