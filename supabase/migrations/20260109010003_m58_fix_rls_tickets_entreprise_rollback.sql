-- ============================================================
-- ROLLBACK M58: Fix Vue tickets_visibles_entreprise
-- ============================================================
-- Date: 2026-01-09
-- Type: ROLLBACK
-- Forward: 20260109010003_m58_fix_vue_tickets_entreprise.sql
-- ============================================================

\echo '⏪ Rollback M58: Restauration vue originale...'

-- Restaurer vue M17 originale (avec bug statut='ouvert')
CREATE OR REPLACE VIEW tickets_visibles_entreprise AS
SELECT
  -- Ticket
  t.id AS ticket_id,
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

  -- Autorisation entreprise
  re.mode_diffusion,

  -- Locataire
  loc.nom AS locataire_nom,
  loc.prenom AS locataire_prenom,

  -- Logement
  log.numero AS logement_numero,

  -- Immeuble
  imm.nom AS immeuble_nom,
  imm.adresse AS immeuble_adresse,

  -- Régie
  reg.nom AS regie_nom

FROM tickets t
JOIN regies_entreprises re ON t.regie_id = re.regie_id
JOIN locataires loc ON t.locataire_id = loc.id
JOIN logements log ON t.logement_id = log.id
JOIN immeubles imm ON log.immeuble_id = imm.id
JOIN regies reg ON t.regie_id = reg.id
WHERE
  (
    re.mode_diffusion = 'general'
    AND t.statut = 'ouvert'  -- ❌ BUG: devrait être en_attente
  )
  OR
  (
    re.mode_diffusion = 'restreint'
    AND t.entreprise_id = re.entreprise_id
  );

COMMENT ON VIEW tickets_visibles_entreprise IS
'JETC_IMMO - Tickets visibles par entreprise selon les règles de diffusion.
ATTENTION: Filtre statut=ouvert (bug connu, devrait être en_attente).';

\echo '✅ Rollback M58: Vue M17 restaurée'
