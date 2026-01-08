-- ROLLBACK M55 CASSÉE
-- À exécuter dans Supabase Dashboard > SQL Editor
-- Cela annule les changements de la migration qui a cassé l'application

-- Supprimer les nouveaux objets créés par M55
DROP VIEW IF EXISTS factures_avec_lignes CASCADE;
DROP TABLE IF EXISTS facture_lignes CASCADE;
DROP FUNCTION IF EXISTS recalculer_montant_facture() CASCADE;
DROP FUNCTION IF EXISTS update_facture_lignes_timestamp() CASCADE;
DROP FUNCTION IF EXISTS ajouter_ligne_facture(UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS modifier_ligne_facture(UUID, TEXT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS supprimer_ligne_facture(UUID) CASCADE;

-- Recréer les colonnes si elles ont été supprimées
DO $$
BEGIN
  -- Vérifier si montant_tva existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'montant_tva'
  ) THEN
    ALTER TABLE factures ADD COLUMN montant_tva NUMERIC GENERATED ALWAYS AS (
      montant_ht * (taux_tva / 100)
    ) STORED;
  END IF;

  -- Vérifier si montant_ttc existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'montant_ttc'
  ) THEN
    ALTER TABLE factures ADD COLUMN montant_ttc NUMERIC GENERATED ALWAYS AS (
      montant_ht + (montant_ht * (taux_tva / 100)) + (montant_ht * (taux_commission / 100))
    ) STORED;
  END IF;

  -- Vérifier si montant_commission existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'montant_commission'
  ) THEN
    ALTER TABLE factures ADD COLUMN montant_commission NUMERIC GENERATED ALWAYS AS (
      montant_ht * (taux_commission / 100)
    ) STORED;
  END IF;
END $$;

-- Message de confirmation
SELECT 'Rollback M55 terminé. Vous pouvez maintenant réappliquer la version corrigée.' AS status;
