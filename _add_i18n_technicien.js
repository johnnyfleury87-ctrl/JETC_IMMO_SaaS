#!/usr/bin/env node
/**
 * SCRIPT AUTOMATIQUE D'AJOUT DATA-I18N
 * Ajoute les attributs data-i18n aux éléments HTML principaux du dashboard technicien
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/technicien/dashboard.html');
let content = fs.readFileSync(filePath, 'utf-8');

console.log('🔧 Ajout data-i18n dans dashboard technicien...');

// Liste des remplacements à effectuer
const replacements = [
  // Titre principal
  { old: '<h1>JETC_IMMO</h1>', new: '<h1 data-i18n="appName">JETC_IMMO</h1>' },
  { old: '<div class="sidebar-subtitle">Technicien</div>', new: '<div class="sidebar-subtitle" data-i18n="technicians">Techniciens</div>' },
  
  // Menu
  { old: '<span class="menu-label">Mes missions</span>', new: '<span class="menu-label" data-i18n="myMissions">Mes missions</span>' },
  
  // User info
  { old: '<div class="user-email" id="userEmail">Chargement...</div>', new: '<div class="user-email" id="userEmail" data-i18n="loading">Chargement...</div>' },
  { old: '<div class="user-role">Technicien</div>', new: '<div class="user-role" data-i18n="technicians">Technicien</div>' },
  
  // Bouton déconnexion
  { old: '<button class="btn-logout" onclick="logout()">Déconnexion</button>', new: '<button class="btn-logout" onclick="logout()" data-i18n="logout">Déconnexion</button>' },
  
  // Titre page
  { old: '<h1 style="margin-bottom: 30px; color: var(--gray-900);">Mes missions</h1>', new: '<h1 style="margin-bottom: 30px; color: var(--gray-900);" data-i18n="myMissions">Mes missions</h1>' },
  
  // Stats
  { old: '<div class="stat-label">Missions assignées</div>', new: '<div class="stat-label" data-i18n="assignedMissions">Missions assignées</div>' },
  { old: '<div class="stat-label">En cours</div>', new: '<div class="stat-label" data-i18n="statusInProgress">En cours</div>' },
  { old: '<div class="stat-label">Terminées aujourd\'hui</div>', new: '<div class="stat-label">Terminées <span data-i18n="today">aujourd\'hui</span></div>' },
  
  // Filtres
  { old: 'Toutes les missions', new: '<span data-i18n="missions">Missions</span>' },
  { old: 'En attente', new: '<span data-i18n="statusWaiting">En attente</span>' },
  
  // Appel applyTranslations après checkAuth
  {
    old: 'console.log(\'[TECH][STEP 0] ✅ Authentification OK\');\n        \n        await loadMissions();',
    new: 'console.log(\'[TECH][STEP 0] ✅ Authentification OK\');\n        \n        // Appliquer traductions\n        if (typeof applyTranslations === \'function\') {\n          applyTranslations();\n          console.log(\'[TECH][I18N] Traductions appliquées\');\n        }\n        \n        await loadMissions();'
  }
];

let modifiedCount = 0;
replacements.forEach((repl, idx) => {
  if (content.includes(repl.old)) {
    content = content.replace(repl.old, repl.new);
    modifiedCount++;
    console.log(`  ✅ Remplacement ${idx + 1}/${replacements.length}`);
  } else {
    console.log(`  ⚠️  Remplacement ${idx + 1}/${replacements.length} non trouvé`);
  }
});

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf-8');

console.log(`\n✅ ${modifiedCount}/${replacements.length} modifications appliquées`);
console.log(`📄 Fichier sauvegardé: ${filePath}`);
