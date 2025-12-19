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
    welcomeTitle: 'La solution SaaS pour gérer vos biens immobiliers',
    welcomeSubtitle: 'Plateforme professionnelle de gestion locative et d\'interventions techniques',
    welcomeDescription: 'Optimisez la gestion de vos propriétés avec des outils modernes et performants',
    ctaButton: 'Découvrir nos offres',
    
    // Packs
    packsTitle: 'Choisissez votre forfait',
    packsSubtitle: 'Des solutions adaptées à la taille de votre activité',
    perMonth: '/ mois',
    popular: 'POPULAIRE',
    
    packEssentiel: 'Essentiel',
    packEssentielPrice: 'CHF 99',
    packEssentielTarget: 'Jusqu\'à 50 logements',
    pack1Feature1: 'Gestion des tickets',
    pack1Feature2: '5 entreprises partenaires',
    pack1Feature3: 'Support email',
    pack1Feature4: 'Tableau de bord',
    
    packPro: 'Pro',
    packProPrice: 'CHF 199',
    packProTarget: 'Jusqu\'à 200 logements',
    pack2Feature1: 'Gestion complète',
    pack2Feature2: 'Entreprises illimitées',
    pack2Feature3: 'Analytics avancés',
    pack2Feature4: 'Support prioritaire',
    pack2Feature5: 'API & webhooks',
    
    packPremium: 'Premium',
    packPremiumPrice: 'CHF 399',
    packPremiumTarget: 'Logements illimités',
    pack3Feature1: 'Multi-utilisateurs',
    pack3Feature2: 'API personnalisée',
    pack3Feature3: 'Manager dédié',
    pack3Feature4: 'Formation incluse',
    pack3Feature5: 'SLA garanti',
    
    btnChoose: 'Choisir',
    btnChooseEssentiel: 'Choisir Essentiel',
    btnChoosePro: 'Choisir Pro',
    btnChoosePremium: 'Choisir Premium',
    
    // Modes
    modesTitle: 'Découvrez la plateforme',
    demoMode: 'Mode Démo',
    proMode: 'Mode Professionnel',
    demoDescription: 'Explorez toutes les fonctionnalités sans engagement',
    proDescription: 'Accédez à votre espace sécurisé',
    tryDemo: 'Essayer en démo',
    login: 'Se connecter',
    
    // Features
    featuresTitle: 'Une plateforme complète et performante',
    feature1Title: 'Gestion des tickets',
    feature1Desc: 'Déclaration et suivi en temps réel des interventions',
    feature2Title: 'Missions techniques',
    feature2Desc: 'Assignation automatique aux techniciens qualifiés',
    feature3Title: 'Facturation automatique',
    feature3Desc: 'Génération intelligente des factures et devis',
    feature4Title: 'Tableaux de bord',
    feature4Desc: 'Analytics et KPIs en temps réel',
    
    // Footer
    allRightsReserved: 'Tous droits réservés',
    footerAbout: 'À propos',
    footerLegal: 'Mentions légales',
    footerContact: 'Contact',
    footerSupport: 'Support',
    
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
    welcomeTitle: 'The SaaS solution for property management',
    welcomeSubtitle: 'Professional platform for rental management and technical interventions',
    welcomeDescription: 'Optimize your property management with modern and efficient tools',
    ctaButton: 'Discover our plans',
    
    // Packs
    packsTitle: 'Choose your plan',
    packsSubtitle: 'Solutions adapted to your business size',
    perMonth: '/ month',
    popular: 'POPULAR',
    
    packEssentiel: 'Essential',
    packEssentielPrice: 'CHF 99',
    packEssentielTarget: 'Up to 50 properties',
    pack1Feature1: 'Ticket management',
    pack1Feature2: '5 partner companies',
    pack1Feature3: 'Email support',
    pack1Feature4: 'Dashboard',
    
    packPro: 'Pro',
    packProPrice: 'CHF 199',
    packProTarget: 'Up to 200 properties',
    pack2Feature1: 'Complete management',
    pack2Feature2: 'Unlimited companies',
    pack2Feature3: 'Advanced analytics',
    pack2Feature4: 'Priority support',
    pack2Feature5: 'API & webhooks',
    
    packPremium: 'Premium',
    packPremiumPrice: 'CHF 399',
    packPremiumTarget: 'Unlimited properties',
    pack3Feature1: 'Multi-users',
    pack3Feature2: 'Custom API',
    pack3Feature3: 'Dedicated manager',
    pack3Feature4: 'Training included',
    pack3Feature5: 'Guaranteed SLA',
    
    btnChoose: 'Choose',
    btnChooseEssentiel: 'Choose Essential',
    btnChoosePro: 'Choose Pro',
    btnChoosePremium: 'Choose Premium',
    
    // Modes
    modesTitle: 'Discover the platform',
    demoMode: 'Demo Mode',
    proMode: 'Professional Mode',
    demoDescription: 'Explore all features without commitment',
    proDescription: 'Access your secure workspace',
    tryDemo: 'Try demo',
    login: 'Login',
    
    // Features
    featuresTitle: 'A complete and efficient platform',
    feature1Title: 'Ticket management',
    feature1Desc: 'Real-time intervention declaration and tracking',
    feature2Title: 'Technical missions',
    feature2Desc: 'Automatic assignment to qualified technicians',
    feature3Title: 'Automatic invoicing',
    feature3Desc: 'Smart invoice and quote generation',
    feature4Title: 'Dashboards',
    feature4Desc: 'Real-time analytics and KPIs',
    
    // Footer
    allRightsReserved: 'All rights reserved',
    footerAbout: 'About',
    footerLegal: 'Legal',
    footerContact: 'Contact',
    footerSupport: 'Support',
    
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
    welcomeTitle: 'Die SaaS-Lösung für Immobilienverwaltung',
    welcomeSubtitle: 'Professionelle Plattform für Mietverwaltung und technische Eingriffe',
    welcomeDescription: 'Optimieren Sie Ihre Immobilienverwaltung mit modernen und effizienten Tools',
    ctaButton: 'Unsere Angebote entdecken',
    
    // Packs
    packsTitle: 'Wählen Sie Ihr Paket',
    packsSubtitle: 'Lösungen angepasst an Ihre Geschäftsgröße',
    perMonth: '/ Monat',
    popular: 'BELIEBT',
    
    packEssentiel: 'Essential',
    packEssentielPrice: 'CHF 99',
    packEssentielTarget: 'Bis zu 50 Immobilien',
    pack1Feature1: 'Ticketverwaltung',
    pack1Feature2: '5 Partnerunternehmen',
    pack1Feature3: 'E-Mail-Support',
    pack1Feature4: 'Dashboard',
    
    packPro: 'Pro',
    packProPrice: 'CHF 199',
    packProTarget: 'Bis zu 200 Immobilien',
    pack2Feature1: 'Vollständige Verwaltung',
    pack2Feature2: 'Unbegrenzte Unternehmen',
    pack2Feature3: 'Erweiterte Analysen',
    pack2Feature4: 'Prioritäts-Support',
    pack2Feature5: 'API & Webhooks',
    
    packPremium: 'Premium',
    packPremiumPrice: 'CHF 399',
    packPremiumTarget: 'Unbegrenzte Immobilien',
    pack3Feature1: 'Mehrbenutzer',
    pack3Feature2: 'Benutzerdefinierte API',
    pack3Feature3: 'Dedizierter Manager',
    pack3Feature4: 'Schulung inbegriffen',
    pack3Feature5: 'Garantiertes SLA',
    
    btnChoose: 'Wählen',
    btnChooseEssentiel: 'Essential wählen',
    btnChoosePro: 'Pro wählen',
    btnChoosePremium: 'Premium wählen',
    
    // Modes
    modesTitle: 'Entdecken Sie die Plattform',
    demoMode: 'Demo-Modus',
    proMode: 'Professioneller Modus',
    demoDescription: 'Erkunden Sie alle Funktionen unverbindlich',
    proDescription: 'Zugriff auf Ihren sicheren Arbeitsbereich',
    tryDemo: 'Demo testen',
    login: 'Anmelden',
    
    // Features
    featuresTitle: 'Eine vollständige und effiziente Plattform',
    feature1Title: 'Ticketverwaltung',
    feature1Desc: 'Echtzeit-Meldung und Verfolgung von Eingriffen',
    feature2Title: 'Technische Einsätze',
    feature2Desc: 'Automatische Zuweisung an qualifizierte Techniker',
    feature3Title: 'Automatische Abrechnung',
    feature3Desc: 'Intelligente Rechnungs- und Angebotserstellung',
    feature4Title: 'Dashboards',
    feature4Desc: 'Echtzeit-Analysen und KPIs',
    
    // Footer
    allRightsReserved: 'Alle Rechte vorbehalten',
    footerAbout: 'Über uns',
    footerLegal: 'Rechtliches',
    footerContact: 'Kontakt',
    footerSupport: 'Support',
    
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
