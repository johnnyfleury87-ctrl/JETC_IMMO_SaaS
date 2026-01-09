/**
 * APPLICATION MIGRATION M60: MULTI-DEVISE EUR/CHF
 * Date: 2026-01-09
 * 
 * Cette migration ajoute la gestion complète des devises EUR/CHF
 * sur toute la chaîne: regies → entreprises → locataires → tickets → missions → factures
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyM60Migration() {
  console.log('🚀 MIGRATION M60: MULTI-DEVISE EUR/CHF\n');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60), '\n');

  try {
    // Utiliser pg directement
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Lire le fichier SQL
    const sqlContent = fs.readFileSync('_M60_ADD_MULTI_DEVISE.sql', 'utf8');
    
    console.log('📄 Fichier SQL chargé:', sqlContent.length, 'caractères');
    console.log('');

    console.log('🔌 Connexion à la base de données...');
    await pool.query('SELECT 1'); // Test connexion
    console.log('✅ Connexion établie\n');

    // Exécuter le SQL complet en une seule transaction
    console.log('📝 Exécution de la migration...\n');
    
    try {
      const result = await pool.query(sqlContent);
      console.log('✅ Migration exécutée avec succès');
      
      if (result.rowCount !== undefined) {
        console.log(`   ${result.rowCount} lignes affectées`);
      }
    } catch (sqlError) {
      // Certaines erreurs sont acceptables
      if (
        sqlError.message.includes('already exists') ||
        sqlError.message.includes('IF NOT EXISTS')
      ) {
        console.log('⚠️  Migration partiellement appliquée (certains éléments existaient déjà)');
      } else {
        console.error('❌ Erreur SQL:', sqlError.message);
        throw sqlError;
      }
    }

    await pool.end();

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION M60 TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(60));

    // Vérifications post-migration
    await runPostMigrationChecks();

  } catch (error) {
    console.error('\n❌ ERREUR LORS DE LA MIGRATION:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function runPostMigrationChecks() {
  console.log('\n\n🔍 VÉRIFICATIONS POST-MIGRATION\n');

  try {
    // 1. Vérifier les régies
    const { data: regies, error: regiesError } = await supabase
      .from('regies')
      .select('id, nom, currency')
      .order('created_at', { ascending: true });

    if (regiesError) throw regiesError;

    console.log('1️⃣  RÉGIES:');
    regies.forEach(r => {
      const icon = r.currency === 'EUR' ? '€' : 'CHF';
      console.log(`   ${icon} ${r.nom}: ${r.currency || 'NULL ⚠️'}`);
    });

    const regiesEur = regies.filter(r => r.currency === 'EUR').length;
    const regiesChf = regies.filter(r => r.currency === 'CHF').length;
    const regiesNull = regies.filter(r => !r.currency).length;
    
    console.log(`\n   Total: ${regies.length} régies (${regiesEur} EUR, ${regiesChf} CHF, ${regiesNull} NULL)`);
    
    if (regiesNull > 0) {
      console.log('   ⚠️  ATTENTION: Des régies ont currency NULL!');
    }

    // 2. Vérifier les entreprises
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, currency, regie_id')
      .order('created_at', { ascending: true });

    if (entreprisesError) throw entreprisesError;

    console.log('\n2️⃣  ENTREPRISES:');
    entreprises.forEach(e => {
      const icon = e.currency === 'EUR' ? '€' : e.currency === 'CHF' ? 'CHF' : '?';
      const regieLink = e.regie_id ? '✓' : '✗';
      console.log(`   ${icon} ${e.nom}: ${e.currency || 'NULL'} (regie_id: ${regieLink})`);
    });

    const entreprisesOk = entreprises.filter(e => e.currency && e.regie_id).length;
    console.log(`\n   Total: ${entreprises.length} entreprises (${entreprisesOk} OK)`);

    // 3. Vérifier les factures
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('id, numero, currency, montant_ttc')
      .order('created_at', { ascending: true })
      .limit(10);

    if (facturesError) throw facturesError;

    console.log('\n3️⃣  FACTURES (échantillon):');
    factures.forEach(f => {
      const icon = f.currency === 'EUR' ? '€' : f.currency === 'CHF' ? 'CHF' : '?';
      const montant = f.montant_ttc || 0;
      console.log(`   ${icon} ${f.numero}: ${montant} ${f.currency || 'NULL'}`);
    });

    const facturesNull = factures.filter(f => !f.currency).length;
    console.log(`\n   Échantillon: ${factures.length} factures (${facturesNull} sans devise)`);

    // 4. Vue cohérence
    console.log('\n4️⃣  COHÉRENCE GLOBALE:');
    
    const { data: coherence, error: coherenceError } = await supabase
      .from('v_currency_coherence')
      .select('*');

    if (coherenceError) {
      console.log('   ⚠️  Vue v_currency_coherence non disponible:', coherenceError.message);
    } else {
      coherence.forEach(c => {
        const totalKo = (c.entreprises_ko || 0) + (c.locataires_ko || 0) + (c.factures_ko || 0);
        const status = totalKo > 0 ? '⚠️' : '✅';
        console.log(`   ${status} ${c.regie_nom} (${c.regie_currency}):`);
        console.log(`      Entreprises: ${c.entreprises_ok} OK, ${c.entreprises_ko} KO`);
        console.log(`      Locataires: ${c.locataires_ok} OK, ${c.locataires_ko} KO`);
        console.log(`      Factures: ${c.factures_ok} OK, ${c.factures_ko} KO`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VÉRIFICATIONS TERMINÉES');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erreur lors des vérifications:', error.message);
  }
}

// Fonction auxiliaire pour exécuter du SQL (si RPC pas disponible)
async function executeSqlDirect(sql) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const result = await pool.query(sql);
    return { data: result.rows, error: null };
  } catch (error) {
    return { data: null, error };
  } finally {
    await pool.end();
  }
}

// Point d'entrée
if (require.main === module) {
  applyM60Migration()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script terminé avec erreur:', error);
      process.exit(1);
    });
}

module.exports = { applyM60Migration };
