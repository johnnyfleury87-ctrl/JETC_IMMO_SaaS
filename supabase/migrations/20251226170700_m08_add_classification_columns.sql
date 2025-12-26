-- ============================================================
-- MIGRATION M08 - Ajouter colonnes classification tickets
-- ============================================================
-- Date: 2025-12-26
-- Phase: 2 (Enrichissement fonctionnel)
-- Objectif: Ajouter sous_categorie et piece pour classification métier
-- Dépendances: PHASE 1 complète (M01-M07)
-- Rollback: 20251226170700_m08_add_classification_columns_rollback.sql
-- ============================================================

-- Ajouter colonne sous_categorie (nullable pour tickets legacy)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS sous_categorie text;

-- Ajouter colonne piece (nullable pour tickets legacy)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS piece text;

-- Contrainte CHECK sous_categorie (valeurs métier selon categorie)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_sous_categorie_valide') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_sous_categorie_valide 
    CHECK (
      sous_categorie IS NULL 
      OR (categorie = 'plomberie' AND sous_categorie IN ('Fuite d''eau', 'WC bouché', 'Chauffe-eau', 'Robinetterie', 'Autre plomberie'))
      OR (categorie = 'electricite' AND sous_categorie IN ('Panne générale', 'Prise défectueuse', 'Interrupteur', 'Éclairage', 'Autre électricité'))
      OR (categorie = 'chauffage' AND sous_categorie IN ('Radiateur', 'Chaudière', 'Thermostat', 'Autre chauffage'))
      OR (categorie = 'serrurerie' AND sous_categorie IN ('Porte bloquée', 'Clé perdue', 'Verrou défectueux', 'Autre serrurerie'))
      OR (categorie = 'vitrerie' AND sous_categorie IN ('Vitre cassée', 'Double vitrage', 'Autre vitrerie'))
      OR (categorie = 'menuiserie' AND sous_categorie IN ('Porte', 'Fenêtre', 'Parquet', 'Autre menuiserie'))
      OR (categorie = 'peinture' AND sous_categorie IN ('Murs', 'Plafond', 'Boiseries', 'Autre peinture'))
      OR (categorie = 'autre' AND sous_categorie IN ('Autre intervention'))
    );
  END IF;
END $$;

-- Contrainte CHECK piece (valeurs enum métier)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_piece_valide') THEN
    ALTER TABLE tickets ADD CONSTRAINT check_piece_valide 
    CHECK (
      piece IS NULL 
      OR piece IN ('cuisine', 'salle_de_bain', 'chambre', 'salon', 'wc', 'entree', 'couloir', 'balcon', 'cave', 'garage', 'exterieur', 'parties_communes', 'autre')
    );
  END IF;
END $$;

-- Index pour requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_tickets_sous_categorie 
ON tickets(sous_categorie) 
WHERE sous_categorie IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_piece 
ON tickets(piece) 
WHERE piece IS NOT NULL;

-- ============================================================
-- VALIDATION QUERIES (à exécuter après migration)
-- ============================================================

-- VALIDATION 1: Vérifier colonnes créées
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tickets' 
-- AND column_name IN ('sous_categorie', 'piece');
-- Attendu: 2 lignes (text, YES pour les deux)

-- VALIDATION 2: Vérifier contraintes
-- SELECT conname FROM pg_constraint 
-- WHERE conname IN ('check_sous_categorie_valide', 'check_piece_valide');
-- Attendu: 2 lignes

-- VALIDATION 3: Vérifier index
-- SELECT indexname FROM pg_indexes 
-- WHERE indexname IN ('idx_tickets_sous_categorie', 'idx_tickets_piece');
-- Attendu: 2 lignes

-- VALIDATION 4: Test INSERT valide (staging uniquement)
-- INSERT INTO tickets (titre, description, categorie, sous_categorie, piece, priorite, locataire_id, logement_id)
-- VALUES ('Test M08', 'Test classification', 'plomberie', 'Fuite d''eau', 'cuisine', 'normale', 
--   '<locataire_id_test>', '<logement_id_test>')
-- RETURNING id, categorie, sous_categorie, piece;
-- Attendu: 1 ligne avec ('plomberie', 'Fuite d''eau', 'cuisine')
-- CLEANUP: DELETE FROM tickets WHERE titre = 'Test M08';

-- VALIDATION 5: Test contrainte sous_categorie invalide (doit échouer - staging uniquement)
-- UPDATE tickets SET sous_categorie = 'InvalidValue' WHERE id = '<ticket_id_test>';
-- Attendu: ERROR - new row violates check constraint "check_sous_categorie_valide"

-- VALIDATION 6: Test contrainte piece invalide (doit échouer - staging uniquement)
-- UPDATE tickets SET piece = 'invalid_room' WHERE id = '<ticket_id_test>';
-- Attendu: ERROR - new row violates check constraint "check_piece_valide"

-- VALIDATION 7: Test cohérence sous_categorie/categorie (doit échouer - staging uniquement)
-- UPDATE tickets SET categorie = 'plomberie', sous_categorie = 'Panne générale' WHERE id = '<ticket_id_test>';
-- Attendu: ERROR - 'Panne générale' n'est pas valide pour categorie 'plomberie'

-- ============================================================
-- FIN MIGRATION M08
-- ============================================================
