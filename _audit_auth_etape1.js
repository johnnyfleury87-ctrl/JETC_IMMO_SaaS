#!/usr/bin/env node
/**
 * AUDIT AUTHENTIFICATION - ÉTAPE 1
 * Vérifie toutes les routes API et leur gestion de l'authentification
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('AUDIT AUTHENTIFICATION - ÉTAPE 1');
console.log('='.repeat(60));
console.log();

const results = {
  timestamp: new Date().toISOString(),
  bugs: [],
  routes_api: [],
  frontend_calls: [],
  summary: {}
};

// 1. Lister toutes les routes API
console.log('📁 Analyse des routes API...');
const apiDir = path.join(__dirname, 'api');

function scanApiRoutes(dir, basePath = '/api') {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relativePath = fullPath.replace(__dirname, '');
    
    if (file.isDirectory() && !file.name.startsWith('_')) {
      scanApiRoutes(fullPath, `${basePath}/${file.name}`);
    } else if (file.isFile() && file.name.endsWith('.js') && !file.name.startsWith('_')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const routeName = file.name.replace('.js', '');
      const routePath = `${basePath}/${routeName}`;
      
      const usesAuth = content.includes('authenticateUser');
      const hasMiddleware = content.includes('middleware/auth');
      
      results.routes_api.push({
        path: routePath,
        file: relativePath,
        usesAuth,
        hasMiddleware,
        needsAuth: usesAuth || hasMiddleware
      });
    }
  }
}

scanApiRoutes(apiDir);

console.log(`✅ ${results.routes_api.length} routes API trouvées`);
console.log();

// 2. Analyser les appels frontend
console.log('🌐 Analyse des appels frontend...');
const publicDir = path.join(__dirname, 'public');

function scanFrontendCalls(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    const relativePath = fullPath.replace(__dirname, '');
    
    if (file.isDirectory()) {
      scanFrontendCalls(fullPath);
    } else if (file.isFile() && file.name.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Chercher les appels fetch vers /api/
      const fetchRegex = /fetch\(['"`](\/(api\/[^'"`]+))/g;
      let match;
      
      while ((match = fetchRegex.exec(content)) !== null) {
        const apiPath = '/' + match[2];
        
        // Vérifier si Authorization header est présent dans les 300 caractères suivants
        const contextStart = match.index;
        const contextEnd = Math.min(match.index + 500, content.length);
        const context = content.substring(contextStart, contextEnd);
        
        const hasAuthHeader = context.includes('Authorization') || context.includes('Bearer');
        
        results.frontend_calls.push({
          file: relativePath,
          apiPath,
          hasAuthHeader,
          lineApprox: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }
}

scanFrontendCalls(publicDir);

console.log(`✅ ${results.frontend_calls.length} appels fetch trouvés`);
console.log();

// 3. Identifier les bugs
console.log('🐛 Identification des bugs...');

for (const call of results.frontend_calls) {
  const apiRoute = results.routes_api.find(r => r.path === call.apiPath);
  
  if (apiRoute && apiRoute.needsAuth && !call.hasAuthHeader) {
    results.bugs.push({
      type: 'MISSING_AUTH_HEADER',
      severity: 'CRITIQUE',
      file: call.file,
      line: call.lineApprox,
      apiPath: call.apiPath,
      description: `L'appel à ${call.apiPath} nécessite authentification mais le header Authorization est absent`
    });
  }
}

console.log(`❌ ${results.bugs.length} bugs critiques trouvés`);
console.log();

// 4. Afficher les résultats
console.log('='.repeat(60));
console.log('RÉSULTATS DÉTAILLÉS');
console.log('='.repeat(60));
console.log();

if (results.bugs.length > 0) {
  console.log('🚨 BUGS CRITIQUES (erreurs 401 attendues) :');
  console.log();
  
  results.bugs.forEach((bug, index) => {
    console.log(`${index + 1}. ${bug.file}:${bug.line}`);
    console.log(`   API: ${bug.apiPath}`);
    console.log(`   ❌ ${bug.description}`);
    console.log();
  });
} else {
  console.log('✅ Aucun bug détecté');
}

// 5. Routes API nécessitant authentification
console.log('='.repeat(60));
console.log('ROUTES API NÉCESSITANT AUTHENTIFICATION');
console.log('='.repeat(60));
console.log();

const authRoutes = results.routes_api.filter(r => r.needsAuth);
authRoutes.forEach(route => {
  console.log(`${route.path}`);
  console.log(`  📂 ${route.file}`);
});

console.log();
console.log(`Total: ${authRoutes.length} routes authentifiées`);
console.log();

// 6. Résumé
results.summary = {
  total_routes_api: results.routes_api.length,
  routes_with_auth: authRoutes.length,
  total_frontend_calls: results.frontend_calls.length,
  calls_with_auth_header: results.frontend_calls.filter(c => c.hasAuthHeader).length,
  calls_without_auth_header: results.frontend_calls.filter(c => !c.hasAuthHeader).length,
  bugs_found: results.bugs.length
};

console.log('='.repeat(60));
console.log('RÉSUMÉ');
console.log('='.repeat(60));
console.log();
console.log(`Routes API totales: ${results.summary.total_routes_api}`);
console.log(`Routes avec auth: ${results.summary.routes_with_auth}`);
console.log(`Appels frontend totaux: ${results.summary.total_frontend_calls}`);
console.log(`Appels avec header auth: ${results.summary.calls_with_auth_header}`);
console.log(`Appels sans header auth: ${results.summary.calls_without_auth_header}`);
console.log(`🐛 Bugs critiques: ${results.summary.bugs_found}`);
console.log();

// 7. Sauvegarder le rapport
const reportPath = path.join(__dirname, '_AUDIT_AUTH_ETAPE1_RESULTS.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`📄 Rapport complet sauvegardé: ${reportPath}`);
console.log();

process.exit(results.bugs.length > 0 ? 1 : 0);
