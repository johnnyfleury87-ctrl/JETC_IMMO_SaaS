-- =====================================================
-- ROLLBACK: HOTFIX Récursion RLS regies_entreprises
-- Date: 26 décembre 2025
-- 
-- ATTENTION: Ce rollback restaure l'état AVANT le hotfix
-- ⚠️ Après exécution, erreur "infinite recursion" reviendra
-- 
-- Utiliser UNIQUEMENT si le hotfix cause des problèmes
-- =====================================================

-- =====================================================
-- PARTIE 1: Restaurer policies originales
-- =====================================================

-- Restaurer policy tickets pour entreprises (version AVEC récursion)
DROP POLICY IF EXISTS "Entreprise can view authorized tickets" ON tickets;

CREATE POLICY "Entreprise can view authorized tickets"
ON tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM entreprises e
    WHERE e.profile_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1
          FROM regies_entreprises re
          WHERE re.entreprise_id = e.id
            AND re.regie_id = tickets.regie_id
            AND re.mode_diffusion = 'general'
            AND tickets.statut = 'ouvert'
        )
        OR
        EXISTS (
          SELECT 1
          FROM regies_entreprises re
          WHERE re.entreprise_id = e.id
            AND re.regie_id = tickets.regie_id
            AND re.mode_diffusion = 'restreint'
            AND tickets.entreprise_id = e.id
        )
      )
  )
);

-- Restaurer policy regies_entreprises pour entreprises (version AVEC récursion)
DROP POLICY IF EXISTS "Entreprise can view own authorizations" ON regies_entreprises;

CREATE POLICY "Entreprise can view own authorizations"
ON regies_entreprises FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM entreprises
    WHERE entreprises.id = regies_entreprises.entreprise_id
      AND entreprises.profile_id = auth.uid()
  )
);

-- Restaurer policy storage (version AVEC récursion)
DROP POLICY IF EXISTS "Regie can view signatures of authorized entreprises" ON storage.objects;

CREATE POLICY "Regie can view signatures of authorized entreprises"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = 'entreprises' AND
  EXISTS (
    SELECT 1
    FROM entreprises
    JOIN regies ON regies.profile_id = auth.uid()
    JOIN regies_entreprises ON regies_entreprises.regie_id = regies.id
    WHERE entreprises.id::text = (storage.foldername(name))[2]
      AND regies_entreprises.entreprise_id = entreprises.id
  )
);

-- =====================================================
-- PARTIE 2: Restaurer vue (supprimer fonction)
-- =====================================================

-- Supprimer fonction
DROP FUNCTION IF EXISTS get_tickets_visibles_entreprise(uuid);

-- Recréer vue originale
CREATE OR REPLACE VIEW tickets_visibles_entreprise AS
SELECT
  t.id as ticket_id,
  t.titre,
  t.description,
  t.categorie,
  t.priorite,
  t.statut,
  t.created_at,
  t.updated_at,
  t.locataire_id,
  t.logement_id,
  t.regie_id,
  t.entreprise_id,
  re.mode_diffusion,
  loc.nom as locataire_nom,
  loc.prenom as locataire_prenom,
  log.numero as logement_numero,
  imm.nom as immeuble_nom,
  imm.adresse as immeuble_adresse,
  reg.nom as regie_nom
FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id
JOIN locataires loc ON t.locataire_id = loc.id
JOIN logements log ON t.logement_id = log.id
JOIN immeubles imm ON log.immeuble_id = imm.id
JOIN regies reg ON t.regie_id = reg.id
WHERE
  (
    re.mode_diffusion = 'general'
    AND t.statut = 'ouvert'
  )
  OR
  (
    re.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  );

COMMENT ON VIEW tickets_visibles_entreprise IS
'JETC_IMMO - Tickets visibles par entreprise selon les règles de diffusion';

-- =====================================================
-- PARTIE 3: Supprimer fonctions helper
-- =====================================================

DROP FUNCTION IF EXISTS get_user_entreprise_id();
DROP FUNCTION IF EXISTS is_ticket_authorized_for_entreprise(uuid, uuid);
DROP FUNCTION IF EXISTS is_entreprise_authorized_for_regie(uuid, uuid);

-- =====================================================
-- VALIDATION ROLLBACK
-- =====================================================

-- Vérifier que vue existe
SELECT count(*)
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'tickets_visibles_entreprise';
-- Attendu: 1

-- Vérifier que fonctions supprimées
SELECT count(*)
FROM pg_proc
WHERE proname IN (
  'get_user_entreprise_id',
  'is_ticket_authorized_for_entreprise',
  'is_entreprise_authorized_for_regie',
  'get_tickets_visibles_entreprise'
);
-- Attendu: 0

-- =====================================================
-- RÉSULTAT
-- =====================================================

/*
⚠️ État AVANT hotfix restauré
❌ Erreur "infinite recursion" reviendra
❌ SELECT tickets/entreprises échoueront

Pour corriger à nouveau:
→ Réappliquer HOTFIX_RLS_RECURSION_REGIES_ENTREPRISES.sql
*/
