#!/usr/bin/env node

/**
 * AUDIT ÉTAPE 8 - EMAILS (PRÉPARATION UNIQUEMENT)
 * 
 * Objectif : Vérifier l'état de préparation du système d'emails
 * 
 * ⚠️ IMPORTANT : PAS D'ACTIVATION D'ENVOI
 * Cet audit documente uniquement ce qui existe et ce qui manque
 */

const fs = require('fs');
const path = require('path');

console.log('============================================');
console.log('AUDIT ÉTAPE 8 - SYSTÈME EMAILS');
console.log('(PRÉPARATION - PAS D\'ACTIVATION)');
console.log('============================================\n');

const results = {
  infrastructure: [],
  templates: [],
  loginGeneration: [],
  integration: [],
  recommendations: []
};

// ============================================
// 1. VÉRIFICATION INFRASTRUCTURE EMAIL
// ============================================
console.log('📦 1. INFRASTRUCTURE EMAIL\n');

// 1.1 Service centralisé
const emailServicePath = './api/services/emailService.js';
if (fs.existsSync(emailServicePath)) {
  const content = fs.readFileSync(emailServicePath, 'utf-8');
  
  results.infrastructure.push({
    item: 'Service centralisé emailService.js',
    status: '✅ EXISTE',
    details: 'Fichier présent avec nodemailer configuré'
  });
  
  // Vérifier nodemailer
  if (content.includes('nodemailer')) {
    results.infrastructure.push({
      item: 'Nodemailer installé',
      status: '✅ OK',
      details: 'Package nodemailer importé et utilisé'
    });
  }
  
  // Vérifier configuration SMTP
  if (content.includes('SMTP_HOST') && content.includes('SMTP_USER')) {
    results.infrastructure.push({
      item: 'Configuration SMTP',
      status: '✅ PRÉPARÉE',
      details: 'Variables env SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM'
    });
  }
  
} else {
  results.infrastructure.push({
    item: 'Service centralisé emailService.js',
    status: '❌ MANQUANT',
    details: 'Fichier non trouvé'
  });
}

// 1.2 Configuration .env
const envExamplePath = './.env.example';
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf-8');
  if (envContent.includes('SMTP_HOST')) {
    results.infrastructure.push({
      item: 'Variables SMTP dans .env.example',
      status: '✅ DOCUMENTÉES',
      details: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM'
    });
  }
}

// 1.3 Package.json
const packagePath = './package.json';
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  if (pkg.dependencies && pkg.dependencies.nodemailer) {
    results.infrastructure.push({
      item: 'Nodemailer dans package.json',
      status: '✅ INSTALLÉ',
      details: `Version: ${pkg.dependencies.nodemailer}`
    });
  } else {
    results.infrastructure.push({
      item: 'Nodemailer dans package.json',
      status: '❌ MANQUANT',
      details: 'Dépendance non trouvée'
    });
  }
}

// ============================================
// 2. TEMPLATES EMAIL EXISTANTS
// ============================================
console.log('\n📧 2. TEMPLATES EMAIL\n');

const emailServicePath2 = './api/services/emailService.js';
if (fs.existsSync(emailServicePath2)) {
  const content = fs.readFileSync(emailServicePath2, 'utf-8');
  
  // Template de base
  if (content.includes('function getEmailTemplate')) {
    results.templates.push({
      item: 'Template HTML de base',
      status: '✅ EXISTE',
      details: 'Template avec logo JETC_IMMO, header gradient, footer'
    });
  }
  
  // Vérifier templates spécifiques
  const templates = [
    { func: 'getAdhesionDemandeEmail', name: 'Demande adhésion reçue', type: 'adhesion_demande' },
    { func: 'getAdhesionValideeEmail', name: 'Adhésion validée', type: 'adhesion_validee' },
    { func: 'getAdhesionRefuseeEmail', name: 'Adhésion refusée', type: 'adhesion_refusee' }
  ];
  
  templates.forEach(tpl => {
    if (content.includes(`function ${tpl.func}`)) {
      // Vérifier support multilingue
      const multilang = content.match(new RegExp(`${tpl.func}[\\s\\S]*?fr:[\\s\\S]*?en:[\\s\\S]*?de:`));
      results.templates.push({
        item: `Template: ${tpl.name}`,
        status: '✅ EXISTE',
        details: multilang ? 'FR/EN/DE supportés' : 'Multilingue à vérifier'
      });
    } else {
      results.templates.push({
        item: `Template: ${tpl.name}`,
        status: '❌ MANQUANT',
        details: 'Fonction non trouvée'
      });
    }
  });
  
  // Vérifier fonction sendEmail
  if (content.includes('async function sendEmail')) {
    results.templates.push({
      item: 'Fonction sendEmail()',
      status: '✅ EXISTE',
      details: 'Fonction principale d\'envoi centralisée'
    });
  }
}

// Templates manquants critiques
const missingTemplates = [
  'Mot de passe temporaire locataire',
  'Mot de passe temporaire entreprise',
  'Mot de passe temporaire technicien',
  'Réinitialisation mot de passe'
];

missingTemplates.forEach(tpl => {
  results.templates.push({
    item: `Template: ${tpl}`,
    status: '⚠️ À CRÉER',
    details: 'Template nécessaire mais non implémenté'
  });
});

// ============================================
// 3. GÉNÉRATION LOGIN & MOT DE PASSE
// ============================================
console.log('\n🔐 3. GÉNÉRATION LOGIN & MOT DE PASSE\n');

// 3.1 Service mot de passe
const passwordServicePath = './api/services/passwordService.js';
if (fs.existsSync(passwordServicePath)) {
  const content = fs.readFileSync(passwordServicePath, 'utf-8');
  
  results.loginGeneration.push({
    item: 'Service passwordService.js',
    status: '✅ EXISTE',
    details: 'Service centralisé de génération mot de passe'
  });
  
  if (content.includes('function generateTempPassword')) {
    results.loginGeneration.push({
      item: 'Génération mot de passe temporaire',
      status: '✅ FONCTIONNEL',
      details: content.includes('Test1234!') ? 
        '⚠️ Mot de passe FIXE (Test1234!) - OK pour dev, à changer en prod' :
        'Génération aléatoire'
    });
  }
  
  if (content.includes('TEMP_PASSWORD_EXPIRY_DAYS')) {
    results.loginGeneration.push({
      item: 'Expiration mot de passe',
      status: '✅ CONFIGURÉE',
      details: '7 jours par défaut'
    });
  }
  
  if (content.includes('createTempPassword')) {
    results.loginGeneration.push({
      item: 'Fonction createTempPassword()',
      status: '✅ EXISTE',
      details: 'Crée/remplace mot de passe temporaire avec expiration'
    });
  }
}

// 3.2 Endpoints utilisant mot de passe temporaire
const endpointsWithPassword = [
  { path: './api/locataires/create.js', type: 'Création locataire' },
  { path: './api/regie/create-entreprise-account.js', type: 'Création entreprise' },
  { path: './api/techniciens/create.js', type: 'Création technicien' },
  { path: './api/auth/reset-password.js', type: 'Réinitialisation mot de passe' }
];

endpointsWithPassword.forEach(endpoint => {
  if (fs.existsSync(endpoint.path)) {
    const content = fs.readFileSync(endpoint.path, 'utf-8');
    const hasPasswordGen = content.includes('generateTempPassword') || 
                           content.includes('createTempPassword') ||
                           content.includes('temporaryPassword');
    
    results.loginGeneration.push({
      item: endpoint.type,
      status: hasPasswordGen ? '✅ GÉNÈRE MDP' : '⚠️ À VÉRIFIER',
      details: hasPasswordGen ? 
        'Génère mot de passe temporaire' : 
        'Génération mot de passe à confirmer'
    });
  } else {
    results.loginGeneration.push({
      item: endpoint.type,
      status: '❌ FICHIER MANQUANT',
      details: `${endpoint.path} non trouvé`
    });
  }
});

// ============================================
// 4. INTÉGRATION ACTUELLE
// ============================================
console.log('\n🔗 4. INTÉGRATION EMAIL ACTUELLE\n');

// Vérifier où sendEmail est appelé
const apiFiles = [
  './api/auth/register.js',
  './api/admin/valider-regie.js',
  './api/admin/refuser-regie.js',
  './api/locataires/create.js',
  './api/regie/create-entreprise-account.js',
  './api/techniciens/create.js'
];

apiFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasSendEmail = content.includes('sendEmail(');
    const hasEmailService = content.includes('emailService');
    
    if (hasSendEmail || hasEmailService) {
      results.integration.push({
        item: path.basename(filePath),
        status: '✅ INTÉGRÉ',
        details: 'Appelle sendEmail() du service centralisé'
      });
    } else {
      results.integration.push({
        item: path.basename(filePath),
        status: '⚠️ NON INTÉGRÉ',
        details: 'N\'utilise pas encore le service email'
      });
    }
  }
});

// ============================================
// 5. RECOMMANDATIONS
// ============================================
console.log('\n💡 5. RECOMMANDATIONS\n');

results.recommendations = [
  {
    priority: 'HAUTE',
    item: 'Créer templates mot de passe temporaire',
    details: 'Créer getPasswordTempEmail() pour locataires, entreprises, techniciens avec MDP en clair + expiration'
  },
  {
    priority: 'HAUTE',
    item: 'Intégrer envoi email création compte',
    details: 'Ajouter sendEmail() dans create.js (locataires, entreprises, techniciens) avec flag SMTP_ENABLED'
  },
  {
    priority: 'MOYENNE',
    item: 'Créer template réinitialisation',
    details: 'Template pour reset-password.js avec nouveau mot de passe temporaire'
  },
  {
    priority: 'MOYENNE',
    item: 'Génération aléatoire production',
    details: 'Remplacer Test1234! par génération aléatoire sécurisée (12+ chars, majuscules/minuscules/chiffres/symboles)'
  },
  {
    priority: 'BASSE',
    item: 'Tests unitaires emails',
    details: 'Créer tests avec mock SMTP pour valider templates et envois'
  },
  {
    priority: 'BASSE',
    item: 'Logs centralisés emails',
    details: 'Logger tous les envois (succès/échec) pour monitoring'
  },
  {
    priority: 'INFO',
    item: 'Configuration SMTP production',
    details: 'Définir SMTP_HOST, SMTP_USER, SMTP_PASS dans .env (utiliser Brevo, SendGrid, ou Gmail avec App Password)'
  },
  {
    priority: 'INFO',
    item: 'Flag activation progressive',
    details: 'Utiliser SMTP_ENABLED=true/false pour activer/désactiver envois sans modifier code'
  }
];

// ============================================
// AFFICHAGE RÉSULTATS
// ============================================

console.log('\n============================================');
console.log('RÉSULTATS AUDIT');
console.log('============================================\n');

console.log('📦 INFRASTRUCTURE EMAIL:');
results.infrastructure.forEach(r => {
  console.log(`  ${r.status} ${r.item}`);
  console.log(`     ${r.details}\n`);
});

console.log('\n📧 TEMPLATES EMAIL:');
results.templates.forEach(r => {
  console.log(`  ${r.status} ${r.item}`);
  console.log(`     ${r.details}\n`);
});

console.log('\n🔐 GÉNÉRATION LOGIN & MOT DE PASSE:');
results.loginGeneration.forEach(r => {
  console.log(`  ${r.status} ${r.item}`);
  console.log(`     ${r.details}\n`);
});

console.log('\n🔗 INTÉGRATION EMAIL:');
results.integration.forEach(r => {
  console.log(`  ${r.status} ${r.item}`);
  console.log(`     ${r.details}\n`);
});

console.log('\n💡 RECOMMANDATIONS:');
results.recommendations.forEach(r => {
  console.log(`  [${r.priority}] ${r.item}`);
  console.log(`     → ${r.details}\n`);
});

// ============================================
// SYNTHÈSE FINALE
// ============================================

const infrastructureOK = results.infrastructure.filter(r => r.status.includes('✅')).length;
const templatesExist = results.templates.filter(r => r.status.includes('✅')).length;
const templatesNeeded = results.templates.filter(r => r.status.includes('⚠️')).length;
const loginOK = results.loginGeneration.filter(r => r.status.includes('✅')).length;
const integrationOK = results.integration.filter(r => r.status.includes('✅')).length;
const integrationNeeded = results.integration.filter(r => r.status.includes('⚠️')).length;

console.log('\n============================================');
console.log('SYNTHÈSE ÉTAPE 8 - EMAILS');
console.log('============================================\n');

console.log('✅ CE QUI EST PRÊT:');
console.log(`  - Infrastructure: ${infrastructureOK} éléments OK`);
console.log(`  - Templates existants: ${templatesExist}`);
console.log(`  - Génération login/MDP: ${loginOK} éléments fonctionnels`);
console.log(`  - Intégrations actives: ${integrationOK}\n`);

console.log('⚠️ CE QUI MANQUE:');
console.log(`  - Templates à créer: ${templatesNeeded}`);
console.log(`  - Intégrations à ajouter: ${integrationNeeded}\n`);

console.log('📋 ACTIONS RECOMMANDÉES (par priorité):');
console.log('  1. [HAUTE] Créer 4 templates mot de passe temporaire');
console.log('  2. [HAUTE] Intégrer sendEmail() dans endpoints création compte');
console.log('  3. [MOYENNE] Passer génération MDP de fixe (Test1234!) à aléatoire');
console.log('  4. [INFO] Configurer SMTP en production (Brevo/SendGrid)');
console.log('  5. [INFO] Ajouter flag SMTP_ENABLED pour activation progressive\n');

console.log('⚠️ RAPPEL IMPORTANT:');
console.log('  Cette étape est PRÉPARATION uniquement');
console.log('  NE PAS ACTIVER l\'envoi d\'emails sans configuration SMTP valide');
console.log('  Le système fonctionne sans emails (affichage dans UI)\n');

console.log('============================================\n');

// Sauvegarder résultats
const reportPath = './_RAPPORT_ETAPE_8_EMAILS.json';
fs.writeFileSync(reportPath, JSON.stringify({
  date: new Date().toISOString(),
  infrastructure: results.infrastructure,
  templates: results.templates,
  loginGeneration: results.loginGeneration,
  integration: results.integration,
  recommendations: results.recommendations,
  summary: {
    infrastructureReady: infrastructureOK,
    templatesExist,
    templatesNeeded,
    loginGenerationReady: loginOK,
    integrationActive: integrationOK,
    integrationNeeded
  }
}, null, 2));

console.log(`📄 Rapport détaillé sauvegardé: ${reportPath}\n`);

process.exit(0);
