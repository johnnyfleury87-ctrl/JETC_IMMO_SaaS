/**
 * Rollback M17: Restaurer check_piece_valide sensible à la casse
 */

-- Supprimer la contrainte insensible à la casse
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS check_piece_valide;

-- Restaurer l'ancienne contrainte (sensible à la casse)
ALTER TABLE tickets ADD CONSTRAINT check_piece_valide 
CHECK (
  piece IS NULL 
  OR piece IN ('cuisine', 'salle_de_bain', 'chambre', 'salon', 'wc', 'entree', 'couloir', 'balcon', 'cave', 'garage', 'exterieur', 'parties_communes', 'autre')
);
