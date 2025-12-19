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
    // Meta
    pageTitle: 'JETC_IMMO - Gestion immobilière intelligente',
    appName: 'JETC_IMMO',
    
    // Hero
    welcomeTitle: 'Gérez vos biens immobiliers en toute simplicité',
    welcomeDescription: 'La plateforme complète pour optimiser la gestion de vos interventions techniques',
    
    // Packs
    packsTitle: 'Nos Forfaits',
    packsSubtitle: 'Choisissez le plan qui correspond à vos besoins',
    perMonth: '/ mois',
    
    packEssentiel: 'Essentiel',
    packEssentielTarget: 'Petites régies débutantes',
    pack1Feature1: 'Jusqu\'à 50 logements',
    pack1Feature2: 'Gestion des tickets',
    pack1Feature3: '5 entreprises partenaires',
    pack1Feature4: 'Support email',
    
    packPro: 'Pro',
    packProTarget: 'Régies en croissance',
    pack2Feature1: 'Jusqu\'à 200 logements',
    pack2Feature2: 'Gestion complète',
    pack2Feature3: 'Entreprises illimitées',
    pack2Feature4: 'Analytics avancés',
    pack2Feature5: 'Support prioritaire',
    
    packPremium: 'Premium',
    packPremiumTarget: 'Grandes régies',
    pack3Feature1: 'Logements illimités',
    pack3Feature2: 'Multi-utilisateurs',
    pack3Feature3: 'API personnalisée',
    pack3Feature4: 'Manager dédié',
    pack3Feature5: 'Formation incluse',
    
    btnLearnMore: 'En savoir plus',
    btnChoosePro: 'Choisir Pro',
    
    // Modes
    modesTitle: 'Découvrez la plateforme',
    demoMode: 'Mode Démo',
    proMode: 'Mode Professionnel',
    demoDescription: 'Explorez toutes les fonctionnalités sans engagement',
    proDescription: 'Accédez à votre espace sécurisé',
    tryDemo: 'Essayer en démo',
    login: 'Se connecter',
    
    // Features
    featuresTitle: 'Fonctionnalités',
    feature1Title: 'Gestion des tickets',
    feature1Desc: 'Déclaration et suivi en temps réel',
    feature2Title: 'Missions techniques',
    feature2Desc: 'Assignation automatique des techniciens',
    feature3Title: 'Facturation automatique',
    feature3Desc: 'Génération intelligente des factures',
    
    // Footer
    allRightsReserved: 'Tous droits réservés',
    
    // Formulaire
    requestAdhesion: 'Demande d\'adhésion',
    adhesionInfo: 'Votre demande sera examinée par notre équipe. Vous recevrez un email dès validation.',
    selectedPlan: 'Forfait sélectionné',
    email: 'Email',
    agencyName: 'Nom de l\'agence',
    agencyNamePlaceholder: 'Agence Immobilière ABC',
    nbCollaborators: 'Nombre de collaborateurs',
    nbCollaboratorsHelp: 'Nombre de personnes travaillant dans votre agence',
    nbHousing: 'Nombre de logements gérés',
    nbHousingHelp: 'Nombre de biens immobiliers actuellement gérés',
    siret: 'Numéro SIRET (optionnel)',
    siretHelp: '14 chiffres - Vous pourrez le renseigner plus tard',
    password: 'Mot de passe',
    passwordPlaceholder: '••••••••',
    passwordHelp: 'Minimum 6 caractères',
    confirmPassword: 'Confirmer le mot de passe',
    preferredLanguage: 'Langue préférée',
    sendAdhesionRequest: 'Envoyer ma demande d\'adhésion',
    alreadyAccount: 'Vous avez déjà un compte ?',
    backToHome: '← Retour à l\'accueil',
    
    // Common
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès'
  },
  
  en: {
    // Meta
    pageTitle: 'JETC_IMMO - Smart Property Management',
    appName: 'JETC_IMMO',
    
    // Hero
    welcomeTitle: 'Manage your properties with ease',
    welcomeDescription: 'The complete platform to optimize your technical interventions management',
    
    // Packs
    packsTitle: 'Our Plans',
    packsSubtitle: 'Choose the plan that fits your needs',
    perMonth: '/ month',
    
    packEssentiel: 'Essential',
    packEssentielTarget: 'Small starting agencies',
    pack1Feature1: 'Up to 50 properties',
    pack1Feature2: 'Ticket management',
    pack1Feature3: '5 partner companies',
    pack1Feature4: 'Email support',
    
    packPro: 'Pro',
    packProTarget: 'Growing agencies',
    pack2Feature1: 'Up to 200 properties',
    pack2Feature2: 'Complete management',
    pack2Feature3: 'Unlimited companies',
    pack2Feature4: 'Advanced analytics',
    pack2Feature5: 'Priority support',
    
    packPremium: 'Premium',
    packPremiumTarget: 'Large agencies',
    pack3Feature1: 'Unlimited properties',
    pack3Feature2: 'Multi-users',
    pack3Feature3: 'Custom API',
    pack3Feature4: 'Dedicated manager',
    pack3Feature5: 'Training included',
    
    btnLearnMore: 'Learn more',
    btnChoosePro: 'Choose Pro',
    
    // Modes
    modesTitle: 'Discover the platform',
    demoMode: 'Demo Mode',
    proMode: 'Professional Mode',
    demoDescription: 'Explore all features without commitment',
    proDescription: 'Access your secure workspace',
    tryDemo: 'Try demo',
    login: 'Login',
    
    // Features
    featuresTitle: 'Features',
    feature1Title: 'Ticket management',
    feature1Desc: 'Real-time declaration and tracking',
    feature2Title: 'Technical missions',
    feature2Desc: 'Automatic technician assignment',
    feature3Title: 'Automatic invoicing',
    feature3Desc: 'Smart invoice generation',
    
    // Footer
    allRightsReserved: 'All rights reserved',
    
    // Form
    requestAdhesion: 'Membership request',
    adhesionInfo: 'Your request will be reviewed by our team. You will receive an email once validated.',
    selectedPlan: 'Selected plan',
    email: 'Email',
    agencyName: 'Agency name',
    agencyNamePlaceholder: 'ABC Real Estate Agency',
    nbCollaborators: 'Number of employees',
    nbCollaboratorsHelp: 'Number of people working in your agency',
    nbHousing: 'Properties managed',
    nbHousingHelp: 'Number of properties currently managed',
    siret: 'SIRET number (optional)',
    siretHelp: '14 digits - You can fill it later',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    passwordHelp: 'Minimum 6 characters',
    confirmPassword: 'Confirm password',
    preferredLanguage: 'Preferred language',
    sendAdhesionRequest: 'Send membership request',
    alreadyAccount: 'Already have an account?',
    backToHome: '← Back to home',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success'
  },
  
  de: {
    // Meta
    pageTitle: 'JETC_IMMO - Intelligente Immobilienverwaltung',
    appName: 'JETC_IMMO',
    
    // Hero
    welcomeTitle: 'Verwalten Sie Ihre Immobilien mit Leichtigkeit',
    welcomeDescription: 'Die vollständige Plattform zur Optimierung Ihrer technischen Einsatzverwaltung',
    
    // Packs
    packsTitle: 'Unsere Pakete',
    packsSubtitle: 'Wählen Sie das Paket, das zu Ihnen passt',
    perMonth: '/ Monat',
    
    packEssentiel: 'Essential',
    packEssentielTarget: 'Kleine Startagenturen',
    pack1Feature1: 'Bis zu 50 Immobilien',
    pack1Feature2: 'Ticketverwaltung',
    pack1Feature3: '5 Partnerunternehmen',
    pack1Feature4: 'E-Mail-Support',
    
    packPro: 'Pro',
    packProTarget: 'Wachsende Agenturen',
    pack2Feature1: 'Bis zu 200 Immobilien',
    pack2Feature2: 'Vollständige Verwaltung',
    pack2Feature3: 'Unbegrenzte Unternehmen',
    pack2Feature4: 'Erweiterte Analysen',
    pack2Feature5: 'Prioritäts-Support',
    
    packPremium: 'Premium',
    packPremiumTarget: 'Große Agenturen',
    pack3Feature1: 'Unbegrenzte Immobilien',
    pack3Feature2: 'Mehrbenutzer',
    pack3Feature3: 'Benutzerdefinierte API',
    pack3Feature4: 'Dedizierter Manager',
    pack3Feature5: 'Schulung inbegriffen',
    
    btnLearnMore: 'Mehr erfahren',
    btnChoosePro: 'Pro wählen',
    
    // Modes
    modesTitle: 'Entdecken Sie die Plattform',
    demoMode: 'Demo-Modus',
    proMode: 'Professioneller Modus',
    demoDescription: 'Erkunden Sie alle Funktionen unverbindlich',
    proDescription: 'Zugriff auf Ihren sicheren Arbeitsbereich',
    tryDemo: 'Demo testen',
    login: 'Anmelden',
    
    // Features
    featuresTitle: 'Funktionen',
    feature1Title: 'Ticketverwaltung',
    feature1Desc: 'Echtzeit-Meldung und Verfolgung',
    feature2Title: 'Technische Einsätze',
    feature2Desc: 'Automatische Technikerzuweisung',
    feature3Title: 'Automatische Abrechnung',
    feature3Desc: 'Intelligente Rechnungserstellung',
    
    // Footer
    allRightsReserved: 'Alle Rechte vorbehalten',
    
    // Form
    requestAdhesion: 'Mitgliedsantrag',
    adhesionInfo: 'Ihr Antrag wird von unserem Team geprüft. Sie erhalten eine E-Mail nach der Validierung.',
    selectedPlan: 'Ausgewähltes Paket',
    email: 'E-Mail',
    agencyName: 'Agenturname',
    agencyNamePlaceholder: 'ABC Immobilienagentur',
    nbCollaborators: 'Anzahl Mitarbeiter',
    nbCollaboratorsHelp: 'Anzahl der Personen in Ihrer Agentur',
    nbHousing: 'Verwaltete Immobilien',
    nbHousingHelp: 'Anzahl der aktuell verwalteten Immobilien',
    siret: 'SIRET-Nummer (optional)',
    siretHelp: '14 Ziffern - Sie können es später ausfüllen',
    password: 'Passwort',
    passwordPlaceholder: '••••••••',
    passwordHelp: 'Mindestens 6 Zeichen',
    confirmPassword: 'Passwort bestätigen',
    preferredLanguage: 'Bevorzugte Sprache',
    sendAdhesionRequest: 'Mitgliedsantrag senden',
    alreadyAccount: 'Haben Sie bereits ein Konto?',
    backToHome: '← Zurück zur Startseite',
    
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
