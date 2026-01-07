#!/usr/bin/env node
/**
 * VALIDATION SYNTAXE - Dashboard Technicien
 * Extrait et valide tout le JavaScript du fichier HTML
 */

const fs = require('fs');

console.log('\n🔍 VALIDATION SYNTAXE JAVASCRIPT\n');

const html = fs.readFileSync('public/technicien/dashboard.html', 'utf8');

// Extraire tous les blocs <script> non-src
const scriptMatches = html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
let scriptBlocks = [];

for (const match of scriptMatches) {
  const scriptContent = match[1].trim();
  
  if (scriptContent) {
    scriptBlocks.push({
      content: scriptContent,
      startPos: match.index
    });
  }
}

console.log(`📦 ${scriptBlocks.length} blocs JavaScript trouvés\n`);

let errors = [];

// Valider chaque bloc
scriptBlocks.forEach((block, index) => {
  try {
    // Vérifier syntaxe basique
    new Function(block.content);
    console.log(`✅ Bloc ${index + 1}: OK`);
  } catch (error) {
    console.log(`❌ Bloc ${index + 1}: ERREUR`);
    console.log(`   ${error.message}`);
    
    // Trouver ligne approximative
    const linesBefore = html.substring(0, block.startPos).split('\n').length;
    console.log(`   Ligne HTML approximative: ${linesBefore}`);
    console.log('');
    
    errors.push({
      block: index + 1,
      error: error.message,
      line: linesBefore
    });
  }
});

console.log('\n═══════════════════════════════════════════════════════════════');

if (errors.length === 0) {
  console.log('✅ AUCUNE ERREUR DE SYNTAXE DÉTECTÉE\n');
  process.exit(0);
} else {
  console.log(`❌ ${errors.length} ERREUR(S) DÉTECTÉE(S)\n`);
  errors.forEach(err => {
    console.log(`   Bloc ${err.block} (ligne ~${err.line}): ${err.error}`);
  });
  console.log('');
  process.exit(1);
}
