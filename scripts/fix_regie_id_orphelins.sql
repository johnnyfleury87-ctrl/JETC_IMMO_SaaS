-- ============================================
-- SCRIPT DE DIAGNOSTIC ET CORRECTION
-- Problème: profiles.regie_id NULL après validation
-- Date: 20 décembre 2024
-- ============================================

-- ============================================
-- ÉTAPE 1 : DIAGNOSTIC
-- ============================================

-- 1.1 Vérifier les profils régie orphelins (regie_id NULL)
SELECT 
  p.id AS profile_id,
  p.email,
  p.role,
  p.regie_id,
  p.created_at AS profile_created_at,
  r.id AS regie_id_found,
  r.nom AS regie_nom,
  r.statut_validation,
  r.date_validation
FROM profiles p
LEFT JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND p.regie_id IS NULL
ORDER BY p.created_at DESC;

-- Résultat attendu:
-- Si > 0 lignes : Régies orphelines existantes (nécessite correction)
-- Si 0 lignes : Tout est OK

-- 1.2 Compter les profils orphelins
SELECT 
  COUNT(*) AS nb_profils_orphelins,
  COUNT(CASE WHEN r.statut_validation = 'valide' THEN 1 END) AS nb_orphelins_valides,
  COUNT(CASE WHEN r.statut_validation = 'en_attente' THEN 1 END) AS nb_orphelins_en_attente
FROM profiles p
LEFT JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND p.regie_id IS NULL;

-- Interprétation:
-- nb_orphelins_valides > 0 : BUG CRITIQUE (régies validées mais non rattachées)
-- nb_orphelins_en_attente > 0 : Normal (pas encore validées)

-- ============================================
-- ÉTAPE 2 : CORRECTION DES RÉGIES ORPHELINES VALIDÉES
-- ============================================

-- 2.1 PREVIEW : Voir les mises à jour qui seront faites (sans exécuter)
SELECT 
  p.id AS profile_id,
  p.email,
  p.regie_id AS current_regie_id,
  r.id AS new_regie_id,
  r.nom AS regie_nom,
  'UPDATE profiles SET regie_id = ''' || r.id || ''', updated_at = now() WHERE id = ''' || p.id || ''';' AS sql_to_execute
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND p.regie_id IS NULL
  AND r.statut_validation = 'valide';

-- Vérifier visuellement que les updates sont corrects avant d'exécuter 2.2

-- 2.2 CORRECTION : Rattacher les profils orphelins à leur régie
UPDATE profiles p
SET 
  regie_id = r.id,
  updated_at = now()
FROM regies r
WHERE p.id = r.profile_id
  AND p.role = 'regie'
  AND p.regie_id IS NULL
  AND r.statut_validation = 'valide';

-- Résultat attendu : X lignes mises à jour (où X = nb_orphelins_valides du point 1.2)

-- ============================================
-- ÉTAPE 3 : VÉRIFICATION POST-CORRECTION
-- ============================================

-- 3.1 Vérifier qu'il ne reste AUCUN profil régie orphelin validé
SELECT 
  COUNT(*) AS nb_orphelins_valides_restants
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND p.regie_id IS NULL
  AND r.statut_validation = 'valide';

-- Résultat attendu : 0
-- Si > 0 : Rejouer ÉTAPE 2.2 ou investiguer manuellement

-- 3.2 Vérifier que tous les profils régie validés ont un regie_id
SELECT 
  COUNT(*) AS total_regies_valides,
  COUNT(CASE WHEN p.regie_id IS NOT NULL THEN 1 END) AS nb_avec_regie_id,
  COUNT(CASE WHEN p.regie_id IS NULL THEN 1 END) AS nb_sans_regie_id
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND r.statut_validation = 'valide';

-- Résultat attendu :
-- nb_avec_regie_id = total_regies_valides
-- nb_sans_regie_id = 0

-- 3.3 Afficher toutes les régies validées avec leur rattachement
SELECT 
  p.id AS profile_id,
  p.email,
  p.regie_id,
  r.id AS regie_table_id,
  r.nom AS regie_nom,
  r.date_validation,
  CASE 
    WHEN p.regie_id = r.id THEN '✅ OK - Rattaché'
    WHEN p.regie_id IS NULL THEN '❌ ERREUR - Orphelin'
    ELSE '⚠️ INCOHÉRENT - regie_id ne correspond pas'
  END AS statut_rattachement
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND r.statut_validation = 'valide'
ORDER BY r.date_validation DESC;

-- Résultat attendu : Toutes les lignes doivent avoir statut_rattachement = '✅ OK - Rattaché'

-- ============================================
-- ÉTAPE 4 : TESTS DE VALIDATION FONCTIONNELS
-- ============================================

-- 4.1 Sélectionner une régie validée pour tester la connexion
SELECT 
  p.id AS profile_id,
  p.email,
  p.regie_id,
  r.nom AS regie_nom
FROM profiles p
JOIN regies r ON r.id = p.regie_id
WHERE p.role = 'regie'
  AND r.statut_validation = 'valide'
LIMIT 1;

-- Note les credentials de cette régie (email)
-- Puis :
-- 1. Se connecter sur /login.html avec cet email
-- 2. Aller sur /regie/locataires.html
-- 3. Vérifier que la page se charge sans erreur "profil introuvable"
-- 4. Vérifier que la console affiche :
--    [PROFILE LOAD] Success - Régie ID: <uuid>

-- ============================================
-- ÉTAPE 5 : MONITORING POST-DÉPLOIEMENT
-- ============================================

-- 5.1 Requête de monitoring quotidien (à exécuter après chaque validation)
SELECT 
  COUNT(*) AS total_regies,
  COUNT(CASE WHEN statut_validation = 'en_attente' THEN 1 END) AS nb_en_attente,
  COUNT(CASE WHEN statut_validation = 'valide' THEN 1 END) AS nb_valides,
  COUNT(CASE WHEN statut_validation = 'refuse' THEN 1 END) AS nb_refuses
FROM regies;

-- 5.2 Vérifier qu'aucune nouvelle régie orpheline n'apparaît
SELECT 
  p.email,
  r.nom,
  r.date_validation,
  p.regie_id
FROM profiles p
JOIN regies r ON r.profile_id = p.id
WHERE p.role = 'regie'
  AND r.statut_validation = 'valide'
  AND r.date_validation > now() - interval '7 days'
  AND p.regie_id IS NULL;

-- Résultat attendu : 0 lignes
-- Si > 0 lignes : BUG - La correction n'a pas fonctionné, investiguer immédiatement

-- 5.3 Dashboard des validations récentes
SELECT 
  r.id AS regie_id,
  r.nom,
  r.email,
  r.date_validation,
  p.regie_id AS profile_regie_id,
  a.email AS admin_email,
  CASE 
    WHEN p.regie_id = r.id THEN '✅'
    ELSE '❌'
  END AS ok
FROM regies r
JOIN profiles p ON p.id = r.profile_id
LEFT JOIN profiles a ON a.id = r.admin_validateur_id
WHERE r.statut_validation = 'valide'
  AND r.date_validation > now() - interval '30 days'
ORDER BY r.date_validation DESC;

-- Toutes les lignes doivent avoir ok = '✅'

-- ============================================
-- ÉTAPE 6 : BACKUP DE SÉCURITÉ (RECOMMANDÉ)
-- ============================================

-- 6.1 Créer une table de backup avant correction (optionnel)
CREATE TABLE IF NOT EXISTS profiles_backup_20241220 AS
SELECT * FROM profiles WHERE role = 'regie';

-- 6.2 Créer une table de backup regies (optionnel)
CREATE TABLE IF NOT EXISTS regies_backup_20241220 AS
SELECT * FROM regies;

-- Note : Ces backups peuvent être supprimés après validation complète (ÉTAPE 3)

-- ============================================
-- RÉSUMÉ DES ACTIONS
-- ============================================

/*
ORDRE D'EXÉCUTION :

1. Exécuter ÉTAPE 1 (Diagnostic)
   → Noter le nombre de profils orphelins

2. Exécuter ÉTAPE 2.1 (Preview)
   → Vérifier visuellement que les updates sont corrects

3. Exécuter ÉTAPE 2.2 (Correction)
   → Rattacher les profils orphelins

4. Exécuter ÉTAPE 3 (Vérification)
   → Confirmer que tous les profils sont rattachés

5. Exécuter ÉTAPE 4 (Tests fonctionnels)
   → Se connecter avec un compte régie et vérifier l'accès

6. Exécuter ÉTAPE 5 (Monitoring)
   → Surveiller pendant 24-48h après déploiement

RÉSULTAT ATTENDU FINAL :
✅ 0 profils orphelins validés
✅ Tous les profils régie ont un regie_id NON NULL
✅ Connexion et accès dashboard fonctionnels
✅ Aucune nouvelle régie orpheline après validation
*/

-- ============================================
-- FIN DU SCRIPT
-- ============================================
