/**
 * TEMPLATE GENERATOR - Dashboards par rôle
 * 
 * Ce script génère tous les dashboards nécessaires
 * pour l'ÉTAPE 2 (placeholders)
 */

const fs = require('fs');
const path = require('path');

const roles = [
  {
    name: 'regie',
    title: '🏢 JETC_IMMO - Régie',
    welcomeText: 'Régie immobilière',
    features: [
      '<strong>ÉTAPE 4</strong> : Gérer immeubles et logements',
      '<strong>ÉTAPE 5</strong> : Valider les tickets locataires',
      '<strong>ÉTAPE 6</strong> : Diffuser les tickets (général/restreint)',
      '<strong>ÉTAPE 13</strong> : Consulter les factures'
    ]
  },
  {
    name: 'entreprise',
    title: '🏗️ JETC_IMMO - Entreprise',
    welcomeText: 'Entreprise de services',
    features: [
      '<strong>ÉTAPE 6</strong> : Voir les tickets disponibles',
      '<strong>ÉTAPE 10</strong> : Accepter/refuser des tickets',
      '<strong>ÉTAPE 11</strong> : Gérer vos techniciens',
      '<strong>ÉTAPE 13</strong> : Générer vos factures'
    ]
  },
  {
    name: 'technicien',
    title: '🔧 JETC_IMMO - Technicien',
    welcomeText: 'Technicien',
    features: [
      '<strong>ÉTAPE 11</strong> : Voir missions assignées',
      '<strong>ÉTAPE 12</strong> : Démarrer/terminer interventions',
      '<strong>ÉTAPE 12</strong> : Ajouter photos et rapports',
      '<strong>ÉTAPE 14</strong> : Messagerie avec locataires'
    ]
  },
  {
    name: 'proprietaire',
    title: '🏠 JETC_IMMO - Propriétaire',
    welcomeText: 'Propriétaire',
    features: [
      '<strong>Consultation</strong> : Voir les immeubles liés',
      '<strong>Consultation</strong> : Voir historique interventions',
      '<strong>Consultation</strong> : Rapports et statistiques',
      '<strong>Note</strong> : Rôle consultatif uniquement'
    ]
  },
  {
    name: 'admin',
    title: '⚙️ JETC_IMMO - Admin JTEC',
    welcomeText: 'Administrateur JTEC',
    features: [
      '<strong>ÉTAPE 9</strong> : Vue globale plateforme',
      '<strong>ÉTAPE 9</strong> : Statistiques agrégées',
      '<strong>ÉTAPE 15</strong> : Gestion abonnements',
      '<strong>ÉTAPE 15</strong> : Suivi revenus et commissions'
    ]
  }
];

const template = (role) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard ${role.welcomeText} - JETC_IMMO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      min-height: 100vh;
    }
    .navbar {
      background: #667eea;
      color: white;
      padding: 15px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .navbar h1 { font-size: 24px; }
    .navbar .user-info { display: flex; gap: 20px; align-items: center; }
    .btn-logout {
      background: rgba(255,255,255,0.2);
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.3); }
    .container {
      max-width: 1200px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .welcome-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      text-align: center;
    }
    .welcome-card h2 { color: #667eea; margin-bottom: 20px; font-size: 32px; }
    .welcome-card p { color: #666; line-height: 1.6; margin-bottom: 15px; }
    .info-box {
      background: #e6f7ff;
      border-left: 4px solid #1890ff;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .info-box h3 { color: #0050b3; margin-bottom: 10px; }
    .info-box ul { margin-left: 20px; color: #666; }
    .info-box li { margin: 8px 0; }
  </style>
</head>
<body>
  <nav class="navbar">
    <h1>${role.title}</h1>
    <div class="user-info">
      <span id="userEmail">Chargement...</span>
      <button class="btn-logout" onclick="logout()">Déconnexion</button>
    </div>
  </nav>

  <div class="container">
    <div class="welcome-card">
      <h2>🎉 Bienvenue sur votre dashboard</h2>
      <p><strong>Rôle :</strong> ${role.welcomeText}</p>
      <p>Vous êtes connecté en tant que <strong id="userEmailDisplay">utilisateur</strong></p>
      
      <div class="info-box">
        <h3>📋 Fonctionnalités à venir (ÉTAPES suivantes)</h3>
        <ul style="text-align: left;">
${role.features.map(f => `          <li>${f}</li>`).join('\n')}
        </ul>
      </div>

      <p style="margin-top: 30px; color: #999;">
        <small>ÉTAPE 2 - Authentification fonctionnelle ✅</small>
      </p>
    </div>
  </div>

  <script>
    // Vérifier l'authentification
    async function checkAuth() {
      const token = localStorage.getItem('jetc_access_token');
      const userStr = localStorage.getItem('jetc_user');
      
      if (!token || !userStr) {
        console.log('[DASHBOARD] Non authentifié, redirection...');
        window.location.href = '/login.html';
        return;
      }
      
      const user = JSON.parse(userStr);
      
      // Vérifier le rôle (accepter aussi admin_jtec pour admin/)
      const expectedRole = '${role.name}' === 'admin' ? 'admin_jtec' : '${role.name}';
      if (user.role !== expectedRole) {
        console.log('[DASHBOARD] Rôle incorrect:', user.role);
        alert('Accès interdit : ce dashboard est réservé aux ${role.welcomeText}');
        window.location.href = '/login.html';
        return;
      }
      
      // Afficher les infos utilisateur
      document.getElementById('userEmail').textContent = user.email;
      document.getElementById('userEmailDisplay').textContent = user.email;
      
      console.log('[DASHBOARD] Utilisateur connecté:', user);
    }

    // Déconnexion
    function logout() {
      localStorage.removeItem('jetc_access_token');
      localStorage.removeItem('jetc_refresh_token');
      localStorage.removeItem('jetc_user');
      console.log('[DASHBOARD] Déconnexion');
      window.location.href = '/index.html';
    }

    // Initialisation
    document.addEventListener('DOMContentLoaded', () => {
      checkAuth();
    });
  </script>
</body>
</html>`;

// Créer les dashboards
roles.forEach(role => {
  const dir = path.join(__dirname, 'public', role.name);
  const filePath = path.join(dir, 'dashboard.html');
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Écrire le fichier
  fs.writeFileSync(filePath, template(role));
  console.log(`✅ Créé: ${filePath}`);
});

console.log('\n✅ Tous les dashboards ont été créés !');
