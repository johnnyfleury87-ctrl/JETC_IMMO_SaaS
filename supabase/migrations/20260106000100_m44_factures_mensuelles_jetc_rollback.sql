-- Rollback M44: Vue admin_factures_mensuelles_regies

-- Supprimer policy RLS
DROP POLICY IF EXISTS admin_factures_mensuelles_regies_select_policy ON factures;

-- Révoquer grants
REVOKE ALL ON admin_factures_mensuelles_regies FROM authenticated;
REVOKE ALL ON admin_factures_mensuelles_regies FROM PUBLIC;

-- Supprimer la vue
DROP VIEW IF EXISTS admin_factures_mensuelles_regies;

-- Supprimer les index (optionnel, peuvent être utiles pour d'autres requêtes)
DROP INDEX IF EXISTS idx_factures_date_paiement;
DROP INDEX IF EXISTS idx_factures_regie_paiement_statut;
