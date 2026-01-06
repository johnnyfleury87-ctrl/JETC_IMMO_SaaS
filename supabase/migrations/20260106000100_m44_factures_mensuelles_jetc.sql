-- Migration M44: Vue admin_factures_mensuelles_regies
-- Description: Agrège les factures par régie et par mois pour facturation JETC
-- Date: 2025-01-06

-- =====================================================
-- Vue : admin_factures_mensuelles_regies
-- =====================================================
-- Agrège les factures payées par régie et par mois
-- Calcule : nombre de missions, montant HT total, commission JETC totale

CREATE OR REPLACE VIEW admin_factures_mensuelles_regies AS
SELECT 
  r.id AS regie_id,
  r.nom AS regie_nom,
  
  -- Période (année-mois)
  TO_CHAR(f.date_paiement, 'YYYY-MM') AS periode,
  EXTRACT(YEAR FROM f.date_paiement)::int AS annee,
  EXTRACT(MONTH FROM f.date_paiement)::int AS mois,
  
  -- Agrégations
  COUNT(DISTINCT f.id) AS nombre_factures,
  COUNT(DISTINCT f.mission_id) AS nombre_missions,
  SUM(f.montant_ht) AS total_ht,
  SUM(f.montant_commission) AS total_commission_jetc,
  
  -- Métadonnées
  MIN(f.date_paiement) AS date_paiement_min,
  MAX(f.date_paiement) AS date_paiement_max

FROM factures f
INNER JOIN regies r ON r.id = f.regie_id
WHERE f.statut = 'payee'
  AND f.date_paiement IS NOT NULL
GROUP BY 
  r.id,
  r.nom,
  TO_CHAR(f.date_paiement, 'YYYY-MM'),
  EXTRACT(YEAR FROM f.date_paiement),
  EXTRACT(MONTH FROM f.date_paiement)
ORDER BY 
  periode DESC,
  r.nom ASC;

-- Commentaire
COMMENT ON VIEW admin_factures_mensuelles_regies IS 
  'Vue pour facturation mensuelle JETC : agrège commissions par régie et par mois';

-- =====================================================
-- Grants : accessible uniquement aux admin_jtec
-- =====================================================

-- Révoquer accès par défaut
REVOKE ALL ON admin_factures_mensuelles_regies FROM PUBLIC;
REVOKE ALL ON admin_factures_mensuelles_regies FROM authenticated;

-- Grant explicite pour admin_jtec uniquement
GRANT SELECT ON admin_factures_mensuelles_regies TO authenticated;

-- RLS sur la vue (sécurité additionnelle)
ALTER VIEW admin_factures_mensuelles_regies SET (security_invoker = true);

-- Policy RLS : seuls les admin_jtec peuvent voir
CREATE POLICY admin_factures_mensuelles_regies_select_policy
  ON factures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_jtec'
    )
  );

-- =====================================================
-- Index pour performance
-- =====================================================

-- Index sur date_paiement si pas déjà présent
CREATE INDEX IF NOT EXISTS idx_factures_date_paiement 
  ON factures (date_paiement) 
  WHERE statut = 'payee';

-- Index composite pour la vue
CREATE INDEX IF NOT EXISTS idx_factures_regie_paiement_statut
  ON factures (regie_id, date_paiement, statut)
  WHERE statut = 'payee' AND date_paiement IS NOT NULL;
