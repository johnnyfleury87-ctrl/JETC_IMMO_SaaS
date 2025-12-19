# 📧 Configuration SMTP - JETC_IMMO

## Vue d'ensemble

Le système d'emails de JETC_IMMO utilise **Nodemailer** pour envoyer des emails HTML professionnels lors du workflow d'adhésion.

## 🔧 Configuration requise

### Variables d'environnement

Ajouter dans votre fichier `.env` :

```dotenv
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
SMTP_FROM=noreply@jetc-immo.ch

# Application URL
APP_URL=https://jetc-immo.ch
```

## 📮 Fournisseurs SMTP supportés

### 1. Gmail (Recommandé pour dev)

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # App Password
```

**Configuration Gmail :**
1. Activer l'authentification à 2 facteurs
2. Générer un "App Password" : https://myaccount.google.com/apppasswords
3. Utiliser ce mot de passe dans `SMTP_PASS`

**Limitations :**
- 500 emails/jour (compte gratuit)
- 2000 emails/jour (Google Workspace)

---

### 2. SendGrid (Recommandé pour production)

```dotenv
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxx  # API Key
```

**Configuration SendGrid :**
1. Créer un compte : https://sendgrid.com
2. Générer une API Key : Settings > API Keys
3. Utiliser `apikey` comme username

**Avantages :**
- 100 emails/jour (gratuit)
- 40,000+ emails/mois (payant)
- Analytics intégrés
- IP dédiée disponible

---

### 3. Mailgun

```dotenv
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@votre-domaine.mailgun.org
SMTP_PASS=votre-cle-api
```

**Configuration Mailgun :**
1. Créer un compte : https://mailgun.com
2. Vérifier votre domaine
3. Récupérer les credentials SMTP

**Avantages :**
- 5,000 emails/mois (gratuit)
- API REST complète
- Validation d'emails
- Logs détaillés

---

### 4. AWS SES (Pour gros volumes)

```dotenv
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIAXXXXXXXXXX
SMTP_PASS=xxxxxxxxxxxxxxxxxxxxxxxxx
```

**Configuration AWS SES :**
1. Activer SES dans la console AWS
2. Créer des credentials SMTP
3. Sortir du "Sandbox mode" (demande à AWS)

**Avantages :**
- $0.10 pour 1,000 emails
- Très scalable
- Intégration AWS complète

---

## 🧪 Test de configuration

### Test manuel

Créer un fichier `test-email.js` :

```javascript
const { sendEmail } = require('./api/services/emailService');

async function test() {
  const result = await sendEmail(
    'votre-email@example.com',
    'adhesion_demande',
    {
      email: 'test@example.com',
      nomAgence: 'Test Agency',
      nbCollaborateurs: 5,
      nbLogements: 100,
      siret: '12345678901234'
    },
    'fr'
  );
  
  console.log('Résultat:', result);
}

test();
```

Exécuter :
```bash
node test-email.js
```

---

## 📧 Types d'emails

### 1. Email de demande d'adhésion

**Trigger :** Quand une régie soumet sa demande  
**Template :** `adhesion_demande`  
**Contenu :**
- Confirmation de réception
- Récapitulatif des informations
- Prochaines étapes
- Délai estimé (24-48h)

---

### 2. Email de validation

**Trigger :** Quand un admin valide l'adhésion  
**Template :** `adhesion_validee`  
**Contenu :**
- Félicitations
- Accès maintenant disponible
- Bouton "Se connecter"
- Instructions configuration

---

### 3. Email de refus

**Trigger :** Quand un admin refuse l'adhésion  
**Template :** `adhesion_refusee`  
**Contenu :**
- Notification du refus
- Motif détaillé
- Possibilité de re-soumettre

---

## 🎨 Personnalisation des templates

Les templates sont dans `/api/services/emailService.js`.

### Modifier le design

```javascript
function getEmailTemplate(content, language) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Modifier les styles CSS ici */
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}
```

### Ajouter une langue

```javascript
const translations = {
  fr: { /* ... */ },
  en: { /* ... */ },
  de: { /* ... */ },
  it: { // ← NOUVEAU
    subject: 'Richiesta di adesione ricevuta',
    // ...
  }
};
```

---

## 🔍 Troubleshooting

### Problème : Emails non reçus

**Vérifications :**
1. ✅ Variables SMTP configurées dans `.env`
2. ✅ Vérifier les logs : `grep "EMAIL" logs.txt`
3. ✅ Vérifier le dossier spam
4. ✅ Tester avec `test-email.js`

### Problème : Erreur "Authentication failed"

**Solution :**
- Gmail : Utiliser un "App Password" (pas le mot de passe principal)
- SendGrid : Vérifier que la clé API est valide
- Vérifier `SMTP_USER` et `SMTP_PASS`

### Problème : Erreur "Connection timeout"

**Solution :**
- Vérifier `SMTP_HOST` et `SMTP_PORT`
- Vérifier que le port 587 n'est pas bloqué par le firewall
- Essayer le port 465 avec `secure: true`

### Problème : Emails marqués comme spam

**Solution :**
1. Configurer SPF/DKIM/DMARC sur votre domaine
2. Utiliser un domaine vérifié
3. Éviter les mots-clés spam dans le contenu
4. Utiliser un fournisseur réputé (SendGrid, Mailgun)

---

## 📊 Monitoring

### Logs à surveiller

```bash
# Voir tous les emails envoyés
grep "EMAIL.*envoyé" logs.txt

# Voir les erreurs d'envoi
grep "EMAIL.*Erreur" logs.txt

# Statistiques
grep -c "adhesion_demande" logs.txt
grep -c "adhesion_validee" logs.txt
grep -c "adhesion_refusee" logs.txt
```

### Métriques recommandées

- **Taux de délivrabilité** : % emails livrés
- **Taux d'ouverture** : % emails ouverts (nécessite tracking)
- **Taux de clic** : % liens cliqués
- **Taux de bounce** : % emails rejetés

---

## 🚀 Déploiement Production

### Checklist

- [ ] Choisir un fournisseur SMTP professionnel (SendGrid/Mailgun)
- [ ] Configurer SPF/DKIM sur le domaine
- [ ] Vérifier le domaine d'envoi
- [ ] Tester avec une vraie adresse email
- [ ] Configurer les variables dans Vercel/Heroku
- [ ] Activer le monitoring des emails
- [ ] Prévoir un fallback si SMTP down

### Variables Vercel

```bash
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add SMTP_FROM
vercel env add APP_URL
```

---

## 📚 Documentation Nodemailer

- Site officiel : https://nodemailer.com
- Configuration : https://nodemailer.com/smtp/
- OAuth2 : https://nodemailer.com/smtp/oauth2/

---

## 🆘 Support

**En cas de problème :**

1. Consulter la doc Nodemailer
2. Vérifier les logs serveur
3. Tester avec un autre fournisseur SMTP
4. Contacter le support de votre fournisseur SMTP

---

*Dernière mise à jour : 19 décembre 2025*
