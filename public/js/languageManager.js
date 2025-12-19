/**
 * LANGUAGE MANAGER - Gestionnaire centralisé des langues
 * 
 * Responsable de :
 * - Détection de la langue
 * - Stockage de la préférence
 * - Application des traductions
 * 
 * Langues supportées : FR, EN, DE
 */

const SUPPORTED_LANGUAGES = ['fr', 'en', 'de'];
const DEFAULT_LANGUAGE = 'fr';
const STORAGE_KEY = 'jetc_language';

/**
 * Traductions pour l'application
 */
const translations = {
  fr: {
    // Landing page
    appName: 'JETC_IMMO',
    welcomeTitle: 'Bienvenue sur JETC_IMMO',
    welcomeDescription: 'Gérez efficacement vos interventions techniques immobilières en Suisse.',
    
    // Modes
    demoMode: '🎮 Mode Démo',
    proMode: '🔐 Mode Professionnel',
    demoDescription: 'Découvrez la plateforme sans créer de compte',
    proDescription: 'Accédez à vos données réelles',
    
    // Actions
    tryDemo: 'Essayer en démo',
    login: 'Se connecter',
    requestAdhesion: 'Demander une adhésion',
    
    // Packs
    packsTitle: 'Nos Forfaits',
    packEssentiel: 'Pack Essentiel',
    packPro: 'Pack Pro',
    packPremium: 'Pack Premium',
    packEssentielDesc: 'Pour les petites agences',
    packProDesc: 'Pour les agences en croissance',
    packPremiumDesc: 'Pour les grandes agences',
    packEssentielPrice: '99 CHF/mois',
    packProPrice: '199 CHF/mois',
    packPremiumPrice: '399 CHF/mois',
    packEssentielFeatures: 'Jusqu\'à 100 logements\n5 utilisateurs\nSupport email',
    packProFeatures: 'Jusqu\'à 500 logements\n20 utilisateurs\nSupport prioritaire',
    packPremiumFeatures: 'Logements illimités\nUtilisateurs illimités\nSupport 24/7',
    
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
    
    // Common
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès'
  },
  
  en: {
    // Landing page
    appName: 'JETC_IMMO',
    welcomeTitle: 'Welcome to JETC_IMMO',
    welcomeDescription: 'Efficiently manage your property technical interventions in Switzerland.',
    
    // Modes
    demoMode: '🎮 Demo Mode',
    proMode: '🔐 Professional Mode',
    demoDescription: 'Discover the platform without creating an account',
    proDescription: 'Access your real data',
    
    // Actions
    tryDemo: 'Try demo',
    login: 'Login',
    requestAdhesion: 'Request membership',
    
    // Packs
    packsTitle: 'Our Plans',
    packEssentiel: 'Essential Pack',
    packPro: 'Pro Pack',
    packPremium: 'Premium Pack',
    packEssentielDesc: 'For small agencies',
    packProDesc: 'For growing agencies',
    packPremiumDesc: 'For large agencies',
    packEssentielPrice: 'CHF 99/month',
    packProPrice: 'CHF 199/month',
    packPremiumPrice: 'CHF 399/month',
    packEssentielFeatures: 'Up to 100 properties\n5 users\nEmail support',
    packProFeatures: 'Up to 500 properties\n20 users\nPriority support',
    packPremiumFeatures: 'Unlimited properties\nUnlimited users\n24/7 support',
    
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
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success'
  },
  
  de: {
    // Landing page
    appName: 'JETC_IMMO',
    welcomeTitle: 'Willkommen bei JETC_IMMO',
    welcomeDescription: 'Verwalten Sie effizient Ihre technischen Immobilieneingriffe in der Schweiz.',
    
    // Modes
    demoMode: '🎮 Demo-Modus',
    proMode: '🔐 Professioneller Modus',
    demoDescription: 'Entdecken Sie die Plattform ohne Konto',
    proDescription: 'Greifen Sie auf Ihre echten Daten zu',
    
    // Actions
    tryDemo: 'Demo testen',
    login: 'Anmelden',
    requestAdhesion: 'Mitgliedschaft beantragen',
    
    // Packs
    packsTitle: 'Unsere Pakete',
    packEssentiel: 'Essential-Paket',
    packPro: 'Pro-Paket',
    packPremium: 'Premium-Paket',
    packEssentielDesc: 'Für kleine Agenturen',
    packProDesc: 'Für wachsende Agenturen',
    packPremiumDesc: 'Für große Agenturen',
    packEssentielPrice: 'CHF 99/Monat',
    packProPrice: 'CHF 199/Monat',
    packPremiumPrice: 'CHF 399/Monat',
    packEssentielFeatures: 'Bis zu 100 Immobilien\n5 Benutzer\nE-Mail-Support',
    packProFeatures: 'Bis zu 500 Immobilien\n20 Benutzer\nPrioritäts-Support',
    packPremiumFeatures: 'Unbegrenzte Immobilien\nUnbegrenzte Benutzer\n24/7 Support',
    
    // Features
    featuresTitle: 'Funktionen',
    feature1Title: 'Ticketverwaltung',
    feature1Desc: 'Melden und verfolgen Sie Eingriffe',
    feature2Title: 'Technische Einsätze',
    feature2Desc: 'Techniker zuweisen und verfolgen',
    feature3Title: 'Automatische Abrechnung',
    feature3Desc: 'Rechnungen und Provisionen erstellen',
    
    // Footer
    allRightsReserved: 'Alle Rechte vorbehalten',
    
    // Common
    loading: 'Lädt...',
    error: 'Fehler',
    success: 'Erfolg'
  }
};

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  const browserLang = (navigator.language || navigator.userLanguage || '').substring(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : DEFAULT_LANGUAGE;
}

/**
 * Récupère la langue actuellement active
 */
function getCurrentLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }
  
  const detected = detectBrowserLanguage();
  localStorage.setItem(STORAGE_KEY, detected);
  return detected;
}

/**
 * Change la langue active
 */
function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.error(`[LANG] Langue non supportée: ${lang}`);
    return;
  }
  
  localStorage.setItem(STORAGE_KEY, lang);
  console.log(`[LANG] Langue changée: ${lang}`);
  
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Récupère une traduction
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
 */
function getAllTranslations() {
  const lang = getCurrentLanguage();
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}

/**
 * Applique les traductions à tous les éléments avec data-i18n
 */
function applyTranslations() {
  const trans = getAllTranslations();
  
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (trans[key]) {
      element.textContent = trans[key];
    }
  });
  
  document.documentElement.lang = getCurrentLanguage();
}

/**
 * Change la langue et met à jour l'UI
 */
function changeLanguage(lang) {
  console.log('[LANG] Changement vers:', lang);
  setLanguage(lang);
}

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    getCurrentLanguage,
    setLanguage,
    changeLanguage,
    t,
    getAllTranslations,
    applyTranslations,
    detectBrowserLanguage
  };
}
