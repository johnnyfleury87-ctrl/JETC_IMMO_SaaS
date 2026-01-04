-- ============================================================
-- SCRIPT PRÉ-DÉPLOIEMENT: Vérification état système M31-M35
-- ============================================================
-- Objectif: Valider que le système est prêt pour application M31-M35
-- Usage: Exécuter AVANT déploiement pour identifier problèmes
-- ============================================================

\echo '🔍 AUDIT PRÉ-DÉPLOIEMENT M31-M35'
\echo '================================'
\echo ''

-- ============================================================
-- CHECK 1: Vérifier migrations précédentes (M26-M30)
-- ============================================================
\echo '📋 CHECK 1: Migrations M26-M30...'

DO $$
DECLARE
  v_has_mode_diffusion boolean;
  v_has_rls_policies boolean;
BEGIN
  -- Vérifier colonne mode_diffusion existe (M30)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'mode_diffusion'
  ) INTO v_has_mode_diffusion;
  
  -- Vérifier au moins 1 policy RLS tickets
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tickets'
  ) INTO v_has_rls_policies;
  
  IF v_has_mode_diffusion THEN
    RAISE NOTICE '  ✅ Colonne mode_diffusion existe (M30 appliquée)';
  ELSE
    RAISE WARNING '  ⚠️ Colonne mode_diffusion manquante - Appliquer M30 d''abord!';
  END IF;
  
  IF v_has_rls_policies THEN
    RAISE NOTICE '  ✅ Policies RLS tickets existent';
  ELSE
    RAISE WARNING '  ⚠️ Aucune policy RLS tickets - Vérifier M26-M29';
  END IF;
END $$;

\echo ''

-- ============================================================
-- CHECK 2: État actuel colonnes tickets
-- ============================================================
\echo '📋 CHECK 2: Colonnes table tickets...'

SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name IN ('plafond_valide_par', 'plafond_valide_at', 'diffuse_par', 'diffuse_at') 
      THEN '❌ M31 pas encore appliquée'
    ELSE '✅ Existante'
  END as statut
FROM information_schema.columns
WHERE table_name = 'tickets'
  AND column_name IN (
    'mode_diffusion', 
    'plafond_intervention_chf',
    'plafond_valide_par',
    'plafond_valide_at',
    'diffuse_par',
    'diffuse_at'
  )
ORDER BY column_name;

\echo ''

-- ============================================================
-- CHECK 3: Vérifier valeurs mode_diffusion actuelles
-- ============================================================
\echo '📋 CHECK 3: Valeurs mode_diffusion existantes...'

SELECT 
  mode_diffusion,
  COUNT(*) as nb_tickets,
  CASE 
    WHEN mode_diffusion IN ('general', 'restreint') THEN '✅ Terminologie correcte'
    WHEN mode_diffusion IN ('public', 'assigné') THEN '⚠️ Terminologie obsolète (M35 va migrer)'
    ELSE '❓ Valeur inattendue'
  END as statut
FROM tickets
WHERE mode_diffusion IS NOT NULL
GROUP BY mode_diffusion
ORDER BY mode_diffusion;

\echo ''

-- ============================================================
-- CHECK 4: Policies RLS entreprise actuelles
-- ============================================================
\echo '📋 CHECK 4: Policies RLS entreprise...'

SELECT 
  policyname,
  cmd,
  CASE 
    WHEN policyname IN ('Entreprise can view general tickets', 'Entreprise can view assigned tickets') 
      THEN '✅ M34-M35 appliquée'
    WHEN policyname LIKE '%Entreprise%' 
      THEN '⚠️ Policy obsolète (sera remplacée par M34-M35)'
    ELSE '❓'
  END as statut
FROM pg_policies
WHERE tablename = 'tickets'
  AND policyname LIKE '%Entreprise%'
ORDER BY policyname;

\echo ''

-- ============================================================
-- CHECK 5: RPC existantes
-- ============================================================
\echo '📋 CHECK 5: RPC tickets...'

SELECT 
  proname as fonction_name,
  CASE 
    WHEN proname = 'valider_ticket_regie' THEN '✅ M32 appliquée'
    WHEN proname = 'get_entreprises_autorisees' THEN '✅ M33 appliquée'
    WHEN proname IN ('update_ticket_regie', 'update_ticket_statut') THEN '⚠️ RPC obsolète (remplacée par M32)'
    ELSE '❓'
  END as statut
FROM pg_proc
WHERE proname IN (
  'valider_ticket_regie',
  'get_entreprises_autorisees',
  'update_ticket_regie',
  'update_ticket_statut',
  'create_ticket_locataire',
  'get_tickets_list_regie'
)
ORDER BY proname;

\echo ''

-- ============================================================
-- CHECK 6: Données test/debug à nettoyer
-- ============================================================
\echo '📋 CHECK 6: Données test/debug...'

SELECT 
  COUNT(*) as nb_tickets_test,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Tickets de test présents (nettoyer avant prod?)'
    ELSE '✅ Aucun ticket de test'
  END as recommandation
FROM tickets
WHERE titre LIKE 'TEST%' OR titre LIKE '%test%' OR titre LIKE '%DEBUG%';

\echo ''

-- ============================================================
-- CHECK 7: Intégrité données existantes
-- ============================================================
\echo '📋 CHECK 7: Intégrité données tickets...'

WITH validation AS (
  SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE regie_id IS NULL) as sans_regie,
    COUNT(*) FILTER (WHERE locataire_id IS NULL) as sans_locataire,
    COUNT(*) FILTER (WHERE logement_id IS NULL) as sans_logement,
    COUNT(*) FILTER (WHERE statut = 'nouveau' AND mode_diffusion IS NOT NULL) as nouveau_avec_mode,
    COUNT(*) FILTER (WHERE statut IN ('en_attente', 'en_cours') AND plafond_intervention_chf IS NULL OR plafond_intervention_chf <= 0) as attente_sans_plafond
  FROM tickets
)
SELECT 
  total_tickets as "Total tickets",
  sans_regie as "❌ Sans régie (invalide)",
  sans_locataire as "❌ Sans locataire (invalide)",
  sans_logement as "❌ Sans logement (invalide)",
  nouveau_avec_mode as "⚠️ Nouveau avec mode (incohérent)",
  attente_sans_plafond as "⚠️ En attente sans plafond (incohérent)"
FROM validation;

\echo ''

-- ============================================================
-- RÉSUMÉ ET RECOMMANDATIONS
-- ============================================================
\echo '================================'
\echo '📊 RÉSUMÉ AUDIT'
\echo '================================'

DO $$
DECLARE
  v_ready_for_m31_m35 boolean := true;
  v_warning_count int := 0;
BEGIN
  -- Vérifier prérequis critiques
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'mode_diffusion'
  ) THEN
    v_ready_for_m31_m35 := false;
    RAISE NOTICE '❌ BLOQUANT: Colonne mode_diffusion manquante - Appliquer M30 avant M31-M35';
  END IF;
  
  -- Compter warnings
  SELECT COUNT(*) INTO v_warning_count
  FROM tickets
  WHERE mode_diffusion IN ('public', 'assigné');
  
  IF v_warning_count > 0 THEN
    RAISE NOTICE '⚠️ % tickets avec terminologie obsolète (normal, M35 va migrer)', v_warning_count;
  END IF;
  
  -- Recommandation finale
  RAISE NOTICE '';
  IF v_ready_for_m31_m35 THEN
    RAISE NOTICE '✅ SYSTÈME PRÊT POUR APPLICATION M31-M35';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Actions suivantes:';
    RAISE NOTICE '   1. Backup base de données';
    RAISE NOTICE '   2. Appliquer migration consolidée: 20260104000000_m31_m35_workflow_complet_consolidated.sql';
    RAISE NOTICE '   3. Déployer frontend: public/regie/tickets.html';
    RAISE NOTICE '   4. Exécuter tests: tests/validation_ticket_workflow.sql';
  ELSE
    RAISE NOTICE '❌ SYSTÈME PAS PRÊT - Corriger erreurs bloquantes avant M31-M35';
  END IF;
END $$;

\echo ''
\echo '================================'
