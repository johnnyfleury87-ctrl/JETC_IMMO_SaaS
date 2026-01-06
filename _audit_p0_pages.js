#!/usr/bin/env node
/**
 * AUDIT P0 - PAGES HTML + AUTH + ROUTING
 * Analyse toutes les pages pour identifier:
 * - Mode d'initialisation Supabase
 * - Système d'authentification
 * - Routing par rôle
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// Pages principales à analyser
const pagesToAudit = [
  'index.html',
  'login.html',
  'register.html',
  'admin/dashboard.html',
  'regie/dashboard.html',
  'entreprise/dashboard.html',
  'entreprise/techniciens.html',
  'technicien/dashboard.html',
  'locataire/dashboard.html',
  'proprietaire/dashboard.html',
  'regie/tickets.html',
  'regie/entreprises.html',
  'regie/logements.html',
  'regie/locataires.html',
  'regie/immeubles.html'
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📄 AUDIT PAGES HTML - AUTH & ROUTING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const results = [];

for (const pagePath of pagesToAudit) {
  const fullPath = path.join(publicDir, pagePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ ${pagePath}: FICHIER NON TROUVÉ\n`);
    results.push({
      page: pagePath,
      exists: false,
      supabaseInit: 'N/A',
      authCheck: 'N/A',
      routing: 'N/A'
    });
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // Analyse du contenu
  const analysis = {
    page: pagePath,
    exists: true,
    supabaseInit: 'AUCUN',
    authCheck: false,
    routing: 'AUCUN',
    issues: []
  };

  // 1. Vérifier mode d'initialisation Supabase
  if (content.includes('/js/bootstrapSupabase.js')) {
    analysis.supabaseInit = 'BOOTSTRAP (✅ nouveau)';
  } else if (content.includes('/js/supabaseClient.js')) {
    analysis.supabaseInit = 'CLIENT.JS (⚠️ déprécié)';
    analysis.issues.push('Utilise ancien supabaseClient.js au lieu de bootstrapSupabase.js');
  } else if (content.includes('window.supabase')) {
    analysis.supabaseInit = 'INLINE (⚠️ risque)';
    analysis.issues.push('Initialisation Supabase inline dans la page');
  }

  // 2. Vérifier présence check authentification
  if (content.includes('getSession') || content.includes('auth.getSession')) {
    analysis.authCheck = true;
  }

  // 3. Vérifier routing par rôle
  if (content.includes('window.location.href') && content.includes('role')) {
    analysis.routing = 'BASÉ SUR RÔLE';
  } else if (content.includes('window.location.href')) {
    analysis.routing = 'REDIRECTION SIMPLE';
  }

  // 4. Vérifier attente __SUPABASE_READY__
  if (content.includes('__SUPABASE_READY__')) {
    analysis.supabaseInit += ' + await ready';
  } else if (analysis.supabaseInit !== 'AUCUN') {
    analysis.issues.push('N\'attend pas __SUPABASE_READY__ avant utilisation');
  }

  // 5. Détection d'erreurs potentielles
  if (content.includes('window.supabaseClient') && !content.includes('__SUPABASE_READY__')) {
    analysis.issues.push('❌ RISQUE: Utilise window.supabaseClient sans attendre __SUPABASE_READY__');
  }

  results.push(analysis);

  // Affichage
  console.log(`📄 ${pagePath}`);
  console.log(`   Init Supabase: ${analysis.supabaseInit}`);
  console.log(`   Auth check: ${analysis.authCheck ? '✅' : '❌'}`);
  console.log(`   Routing: ${analysis.routing}`);
  
  if (analysis.issues.length > 0) {
    console.log(`   ⚠️ Issues:`);
    analysis.issues.forEach(issue => {
      console.log(`      • ${issue}`);
    });
  }
  console.log('');
}

// ==========================================
// SYNTHÈSE
// ==========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SYNTHÈSE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const bootstrap = results.filter(r => r.supabaseInit.includes('BOOTSTRAP'));
const oldClient = results.filter(r => r.supabaseInit.includes('CLIENT.JS'));
const noSupabase = results.filter(r => r.supabaseInit === 'AUCUN');
const withAuth = results.filter(r => r.authCheck);
const withIssues = results.filter(r => r.issues.length > 0);

console.log(`✅ Pages utilisant bootstrapSupabase.js: ${bootstrap.length}`);
bootstrap.forEach(r => console.log(`   • ${r.page}`));
console.log('');

console.log(`⚠️ Pages utilisant ancien supabaseClient.js: ${oldClient.length}`);
oldClient.forEach(r => console.log(`   • ${r.page}`));
console.log('');

console.log(`📄 Pages sans Supabase: ${noSupabase.length}`);
noSupabase.forEach(r => console.log(`   • ${r.page}`));
console.log('');

console.log(`🔐 Pages avec check authentification: ${withAuth.length}/${results.length}`);
console.log('');

console.log(`⚠️ Pages avec problèmes: ${withIssues.length}`);
withIssues.forEach(r => {
  console.log(`   • ${r.page}:`);
  r.issues.forEach(issue => console.log(`     - ${issue}`));
});
console.log('');

// ==========================================
// ANALYSE ROUTING LOGIN
// ==========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔀 ANALYSE ROUTING LOGIN → RÔLE → PAGE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const loginPath = path.join(publicDir, 'login.html');
if (fs.existsSync(loginPath)) {
  const loginContent = fs.readFileSync(loginPath, 'utf-8');
  
  console.log('📄 login.html:');
  
  // Extraire la logique de routing
  const roleRouting = [
    { role: 'admin_jtec', page: '/admin/dashboard.html' },
    { role: 'regie', page: '/regie/dashboard.html' },
    { role: 'entreprise', page: '/entreprise/dashboard.html' },
    { role: 'technicien', page: '/technicien/dashboard.html' },
    { role: 'locataire', page: '/locataire/dashboard.html' },
    { role: 'proprietaire', page: '/proprietaire/dashboard.html' }
  ];

  roleRouting.forEach(({ role, page }) => {
    if (loginContent.includes(page)) {
      console.log(`  ✅ ${role} → ${page}`);
    } else {
      console.log(`  ❌ ${role} → ${page} (NON TROUVÉ dans le code)`);
    }
  });
  console.log('');
  
  // Vérifier méthode d'authentification
  if (loginContent.includes('signInWithPassword')) {
    console.log('  ✅ Utilise signInWithPassword (correct)');
  } else if (loginContent.includes('signIn')) {
    console.log('  ⚠️ Utilise ancienne méthode signIn');
  }
  
  if (loginContent.includes('getSession')) {
    console.log('  ✅ Vérifie session après login');
  }
  
  if (loginContent.includes('role')) {
    console.log('  ✅ Routing basé sur rôle détecté');
  }
  console.log('');
}

// ==========================================
// RECOMMANDATIONS
// ==========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 RECOMMANDATIONS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (oldClient.length > 0) {
  console.log(`1. Migrer ${oldClient.length} pages vers bootstrapSupabase.js:`);
  oldClient.forEach(r => console.log(`   • ${r.page}`));
  console.log('');
}

if (withIssues.length > 0) {
  console.log('2. Corriger les problèmes identifiés dans:');
  withIssues.forEach(r => console.log(`   • ${r.page}`));
  console.log('');
}

const withoutAuth = results.filter(r => r.exists && !r.authCheck && !r.page.includes('index') && !r.page.includes('login') && !r.page.includes('register'));
if (withoutAuth.length > 0) {
  console.log('3. Ajouter vérification auth dans:');
  withoutAuth.forEach(r => console.log(`   • ${r.page}`));
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ AUDIT PAGES TERMINÉ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Sauvegarder résultats
fs.writeFileSync(
  path.join(__dirname, '_audit_p0_pages_result.json'),
  JSON.stringify(results, null, 2)
);
console.log('💾 Résultats sauvegardés dans _audit_p0_pages_result.json\n');
