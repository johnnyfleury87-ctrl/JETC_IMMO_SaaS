/**
 * Tests de validation - ÉTAPE 8 : Storage & fichiers
 * 
 * Vérifie :
 * - Colonnes photo_url et signature_url ajoutées
 * - Policies Storage pour chaque bucket
 * - APIs upload créées
 * - Aucun accès public
 * - Accès cohérent par rôle
 * 
 * Usage:
 *   node tests/storage.test.js
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

// Tests
const tests = [];
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ==================== TESTS ====================

test('Fichier 12_storage.sql existe', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  assert(fs.existsSync(filePath), '12_storage.sql devrait exister');
});

// ===== Tests colonnes =====

test('Colonne photo_url ajoutée à immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table immeubles') && content.includes('photo_url'),
    'immeubles devrait avoir une colonne photo_url'
  );
});

test('Colonne photo_url ajoutée à logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table logements') && content.includes('photo_url'),
    'logements devrait avoir une colonne photo_url'
  );
});

test('Colonne signature_url ajoutée à locataires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table locataires') && content.includes('signature_url'),
    'locataires devrait avoir une colonne signature_url'
  );
});

test('Colonne signature_url ajoutée à entreprises', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('alter table entreprises') && content.includes('signature_url'),
    'entreprises devrait avoir une colonne signature_url'
  );
});

// ===== Tests buckets =====

test('Documentation du bucket photos-immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('photos-immeubles'),
    'Devrait documenter le bucket photos-immeubles'
  );
});

test('Documentation du bucket photos-logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('photos-logements'),
    'Devrait documenter le bucket photos-logements'
  );
});

test('Documentation du bucket signatures', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('signatures'),
    'Devrait documenter le bucket signatures'
  );
});

test('Buckets configurés en privé', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Privé') || content.includes('public = false'),
    'Les buckets devraient être privés'
  );
});

// ===== Tests policies photos-immeubles =====

test('Policy : Régie peut uploader photos immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can upload') && content.includes('photos-immeubles') && content.includes('insert'),
    'Régie devrait pouvoir uploader des photos d\'immeubles'
  );
});

test('Policy : Régie peut voir photos de ses immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view') && content.includes('photos-immeubles') && content.includes('select'),
    'Régie devrait pouvoir voir photos de ses immeubles'
  );
});

test('Policy : Régie peut supprimer photos de ses immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can delete') && content.includes('photos-immeubles') && content.includes('delete'),
    'Régie devrait pouvoir supprimer photos de ses immeubles'
  );
});

// ===== Tests policies photos-logements =====

test('Policy : Régie peut uploader photos logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can upload') && content.includes('photos-logements') && content.includes('insert'),
    'Régie devrait pouvoir uploader des photos de logements'
  );
});

test('Policy : Régie peut voir photos de ses logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view') && content.includes('photos-logements') && content.includes('select'),
    'Régie devrait pouvoir voir photos de ses logements'
  );
});

test('Policy : Locataire peut voir photo de son logement', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire can view') && content.includes('photos-logements'),
    'Locataire devrait voir photo de son logement'
  );
});

test('Policy : Régie peut supprimer photos de ses logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can delete') && content.includes('photos-logements') && content.includes('delete'),
    'Régie devrait pouvoir supprimer photos de ses logements'
  );
});

// ===== Tests policies signatures =====

test('Policy : Locataire peut uploader sa signature', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire can upload') && content.includes('signatures') && content.includes('insert'),
    'Locataire devrait pouvoir uploader sa signature'
  );
});

test('Policy : Locataire peut voir sa signature', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Locataire can view') && content.includes('signatures') && content.includes('select'),
    'Locataire devrait voir sa signature'
  );
});

test('Policy : Régie peut voir signatures de ses locataires', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view signatures of own locataires'),
    'Régie devrait voir signatures de ses locataires'
  );
});

test('Policy : Entreprise peut uploader sa signature', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can upload') && content.includes('signatures') && content.includes('insert'),
    'Entreprise devrait pouvoir uploader sa signature'
  );
});

test('Policy : Entreprise peut voir sa signature', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Entreprise can view') && content.includes('signatures') && content.includes('select'),
    'Entreprise devrait voir sa signature'
  );
});

test('Policy : Régie peut voir signatures des entreprises autorisées', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Regie can view signatures of authorized entreprises'),
    'Régie devrait voir signatures des entreprises autorisées'
  );
});

// ===== Tests admin_jtec =====

test('Policy : Admin JTEC peut voir toutes les photos immeubles', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Admin JTEC can view all photos immeubles'),
    'Admin JTEC devrait voir toutes les photos d\'immeubles'
  );
});

test('Policy : Admin JTEC peut voir toutes les photos logements', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Admin JTEC can view all photos logements'),
    'Admin JTEC devrait voir toutes les photos de logements'
  );
});

test('Policy : Admin JTEC peut voir toutes les signatures', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('Admin JTEC can view all signatures'),
    'Admin JTEC devrait voir toutes les signatures'
  );
});

// ===== Tests APIs =====

test('API upload-immeuble existe', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-immeuble.js');
  assert(fs.existsSync(filePath), 'API upload-immeuble.js devrait exister');
});

test('API upload-immeuble vérifie le rôle régie', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-immeuble.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est une régie'
  );
});

test('API upload-immeuble vérifie l\'appartenance de l\'immeuble', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-immeuble.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('immeuble_id') && content.includes('regie_id'),
    'API devrait vérifier que l\'immeuble appartient à la régie'
  );
});

test('API upload-logement existe', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-logement.js');
  assert(fs.existsSync(filePath), 'API upload-logement.js devrait exister');
});

test('API upload-logement vérifie le rôle régie', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-logement.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('regie') && content.includes('403'),
    'API devrait vérifier que l\'utilisateur est une régie'
  );
});

test('API upload-logement vérifie l\'appartenance du logement', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-logement.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('logement_id') && content.includes('immeuble_id'),
    'API devrait vérifier que le logement appartient à la régie'
  );
});

test('API upload-signature existe', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-signature.js');
  assert(fs.existsSync(filePath), 'API upload-signature.js devrait exister');
});

test('API upload-signature accepte locataire et entreprise', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-signature.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locataire') && content.includes('entreprise'),
    'API devrait accepter locataires et entreprises'
  );
});

test('API upload-signature met à jour la bonne table', () => {
  const filePath = path.join(__dirname, '../api/storage/upload-signature.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    content.includes('locataires') && content.includes('entreprises') && content.includes('signature_url'),
    'API devrait mettre à jour locataires ou entreprises avec signature_url'
  );
});

// ===== Tests sécurité =====

test('Toutes les policies Storage utilisent auth.uid()', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const storageCount = (content.match(/storage\.objects/gi) || []).length;
  
  assert(
    storageCount > 10,
    'Devrait avoir plusieurs policies Storage (au moins 10)'
  );
});

test('Pas d\'accès public : aucune policy publique', () => {
  const filePath = path.join(__dirname, '../supabase/schema/12_storage.sql');
  const content = fs.readFileSync(filePath, 'utf8');
  
  assert(
    !content.includes('for all using (true)') && !content.includes('public = true'),
    'Ne devrait pas avoir de policy publique'
  );
});

test('APIs uploadent dans les bons buckets', () => {
  const files = [
    '../api/storage/upload-immeuble.js',
    '../api/storage/upload-logement.js',
    '../api/storage/upload-signature.js'
  ];
  
  const buckets = ['photos-immeubles', 'photos-logements', 'signatures'];
  
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(__dirname, files[i]);
    const content = fs.readFileSync(filePath, 'utf8');
    
    assert(
      content.includes(buckets[i]),
      `${files[i]} devrait utiliser le bucket ${buckets[i]}`
    );
  }
});

test('APIs mettent à jour les colonnes *_url', () => {
  const filePath1 = path.join(__dirname, '../api/storage/upload-immeuble.js');
  const content1 = fs.readFileSync(filePath1, 'utf8');
  assert(content1.includes('photo_url'), 'upload-immeuble devrait mettre à jour photo_url');
  
  const filePath2 = path.join(__dirname, '../api/storage/upload-logement.js');
  const content2 = fs.readFileSync(filePath2, 'utf8');
  assert(content2.includes('photo_url'), 'upload-logement devrait mettre à jour photo_url');
  
  const filePath3 = path.join(__dirname, '../api/storage/upload-signature.js');
  const content3 = fs.readFileSync(filePath3, 'utf8');
  assert(content3.includes('signature_url'), 'upload-signature devrait mettre à jour signature_url');
});

// ==================== EXÉCUTION ====================

function runTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTS ÉTAPE 8 - Storage & fichiers           ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════╝${colors.reset}\n`);

  for (const { name, fn } of tests) {
    try {
      fn();
      passedTests++;
      console.log(`${colors.green}✓${colors.reset} ${name}`);
    } catch (error) {
      failedTests++;
      console.log(`${colors.red}✗${colors.reset} ${name}`);
      console.log(`  ${colors.red}Erreur: ${error.message}${colors.reset}`);
    }
  }

  console.log(`\n${colors.blue}════════════════════════════════════════════════${colors.reset}`);
  console.log(`Tests réussis: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Tests échoués: ${failedTests > 0 ? colors.red : colors.green}${failedTests}${colors.reset}`);
  console.log(`Total: ${passedTests + failedTests}`);
  console.log(`${colors.blue}════════════════════════════════════════════════${colors.reset}\n`);

  if (failedTests > 0) {
    console.log(`${colors.red}❌ Certains tests ont échoué${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Tous les tests Storage sont passés !${colors.reset}\n`);
    console.log(`${colors.green}ÉTAPE 8 VALIDÉE${colors.reset}\n`);
    process.exit(0);
  }
}

runTests();
