-- ============================================
-- ROLLBACK M16 : Retirer catégorie 'ventilation' de la contrainte CHECK
-- ============================================

BEGIN;

-- DROP contrainte
ALTER TABLE public.tickets 
  DROP CONSTRAINT IF EXISTS check_sous_categorie_valide;

-- Recréer contrainte SANS ventilation (état M08 original)
ALTER TABLE public.tickets 
  ADD CONSTRAINT check_sous_categorie_valide 
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

COMMIT;
