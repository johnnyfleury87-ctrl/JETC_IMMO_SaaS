/**
 * Migration M17: Fix check_piece_valide - Insensible à la casse
 * 
 * Problème: La contrainte check_piece_valide échoue quand le frontend envoie 'Cuisine' au lieu de 'cuisine'
 * Solution: Remplacer la contrainte par une version qui normalise en minuscules via LOWER()
 * 
 * Compatibilité: Toutes les données existantes restent valides
 */

-- Supprimer l'ancienne contrainte
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_piece_valide;

-- Recréer avec LOWER() pour être insensible à la casse
ALTER TABLE tickets ADD CONSTRAINT check_piece_valide 
CHECK (
  piece IS NULL 
  OR LOWER(piece) IN ('cuisine', 'salle_de_bain', 'chambre', 'salon', 'wc', 'entree', 'couloir', 'balcon', 'cave', 'garage', 'exterieur', 'parties_communes', 'autre')
);

-- ============================================================
-- VALIDATION (à exécuter après migration)
-- ============================================================

-- Test 1: Valider que 'Cuisine' (majuscule) passe maintenant
-- INSERT INTO tickets (titre, description, categorie, piece, locataire_id, logement_id, regie_id)
-- VALUES ('Test', 'Test', 'plomberie', 'Cuisine', 'uuid-locataire', 'uuid-logement', 'uuid-regie');
-- Attendu: SUCCESS

-- Test 2: Valider que 'cuisine' (minuscule) fonctionne toujours
-- INSERT INTO tickets (titre, description, categorie, piece, locataire_id, logement_id, regie_id)
-- VALUES ('Test', 'Test', 'plomberie', 'cuisine', 'uuid-locataire', 'uuid-logement', 'uuid-regie');
-- Attendu: SUCCESS

-- Test 3: Valider qu'une valeur invalide est rejetée
-- INSERT INTO tickets (titre, description, categorie, piece, locataire_id, logement_id, regie_id)
-- VALUES ('Test', 'Test', 'plomberie', 'INVALIDE', 'uuid-locataire', 'uuid-logement', 'uuid-regie');
-- Attendu: ERROR - violates check constraint "check_piece_valide"
