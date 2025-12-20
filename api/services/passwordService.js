/**
 * SERVICE - Génération et gestion des mots de passe temporaires
 * 
 * Objectif : Centraliser la logique de génération, stockage et validation
 * 
 * Sécurité :
 * - Génération cryptographiquement sécurisée
 * - Hash bcrypt avec salt automatique
 * - Expiration après 7 jours
 * - Un seul mot de passe actif par locataire
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../_supabase');

// Configuration
const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_EXPIRY_DAYS = 7;
const BCRYPT_ROUNDS = 10;

/**
 * Génère un mot de passe temporaire sécurisé
 * @returns {string} Mot de passe en clair (12 caractères)
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const length = TEMP_PASSWORD_LENGTH;
  
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  
  return password;
}

/**
 * Hashe un mot de passe avec bcrypt
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Hash bcrypt
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Vérifie un mot de passe contre un hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash bcrypt
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Crée ou remplace un mot de passe temporaire pour un locataire
 * @param {string} profileId - UUID du profile locataire
 * @param {string} createdByUserId - UUID de la régie qui crée
 * @returns {Promise<{password: string, expiresAt: Date}>}
 */
async function createTempPassword(profileId, createdByUserId) {
  // Générer mot de passe
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  
  // Calculer expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEMP_PASSWORD_EXPIRY_DAYS);
  
  // Upsert dans temporary_passwords (remplace si existe)
  const { error } = await supabaseAdmin
    .from('temporary_passwords')
    .upsert({
      profile_id: profileId,
      password_hash: passwordHash,
      expires_at: expiresAt.toISOString(),
      is_used: false,
      used_at: null,
      created_by: createdByUserId,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'profile_id'
    });
  
  if (error) {
    throw new Error(`Erreur stockage mot de passe temporaire : ${error.message}`);
  }
  
  return {
    password: tempPassword,
    expiresAt: expiresAt
  };
}

/**
 * Récupère le mot de passe temporaire d'un locataire
 * @param {string} profileId - UUID du profile locataire
 * @returns {Promise<{passwordHash: string, expiresAt: Date, isUsed: boolean} | null>}
 */
async function getTempPassword(profileId) {
  const { data, error } = await supabaseAdmin
    .from('temporary_passwords')
    .select('password_hash, expires_at, is_used, used_at')
    .eq('profile_id', profileId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    passwordHash: data.password_hash,
    expiresAt: new Date(data.expires_at),
    isUsed: data.is_used,
    usedAt: data.used_at ? new Date(data.used_at) : null
  };
}

/**
 * Marque un mot de passe temporaire comme utilisé
 * @param {string} profileId - UUID du profile locataire
 * @returns {Promise<void>}
 */
async function markTempPasswordAsUsed(profileId) {
  await supabaseAdmin
    .from('temporary_passwords')
    .update({
      is_used: true,
      used_at: new Date().toISOString()
    })
    .eq('profile_id', profileId);
}

/**
 * Supprime le mot de passe temporaire (après changement permanent)
 * @param {string} profileId - UUID du profile locataire
 * @returns {Promise<void>}
 */
async function deleteTempPassword(profileId) {
  await supabaseAdmin
    .from('temporary_passwords')
    .delete()
    .eq('profile_id', profileId);
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
  
  // Vérifier hash
  const isValid = await verifyPassword(password, tempPwd.passwordHash);
  
  if (!isValid) {
    return { valid: false, reason: 'Mot de passe incorrect' };
  }
  
  return { valid: true };
}

module.exports = {
  generateTempPassword,
  hashPassword,
  verifyPassword,
  createTempPassword,
  getTempPassword,
  markTempPasswordAsUsed,
  deleteTempPassword,
  validateTempPassword,
  TEMP_PASSWORD_EXPIRY_DAYS
};
