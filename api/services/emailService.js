/**
 * SERVICE D'EMAILS CENTRALISÉ
 * 
 * Gère l'envoi de tous les emails de l'application
 * - Templates HTML professionnels
 * - Logo JETC_IMMO
 * - Support multilingue
 * 
 * TYPES D'EMAILS :
 * - adhesion_demande : Confirmation de réception de la demande
 * - adhesion_validee : Adhésion validée par admin
 * - adhesion_refusee : Adhésion refusée par admin
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuration du transporteur email
let transporter;

function getTransporter() {
  if (transporter) return transporter;
  
  // Configuration SMTP (à adapter selon votre fournisseur)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true pour 465, false pour les autres ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  return transporter;
}

/**
 * Template HTML de base avec logo
 */
function getEmailTemplate(content, language = 'fr') {
  const translations = {
    fr: {
      footer: 'Cet email a été envoyé automatiquement. Merci de ne pas y répondre.',
      contact: 'Pour toute question, contactez-nous à',
      copyright: 'JETC_IMMO - Tous droits réservés'
    },
    en: {
      footer: 'This email was sent automatically. Please do not reply.',
      contact: 'For any questions, contact us at',
      copyright: 'JETC_IMMO - All rights reserved'
    },
    de: {
      footer: 'Diese E-Mail wurde automatisch gesendet. Bitte nicht antworten.',
      contact: 'Für Fragen kontaktieren Sie uns unter',
      copyright: 'JETC_IMMO - Alle Rechte vorbehalten'
    }
  };
  
  const t = translations[language] || translations['fr'];
  
  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f7fafc;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .logo-placeholder {
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: white;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      line-height: 1.6;
      color: #2d3748;
    }
    .footer {
      background-color: #f7fafc;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #718096;
      border-top: 1px solid #e2e8f0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: 600;
    }
    .info-box {
      background-color: #ebf8ff;
      border-left: 4px solid #4299e1;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background-color: #fffaf0;
      border-left: 4px solid #ed8936;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success-box {
      background-color: #f0fff4;
      border-left: 4px solid #48bb78;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo-placeholder">J</div>
      <h1 class="logo">JETC_IMMO</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${t.footer}</p>
      <p>${t.contact} <strong>contact@jetc-immo.ch</strong></p>
      <p>&copy; 2025 ${t.copyright}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * EMAIL : Demande d'adhésion reçue
 */
function getAdhesionDemandeEmail(data, language = 'fr') {
  const translations = {
    fr: {
      subject: '✅ Demande d\'adhésion reçue - JETC_IMMO',
      greeting: 'Bonjour,',
      title: 'Votre demande d\'adhésion a bien été prise en compte',
      message: `
        <p>Nous avons bien reçu votre demande d'adhésion pour <strong>${data.nomAgence}</strong>.</p>
        <div class="info-box">
          <strong>📋 Informations reçues :</strong>
          <ul>
            <li>Email : ${data.email}</li>
            <li>Agence : ${data.nomAgence}</li>
            <li>Nombre de collaborateurs : ${data.nbCollaborateurs}</li>
            <li>Nombre de logements gérés : ${data.nbLogements}</li>
            ${data.siret ? `<li>SIRET : ${data.siret}</li>` : ''}
          </ul>
        </div>
        <p><strong>⏳ Prochaines étapes :</strong></p>
        <ol>
          <li>Notre équipe va examiner votre demande</li>
          <li>Vous recevrez un email de confirmation dès validation</li>
          <li>Vous pourrez ensuite vous connecter et créer vos accès</li>
        </ol>
        <p>Le délai de traitement est généralement de 24 à 48 heures.</p>
      `,
      thanks: 'Merci de votre confiance !'
    },
    en: {
      subject: '✅ Membership request received - JETC_IMMO',
      greeting: 'Hello,',
      title: 'Your membership request has been received',
      message: `
        <p>We have received your membership request for <strong>${data.nomAgence}</strong>.</p>
        <div class="info-box">
          <strong>📋 Information received:</strong>
          <ul>
            <li>Email: ${data.email}</li>
            <li>Agency: ${data.nomAgence}</li>
            <li>Number of employees: ${data.nbCollaborateurs}</li>
            <li>Properties managed: ${data.nbLogements}</li>
            ${data.siret ? `<li>SIRET: ${data.siret}</li>` : ''}
          </ul>
        </div>
        <p><strong>⏳ Next steps:</strong></p>
        <ol>
          <li>Our team will review your request</li>
          <li>You will receive a confirmation email once validated</li>
          <li>You can then log in and create your access</li>
        </ol>
        <p>Processing time is typically 24 to 48 hours.</p>
      `,
      thanks: 'Thank you for your trust!'
    },
    de: {
      subject: '✅ Mitgliedsantrag erhalten - JETC_IMMO',
      greeting: 'Hallo,',
      title: 'Ihr Mitgliedsantrag wurde empfangen',
      message: `
        <p>Wir haben Ihren Mitgliedsantrag für <strong>${data.nomAgence}</strong> erhalten.</p>
        <div class="info-box">
          <strong>📋 Erhaltene Informationen:</strong>
          <ul>
            <li>E-Mail: ${data.email}</li>
            <li>Agentur: ${data.nomAgence}</li>
            <li>Anzahl Mitarbeiter: ${data.nbCollaborateurs}</li>
            <li>Verwaltete Immobilien: ${data.nbLogements}</li>
            ${data.siret ? `<li>SIRET: ${data.siret}</li>` : ''}
          </ul>
        </div>
        <p><strong>⏳ Nächste Schritte:</strong></p>
        <ol>
          <li>Unser Team wird Ihren Antrag prüfen</li>
          <li>Sie erhalten eine Bestätigungs-E-Mail nach der Validierung</li>
          <li>Danach können Sie sich anmelden und Ihre Zugänge erstellen</li>
        </ol>
        <p>Die Bearbeitungszeit beträgt in der Regel 24 bis 48 Stunden.</p>
      `,
      thanks: 'Vielen Dank für Ihr Vertrauen!'
    }
  };
  
  const t = translations[language] || translations['fr'];
  
  const content = `
    <p>${t.greeting}</p>
    <h2 style="color: #667eea;">${t.title}</h2>
    ${t.message}
    <p style="margin-top: 30px;"><strong>${t.thanks}</strong></p>
    <p>L'équipe JETC_IMMO</p>
  `;
  
  return {
    subject: t.subject,
    html: getEmailTemplate(content, language)
  };
}

/**
 * EMAIL : Adhésion validée
 */
function getAdhesionValideeEmail(data, language = 'fr') {
  const translations = {
    fr: {
      subject: '🎉 Adhésion validée - Bienvenue sur JETC_IMMO !',
      greeting: `Bonjour,`,
      title: 'Votre adhésion a été validée !',
      message: `
        <div class="success-box">
          <p><strong>✅ Félicitations !</strong></p>
          <p>Votre agence <strong>${data.nomAgence}</strong> a été validée par notre équipe.</p>
        </div>
        <p><strong>🎯 Vous pouvez maintenant :</strong></p>
        <ol>
          <li>Vous connecter à la plateforme</li>
          <li>Configurer votre espace</li>
          <li>Créer des accès pour vos collaborateurs</li>
          <li>Gérer vos biens immobiliers</li>
        </ol>
        <p style="text-align: center;">
          <a href="${process.env.APP_URL || 'https://jetc-immo.ch'}/login.html" class="button">
            Se connecter maintenant
          </a>
        </p>
        <p><strong>📞 Besoin d'aide ?</strong></p>
        <p>Notre équipe est à votre disposition pour vous accompagner dans la prise en main de la plateforme.</p>
      `,
      thanks: 'Bienvenue dans la famille JETC_IMMO !'
    },
    en: {
      subject: '🎉 Membership validated - Welcome to JETC_IMMO!',
      greeting: 'Hello,',
      title: 'Your membership has been validated!',
      message: `
        <div class="success-box">
          <p><strong>✅ Congratulations!</strong></p>
          <p>Your agency <strong>${data.nomAgence}</strong> has been validated by our team.</p>
        </div>
        <p><strong>🎯 You can now:</strong></p>
        <ol>
          <li>Log in to the platform</li>
          <li>Configure your space</li>
          <li>Create access for your collaborators</li>
          <li>Manage your properties</li>
        </ol>
        <p style="text-align: center;">
          <a href="${process.env.APP_URL || 'https://jetc-immo.ch'}/login.html" class="button">
            Log in now
          </a>
        </p>
        <p><strong>📞 Need help?</strong></p>
        <p>Our team is available to help you get started with the platform.</p>
      `,
      thanks: 'Welcome to the JETC_IMMO family!'
    },
    de: {
      subject: '🎉 Mitgliedschaft validiert - Willkommen bei JETC_IMMO!',
      greeting: 'Hallo,',
      title: 'Ihre Mitgliedschaft wurde validiert!',
      message: `
        <div class="success-box">
          <p><strong>✅ Herzlichen Glückwunsch!</strong></p>
          <p>Ihre Agentur <strong>${data.nomAgence}</strong> wurde von unserem Team validiert.</p>
        </div>
        <p><strong>🎯 Sie können jetzt:</strong></p>
        <ol>
          <li>Sich auf der Plattform anmelden</li>
          <li>Ihren Bereich konfigurieren</li>
          <li>Zugänge für Ihre Mitarbeiter erstellen</li>
          <li>Ihre Immobilien verwalten</li>
        </ol>
        <p style="text-align: center;">
          <a href="${process.env.APP_URL || 'https://jetc-immo.ch'}/login.html" class="button">
            Jetzt anmelden
          </a>
        </p>
        <p><strong>📞 Brauchen Sie Hilfe?</strong></p>
        <p>Unser Team steht Ihnen zur Verfügung, um Sie bei der Einführung in die Plattform zu unterstützen.</p>
      `,
      thanks: 'Willkommen in der JETC_IMMO-Familie!'
    }
  };
  
  const t = translations[language] || translations['fr'];
  
  const content = `
    <p>${t.greeting}</p>
    <h2 style="color: #52c41a;">${t.title}</h2>
    ${t.message}
    <p style="margin-top: 30px;"><strong>${t.thanks}</strong></p>
    <p>L'équipe JETC_IMMO</p>
  `;
  
  return {
    subject: t.subject,
    html: getEmailTemplate(content, language)
  };
}

/**
 * EMAIL : Adhésion refusée
 */
function getAdhesionRefuseeEmail(data, language = 'fr') {
  const translations = {
    fr: {
      subject: 'Demande d\'adhésion - JETC_IMMO',
      greeting: 'Bonjour,',
      title: 'Suite à votre demande d\'adhésion',
      message: `
        <p>Nous avons examiné votre demande d'adhésion pour <strong>${data.nomAgence}</strong>.</p>
        <div class="warning-box">
          <p><strong>ℹ️ Motif :</strong></p>
          <p>${data.commentaire}</p>
        </div>
        <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez plus d'informations, n'hésitez pas à nous contacter.</p>
        <p>Vous pouvez également soumettre une nouvelle demande en vous assurant que toutes les informations requises sont complètes.</p>
      `,
      thanks: 'Merci de votre compréhension'
    },
    en: {
      subject: 'Membership request - JETC_IMMO',
      greeting: 'Hello,',
      title: 'Regarding your membership request',
      message: `
        <p>We have reviewed your membership request for <strong>${data.nomAgence}</strong>.</p>
        <div class="warning-box">
          <p><strong>ℹ️ Reason:</strong></p>
          <p>${data.commentaire}</p>
        </div>
        <p>If you believe this is an error or if you would like more information, please feel free to contact us.</p>
        <p>You can also submit a new request by ensuring that all required information is complete.</p>
      `,
      thanks: 'Thank you for your understanding'
    },
    de: {
      subject: 'Mitgliedsantrag - JETC_IMMO',
      greeting: 'Hallo,',
      title: 'Bezüglich Ihres Mitgliedsantrags',
      message: `
        <p>Wir haben Ihren Mitgliedsantrag für <strong>${data.nomAgence}</strong> geprüft.</p>
        <div class="warning-box">
          <p><strong>ℹ️ Grund:</strong></p>
          <p>${data.commentaire}</p>
        </div>
        <p>Wenn Sie glauben, dass dies ein Fehler ist oder wenn Sie weitere Informationen wünschen, kontaktieren Sie uns bitte.</p>
        <p>Sie können auch einen neuen Antrag stellen, indem Sie sicherstellen, dass alle erforderlichen Informationen vollständig sind.</p>
      `,
      thanks: 'Vielen Dank für Ihr Verständnis'
    }
  };
  
  const t = translations[language] || translations['fr'];
  
  const content = `
    <p>${t.greeting}</p>
    <h2 style="color: #fa8c16;">${t.title}</h2>
    ${t.message}
    <p style="margin-top: 30px;"><strong>${t.thanks}</strong></p>
    <p>L'équipe JETC_IMMO</p>
  `;
  
  return {
    subject: t.subject,
    html: getEmailTemplate(content, language)
  };
}

/**
 * Fonction d'envoi d'email
 */
async function sendEmail(to, type, data, language = 'fr') {
  try {
    console.log(`[EMAIL] Envoi email ${type} à ${to}`);
    
    // Sélectionner le template approprié
    let emailContent;
    switch (type) {
      case 'adhesion_demande':
        emailContent = getAdhesionDemandeEmail(data, language);
        break;
      case 'adhesion_validee':
        emailContent = getAdhesionValideeEmail(data, language);
        break;
      case 'adhesion_refusee':
        emailContent = getAdhesionRefuseeEmail(data, language);
        break;
      default:
        throw new Error(`Type d'email inconnu: ${type}`);
    }
    
    // Envoi de l'email
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"JETC_IMMO" <${process.env.SMTP_FROM || 'noreply@jetc-immo.ch'}>`,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html
    });
    
    console.log(`[EMAIL] ✅ Email ${type} envoyé avec succès:`, info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error(`[EMAIL] ❌ Erreur envoi email ${type}:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  getAdhesionDemandeEmail,
  getAdhesionValideeEmail,
  getAdhesionRefuseeEmail
};
