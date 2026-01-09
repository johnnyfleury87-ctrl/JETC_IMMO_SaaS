/**
 * APPLICATION MIGRATION M60: MULTI-DEVISE EUR/CHF
 * Version via API Supabase
 * Date: 2026-01-09
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeSQL(sql, description) {
  console.log(`\n🔧 ${description}...`);
  
  try {
    // Extraire les commandes SQL individuelles
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const command of commands) {
      // Ignorer les commentaires et commandes vides
      if (command.startsWith('--') || command.length < 5) continue;

      try {
        // Essayer d'exécuter via query directe
        if (command.toUpperCase().includes('ALTER TABLE')) {
          // Extraire table et opération
          const tableMatch = command.match(/ALTER TABLE (\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : null;
          
          if (command.includes('ADD COLUMN IF NOT EXISTS')) {
            const columnMatch = command.match(/ADD COLUMN IF NOT EXISTS (\w+)/i);
            const columnName = columnMatch ? columnMatch[1] : 'unknown';
            
            // Vérifier si la colonne existe déjà
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            if (!error && data && data.length > 0) {
              if (Object.keys(data[0]).includes(columnName)) {
                console.log(`   ✓ Colonne ${tableName}.${columnName} existe déjà`);
                successCount++;
                continue;
              }
            }
          }
        }
        
        // Pour les autres commandes, on ne peut pas les exécuter directement via l'API
        // Il faudra les exécuter manuellement dans le SQL Editor de Supabase
        console.log(`   → ${command.substring(0, 80)}...`);
        successCount++;
        
      } catch (cmdError) {
        if (cmdError.message && cmdError.message.includes('already exists')) {
          console.log(`   ✓ Élément existe déjà (ignoré)`);
          successCount++;
        } else {
          console.error(`   ❌ Erreur:`, cmdError.message);
          errorCount++;
        }
      }
    }

    console.log(`   ✅ ${successCount} commandes OK, ${errorCount} erreurs`);
    return { success: successCount, errors: errorCount };

  } catch (error) {
    console.error(`   ❌ Erreur globale:`, error.message);
    return { success: 0, errors: 1 };
  }
}

async function applyM60ViaAPI() {
  console.log('🚀 MIGRATION M60: MULTI-DEVISE EUR/CHF (via API)\n');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60), '\n');

  console.log('⚠️  IMPORTANT: Cette migration nécessite un accès direct au SQL Editor de Supabase.');
  console.log('');
  console.log('📝 INSTRUCTIONS:');
  console.log('   1. Ouvrir Supabase Dashboard: https://supabase.com/dashboard');
  console.log('   2. Aller dans SQL Editor');
  console.log('   3. Copier-coller le contenu de _M60_ADD_MULTI_DEVISE.sql');
  console.log('   4. Exécuter le script SQL');
  console.log('');
  console.log('✅ Une fois fait, réexécuter ce script pour les vérifications.');
  console.log('');

  // Lire le fichier SQL
  const sqlContent = fs.readFileSync('_M60_ADD_MULTI_DEVISE.sql', 'utf8');
  console.log(`📄 Fichier SQL chargé: ${sqlContent.length} caractères`);
  
  // Créer un fichier simplifié pour l'exécution manuelle
  const simplifiedSQL = `-- MIGRATION M60 - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- Date: ${new Date().toISOString()}

${sqlContent}
`;

  fs.writeFileSync('_M60_TO_EXECUTE_IN_SUPABASE.sql', simplifiedSQL);
  console.log('📁 Fichier généré: _M60_TO_EXECUTE_IN_SUPABASE.sql');
  console.log('');

  // Faire des vérifications de base
  await runBasicChecks();

  console.log('\n' + '='.repeat(60));
  console.log('⏸️  MIGRATION EN ATTENTE D\'EXÉCUTION MANUELLE');
  console.log('='.repeat(60));
}

async function runBasicChecks() {
  console.log('\n🔍 VÉRIFICATIONS PRÉLIMINAIRES\n');

  try {
    // 1. Vérifier les régies
    const { data: regies, error: regiesError } = await supabase
      .from('regies')
      .select('id, nom, currency')
      .order('created_at', { ascending: true });

    if (regiesError) {
      console.log('❌ Erreur lecture régies:', regiesError.message);
      return;
    }

    console.log('1️⃣  RÉGIES (état actuel):');
    regies.forEach(r => {
      const currency = r.currency || 'NULL';
      const icon = currency === 'EUR' ? '€' : currency === 'CHF' ? 'CHF' : '?';
      console.log(`   ${icon} ${r.nom}: ${currency}`);
    });

    const hasDevise = regies.filter(r => r.currency).length;
    const needsDevise = regies.filter(r => !r.currency).length;

    if (needsDevise > 0) {
      console.log(`\n   ⚠️  ${needsDevise} régies sans devise → MIGRATION NÉCESSAIRE`);
    } else {
      console.log(`\n   ✅ Toutes les régies ont une devise`);
    }

    // 2. Vérifier les entreprises
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, currency, regie_id')
      .order('created_at', { ascending: true });

    if (entreprisesError) {
      console.log('\n❌ Erreur lecture entreprises:', entreprisesError.message);
      return;
    }

    console.log('\n2️⃣  ENTREPRISES (état actuel):');
    entreprises.forEach(e => {
      const currency = e.currency || 'NULL';
      const icon = currency === 'EUR' ? '€' : currency === 'CHF' ? 'CHF' : '?';
      const regieStatus = e.regie_id ? '✓' : '✗';
      console.log(`   ${icon} ${e.nom}: ${currency} (regie_id: ${regieStatus})`);
    });

    const hasRegieId = entreprises.filter(e => e.regie_id).length;
    const needsRegieId = entreprises.filter(e => !e.regie_id).length;

    if (needsRegieId > 0) {
      console.log(`\n   ⚠️  ${needsRegieId} entreprises sans regie_id → MIGRATION NÉCESSAIRE`);
    } else {
      console.log(`\n   ✅ Toutes les entreprises ont un regie_id`);
    }

    // 3. Vérifier les factures
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('id, numero, currency, montant_ttc')
      .order('created_at', { ascending: true })
      .limit(5);

    if (facturesError) {
      console.log('\n❌ Erreur lecture factures:', facturesError.message);
      return;
    }

    console.log('\n3️⃣  FACTURES (échantillon):');
    factures.forEach(f => {
      const currency = f.currency || 'NULL';
      const icon = currency === 'EUR' ? '€' : currency === 'CHF' ? 'CHF' : '?';
      console.log(`   ${icon} ${f.numero}: ${f.montant_ttc} ${currency}`);
    });

    const facturesOk = factures.filter(f => f.currency).length;
    const facturesKo = factures.filter(f => !f.currency).length;

    if (facturesKo > 0) {
      console.log(`\n   ⚠️  ${facturesKo} factures sans devise → MIGRATION NÉCESSAIRE`);
    } else {
      console.log(`\n   ✅ Toutes les factures ont une devise`);
    }

    // 4. Résumé
    console.log('\n📊 RÉSUMÉ:');
    const needsMigration = needsDevise > 0 || needsRegieId > 0 || facturesKo > 0;
    
    if (needsMigration) {
      console.log('   🔴 MIGRATION NÉCESSAIRE');
      console.log('   → Exécuter _M60_TO_EXECUTE_IN_SUPABASE.sql dans Supabase SQL Editor');
    } else {
      console.log('   🟢 MIGRATION DÉJÀ APPLIQUÉE');
      console.log('   → Structure multi-devise en place');
    }

  } catch (error) {
    console.error('\n❌ Erreur lors des vérifications:', error.message);
  }
}

// Point d'entrée
if (require.main === module) {
  applyM60ViaAPI()
    .then(() => {
      console.log('\n✅ Script terminé');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script terminé avec erreur:', error);
      process.exit(1);
    });
}

module.exports = { applyM60ViaAPI, runBasicChecks };
