/**
 * SYSTÈME MULTILINGUE
 * 
 * Gestion des traductions FR / EN / DE
 * Stockage et récupération de la langue préférée
 * 
 * RÈGLES :
 * - La langue est stockée dans localStorage
 * - La langue par défaut est détectée depuis le navigateur
 * - Fallback sur FR si langue non supportée
 */

const SUPPORTED_LANGUAGES = ['fr', 'en', 'de'];
const DEFAULT_LANGUAGE = 'fr';
const STORAGE_KEY = 'jetc_language';

/**
 * Traductions complètes
 */
const translations = {
  fr: {
    // Landing page
    appName: 'JETC_IMMO',
    tagline: 'Plateforme de gestion des interventions techniques immobilières',
    welcomeTitle: 'Bienvenue sur JETC_IMMO',
    welcomeDescription: 'Gérez efficacement vos interventions techniques, de la déclaration à la facturation.',
    
    // Modes
    demoMode: 'Mode Démo',
    proMode: 'Mode Professionnel',
    demoDescription: 'Découvrez la plateforme sans créer de compte',
    proDescription: 'Accédez à vos données réelles',
    
    // Actions
    tryDemo: 'Essayer en démo',
    login: 'Se connecter',
    register: 'S\'inscrire',
    
    // Features
    featuresTitle: 'Fonctionnalités',
    feature1Title: 'Gestion des tickets',
    feature1Desc: 'Déclaration et suivi des interventions',
    feature2Title: 'Missions techniques',
    feature2Desc: 'Assignation et suivi des techniciens',
    feature3Title: 'Facturation automatique',
    feature3Desc: 'Génération des factures et commissions',
    
    // Footer
    allRightsReserved: 'Tous droits réservés',
    
    // Hub DEMO
    chooseRole: 'Choisissez votre rôle',
    roleRegie: 'Régie',
    roleEntreprise: 'Entreprise',
    roleLocataire: 'Locataire',
    roleTechnicien: 'Technicien',
    roleAdmin: 'Admin JTEC',
    roleRegieDesc: 'Gérer immeubles, logements et tickets',
    roleEntrepriseDesc: 'Accepter des missions et gérer vos techniciens',
    roleLocataireDesc: 'Déclarer et suivre vos tickets',
    roleTechnicienDesc: 'Intervenir sur vos missions assignées',
    roleAdminDesc: 'Vue globale et statistiques',
    enterDemo: 'Entrer en démo',
    backToHome: 'Retour à l\'accueil',
    
    // Messages
    demoSimulation: 'Ceci est une simulation',
    noRealData: 'Aucune donnée réelle n\'a été enregistrée',
    quitDemo: 'Quitter la démo',
    changeRole: 'Changer de rôle',
    
    // Common
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer'
  },
  
  en: {
    // Landing page
    appName: 'JETC_IMMO',
    tagline: 'Property technical intervention management platform',
    welcomeTitle: 'Welcome to JETC_IMMO',
    welcomeDescription: 'Efficiently manage your technical interventions, from declaration to invoicing.',
    
    // Modes
    demoMode: 'Demo Mode',
    proMode: 'Professional Mode',
    demoDescription: 'Discover the platform without creating an account',
    proDescription: 'Access your real data',
    
    // Actions
    tryDemo: 'Try demo',
    login: 'Login',
    register: 'Sign up',
    
    // Features
    featuresTitle: 'Features',
    feature1Title: 'Ticket management',
    feature1Desc: 'Report and track interventions',
    feature2Title: 'Technical missions',
    feature2Desc: 'Assign and track technicians',
    feature3Title: 'Automatic invoicing',
    feature3Desc: 'Generate invoices and commissions',
    
    // Footer
    allRightsReserved: 'All rights reserved',
    
    // Hub DEMO
    chooseRole: 'Choose your role',
    roleRegie: 'Property Manager',
    roleEntreprise: 'Company',
    roleLocataire: 'Tenant',
    roleTechnicien: 'Technician',
    roleAdmin: 'Admin JTEC',
    roleRegieDesc: 'Manage buildings, apartments and tickets',
    roleEntrepriseDesc: 'Accept missions and manage your technicians',
    roleLocataireDesc: 'Report and track your tickets',
    roleTechnicienDesc: 'Work on your assigned missions',
    roleAdminDesc: 'Global view and statistics',
    enterDemo: 'Enter demo',
    backToHome: 'Back to home',
    
    // Messages
    demoSimulation: 'This is a simulation',
    noRealData: 'No real data has been saved',
    quitDemo: 'Quit demo',
    changeRole: 'Change role',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close'
  },
  
  de: {
    // Landing page
    appName: 'JETC_IMMO',
    tagline: 'Plattform für technische Interventionsverwaltung',
    welcomeTitle: 'Willkommen bei JETC_IMMO',
    welcomeDescription: 'Verwalten Sie effizient Ihre technischen Interventionen, von der Meldung bis zur Abrechnung.',
    
    // Modes
    demoMode: 'Demo-Modus',
    proMode: 'Professioneller Modus',
    demoDescription: 'Entdecken Sie die Plattform ohne Konto zu erstellen',
    proDescription: 'Greifen Sie auf Ihre echten Daten zu',
    
    // Actions
    tryDemo: 'Demo ausprobieren',
    login: 'Anmelden',
    register: 'Registrieren',
    
    // Features
    featuresTitle: 'Funktionen',
    feature1Title: 'Ticketverwaltung',
    feature1Desc: 'Melden und verfolgen Sie Interventionen',
    feature2Title: 'Technische Einsätze',
    feature2Desc: 'Zuweisen und verfolgen Sie Techniker',
    feature3Title: 'Automatische Abrechnung',
    feature3Desc: 'Erstellen Sie Rechnungen und Provisionen',
    
    // Footer
    allRightsReserved: 'Alle Rechte vorbehalten',
    
    // Hub DEMO
    chooseRole: 'Wählen Sie Ihre Rolle',
    roleRegie: 'Hausverwaltung',
    roleEntreprise: 'Unternehmen',
    roleLocataire: 'Mieter',
    roleTechnicien: 'Techniker',
    roleAdmin: 'Admin JTEC',
    roleRegieDesc: 'Verwalten Sie Gebäude, Wohnungen und Tickets',
    roleEntrepriseDesc: 'Akzeptieren Sie Aufträge und verwalten Sie Ihre Techniker',
    roleLocataireDesc: 'Melden und verfolgen Sie Ihre Tickets',
    roleTechnicienDesc: 'Arbeiten Sie an Ihren zugewiesenen Aufträgen',
    roleAdminDesc: 'Globale Ansicht und Statistiken',
    enterDemo: 'Demo betreten',
    backToHome: 'Zurück zur Startseite',
    
    // Messages
    demoSimulation: 'Dies ist eine Simulation',
    noRealData: 'Keine echten Daten wurden gespeichert',
    quitDemo: 'Demo verlassen',
    changeRole: 'Rolle wechseln',
    
    // Common
    loading: 'Lädt...',
    error: 'Fehler',
    success: 'Erfolg',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schließen'
  }
};

/**
 * Détecte la langue du navigateur
 * @returns {string} Code langue (fr, en, de)
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  const browserLang = (navigator.language || navigator.userLanguage || '').substring(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : DEFAULT_LANGUAGE;
}

/**
 * Récupère la langue actuellement active
 * @returns {string} Code langue
 */
function getCurrentLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  // 1. Chercher dans localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }
  
  // 2. Détecter depuis le navigateur
  const detected = detectBrowserLanguage();
  
  // 3. Sauvegarder pour la prochaine fois
  localStorage.setItem(STORAGE_KEY, detected);
  
  return detected;
}

/**
 * Change la langue active
 * @param {string} lang - Code langue (fr, en, de)
 */
function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.error(`[LANG] Langue non supportée: ${lang}`);
    return;
  }
  
  localStorage.setItem(STORAGE_KEY, lang);
  console.log(`[LANG] Langue changée: ${lang}`);
  
  // Recharger la page pour appliquer
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Récupère une traduction
 * @param {string} key - Clé de traduction
 * @returns {string} Texte traduit
 */
function t(key) {
  const lang = getCurrentLanguage();
  const translation = translations[lang]?.[key];
  
  if (!translation) {
    console.warn(`[LANG] Traduction manquante: ${key} (${lang})`);
    return translations[DEFAULT_LANGUAGE]?.[key] || key;
  }
  
  return translation;
}

/**
 * Récupère toutes les traductions pour la langue active
 * @returns {object} Objet des traductions
 */
function getAllTranslations() {
  const lang = getCurrentLanguage();
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    getCurrentLanguage,
    setLanguage,
    t,
    getAllTranslations,
    detectBrowserLanguage
  };
}
