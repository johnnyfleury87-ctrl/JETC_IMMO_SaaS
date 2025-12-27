-- ============================================================
-- ROLLBACK M26 - Supprimer policy INSERT entreprises régie
-- ============================================================
-- Restaure état AVANT M26 (régie ne peut PAS créer entreprises)
-- À utiliser SI bugs détectés après déploiement M26
-- ============================================================

-- Supprimer policy INSERT ajoutée par M26
DROP POLICY IF EXISTS "Regie can insert entreprise" ON entreprises;

-- ⚠️ ATTENTION: Rollback retire autorisation
-- Régie ne pourra PLUS créer entreprises via frontend
-- Entreprises créées par M26 restent en base (pas de suppression données)

-- Vérification policies restantes après rollback:
-- SELECT policyname FROM pg_policies WHERE tablename = 'entreprises';
-- Attendu:
-- - "Entreprise can insert own profile" (18_rls.sql)
-- - "Entreprise can update own profile" (18_rls.sql)
-- - "Regie can view authorized entreprises" (18_rls.sql)
-- - "Admin JTEC can view all entreprises" (18_rls.sql)

-- ============================================================
-- FIN ROLLBACK M26
-- ============================================================
