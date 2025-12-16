/**
 * SERVEUR NODE.JS SIMPLE
 * 
 * Serveur de développement pour tester les routes API
 * En production, ce sera géré par Vercel
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'demo';

console.log('========================================');
console.log('  JETC_IMMO - Serveur de développement');
console.log('========================================');
console.log(`MODE: ${MODE}`);
console.log(`PORT: ${PORT}`);
console.log('========================================\n');

// Gestionnaire de requêtes
const server = http.createServer(async (req, res) => {
  const url = req.url;
  
  // CORS pour le développement
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Réponse aux requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${url}`);
  
  // Routes API
  if (url.startsWith('/api/')) {
    try {
      // Extraction du chemin de la route
      const routePath = url.replace('/api/', '').split('?')[0];
      const apiFilePath = path.join(__dirname, 'api', `${routePath}.js`);
      
      // Vérification de l'existence du fichier
      if (fs.existsSync(apiFilePath)) {
        // Suppression du cache pour permettre le hot-reload
        delete require.cache[require.resolve(apiFilePath)];
        
        // Import et exécution de la route
        const handler = require(apiFilePath);
        await handler(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          error: 'Route API introuvable',
          route: url
        }));
      }
    } catch (error) {
      console.error('[SERVEUR] Erreur route API:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: 'Erreur serveur',
        message: error.message
      }));
    }
    return;
  }
  
  // Servir les fichiers statiques
  if (url !== '/api/healthcheck' && !url.startsWith('/api/')) {
    try {
      // Déterminer le chemin du fichier
      let filePath;
      
      if (url === '/' || url === '') {
        filePath = path.join(__dirname, 'public', 'index.html');
      } else {
        // Retirer le / initial et chercher dans public/
        filePath = path.join(__dirname, 'public', url);
      }
      
      // Si c'est un dossier, chercher index.html
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      
      // Vérifier l'existence du fichier
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        // Déterminer le Content-Type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        // Lire et envoyer le fichier
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
      
      // Si le fichier n'existe pas dans public, chercher dans src
      const srcPath = path.join(__dirname, 'src', url.replace(/^\/src\//, ''));
      if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        const ext = path.extname(srcPath).toLowerCase();
        const contentType = ext === '.js' ? 'application/javascript' : 'text/plain';
        const content = fs.readFileSync(srcPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
      
    } catch (error) {
      console.error('[SERVEUR] Erreur lecture fichier:', error);
    }
  }
  
  // 404 pour les autres routes
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Page non trouvée</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }
        h1 { font-size: 72px; margin: 0; }
        p { font-size: 24px; }
        a { color: white; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div>
        <h1>404</h1>
        <p>Page non trouvée</p>
        <a href="/">← Retour à l'accueil</a>
      </div>
    </body>
    </html>
  `);
});

// Démarrage du serveur
server.listen(PORT, () => {
  console.log(`✅ Serveur démarré avec succès`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/healthcheck\n`);
  console.log(`Appuyez sur Ctrl+C pour arrêter\n`);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('\n[SERVEUR] Arrêt en cours...');
  server.close(() => {
    console.log('[SERVEUR] Arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SERVEUR] Arrêt en cours...');
  server.close(() => {
    console.log('[SERVEUR] Arrêté proprement');
    process.exit(0);
  });
});
