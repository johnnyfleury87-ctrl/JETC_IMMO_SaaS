-- ============================================
-- VÉRIFICATION DES SIGNATURES DE FONCTIONS
-- Date: 2026-01-09
-- Objectif: Lister toutes les surcharges existantes
-- ============================================

-- Lister toutes les fonctions RPC facturation dans public
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  oidvectortypes(p.proargtypes) AS arg_types,
  pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('editer_facture', 'generate_facture_from_mission', 'calculer_montants_facture')
ORDER BY p.proname, p.pronargs;

-- ============================================
-- RÉSULTATS ATTENDUS APRÈS M61B:
-- ============================================
-- function_name                      | arg_types                   | identity_args
-- -----------------------------------+-----------------------------+--------------------------------
-- calculer_montants_facture          | numeric, text               | p_montant_ht numeric, p_currency text
-- editer_facture                     | uuid, numeric, text, text   | p_facture_id uuid, p_montant_ht numeric, p_notes text, p_iban text
-- generate_facture_from_mission      | uuid, numeric, text, text   | p_mission_id uuid, p_montant_ht numeric, p_description text, p_iban text
-- ============================================
