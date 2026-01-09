/**
 * APPLICATION MIGRATION M60: MULTI-DEVISE EUR/CHF
 * Version avec exécution par étapes via API Supabase
 * Date: 2026-01-09
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Étapes SQL séparées pour éviter les problèmes de transaction
const migrationSteps = [
  {
    name: 'Ajout currency sur regies',
    sql: `
      ALTER TABLE regies 
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR' 
      CHECK (currency IN ('EUR', 'CHF'));
    `
  },
  {
    name: 'Ajout currency sur entreprises',
    sql: `
      ALTER TABLE entreprises 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));
    `
  },
  {
    name: 'Ajout currency sur locataires',
    sql: `
      ALTER TABLE locataires 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));
    `
  },
  {
    name: 'Ajout currency sur factures',
    sql: `
      ALTER TABLE factures 
      ADD COLUMN IF NOT EXISTS currency TEXT 
      CHECK (currency IN ('EUR', 'CHF'));
    `
  },
  {
    name: 'Ajout regie_id sur entreprises',
    sql: `
      ALTER TABLE entreprises 
      ADD COLUMN IF NOT EXISTS regie_id UUID REFERENCES regies(id);
    `
  },
  {
    name: 'Index entreprises.regie_id',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_entreprises_regie_id ON entreprises(regie_id);
    `
  },
  {
    name: 'Index entreprises.currency',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_entreprises_currency ON entreprises(currency);
    `
  },
  {
    name: 'Index factures.currency',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_factures_currency ON factures(currency);
    `
  },
  {
    name: 'Index regies.currency',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_regies_currency ON regies(currency);
    `
  },
  {
    name: 'Renommer montant_reel_chf',
    sql: `
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'missions' AND column_name = 'montant_reel_chf'
        ) THEN
          ALTER TABLE missions RENAME COLUMN montant_reel_chf TO montant_reel;
        END IF;
      END $$;
    `
  },
  {
    name: 'Initialiser currency des régies',
    sql: `
      UPDATE regies 
      SET currency = CASE 
        WHEN ville IN ('Lausanne', 'Genève', 'Zurich', 'Berne', 'Bâle', 'Lucerne', 'Lugano', 'Neuchâtel', 'Fribourg', 'Sion')
        THEN 'CHF'
        WHEN ville IN ('Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille')
        THEN 'EUR'
        WHEN EXISTS (
          SELECT 1 FROM missions m
          JOIN tickets t ON t.id = m.ticket_id
          WHERE t.regie_id = regies.id AND m.devise = 'CHF'
        )
        THEN 'CHF'
        ELSE 'EUR'
      END
      WHERE currency IS NULL;
    `
  },
  {
    name: 'Lier entreprises aux régies',
    sql: `
      UPDATE entreprises e
      SET regie_id = (
        SELECT DISTINCT t.regie_id
        FROM missions m
        JOIN tickets t ON t.id = m.ticket_id
        WHERE m.entreprise_id = e.id
        LIMIT 1
      )
      WHERE regie_id IS NULL;
    `
  },
  {
    name: 'Initialiser currency des entreprises',
    sql: `
      UPDATE entreprises e
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = e.regie_id),
        (SELECT m.devise FROM missions m WHERE m.entreprise_id = e.id LIMIT 1),
        'EUR'
      )
      WHERE currency IS NULL;
    `
  },
  {
    name: 'Initialiser currency des locataires',
    sql: `
      UPDATE locataires l
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = l.regie_id),
        'EUR'
      )
      WHERE currency IS NULL;
    `
  },
  {
    name: 'Initialiser currency des factures',
    sql: `
      UPDATE factures f
      SET currency = COALESCE(
        (SELECT r.currency FROM regies r WHERE r.id = f.regie_id),
        (SELECT m.devise FROM missions m WHERE m.id = f.mission_id),
        'EUR'
      )
      WHERE currency IS NULL;
    `
  }
];

async function executeStepViaSQL(step) {
  // On va utiliser une approche différente: passer par le client admin
  try {
    // Note: L'API Supabase JS ne permet pas d'exécuter du DDL directement
    // Il faut utiliser soit:
    // 1. Une fonction RPC qui exécute du SQL dynamique (non recommandé en prod)
    // 2. Le dashboard SQL Editor (recommandé)
    // 3. Utiliser psql directement
    
    console.log(`   ⚠️  Cette étape doit être exécutée manuellement dans Supabase SQL Editor`);
    return { success: false, manual: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function applyM60Stepwise() {
  console.log('🚀 MIGRATION M60: MULTI-DEVISE EUR/CHF (Par étapes)\n');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(60), '\n');

  console.log('📋 PRÉPARATION DE LA MIGRATION\n');
  console.log(`   ${migrationSteps.length} étapes détectées\n`);

  // Créer un fichier SQL complet à exécuter manuellement
  let fullSQL = `-- ============================================
-- MIGRATION M60: MULTI-DEVISE EUR/CHF
-- Date: ${new Date().toISOString()}
-- À exécuter dans Supabase SQL Editor
-- ============================================\n\n`;

  migrationSteps.forEach((step, index) => {
    fullSQL += `-- ÉTAPE ${index + 1}: ${step.name}\n`;
    fullSQL += step.sql.trim() + ';\n\n';
  });

  // Ajouter les triggers
  fullSQL += `-- ============================================
-- TRIGGERS DE PROPAGATION
-- ============================================\n\n`;

  fullSQL += `-- Trigger: Entreprise hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_entreprise_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  IF NEW.regie_id IS NOT NULL AND NEW.currency IS NOT NULL THEN
    IF NEW.currency != (SELECT currency FROM regies WHERE id = NEW.regie_id) THEN
      RAISE EXCEPTION 'La devise de l''entreprise ne correspond pas à celle de la régie';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_entreprise_currency ON entreprises;
CREATE TRIGGER trigger_sync_entreprise_currency
BEFORE INSERT OR UPDATE OF regie_id ON entreprises
FOR EACH ROW
EXECUTE FUNCTION sync_entreprise_currency();\n\n`;

  fullSQL += `-- Trigger: Locataire hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_locataire_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_locataire_currency ON locataires;
CREATE TRIGGER trigger_sync_locataire_currency
BEFORE INSERT OR UPDATE OF regie_id ON locataires
FOR EACH ROW
EXECUTE FUNCTION sync_locataire_currency();\n\n`;

  fullSQL += `-- Trigger: Ticket hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_ticket_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.devise
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_ticket_currency ON tickets;
CREATE TRIGGER trigger_sync_ticket_currency
BEFORE INSERT OR UPDATE OF regie_id ON tickets
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_currency();\n\n`;

  fullSQL += `-- Trigger: Mission hérite devise du ticket
CREATE OR REPLACE FUNCTION sync_mission_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.devise INTO NEW.devise
    FROM tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_mission_currency ON missions;
CREATE TRIGGER trigger_sync_mission_currency
BEFORE INSERT OR UPDATE OF ticket_id ON missions
FOR EACH ROW
EXECUTE FUNCTION sync_mission_currency();\n\n`;

  fullSQL += `-- Trigger: Facture hérite devise de la régie
CREATE OR REPLACE FUNCTION sync_facture_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    SELECT currency INTO NEW.currency
    FROM regies
    WHERE id = NEW.regie_id;
  END IF;
  
  IF NEW.mission_id IS NOT NULL AND NEW.currency IS NULL THEN
    SELECT m.devise INTO NEW.currency
    FROM missions m
    WHERE m.id = NEW.mission_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_facture_currency ON factures;
CREATE TRIGGER trigger_sync_facture_currency
BEFORE INSERT OR UPDATE OF regie_id, mission_id ON factures
FOR EACH ROW
EXECUTE FUNCTION sync_facture_currency();\n\n`;

  // Vue de cohérence
  fullSQL += `-- ============================================
-- VUE DE COHÉRENCE
-- ============================================\n\n`;

  fullSQL += `CREATE OR REPLACE VIEW v_currency_coherence AS
SELECT 
  r.id AS regie_id,
  r.nom AS regie_nom,
  r.currency AS regie_currency,
  COUNT(DISTINCT e.id) FILTER (WHERE e.currency = r.currency) AS entreprises_ok,
  COUNT(DISTINCT e.id) FILTER (WHERE e.currency != r.currency) AS entreprises_ko,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency = r.currency) AS locataires_ok,
  COUNT(DISTINCT l.id) FILTER (WHERE l.currency != r.currency) AS locataires_ko,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency = r.currency) AS factures_ok,
  COUNT(DISTINCT f.id) FILTER (WHERE f.currency != r.currency) AS factures_ko
FROM regies r
LEFT JOIN entreprises e ON e.regie_id = r.id
LEFT JOIN locataires l ON l.regie_id = r.id
LEFT JOIN factures f ON f.regie_id = r.id
GROUP BY r.id, r.nom, r.currency;\n\n`;

  fullSQL += `-- ============================================
-- FIN DE LA MIGRATION
-- ============================================\n`;

  // Sauvegarder
  const filename = '_M60_EXECUTE_IN_SUPABASE.sql';
  fs.writeFileSync(filename, fullSQL);
  
  console.log(`✅ Fichier SQL généré: ${filename}\n`);
  console.log('📝 INSTRUCTIONS D\'EXÉCUTION:\n');
  console.log('   1. Ouvrir Supabase Dashboard');
  console.log('   2. Aller dans SQL Editor');
  console.log('   3. Créer une nouvelle requête');
  console.log(`   4. Copier-coller le contenu de ${filename}`);
  console.log('   5. Exécuter (RUN)');
  console.log('');
  console.log('⏱️  Durée estimée: < 1 minute');
  console.log('');

  console.log('='.repeat(60));
  console.log('⏸️  EN ATTENTE D\'EXÉCUTION MANUELLE');
  console.log('='.repeat(60));
  console.log('');
  console.log('✅ Une fois exécuté, relancer: node _verify_m60.js');
}

// Point d'entrée
if (require.main === module) {
  applyM60Stepwise()
    .then(() => {
      console.log('\n✅ Préparation terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = { applyM60Stepwise };
