/**
 * PROFILS DEMO PRÉDÉFINIS
 * 
 * Profils fictifs pour le MODE DEMO
 * Ces profils sont STATIQUES et définis dans le code
 * 
 * RÈGLES :
 * - IDs stables (DEMO_USER_XXX)
 * - Emails fictifs (.local)
 * - Flag is_demo: true
 * - Références fictives aux entités
 */

const DEMO_PROFILES = {
  regie: {
    id: 'DEMO_USER_001',
    email: 'demo.regie@jetc-immo.local',
    role: 'regie',
    regie_id: 'REGIE_DEMO_001',
    is_demo: true,
    name: 'Régie Démo',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  
  entreprise: {
    id: 'DEMO_USER_002',
    email: 'demo.entreprise@jetc-immo.local',
    role: 'entreprise',
    entreprise_id: 'ENTREPRISE_DEMO_001',
    is_demo: true,
    name: 'Entreprise Démo',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  
  locataire: {
    id: 'DEMO_USER_003',
    email: 'demo.locataire@jetc-immo.local',
    role: 'locataire',
    logement_id: 'LOGEMENT_DEMO_001',
    is_demo: true,
    name: 'Locataire Démo',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  
  technicien: {
    id: 'DEMO_USER_004',
    email: 'demo.technicien@jetc-immo.local',
    role: 'technicien',
    entreprise_id: 'ENTREPRISE_DEMO_001',
    is_demo: true,
    name: 'Technicien Démo',
    created_at: '2025-01-01T00:00:00.000Z'
  },
  
  admin_jtec: {
    id: 'DEMO_ADMIN_001',
    email: 'demo.admin@jetc-immo.local',
    role: 'admin_jtec',
    is_demo: true,
    name: 'Admin JTEC Démo',
    created_at: '2025-01-01T00:00:00.000Z'
  }
};

/**
 * Clés localStorage pour le MODE DEMO
 */
const DEMO_STORAGE_KEYS = {
  MODE: 'jetc_demo_mode',
  ROLE: 'jetc_demo_role',
  PROFILE: 'jetc_demo_profile',
  SESSION: 'jetc_demo_session'
};

/**
 * Active le MODE DEMO avec un rôle spécifique
 * @param {string} role - Rôle à activer (regie, entreprise, locataire, technicien, admin_jtec)
 * @returns {boolean} Succès de l'activation
 */
function activateDemoMode(role) {
  if (typeof window === 'undefined') return false;
  
  const profile = DEMO_PROFILES[role];
  
  if (!profile) {
    console.error(`[DEMO] Rôle invalide: ${role}`);
    return false;
  }
  
  try {
    // 1. Activer le mode DEMO
    localStorage.setItem(DEMO_STORAGE_KEYS.MODE, 'true');
    
    // 2. Définir le rôle
    localStorage.setItem(DEMO_STORAGE_KEYS.ROLE, role);
    
    // 3. Stocker le profil complet
    localStorage.setItem(DEMO_STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    
    // 4. Créer une session fictive
    const fakeSession = {
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
      is_demo: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    };
    localStorage.setItem(DEMO_STORAGE_KEYS.SESSION, JSON.stringify(fakeSession));
    
    console.log(`[DEMO] Mode DEMO activé - Rôle: ${role}`);
    return true;
    
  } catch (error) {
    console.error('[DEMO] Erreur activation:', error);
    return false;
  }
}

/**
 * Vérifie si le MODE DEMO est actif
 * @returns {boolean}
 */
function isDemoMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_STORAGE_KEYS.MODE) === 'true';
}

/**
 * Récupère le profil DEMO actuel
 * @returns {object|null} Profil ou null
 */
function getDemoProfile() {
  if (!isDemoMode()) return null;
  
  try {
    const profileStr = localStorage.getItem(DEMO_STORAGE_KEYS.PROFILE);
    return profileStr ? JSON.parse(profileStr) : null;
  } catch (error) {
    console.error('[DEMO] Erreur lecture profil:', error);
    return null;
  }
}

/**
 * Récupère le rôle DEMO actuel
 * @returns {string|null}
 */
function getDemoRole() {
  if (!isDemoMode()) return null;
  return localStorage.getItem(DEMO_STORAGE_KEYS.ROLE);
}

/**
 * Quitte le MODE DEMO (nettoyage complet)
 */
function quitDemoMode() {
  if (typeof window === 'undefined') return;
  
  console.log('[DEMO] Nettoyage du mode DEMO...');
  
  // Suppression des clés connues
  Object.values(DEMO_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Fallback : suppression de toutes les clés contenant "demo"
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.toLowerCase().includes('demo')) {
      localStorage.removeItem(key);
      console.log(`[DEMO] Clé supprimée: ${key}`);
    }
  });
  
  console.log('[DEMO] Mode DEMO désactivé');
}

/**
 * Change le rôle en MODE DEMO
 * @param {string} newRole - Nouveau rôle
 * @returns {boolean} Succès du changement
 */
function changeDemoRole(newRole) {
  if (!isDemoMode()) {
    console.error('[DEMO] Pas en mode DEMO');
    return false;
  }
  
  // Désactiver puis réactiver avec le nouveau rôle
  quitDemoMode();
  return activateDemoMode(newRole);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEMO_PROFILES,
    DEMO_STORAGE_KEYS,
    activateDemoMode,
    isDemoMode,
    getDemoProfile,
    getDemoRole,
    quitDemoMode,
    changeDemoRole
  };
}
