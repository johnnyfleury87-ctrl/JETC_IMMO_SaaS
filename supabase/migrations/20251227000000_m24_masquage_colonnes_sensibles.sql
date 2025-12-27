-- ============================================================
-- MIGRATION M24 - Masquage conditionnel colonnes sensibles vue entreprise
-- ============================================================
-- Date: 2025-12-27
-- Phase: Sécurité RGPD
-- Objectif: Masquer locataire_id/logement_id en mode public AVANT acceptation
--           Ajouter colonne ville (immeubles.ville) pour géolocalisation
-- Dépendances: M06 (vue tickets_visibles_entreprise)
-- Règle métier: Infos sensibles visibles UNIQUEMENT si assignation OU acceptation
-- Rollback: 20251227000000_m24_masquage_colonnes_sensibles_rollback.sql
-- ============================================================

-- Supprimer vue actuelle
DROP VIEW IF EXISTS tickets_visibles_entreprise CASCADE;

-- Recréer vue avec masquage conditionnel
CREATE VIEW tickets_visibles_entreprise AS
SELECT
  -- ===== COLONNES TICKETS (identifiants et métadonnées) =====
  t.id,
  t.regie_id,
  t.entreprise_id,
  t.technicien_id,
  
  -- ===== COLONNES UUIDs SENSIBLES (masquage conditionnel) =====
  -- Règle: NULL si mode_diffusion='public' ET locked_at IS NULL (avant acceptation)
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.locataire_id
  END AS locataire_id,
  
  CASE
    WHEN t.mode_diffusion = 'public' AND t.locked_at IS NULL 
      THEN NULL
    ELSE t.logement_id
  END AS logement_id,
  
  -- ===== COLONNES TICKETS (informations techniques) =====
  t.titre,
  t.description,
  t.categorie,
  t.sous_categorie,
  t.piece,
  t.priorite,
  t.statut,
  t.urgence,
  
  -- ===== COLONNES MÉTIER (diffusion et verrouillage) =====
  t.mode_diffusion,
  t.locked_at,
  t.plafond_intervention_chf,
  t.devise,
  
  -- ===== COLONNES DATES =====
  t.date_creation,
  t.date_cloture,
  t.date_limite,
  t.created_at,
  t.updated_at,
  
  -- ===== COLONNES MEDIA =====
  t.photos,
  
  -- ===== NOUVELLE COLONNE VILLE (via JOIN immeubles) =====
  -- Décision métier: immeubles.ville uniquement (pas code_postal, pas adresse)
  -- Visible pour tous les rôles (mode public inclus)
  i.ville AS ville,
  
  -- ===== COLONNES VUE (métadonnées visibilité) =====
  re.entreprise_id AS visible_par_entreprise_id,
  re.mode_diffusion AS autorisation_mode

FROM tickets t
INNER JOIN regies_entreprises re ON re.regie_id = t.regie_id
LEFT JOIN logements lg ON lg.id = t.logement_id
LEFT JOIN immeubles i ON i.id = lg.immeuble_id

WHERE
  -- Cas 1: Tickets diffusés en mode PUBLIC
  (
    re.mode_diffusion = 'general'
    AND t.mode_diffusion = 'public'
    AND t.statut = 'en_attente'
    AND t.locked_at IS NULL
  )
  OR
  -- Cas 2: Tickets diffusés en mode ASSIGNÉ à cette entreprise
  (
    t.mode_diffusion = 'assigné'
    AND t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_attente', 'en_cours', 'termine')
  )
  OR
  -- Cas 3: Tickets acceptés par cette entreprise (historique)
  (
    t.entreprise_id = re.entreprise_id
    AND t.statut IN ('en_cours', 'termine', 'clos')
  );

-- Accorder permissions
GRANT SELECT ON tickets_visibles_entreprise TO authenticated;

-- Index déjà créés par M06 (pas de duplication)
-- idx_tickets_statut, idx_tickets_locked_at, idx_tickets_entreprise_id
-- idx_regies_entreprises_entreprise_id, idx_regies_entreprises_regie_id

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier colonnes vue modifiée
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'tickets_visibles_entreprise'
-- ORDER BY ordinal_position;
-- Attendu: locataire_id (uuid), logement_id (uuid), ville (text)

-- VALIDATION 2: Test masquage mode public AVANT acceptation
-- Pré-requis: Ticket mode_diffusion='public', locked_at IS NULL
-- Query:
-- SELECT id, titre, locataire_id, logement_id, ville
-- FROM tickets_visibles_entreprise
-- WHERE id = '<ticket_public_non_accepte>'
--   AND visible_par_entreprise_id = '<entreprise_autorisee>';
-- Attendu: locataire_id = NULL, logement_id = NULL, ville != NULL

-- VALIDATION 3: Test déverrouillage APRÈS acceptation
-- Pré-requis: Ticket locked_at NOT NULL, entreprise_id = <E1>
-- Query:
-- SELECT id, titre, locataire_id, logement_id, ville
-- FROM tickets_visibles_entreprise
-- WHERE id = '<ticket_accepte>'
--   AND visible_par_entreprise_id = '<E1>';
-- Attendu: locataire_id != NULL, logement_id != NULL, ville != NULL

-- VALIDATION 4: Test mode assigné (déverrouillage immédiat)
-- Pré-requis: Ticket mode_diffusion='assigné', entreprise_id = <E1>
-- Query:
-- SELECT id, titre, locataire_id, logement_id, ville
-- FROM tickets_visibles_entreprise
-- WHERE id = '<ticket_assigne>'
--   AND visible_par_entreprise_id = '<E1>';
-- Attendu: locataire_id != NULL, logement_id != NULL (assigné = engagement)

-- VALIDATION 5: Test invisibilité autre entreprise
-- Query:
-- SELECT COUNT(*)
-- FROM tickets_visibles_entreprise
-- WHERE id = '<ticket_accepte>'
--   AND visible_par_entreprise_id != entreprise_id;
-- Attendu: 0 (autre entreprise ne voit pas ticket accepté par E1)

-- VALIDATION 6: Test colonne ville présente
-- Query:
-- SELECT ville
-- FROM tickets_visibles_entreprise
-- WHERE ville IS NOT NULL
-- LIMIT 5;
-- Attendu: Valeurs texte (ex: "Genève", "Lausanne")

-- ============================================================
-- NOTES TECHNIQUE
-- ============================================================

-- 1. CASE WHEN logique:
--    - Mode public + locked_at NULL = entreprise voit ticket mais pas identité locataire
--    - Mode assigné OU locked_at NOT NULL = déverrouillage total
--    - Décision métier: assignation = engagement régie → infos visibles

-- 2. LEFT JOIN logements/immeubles:
--    - Nécessaire pour colonne ville
--    - LEFT (pas INNER) pour supporter tickets sans logement_id temporairement
--    - Performance: logements.immeuble_id indexé (schema 07)

-- 3. Pas de RLS sur logements/locataires:
--    - Décision métier: toute info doit passer par vue ou RPC
--    - Frontend ne doit PAS faire .from('logements').select()
--    - Masquage UUIDs = protection suffisante

-- 4. Colonne ville toujours visible:
--    - Même en mode public avant acceptation
--    - Géolocalisation acceptable métier (commune, pas adresse)
--    - Permet entreprise d'évaluer déplacement avant acceptation

-- 5. Rétrocompatibilité frontend:
--    - Vue garde même nom tickets_visibles_entreprise
--    - Frontend .from('tickets_visibles_entreprise').select('*') fonctionne
--    - Nouvelles colonnes (ville) + masquage transparent

-- ============================================================
-- FIN MIGRATION M24
-- ============================================================
